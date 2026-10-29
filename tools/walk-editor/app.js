import { SpriteDocument, DIRECTIONS, pack, unpack, linePoints, flood, exportName, layoutOf } from "./pixels.js";
import { samplePixels } from "./sample.js";

const $ = id => document.getElementById(id);
const frames = Array.from({ length: 12 }, (_, i) => i);
let sprite, savedBytes, frame = 1, tool = "pencil", view = "working", drawing = null;
let color = pack(86, 123, 123), dirty = false, loading = false, editRevision = 0;
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches, lastPreview = "", keyX = 0, keyY = 0;
const selected = new Set(), frameButtons = [], thumbnails = [];
const scratch = document.createElement("canvas");
const description = i => `${DIRECTIONS[Math.floor(i / 3)]}向き・${i % 3 + 1}コマ目`;
const hex = value => "#" + unpack(value).map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("is-error", error);
}
function run(action) {
  if (loading) return;
  try { endStroke(); action(); } catch (error) { notice(error.message, true); }
}
function parseColor(value) {
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) throw Error("色は #RRGGBB または #RRGGBBAA で入力してください。");
  const values = value.slice(1).match(/../g).map(v => parseInt(v, 16));
  return pack(values[0], values[1], values[2], values[3] ?? 255);
}
function setColor(next, keepInput = false) {
  color = next;
  $("color").value = hex(next).slice(0, 7);
  if (!keepInput) $("rgba").value = hex(next);
  $("alpha").value = unpack(next)[3];
  $("alpha-value").value = `${Math.round(unpack(next)[3] / 255 * 100)}%`;
}
function selectTool(next) {
  tool = next;
  for (const button of document.querySelectorAll("[data-tool]")) button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
}
function canReplaceDocument() {
  return !dirty || confirm("保存していない編集があります。必要なPNGは保存しましたか？ 別の画像に切り替えると、このタブの編集履歴は消えます。");
}
function install(width, height, type, bytes, name) {
  sprite = new SpriteDocument(width, height, type, bytes);
  savedBytes = sprite.original;
  editRevision++; frame = 1; drawing = null; selected.clear(); dirty = false; keyX = 0; keyY = 0;
  $("character").replaceChildren();
  for (let i = 0; i < (type === "sheet" ? 8 : 1); i++) {
    const option = document.createElement("option");
    option.value = i; option.textContent = type === "single" ? "単体キャラ" : `${i + 1}：${i < 4 ? "上段" : "下段"}・左から${i % 4 + 1}番目`;
    $("character").append(option);
  }
  $("character").disabled = type === "single";
  $("document-name").textContent = name;
  $("coordinate").textContent = "x: — / y: —";
  $("export-name").value = name.replace(/\.png$/i, "").replace(/^\$/, "") + "_edited";
  $("export-layout").value = type === "sheet" ? "sheet" : "single";
  $("direction").value = "0";
  setView("working");
  refresh();
}
function loadSample(ask = true) {
  if (ask && !canReplaceDocument()) return;
  const sample = samplePixels();
  install(sample.width, sample.height, "single", sample.bytes, "sample_robot.png");
  notice("オリジナルのロボットを読み込みました。自由に編集・保存して試せます。");
}

// ファイルの先頭で寸法・配置を検証してから展開し、大きすぎる画像を防ぐ。
async function importFile(file) {
  if (loading || !file) return;
  endStroke();
  loading = true;
  $("open-file").disabled = true;
  try {
    if (!file.size || file.size > 8 * 1024 * 1024) throw Error("8MB以下のPNGファイルを選んでください。");
    const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    if (header.length < 24 || [137, 80, 78, 71, 13, 10, 26, 10].some((byte, i) => header[i] !== byte)) throw Error("PNGファイルを選んでください。拡張子だけ変更した画像は使えません。");
    const data = new DataView(header.buffer), width = data.getUint32(16), height = data.getUint32(20);
    const chosen = $("import-layout").value, type = chosen === "auto" ? (file.name.startsWith("$") ? "single" : "sheet") : chosen;
    layoutOf(width, height, type);
    if (!canReplaceDocument()) return;
    notice("PNGを読み込んでいます…");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth !== width || image.naturalHeight !== height) throw Error("PNGの寸法を読み取れませんでした。");
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
      install(width, height, type, context.getImageData(0, 0, width, height).data, file.name);
      notice(`${file.name} を読み込みました。${type === "sheet" ? "編集するキャラ位置を選んでください。" : "12コマを編集できます。"}`);
    } finally { URL.revokeObjectURL(url); }
  } catch (error) { notice(error.message || "画像を読み込めませんでした。別のPNGでお試しください。", true); }
  finally { loading = false; $("open-file").disabled = false; $("file").value = ""; }
}

