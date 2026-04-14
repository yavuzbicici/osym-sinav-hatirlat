/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Scheme = keyof typeof Colors;

export function useThemeColor(
  props: { light?: string; dark?: string; blue?: string },
  colorName: keyof typeof Colors.light,
) {
  const theme = useColorScheme() as Scheme;
  const colorFromProps = props[theme as keyof typeof props];

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[theme][colorName];
}
