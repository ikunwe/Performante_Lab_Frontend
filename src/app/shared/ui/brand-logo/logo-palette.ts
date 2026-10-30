function luminance(red: number, green: number, blue: number): number {
  const linear = (value: number) => {
    const color = value / 255;
    return color <= 0.04045 ? color / 12.92 : ((color + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

// Compare three muted tones of the logo's own color against its visible pixels.
// Transparent margins do not influence the result; mixed black/white marks favor a middle tone.
export function pickLogoBackdrop(pixels: ArrayLike<number>): string {
  const samples: { light: number; weight: number }[] = [];
  const color = [0, 0, 0];
  let colorWeight = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.25) continue;
    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    samples.push({ light: luminance(...(rgb as [number, number, number])), weight: alpha });
    const chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;
    if (chroma > 0.15) {
      const weight = alpha * chroma;
      colorWeight += weight;
      for (let channel = 0; channel < 3; channel++) color[channel] += rgb[channel] * weight;
    }
  }
  if (!samples.length) return '#737373';
  const tint = colorWeight ? color.map((value) => value / colorWeight) : [128, 128, 128];
  const tones = [
    tint.map((value) => Math.round(230 + value * 0.06)),
    tint.map((value) => Math.round(17 + value * 0.1)),
    tint.map((value) => Math.round(103 + value * 0.1)),
  ];
  let best = tones[0];
  let bestScore = -Infinity;
  for (const tone of tones) {
    const background = luminance(...(tone as [number, number, number]));
    const score = samples.reduce((total, sample) => {
      const contrast =
        (Math.max(background, sample.light) + 0.05) / (Math.min(background, sample.light) + 0.05);
      return (
        total + sample.weight * (Math.min(contrast / 3, 1) + Math.log(Math.min(contrast, 7)) * 0.01)
      );
    }, 0);
    if (score > bestScore) {
      best = tone;
      bestScore = score;
    }
  }
  return '#' + best.map((value) => value.toString(16).padStart(2, '0')).join('');
}