function frameImage(index, mode = "working") {
  const { width, height } = sprite.rect(index);
  const bytes = sprite.frameBytes(index, mode === "original");
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const id = sprite.index(index, x, y), offset = (y * width + x) * 4;
    if (mode === "diff") bytes.set(sprite.color(id) === sprite.color(id, true) ? [0, 0, 0, 0] : [166, 78, 58, 225], offset);
    else if (mode !== "original" && drawing?.changes.has(id)) bytes.set(unpack(drawing.changes.get(id)), offset);
  }
  scratch.width = width; scratch.height = height;
  scratch.getContext("2d").putImageData(new ImageData(bytes, width, height), 0, 0);
  return scratch;
}
function drawCanvas(canvas, index, mode, zoom) {
  const r = sprite.rect(index), image = frameImage(index, mode);
  canvas.width = r.width * zoom; canvas.height = r.height * zoom;
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ($( "grid").checked && zoom >= 4) {
    ctx.strokeStyle = "#697e752e"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = .5; x < canvas.width; x += zoom) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = .5; y < canvas.height; y += zoom) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
  }
  if (canvas.id === "editor" && document.activeElement === canvas) {
    ctx.strokeStyle = "#345e6c"; ctx.lineWidth = 2;
    ctx.strokeRect(keyX * zoom + 1, keyY * zoom + 1, zoom - 2, zoom - 2);
  }
}
function draw() {
  if (!sprite) return;
  const zoom = Number($("zoom").value);
  $("zoom-value").value = `${zoom}×`;
  $("canvas-label").textContent = description(frame) + (view === "original" ? " / 原本" : view === "diff" ? " / 変更ドットのみ" : "");
  $("comparison").hidden = view !== "compare";
  drawCanvas($("editor"), frame, view === "compare" ? "working" : view, zoom);
  if (view === "compare") drawCanvas($("original-canvas"), frame, "original", zoom);
}
function setView(next) {
  endStroke(); view = next;
  for (const button of document.querySelectorAll("[data-view]")) button.setAttribute("aria-pressed", String(button.dataset.view === view));
  draw();
}
function updateFrames() {
  for (const index of frames) {
    const canvas = thumbnails[index], image = frameImage(index);
    canvas.width = image.width; canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    frameButtons[index].setAttribute("aria-pressed", String(index === frame));
    frameButtons[index].parentElement.classList.toggle("is-current", index === frame);
    $("frame-check-" + index).checked = selected.has(index);
  }
}
function updatePalette() {
  const counts = new Map();
  for (const index of frames) {
    const bytes = sprite.frameBytes(index);
    for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3]) {
      const value = pack(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  $("palette").replaceChildren();
  for (const [value] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 48)) {
    const button = document.createElement("button"); button.type = "button"; button.className = "swatch";
    button.style.backgroundColor = hex(value); button.title = hex(value); button.setAttribute("aria-label", `${hex(value)}を描画色と置換元に選ぶ`);
    button.onclick = () => { setColor(value); $("replace-from").value = hex(value); };
    $("palette").append(button);
  }
  $("palette-note").textContent = counts.size > 48 ? `${counts.size}色のうち、使用量の多い48色を表示。ほかの色はスポイトで選べます。` : "";
}
function exportSize() {
  const { width, height, cellWidth, cellHeight } = sprite.layout, single = $("export-layout").value === "single";
  $("export-size").textContent = `${single ? cellWidth * 3 : width} × ${single ? cellHeight * 4 : height}px・透過PNG・等倍${single ? "・ファイル名の先頭に $" : ""}`;
}
function refresh() {
  const l = sprite.layout;
  $("document-info").textContent = `${l.width} × ${l.height}px / 1コマ ${l.cellWidth} × ${l.cellHeight}px`;
  $("undo").disabled = sprite.cursor === 0; $("redo").disabled = sprite.cursor === sprite.history.length;
  $("change-count").textContent = `変更 ${sprite.changedCount().toLocaleString()}ドット（シート全体）`;
  updateFrames(); updatePalette(); draw(); exportSize(); lastPreview = "";
}
function changed(result, message) {
  if (result) {
    editRevision++;
    dirty = false;
    for (let i = 0; i < sprite.bytes.length; i++) if (sprite.bytes[i] !== savedBytes[i]) { dirty = true; break; }
  }
  refresh(); notice(result ? message : "対象のドットに変化はありませんでした。");
}

