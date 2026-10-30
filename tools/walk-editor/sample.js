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
    if (direction === 1 || direction === 2) {
      // 左向きを基準に体を描き、右向きは鏡像に。胴の厚み・前後の腕脚も回す。
      const side = (x, y, w, h, color) => rect(direction === 2 ? 48 - x - w : x, y, w, h, color);
      // 奥の手足 → 胴体 → 手前の手足、の順に重ねる。
      side(25 - leg * 3, 36, 3, 6, colors.ink);
      side(24 - leg * 3, 41, 5, 2, colors.ink);
      side(23 + leg * 3, 27, 3, 8, colors.ink);
      side(23 + leg * 3, 33, 3, 2, colors.copper);
      side(20, 26, 10, 11, colors.ink);
      side(21, 27, 8, 8, colors.body);
      side(21, 27, 1, 7, colors.light);
      side(21, 29, 1, 4, colors.copper);
      side(28, 28, 1, 6, colors.ink);
      side(23 + leg * 3, 36, 3, 6, colors.ink);
      side(22 + leg * 3, 41, 5, 2, colors.copper);
      side(24 - leg * 3, 28, 3, 8, colors.ink);
      side(24 - leg * 3, 34, 3, 2, colors.copper);
      side(24, 27, 2, 2, colors.copper);
    } else {
      rect(18, 26, 12, 11, colors.ink); rect(19, 27, 10, 8, colors.body);
      if (direction === 0) {
        // 正面のデザインは従来通り。
        rect(22, 28, 4, 4, colors.copper);
        rect(14, 27 + leg, 3, 8, colors.ink); rect(31, 27 - leg, 3, 8, colors.ink);
        rect(19, 37, 4, 5 + leg, colors.ink); rect(25, 37, 4, 5 - leg, colors.ink);
        rect(18, 41 + leg, 6, 2, colors.copper); rect(24, 41 - leg, 6, 2, colors.copper);
      } else {
        // 背面には胸のパネルを描かず、継ぎ目・排気スリット・小さな接続部を置く。
        rect(23, 28, 2, 6, colors.ink);
        rect(21, 29, 6, 1, colors.ink); rect(21, 32, 6, 1, colors.ink);
        rect(23, 27, 2, 1, colors.copper);
        rect(14, 27 - leg, 3, 8, colors.ink); rect(31, 27 + leg, 3, 8, colors.ink);
        rect(19, 37, 4, 5 - leg, colors.ink); rect(25, 37, 4, 5 + leg, colors.ink);
        rect(19, 41 - leg, 4, 2, colors.copper); rect(25, 41 + leg, 4, 2, colors.copper);
      }
    }
  }
  return { width, height, bytes };
}
