// ブラウザにもテストにも依存しない、歩行シートの編集処理。
export const DIRECTIONS = ["下", "左", "右", "上"];
export const pack = (r, g, b, a = 255) => (r | g << 8 | b << 16 | a << 24) >>> 0;
export const unpack = color => [color & 255, color >>> 8 & 255, color >>> 16 & 255, color >>> 24];

export function layoutOf(width, height, type) {
  if (!["single", "sheet"].includes(type)) throw Error("配置を選んでください。");
  const columns = type === "single" ? 3 : 12, rows = type === "single" ? 4 : 8;
  const cellWidth = width / columns, cellHeight = height / rows;
  if (![width, height, cellWidth, cellHeight].every(Number.isInteger) || cellWidth < 8 || cellHeight < 8 || cellWidth > 128 || cellHeight > 128) {
    throw Error(`${columns}列×${rows}行に等分でき、1コマが8〜128pxのPNGを選んでください。`);
  }
  return { width, height, type, columns, rows, cellWidth, cellHeight };
}

export class SpriteDocument {
  constructor(width, height, type, rgba) {
    this.layout = layoutOf(width, height, type);
    if (rgba.length !== width * height * 4) throw Error("画像のデータが不正です。");
    this.original = new Uint8ClampedArray(rgba);
    this.bytes = new Uint8ClampedArray(rgba);
    this.character = 0;
    this.history = [];
    this.cursor = 0;
  }
  setCharacter(index) {
    if (!Number.isInteger(index) || index < 0 || index >= (this.layout.type === "single" ? 1 : 8)) throw Error("キャラ位置が不正です。");
    this.character = index;
  }
  rect(frame) {
    if (!Number.isInteger(frame) || frame < 0 || frame > 11) throw Error("コマ番号が不正です。");
    const { cellWidth: width, cellHeight: height } = this.layout;
    return { x: ((this.character % 4) * 3 + frame % 3) * width, y: (Math.floor(this.character / 4) * 4 + Math.floor(frame / 3)) * height, width, height };
  }
  index(frame, x, y) {
    const r = this.rect(frame);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= r.width || y >= r.height) throw Error("コマの外は編集できません。");
    return (r.y + y) * this.layout.width + r.x + x;
  }
  color(index, original = false) {
    const b = original ? this.original : this.bytes, i = index * 4;
    return pack(b[i], b[i + 1], b[i + 2], b[i + 3]);
  }
  write(index, color) { this.bytes.set(unpack(color), index * 4); }
  apply(changes, label) {
    const patch = [];
    for (const [index, color] of changes) {
      if (!Number.isInteger(index) || index < 0 || index >= this.layout.width * this.layout.height) throw Error("ピクセル位置が不正です。");
      const before = this.color(index);
      if (before !== color) patch.push(index, before, color);
    }
    if (!patch.length) return false;
    this.history.splice(this.cursor);
    const pixels = new Uint32Array(patch);
    for (let i = 0; i < pixels.length; i += 3) this.write(pixels[i], pixels[i + 2]);
    this.history.push({ label, pixels });
    // 最大100操作・約200万ピクセル分。原本は履歴を切っても保持する。
    let size = this.history.reduce((n, entry) => n + entry.pixels.length / 3, 0);
    while (this.history.length > 1 && (this.history.length > 100 || size > 2_000_000)) size -= this.history.shift().pixels.length / 3;
    this.cursor = this.history.length;
    return true;
  }
  undo() {
    if (!this.cursor) return false;
    const { pixels } = this.history[--this.cursor];
    for (let i = 0; i < pixels.length; i += 3) this.write(pixels[i], pixels[i + 1]);
    return true;
  }
  redo() {
    if (this.cursor === this.history.length) return false;
    const { pixels } = this.history[this.cursor++];
    for (let i = 0; i < pixels.length; i += 3) this.write(pixels[i], pixels[i + 2]);
    return true;
  }
  frameBytes(frame, original = false) {
    const r = this.rect(frame), out = new Uint8ClampedArray(r.width * r.height * 4), bytes = original ? this.original : this.bytes;
    for (let y = 0; y < r.height; y++) {
      const offset = ((r.y + y) * this.layout.width + r.x) * 4;
      out.set(bytes.subarray(offset, offset + r.width * 4), y * r.width * 4);
    }
    return out;
  }
  replace(from, to, frames) {
    const changes = new Map();
    for (const frame of frames) {
      const r = this.rect(frame);
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
        const index = this.index(frame, x, y);
        if (this.color(index) === from) changes.set(index, to);
      }
    }
    return this.apply(changes, "色置換");
  }
  copy(source, targets, changedOnly = true, dx = 0, dy = 0) {
    if (![dx, dy].every(Number.isInteger)) throw Error("ずらす量は整数にしてください。");
    const changes = new Map(), r = this.rect(source);
    for (const target of targets) {
      this.rect(target);
      if (target === source) continue;
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
        const index = this.index(source, x, y), color = this.color(index);
        if (changedOnly && color === this.color(index, true)) continue;
        if (x + dx >= 0 && y + dy >= 0 && x + dx < r.width && y + dy < r.height) changes.set(this.index(target, x + dx, y + dy), color);
      }
    }
    return this.apply(changes, "コマへコピー");
  }
  resetCharacter() {
    const changes = new Map();
    for (let frame = 0; frame < 12; frame++) {
      const r = this.rect(frame);
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
        const index = this.index(frame, x, y);
        if (this.color(index) !== this.color(index, true)) changes.set(index, this.color(index, true));
      }
    }
    return this.apply(changes, "選択キャラを原本に戻す");
  }
  changedCount() {
    let count = 0;
    for (let i = 0; i < this.bytes.length; i += 4) if (this.bytes[i] !== this.original[i] || this.bytes[i + 1] !== this.original[i + 1] || this.bytes[i + 2] !== this.original[i + 2] || this.bytes[i + 3] !== this.original[i + 3]) count++;
    return count;
  }
}

export function linePoints(a, b) {
  const points = []; let [x, y] = a;
  const dx = Math.abs(b[0] - x), sx = x < b[0] ? 1 : -1, dy = -Math.abs(b[1] - y), sy = y < b[1] ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    points.push([x, y]); if (x === b[0] && y === b[1]) return points;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

export function flood(document, frame, x, y, color) {
  const r = document.rect(frame), from = document.color(document.index(frame, x, y)), changes = new Map();
  if (from === color) return changes;
  const seen = new Uint8Array(r.width * r.height), queue = [[x, y]];
  while (queue.length) {
    const [px, py] = queue.pop();
    if (px < 0 || py < 0 || px >= r.width || py >= r.height || seen[py * r.width + px]) continue;
    seen[py * r.width + px] = 1;
    const index = document.index(frame, px, py);
    if (document.color(index) !== from) continue;
    changes.set(index, color);
    queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  return changes;
}

export function exportName(value, single) {
  let base = value.replace(/\.png$/i, "").replace(/^\$+/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 80).replace(/[. ]+$/, "") || "character";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = "_" + base;
  return `${single ? "$" : ""}${base}.png`;
}