// 1ストロークを1回のUndoにする。描画途中は元データに確定しない。
function position(event) {
  const bounds = $("editor").getBoundingClientRect(), r = sprite.rect(frame);
  return [Math.max(0, Math.min(r.width - 1, Math.floor((event.clientX - bounds.left) / bounds.width * r.width))), Math.max(0, Math.min(r.height - 1, Math.floor((event.clientY - bounds.top) / bounds.height * r.height)))];
}
function editable() { return !loading && !["original", "diff"].includes(view); }
function endStroke() {
  if (!drawing) return;
  const current = drawing; drawing = null;
  changed(sprite.apply(current.changes, current.label), "ドットを編集しました。PNGで保存すると持ち出せます。");
}
$("editor").addEventListener("pointerdown", event => {
  if (!editable() || event.button !== 0) return;
  event.preventDefault(); $("editor").focus({ preventScroll: true });
  const [x, y] = position(event); keyX = x; keyY = y;
  if (tool === "pick") { setColor(sprite.color(sprite.index(frame, x, y))); $("replace-from").value = hex(color); draw(); return; }
  if (tool === "fill") { changed(sprite.apply(flood(sprite, frame, x, y, color), "塗りつぶし"), "つながった同じ色のドットを塗りつぶしました。"); return; }
  drawing = { changes: new Map([[sprite.index(frame, x, y), tool === "eraser" ? 0 : color]]), last: [x, y], label: tool === "eraser" ? "消しゴム" : "鉛筆", color: tool === "eraser" ? 0 : color };
  $("editor").setPointerCapture(event.pointerId); draw();
});
$("editor").addEventListener("pointermove", event => {
  if (!sprite) return;
  const [x, y] = position(event); $("coordinate").textContent = `x: ${x} / y: ${y}`;
  if (!drawing) return;
  for (const [px, py] of linePoints(drawing.last, [x, y])) drawing.changes.set(sprite.index(frame, px, py), drawing.color);
  drawing.last = [x, y]; draw();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) $("editor").addEventListener(event, endStroke);
$("editor").addEventListener("focus", draw);
$("editor").addEventListener("blur", () => { endStroke(); draw(); });
$("editor").addEventListener("keydown", event => {
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, r = sprite.rect(frame);
  if (moves[event.key]) {
    event.preventDefault(); keyX = Math.max(0, Math.min(r.width - 1, keyX + moves[event.key][0])); keyY = Math.max(0, Math.min(r.height - 1, keyY + moves[event.key][1]));
    $("coordinate").textContent = `x: ${keyX} / y: ${keyY}`; draw();
  } else if (["Enter", " "].includes(event.key)) {
    event.preventDefault(); if (!editable()) return;
    if (tool === "pick") { setColor(sprite.color(sprite.index(frame, keyX, keyY))); $("replace-from").value = hex(color); return; }
    const changes = tool === "fill" ? flood(sprite, frame, keyX, keyY, color) : new Map([[sprite.index(frame, keyX, keyY), tool === "eraser" ? 0 : color]]);
    changed(sprite.apply(changes, "キーボード編集"), "ドットを編集しました。");
  }
});

for (const index of frames) {
  if (index % 3 === 0) {
    const label = document.createElement("span"); label.className = "direction-label"; label.textContent = DIRECTIONS[index / 3]; $("frames").append(label);
  }
  const cell = document.createElement("div"); cell.className = "frame-cell";
  const button = document.createElement("button"); button.type = "button"; button.className = "frame-button"; button.setAttribute("aria-label", description(index) + "を編集");
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  const label = document.createElement("span"); label.textContent = `${index % 3 + 1}コマ目`;
  button.append(canvas, label);
  button.onclick = () => { endStroke(); frame = index; $("direction").value = Math.floor(index / 3); lastPreview = ""; updateFrames(); draw(); };
  const checkLabel = document.createElement("label"), checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.id = "frame-check-" + index; checkbox.setAttribute("aria-label", description(index) + "をまとめて編集する対象に選ぶ");
  checkbox.onchange = () => checkbox.checked ? selected.add(index) : selected.delete(index);
  checkLabel.append(checkbox); cell.append(button, checkLabel); $("frames").append(cell); frameButtons.push(button); thumbnails.push(canvas);
}

$("open-file").onclick = () => $("file").click();
$("file").onchange = () => importFile($("file").files[0]);
$("sample").onclick = () => run(() => loadSample());
$("new-file").onclick = () => run(() => $("new-dialog").showModal());
$("cancel-new").onclick = () => $("new-dialog").close();
$("new-form").onsubmit = event => {
  event.preventDefault(); if (!canReplaceDocument()) return;
  const size = Number($("new-size").value);
  install(size * 3, size * 4, "single", new Uint8ClampedArray(size * 3 * size * 4 * 4), "$new_character.png");
  $("new-dialog").close(); notice("透明な白紙をひらきました。12コマに少しずつ描いてみましょう。");
};
$("character").onchange = () => run(() => { sprite.setCharacter(Number($("character").value)); selected.clear(); refresh(); notice("編集するキャラを切り替えました。他のキャラの編集内容も保持しています。"); });
for (const button of document.querySelectorAll("[data-tool]")) button.onclick = () => run(() => selectTool(button.dataset.tool));
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => run(() => setView(button.dataset.view));
$("color").oninput = () => setColor(parseColor($("color").value + unpack(color)[3].toString(16).padStart(2, "0")));
$("rgba").oninput = () => {
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test($("rgba").value)) setColor(parseColor($("rgba").value), true);
};
$("rgba").onchange = () => run(() => { try { setColor(parseColor($("rgba").value)); } catch (error) { $("rgba").value = hex(color); throw error; } });
$("alpha").oninput = () => { const [r, g, b] = unpack(color); setColor(pack(r, g, b, Number($("alpha").value))); };
$("grid").onchange = draw;
$("zoom").oninput = draw;
$("undo").onclick = () => run(() => changed(sprite.undo(), "ひとつ前の編集に戻しました。"));
$("redo").onclick = () => run(() => changed(sprite.redo(), "編集をやり直しました。"));
$("reset").onclick = () => run(() => { if (confirm("選択キャラの12コマを原本に戻します。他のキャラは変更しません。この操作は「戻す」で取り消せます。")) changed(sprite.resetCharacter(), "選択キャラを原本に戻しました。"); });
$("replace").onclick = () => run(() => {
  const scope = $("replace-scope").value, targets = scope === "all" ? frames : scope === "selected" ? [...selected] : [frame];
  if (!targets.length) throw Error("置換する対象のコマにチェックを入れてください。");
  changed(sprite.replace(parseColor($("replace-from").value), color, targets), "対象のコマの色を置き換えました。");
});
$("copy").onclick = () => run(() => {
  const targets = [...selected].filter(index => index !== frame);
  if (!targets.length) throw Error("コピー先のコマにチェックを入れてください。今のコマ以外を選びます。");
  if (!$("dx").value.trim() || !$("dy").value.trim()) throw Error("XとYに整数を入力してください。");
  const dx = Number($("dx").value), dy = Number($("dy").value);
  if (![dx, dy].every(value => Number.isInteger(value) && Math.abs(value) <= 128)) throw Error("XとYは−128〜128の整数にしてください。");
  changed(sprite.copy(frame, targets, $("changed-only").checked, dx, dy), "チェックしたコマへコピーしました。動きと輪郭も確認してください。");
});

