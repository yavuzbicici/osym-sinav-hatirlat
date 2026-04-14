import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

const STORAGE_KEY = '@osym_app_theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark' | 'blue';

export type ResolvedScheme = 'light' | 'dark' | 'blue';

type Ctx = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  resolved: ResolvedScheme;
};

const AppThemeCtx = createContext<Ctx | null>(null);

function resolveScheme(pref: ThemePreference, system: ColorSchemeName | null | undefined): ResolvedScheme {
  if (pref === 'system') return system === 'dark' ? 'dark' : 'light';
  if (pref === 'blue') return 'blue';
  return pref;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPrefState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | null | undefined>(() =>
    Appearance.getColorScheme(),
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v === 'system' || v === 'light' || v === 'dark' || v === 'blue') {
          setPrefState(v);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPrefState(p);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const resolved = useMemo(
    () => resolveScheme(preference, systemScheme),
    [preference, systemScheme],
  );

  const value = useMemo(
    () => ({ preference, setPreference, resolved }),
    [preference, setPreference, resolved],
  );

  return <AppThemeCtx.Provider value={value}>{children}</AppThemeCtx.Provider>;
}

export function useAppTheme(): Ctx {
  const ctx = useContext(AppThemeCtx);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

/** Uygulama paleti: `light` | `dark` | `blue` (mavi açık tema). */
export function useColorScheme(): ResolvedScheme {
  const ctx = useContext(AppThemeCtx);
  if (!ctx) return 'light';
  return ctx.resolved;
}
