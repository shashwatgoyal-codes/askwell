/** True when the page behind `el` is dark, judged by the first opaque background up the tree. */
export function isDarkBehind(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    const rgb = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (rgb && rgb.length >= 3 && (rgb[3] ?? 1) > 0.5) {
      const [r, g, b] = rgb as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
