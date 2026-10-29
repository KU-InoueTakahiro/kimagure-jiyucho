import test from "node:test";
import assert from "node:assert/strict";
import { SpriteDocument, pack, unpack, layoutOf, flood, linePoints, exportName } from "../pixels.js";
import { samplePixels } from "../sample.js";
const blank = (sheet = false) => new SpriteDocument(sheet ? 576 : 144, sheet ? 384 : 192, sheet ? "sheet" : "single", new Uint8ClampedArray((sheet ? 576 * 384 : 144 * 192) * 4));

test("配置・キャラ番号・コマ境界を検証し、8キャラシートの位置を正しく分離", () => {
  assert.equal(layoutOf(144, 192, "single").cellWidth, 48);
  assert.throws(() => layoutOf(145, 192, "single"));
  assert.throws(() => layoutOf(12288, 8192, "sheet"));
  const d = blank(true); d.setCharacter(5);
  assert.deepEqual(d.rect(11), { x: 240, y: 336, width: 48, height: 48 });
  assert.throws(() => d.setCharacter(8)); assert.throws(() => d.rect(12)); assert.throws(() => d.index(0, 48, 0));
});
test("RGBAの不透明度・1操作のUndo/Redo・Redo分岐・原本不変", () => {
  const d = blank(), c = pack(1, 2, 3, 128), i = d.index(0, 3, 4);
  assert.deepEqual(unpack(c), [1, 2, 3, 128]);
  d.apply(new Map([[i, c], [i + 1, c]]), "stroke");
  assert.equal(d.changedCount(), 2); assert.equal(d.color(i, true), 0);
  d.undo(); assert.equal(d.changedCount(), 0); d.redo(); assert.equal(d.color(i), c);
  d.undo(); d.apply(new Map([[i, pack(8, 9, 10)]]), "branch"); assert.equal(d.redo(), false);
});
test("色置換は選択キャラの選択コマだけ。他キャラと原本は保護", () => {
  const d = blank(true), red = pack(255, 0, 0), blue = pack(0, 0, 255);
  d.setCharacter(7); const i = d.index(0, 0, 0), other = d.index(1, 0, 0);
  d.apply(new Map([[i, red], [other, red], [0, red]]), "setup");
  d.replace(red, blue, [0]);
  assert.equal(d.color(i), blue); assert.equal(d.color(other), red); assert.equal(d.color(0), red); assert.equal(d.color(i, true), 0);
});
test("変更のみコピー・消去コピー・ずらし・端の切り落とし", () => {
  const d = blank(), c = pack(80, 90, 100), target = d.index(1, 0, 0);
  d.apply(new Map([[d.index(0, 1, 2), c], [target, c]]), "source");
  d.copy(0, [1], true, 2, 1);
  assert.equal(d.color(d.index(1, 3, 3)), c); assert.equal(d.color(target), c);
  d.copy(0, [2], true, 128, 0); assert.equal(d.color(d.index(2, 0, 0)), 0);
  d.copy(0, [1], false); assert.equal(d.color(target), 0);
  const raw = new Uint8ClampedArray(144 * 192 * 4); raw.set(unpack(c), 0);
  raw.set(unpack(c), 48 * 4);
  const erased = new SpriteDocument(144, 192, "single", raw);
  erased.apply(new Map([[0, 0]]), "erase"); erased.copy(0, [1], true);
  assert.equal(erased.color(erased.index(1, 0, 0)), 0);
});
test("塗りつぶしは4連結・1コマ内のみ。原本復元も選択キャラ内のみ", () => {
  const d = blank(true), c = pack(3, 4, 5);
  d.setCharacter(3); const changes = flood(d, 0, 0, 0, c);
  assert.equal(changes.size, 48 * 48); d.apply(changes, "fill");
  assert.equal(d.color(d.index(1, 0, 0)), 0); assert.equal(d.color(0), 0);
  d.setCharacter(4); d.apply(new Map([[d.index(0, 0, 0), c]]), "other");
  d.resetCharacter(); assert.equal(d.changedCount(), 48 * 48); d.undo(); assert.equal(d.changedCount(), 48 * 48 + 1);
});
test("線は途切れず・サンプルは12コマ透過・保存名は単体だけ$", () => {
  assert.deepEqual(linePoints([0, 0], [2, 2]), [[0, 0], [1, 1], [2, 2]]);
  const s = samplePixels(), d = new SpriteDocument(s.width, s.height, "single", s.bytes);
  for (let i = 0; i < 12; i++) assert.ok(d.frameBytes(i).some(v => v));
  assert.equal(d.color(0), 0); assert.equal(exportName("$$hero.png", true), "$hero.png");
  assert.equal(exportName("hero.png", false), "hero.png"); assert.equal(exportName("../hero", false), ".._hero.png");
  assert.equal(exportName("CON", false), "_CON.png"); assert.equal(exportName("...", true), "$character.png");
});
test("履歴上限後もUndo/Redoが成立する", () => {
  const d = blank(); for (let n = 1; n <= 105; n++) d.apply(new Map([[0, pack(n, 0, 0)]]), "edit");
  assert.equal(d.history.length, 100); for (let n = 0; n < 100; n++) d.undo();
  assert.equal(unpack(d.color(0))[0], 5); assert.equal(d.color(0, true), 0);
  for (let n = 0; n < 100; n++) d.redo(); assert.equal(unpack(d.color(0))[0], 105);
});
