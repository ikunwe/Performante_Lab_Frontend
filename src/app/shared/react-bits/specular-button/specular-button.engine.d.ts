export interface SpecularOptions {
  lineColor: string;
  reducedMotion: boolean;
}
export function mountSpecularButton(
  button: HTMLButtonElement,
  canvas: HTMLCanvasElement,
  options: SpecularOptions,
): (() => void) | undefined;
