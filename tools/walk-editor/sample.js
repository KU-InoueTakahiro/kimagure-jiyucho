// 公開用のオリジナルサンプル。ゲーム素材や個人用データは使用しない。
import { pack, unpack } from "./pixels.js";
export function samplePixels() {
  const width = 144, height = 192, bytes = new Uint8ClampedArray(width * height * 4);
  const colors = { ink: pack(62, 77, 77), body: pack(158, 199, 198), light: pack(221, 233, 213), copper: pack(185, 126, 98) };
  function box(fx, fy, x, y, w, h, color) {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) bytes.set(unpack(color), ((fy + py) * width + fx + px) * 4);
  }
  for (let direction = 0; direction < 4; direction++) for (let step = 0; step < 3; step++) {
    const fx = step * 48, fy = direction * 48, bounce = step === 1 ? 0 : 1, leg = step - 1;
    const rect = (x, y, w, h, color) => box(fx, fy, x, y + bounce, w, h, color);
    rect(23, 4, 2, 5, colors.ink); rect(22, 3, 4, 3, colors.copper);
    rect(15, 10, 18, 14, colors.ink); rect(16, 9, 16, 16, colors.ink); rect(17, 11, 14, 12, colors.body);
    if (direction !== 3) {
      rect(direction === 1 ? 17 : direction === 2 ? 23 : 18, 14, direction % 3 ? 8 : 12, 6, colors.ink);
      if (direction === 0) { rect(20, 16, 2, 2, colors.light); rect(26, 16, 2, 2, colors.light); }
      else rect(direction === 1 ? 18 : 28, 16, 2, 2, colors.light);
    } else rect(20, 14, 8, 5, colors.light);
    rect(18, 26, 12, 11, colors.ink); rect(19, 27, 10, 8, colors.body); rect(22, 28, 4, 4, colors.copper);
    rect(14, 27 + leg, 3, 8, colors.ink); rect(31, 27 - leg, 3, 8, colors.ink);
    rect(19, 37, 4, 5 + leg, colors.ink); rect(25, 37, 4, 5 - leg, colors.ink);
    rect(18, 41 + leg, 6, 2, colors.copper); rect(24, 41 - leg, 6, 2, colors.copper);
  }
  return { width, height, bytes };
}
