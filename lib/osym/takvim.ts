export type OsymTakvimItem = {
  /** Stable-ish key computed from exam name + date */
  id: string;
  /** "SINAV" (as displayed) */
  sinav: string;
  /** "SINAV TARİHİ" (as displayed) */
  sinavTarihi: string;
  /** Parsed Date if we can confidently parse it (TR format) */
  date?: Date;
};

const OSYM_TAKVIM_URL = 'https://www.osym.gov.tr/TR,8797/takvim.html';
const OSYM_TAKVIM_FALLBACK_URL = 'https://r.jina.ai/https://www.osym.gov.tr/TR,8797/takvim.html';

function decodeHtmlEntities(input: string) {
  return input
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&uuml;', 'ü')
    .replaceAll('&Uuml;', 'Ü')
    .replaceAll('&ouml;', 'ö')
    .replaceAll('&Ouml;', 'Ö')
    .replaceAll('&ccedil;', 'ç')
    .replaceAll('&Ccedil;', 'Ç')
    .replaceAll('&scedil;', 'ş')
    .replaceAll('&Scedil;', 'Ş')
    .replaceAll('&iacute;', 'í')
    .replaceAll('&Iacute;', 'Í')
    .replaceAll('&acirc;', 'â')
    .replaceAll('&Acirc;', 'Â')
    .replaceAll('&rsquo;', '’')
    .replaceAll('&lsquo;', '‘')
    .replaceAll('&ldquo;', '“')
    .replaceAll('&rdquo;', '”');
}

function htmlToText(html: string) {
  const withLineBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*tr\s*>/gi, '\n')
    .replace(/<\/\s*li\s*>/gi, '\n');

  const stripped = withLineBreaks.replace(/<[^>]*>/g, '');
  const decoded = decodeHtmlEntities(stripped);

  return decoded
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

function parseTrDateFromLine(line: string): Date | undefined {
  // Supports "20.06.2026 10:15" or "31.01.2026 13:45" or "07.03.2026"
  const m = line.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const hh = m[4] ? Number(m[4]) : 0;
  const min = m[5] ? Number(m[5]) : 0;
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return;
  return new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
}

function makeId(sinav: string, sinavTarihi: string) {
  const base = `${sinav}__${sinavTarihi}`.toLowerCase().trim();
  // Lightweight stable hash-ish (no crypto).
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) | 0;
  }
  return `osym_${Math.abs(h)}`;
}

function extractTdContents(trHtml: string) {
  const tds = trHtml.match(/<\s*td\b[\s\S]*?<\/\s*td\s*>/gi) ?? [];
  return tds.map((td) => td);
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function parseFromTable(html: string): OsymTakvimItem[] {
  const items: OsymTakvimItem[] = [];
  const trs = html.match(/<\s*tr\b[\s\S]*?<\/\s*tr\s*>/gi) ?? [];

  for (const tr of trs) {
    const tds = extractTdContents(tr);
    if (tds.length < 2) continue;

    const colSinav = htmlToText(tds[0]);
    const colTarih = htmlToText(tds[1]);

    // Skip header row(s)
    if (/^SINAV$/i.test(normalizeWhitespace(colSinav)) && /SINAV TARİHİ/i.test(colTarih)) continue;

    // First column typically starts with a short code like "YKS" or "e-YDS"
    // but may also contain longer titles. We take the first non-empty line.
    const sinavLine = colSinav.split('\n').map((l) => l.trim()).filter(Boolean)[0];
    if (!sinavLine) continue;

    // Second column contains "Sınav Tarihi:" and then the date line.
    const tarihLines = colTarih.split('\n').map((l) => l.trim()).filter(Boolean);
    const idx = tarihLines.findIndex((l) => /^Sınav Tarihi:?$/i.test(l));
    const sinavTarihi = idx >= 0 ? tarihLines[idx + 1] : tarihLines.find((l) => /\d{2}\.\d{2}\.\d{4}/.test(l));
    if (!sinavTarihi) continue;

    const sinav = normalizeWhitespace(sinavLine);
    const date = parseTrDateFromLine(sinavTarihi);
    const id = makeId(sinav, sinavTarihi);

    if (items.some((x) => x.id === id)) continue;
    items.push({ id, sinav, sinavTarihi, date });
  }

  return items;
}

export function parseOsymTakvim(html: string): OsymTakvimItem[] {
  // 1) Prefer parsing the actual table columns (SINAV + SINAV TARİHİ)
  const fromTable = parseFromTable(html);
  const items: OsymTakvimItem[] = fromTable.length ? fromTable : [];

  // 2) Fallback heuristic if table parsing fails (page markup changed)
  if (!items.length) {
    const text = htmlToText(html);
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (!/^Sınav Tarihi:?$/i.test(lines[i])) continue;

      const dateLine = lines[i + 1];
      if (!dateLine) continue;

      let sinav = '';
      for (let back = 1; back <= 15; back++) {
        const candidate = lines[i - back];
        if (!candidate) break;

        if (
          /^(SINAV|SINAVLAR|Tüm Sınavlar|Başvuru Tarihleri|Geç Başvuru Günü|Sonuç Tarihi)/i.test(
            candidate,
          )
        )
          continue;
        if (/^\d{2}\.\d{2}\.\d{4}/.test(candidate)) continue;
        if (candidate.length > 80) continue;

        const looksLikeCode =
          /^[A-Za-zĞÜŞİÖÇğüşiöç0-9][A-Za-zĞÜŞİÖÇğüşiöç0-9\-\/ ]{1,20}$/.test(candidate);
        if (looksLikeCode) {
          sinav = candidate;
          break;
        }

        if (!sinav) sinav = candidate;
      }

      if (!sinav) continue;

      const sinavTarihi = dateLine;
      const date = parseTrDateFromLine(dateLine);
      const id = makeId(sinav, sinavTarihi);
      if (items.some((x) => x.id === id)) continue;
      items.push({ id, sinav, sinavTarihi, date });
    }
  }

  // Sort: parsed date asc first, then fallback lexicographic
  items.sort((a, b) => {
    const ad = a.date?.getTime();
    const bd = b.date?.getTime();
    if (ad != null && bd != null) return ad - bd;
    if (ad != null) return -1;
    if (bd != null) return 1;
    return a.sinavTarihi.localeCompare(b.sinavTarihi, 'tr');
  });

  return items;
}

export async function fetchOsymTakvim(signal?: AbortSignal) {
  const tryFetch = async (url: string) => {
    const res = await fetch(url, {
      method: 'GET',
      signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        // Some servers reject requests without a UA; harmless if ignored.
        'User-Agent': 'Mozilla/5.0 (compatible; osym-sinav-hatirtlat/1.0)',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
  };

  let html: string | null = null;
  let usedFallback = false;

  try {
    html = await tryFetch(OSYM_TAKVIM_URL);
  } catch {
    usedFallback = true;
    html = await tryFetch(OSYM_TAKVIM_FALLBACK_URL);
  }

  const items = parseOsymTakvim(html);
  if (!items.length) {
    throw new Error('ÖSYM takviminden veri okunamadı (sayfa yapısı değişmiş olabilir).');
  }

  return {
    items,
    sourceUrl: OSYM_TAKVIM_URL,
    ...(usedFallback ? { fetchedVia: 'fallback' as const } : {}),
  };
}

