import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  blueColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, blueColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor, blue: blueColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