function setPlayButton() { $("play").textContent = playing ? "一時停止" : "再生"; $("play").setAttribute("aria-pressed", String(playing)); }
$("play").onclick = () => { playing = !playing; setPlayButton(); lastPreview = ""; };
$("direction").onchange = () => { lastPreview = ""; };
$("fps").oninput = () => { $("fps-value").value = $("fps").value; lastPreview = ""; };
function animate(time) {
  if (sprite && !document.hidden) {
    const step = playing ? [1, 2, 1, 0][Math.floor(time / 1000 * Number($("fps").value)) % 4] : 1;
    const index = Number($("direction").value) * 3 + step, key = `${index}/${sprite.character}`;
    if (lastPreview !== key || drawing) {
      lastPreview = key;
      const ctx = $("preview").getContext("2d"), image = frameImage(index), zoom = Math.max(1, Math.floor(144 / Math.max(image.width, image.height)));
      ctx.clearRect(0, 0, 160, 160); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, Math.floor((160 - image.width * zoom) / 2), Math.floor((160 - image.height * zoom) / 2), image.width * zoom, image.height * zoom);
    }
  }
  requestAnimationFrame(animate);
}

$("export-layout").onchange = exportSize;
$("export").onclick = () => run(() => {
  const single = $("export-layout").value === "single", l = sprite.layout, canvas = document.createElement("canvas"), revision = editRevision;
  const fullSnapshot = !single || l.type === "single" ? new Uint8ClampedArray(sprite.bytes) : null;
  canvas.width = single ? l.cellWidth * 3 : l.width; canvas.height = single ? l.cellHeight * 4 : l.height;
  const ctx = canvas.getContext("2d");
  if (single) for (const index of frames) ctx.putImageData(new ImageData(sprite.frameBytes(index), l.cellWidth, l.cellHeight), index % 3 * l.cellWidth, Math.floor(index / 3) * l.cellHeight);
  else ctx.putImageData(new ImageData(new Uint8ClampedArray(sprite.bytes), l.width, l.height), 0, 0);
  const name = exportName($("export-name").value, single || l.type === "single");
  canvas.toBlob(blob => {
    if (!blob) { notice("PNGの生成に失敗しました。もう一度お試しください。", true); return; }
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (revision === editRevision && fullSnapshot) { savedBytes = fullSnapshot; dirty = false; }
    notice(`${name} の保存を開始しました。${single && l.type === "sheet" ? "ほかのキャラの編集も残す場合はシート全体を保存してください。" : "ブラウザのダウンロード先を確認してください。"}`);
  }, "image/png");
});

document.addEventListener("keydown", event => {
  if (document.querySelector("dialog[open]") || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) || loading) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault(); run(() => changed(event.shiftKey ? sprite.redo() : sprite.undo(), event.shiftKey ? "編集をやり直しました。" : "ひとつ前の編集に戻しました。")); return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const next = { b: "pencil", e: "eraser", i: "pick", g: "fill" }[event.key.toLowerCase()];
  if (next) { event.preventDefault(); run(() => selectTool(next)); }
});
document.addEventListener("dragover", event => { event.preventDefault(); document.body.classList.add("is-dragging"); });
document.addEventListener("dragleave", event => { if (!event.relatedTarget) document.body.classList.remove("is-dragging"); });
document.addEventListener("drop", event => {
  event.preventDefault(); document.body.classList.remove("is-dragging");
  if (event.dataTransfer.files.length > 1) { notice("PNGは1枚ずつ読み込んでください。", true); return; }
  importFile(event.dataTransfer.files[0]);
});
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
$("year").textContent = new Date().getFullYear();
$("zoom").value = matchMedia("(max-width: 650px)").matches ? "4" : "8";
setColor(color); setPlayButton(); loadSample(false); requestAnimationFrame(animate);
