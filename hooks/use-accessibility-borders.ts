import { PixelRatio } from 'react-native';

/** Büyük sistem yazı tipinde kart kenarlıklarını kalınlaştırır (erişilebilirlik). */
export function useStrongCardBorders(): boolean {
  return PixelRatio.getFontScale() >= 1.15;
}
