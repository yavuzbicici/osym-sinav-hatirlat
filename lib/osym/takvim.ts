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

import rawManualTakvim from '@/lib/osym/manual-takvim.json';

const OSYM_TAKVIM_URL = 'https://www.osym.gov.tr/TR,8797/takvim.html';

type ManualTakvimRow = { sinav: string; sinavTarihi: string };

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

function toItems(rows: ManualTakvimRow[]): OsymTakvimItem[] {
  const items: OsymTakvimItem[] = rows
    .filter((r) => r?.sinav && r?.sinavTarihi)
    .map((r) => {
      const sinav = String(r.sinav).trim();
      const sinavTarihi = String(r.sinavTarihi).trim();
      const date = parseTrDateFromLine(sinavTarihi);
      return { id: makeId(sinav, sinavTarihi), sinav, sinavTarihi, date };
    });

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
  // Keep signature compatible with callers; no network fetch anymore.
  // If caller passed an AbortSignal and it is already aborted, respect it.
  if (signal?.aborted) {
    throw new Error('İstek iptal edildi');
  }

  const items = toItems(rawManualTakvim as ManualTakvimRow[]);
  return { items, sourceUrl: OSYM_TAKVIM_URL };
}

