import { LIMITS, uniqueBaseName, formatSize, formatDuration, sniffFormat, audioFilters } from "./audio-utils.js";
import { loadFFmpegClass, engineAssets, probeAudio } from "./engine.js";
import { createZip } from "./archive.js";

const $ = selector => document.querySelector(selector);
const ui = {
  input: $("#file-input"), choose: $("#choose-files"), drop: $("#drop-zone"),
  chooseLabel: $("#choose-files-label"), selection: $("#selection-status"), selectionJump: $("#selection-jump"),
  list: $("#file-list"), empty: $("#queue-empty"), count: $("#file-count"), notice: $("#file-notice"),
  convert: $("#convert"), cancel: $("#cancel"), clear: $("#clear-files"), zip: $("#download-zip"),
  options: $("#options"), status: $("#engine-status"), progress: $("#total-progress"),
  summary: $("#queue-summary"), saveHint: $("#save-hint"), template: $("#file-template"),
};
let items = [];
let nextId = 1;
let engine;
let busy = false;
let adding = false;
let stopRequested = false;
let zipBusy = false;
let activeItem = null;
let activePhase = 0;
let processed = 0;
let batchLength = 0;

const stateLabels = { waiting: "待機中", preparing: "形式を確認中", ogg: "OGGに変換中", m4a: "M4Aに変換中", done: "変換できました", error: "変換できませんでした", stopped: "中断しました" };
const finished = () => items.filter(item => item.status === "done");
const pending = () => items.filter(item => ["waiting", "error", "stopped"].includes(item.status));

function notice(text) {
  ui.notice.textContent = text;
  ui.notice.hidden = !text;
}

function status(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("is-error", isError);
}

function refreshControls() {
  const done = finished().length;
  const locked = busy || adding || zipBusy;
  ui.choose.disabled = locked;
  ui.input.disabled = locked;
  ui.clear.disabled = locked || !items.length;
  ui.options.disabled = locked;
  ui.convert.disabled = locked || !pending().length;
  ui.convert.textContent = done && pending().length ? "残りを変換 →" : "まとめて変換 →";
  ui.cancel.hidden = !busy;
  ui.cancel.disabled = stopRequested;
  ui.zip.disabled = locked || !done;
  ui.count.textContent = `${items.length}件`;
  // 02へスクロールしなくても、01で追加済み件数を確認できるようにする。
  const selectionText = adding ? "音声を追加しています…" : items.length ? `${items.length}件選択済み` : "音声はまだ選択されていません";
  if (ui.selection.textContent !== selectionText) ui.selection.textContent = selectionText;
  ui.selectionJump.hidden = !items.length;
  ui.drop.classList.toggle("has-selection", !!items.length);
  ui.chooseLabel.textContent = items.length ? "音声を追加する" : "音声ファイルを選ぶ";
  ui.empty.hidden = !!items.length;
  ui.summary.textContent = items.length ? `${done} / ${items.length}件が完了・入力合計 ${formatSize(items.reduce((total, item) => total + item.file.size, 0))}` : "ogg と m4a を、それぞれ生成します。";
  ui.saveHint.textContent = done ? `${done}音源・${done * 2}ファイルを、フォルダなしでZIPの直下に保存します。` : "変換が終わると、ZIPでまとめて保存できます。";
  for (const item of items) {
    item.element.querySelector(".remove-file").disabled = locked;
    item.element.querySelector(".output-name").disabled = locked;
  }
}

function setItemState(item, next, error = "") {
  item.status = next;
  item.element.dataset.status = next;
  item.element.querySelector(".audio-status").textContent = stateLabels[next];
  const message = item.element.querySelector(".audio-error");
  message.textContent = error;
  message.hidden = !error;
  const progress = item.element.querySelector(".file-progress");
  progress.hidden = !["preparing", "ogg", "m4a"].includes(next);
  if (next === "preparing") progress.removeAttribute("value");
  refreshControls();
}

function updateNames(item) {
  const input = item.element.querySelector(".output-name");
  const requested = input.value;
  item.base = uniqueBaseName(requested, items.filter(other => other !== item).map(other => other.base), `audio_${String(item.id).padStart(2, "0")}`);
  input.value = item.base;
  for (const extension of ["ogg", "m4a"]) item.element.querySelector(`.download-${extension}`).download = `${item.base}.${extension}`;
  if (requested !== item.base) notice(`保存名を「${item.base}」に整えました。半角英数字の名前を使用し、同名には連番を付けます。`);
}

function release(item) {
  const audio = item.element.querySelector("audio");
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (item.outputs) for (const value of Object.values(item.outputs)) URL.revokeObjectURL(value.url);
  item.outputs = null;
}

function createCard(item) {
  const element = ui.template.content.firstElementChild.cloneNode(true);
  item.element = element;
  element.dataset.id = String(item.id);
  element.querySelector(".audio-number").textContent = String(item.id).padStart(2, "0");
  element.querySelector(".source-name").textContent = item.file.name;
  element.querySelector(".source-meta").textContent = `${item.format} · ${formatSize(item.file.size)}`;
  const input = element.querySelector(".output-name");
  input.value = item.base;
  input.setAttribute("aria-label", `${item.file.name}の保存名`);
  input.addEventListener("change", () => updateNames(item));
  element.querySelector(".remove-file").setAttribute("aria-label", `${item.file.name}を取り除く`);
  element.querySelector(".remove-file").addEventListener("click", () => {
    if (busy || adding || zipBusy) return;
    release(item);
    items = items.filter(other => other !== item);
    element.remove();
    refreshControls();
    if (!items.length) resetProgress();
    else {
      const failed = items.filter(other => other.status === "error").length;
      status(failed ? `${finished().length}件が完了、${failed}件は変換できませんでした。` : `${finished().length}件が完了。${pending().length ? "残りの音声を変換できます。" : "試聴してから保存してください。"}`, failed > 0);
    }
  });
  element.querySelector(".preview-format").addEventListener("change", event => {
    if (!item.outputs) return;
    const audio = element.querySelector("audio");
    audio.pause();
    audio.src = item.outputs[event.target.value].url;
    audio.load();
  });
  for (const link of element.querySelectorAll(".output-downloads a")) link.addEventListener("click", () => updateNames(item));
  ui.list.append(element);
}

async function addFiles(files) {
  if (busy || adding || zipBusy || !files.length) return;
  adding = true;
  refreshControls();
  const messages = [];
  let total = items.reduce((sum, item) => sum + item.file.size, 0);
  try {
    for (const file of files) {
      if (!file.size) { messages.push(`${file.name}：空のファイルのため追加できません。`); continue; }
      if (file.size > LIMITS.perFile) { messages.push(`${file.name}：1件50MBまでにしてください。`); continue; }
      if (items.length >= LIMITS.count) { messages.push("一度に追加できるのは20件までです。"); break; }
      if (total + file.size > LIMITS.total) { messages.push(`${file.name}：入力合計200MBを超えるため追加できません。`); continue; }
      if (items.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
        messages.push(`${file.name}：すでに追加されています。`); continue;
      }
      const id = nextId++;
      const base = uniqueBaseName(file.name.replace(/\.[^.]+$/, ""), items.map(item => item.base), `audio_${String(id).padStart(2, "0")}`);
      const item = { id, file, base, format: await sniffFormat(file), status: "waiting", outputs: null };
      items.push(item);
      total += file.size;
      createCard(item);
    }
    notice(messages.join("\n"));
  } catch {
    notice("ファイルを読み込めませんでした。読み込み可能な音声ファイルを選び直してください。");
  } finally {
    adding = false;
    ui.input.value = "";
    refreshControls();
  }
}

function resetProgress() {
  ui.progress.hidden = true;
  ui.progress.value = 0;
  status(engine?.loaded ? "変換エンジンの準備ができています。" : "初回の変換時に、変換エンジン（約31MB）を読み込みます。");
}

async function ensureEngine() {
  if (engine?.loaded) return engine;
  if (!globalThis.Worker || !globalThis.WebAssembly) throw new Error("このブラウザでは変換を実行できません。最新のブラウザで開いてください。");
  if (location.protocol === "file:") throw new Error("ローカル確認にはHTTPサーバーが必要です。READMEの手順で開き直してください。");
  status("変換エンジンを読み込んでいます。初回は約31MBの読み込みがあります…");
  ui.progress.removeAttribute("value");
  const FFmpeg = await loadFFmpegClass();
  if (stopRequested) throw new Error("中断");
  engine = new FFmpeg();
  engine.on("progress", ({ progress }) => {
    if (!activeItem || !Number.isFinite(progress)) return;
    const value = Math.max(0, Math.min(1, progress));
    const itemProgress = activePhase === 0 ? 5 + value * 45 : 50 + value * 45;
    activeItem.element.querySelector(".file-progress").value = itemProgress;
    ui.progress.value = ((processed + itemProgress / 100) / batchLength) * 100;
  });
  await engine.load(engineAssets);
  return engine;
}

async function convertItem(item, ffmpeg, options) {
  const input = `input_${item.id}.bin`;
  const paths = [input, `meta_${item.id}.json`, `check_${item.id}.json`, `out_${item.id}.ogg`, `out_${item.id}.m4a`];
  const result = {};
  try {
    setItemState(item, "preparing");
    await ffmpeg.writeFile(input, new Uint8Array(await item.file.arrayBuffer()));
    const metadata = await probeAudio(ffmpeg, input, paths[1]);
    item.element.querySelector(".source-meta").textContent = `${metadata.codec.toUpperCase()} · ${formatDuration(metadata.duration)} · ${metadata.sampleRate.toLocaleString()}Hz · ${metadata.channels}ch · ${formatSize(item.file.size)}`;
    const filters = audioFilters(options);
    const common = ["-i", input, "-map", "0:a:0", "-vn", "-map_metadata", "-1", "-ar", "44100", "-ac", metadata.channels === 1 ? "1" : "2"];
    if (filters.length) common.push("-af", filters.join(","));
    for (const [index, extension] of ["ogg", "m4a"].entries()) {
      if (stopRequested) throw new Error("中断");
      activePhase = index;
      setItemState(item, extension);
      status(`${processed + 1} / ${batchLength}件：${item.file.name} を ${extension.toUpperCase()} に変換中…`);
      const output = `out_${item.id}.${extension}`;
      const encoding = extension === "ogg" ? ["-c:a", "libvorbis", "-q:a", "4"] : ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", "160k", "-movflags", "+faststart"];
      const code = await ffmpeg.exec([...common, ...encoding, "-y", output], 180000);
      if (code !== 0) throw new Error("音声を変換できませんでした。ファイルの破損や、長すぎる音声でないか確認してください。");
      const bytes = await ffmpeg.readFile(output);
      if (bytes.length < 100) throw new Error("音声が短すぎるか、処理後に無音だけになっています。無音の設定を外して再試行してください。");
      result[extension] = new Blob([bytes], { type: extension === "ogg" ? "audio/ogg" : "audio/mp4" });
    }
    const check = await probeAudio(ffmpeg, paths[4], paths[2]);
    if (!Number.isFinite(check.duration) || check.duration <= 0) throw new Error("処理後の音声に長さがありません。無音の設定を外して再試行してください。");
    item.outputs = Object.fromEntries(Object.entries(result).map(([extension, blob]) => [extension, { blob, url: URL.createObjectURL(blob) }]));
    for (const extension of ["ogg", "m4a"]) {
      const value = item.outputs[extension];
      item.element.querySelector(`.download-${extension}`).href = value.url;
      item.element.querySelector(`.${extension}-size`).textContent = formatSize(value.blob.size);
    }
    updateNames(item);
    const audio = item.element.querySelector("audio");
    audio.src = item.outputs.m4a.url;
    item.element.querySelector(".preview-format").value = "m4a";
    item.element.querySelector(".audio-result").hidden = false;
    setItemState(item, "done");
  } finally {
    // 仮想ファイルは1音源ごとに削除し、大量の入力を同時に保持しない。
    if (ffmpeg.loaded && !stopRequested) for (const file of paths) {
      try { await ffmpeg.deleteFile(file); } catch { /* 未生成のファイルは削除不要 */ }
    }
  }
}

async function convertAll() {
  if (busy || adding || zipBusy || !pending().length) return;
  for (const item of items) updateNames(item);
  const batch = pending();
  const options = { trim: $("#trim").checked, normalize: $("#normalize").checked };
  busy = true;
  stopRequested = false;
  processed = 0;
  batchLength = batch.length;
  ui.progress.hidden = false;
  ui.progress.value = 0;
  notice("");
  refreshControls();
  try {
    await ensureEngine();
    for (const item of batch) {
      if (stopRequested) break;
      activeItem = item;
      try {
        await convertItem(item, engine, options);
      } catch (error) {
        if (stopRequested) { setItemState(item, "stopped"); break; }
        setItemState(item, "error", error.message?.includes("FS error") ? "音声を読み取れませんでした。対応形式やファイルの破損を確認してください。" : (error.message || "変換できませんでした。別の音声でお試しください。"));
        // メモリ不足などでエンジンが不安定になっても、次の音源から再読み込みする。
        engine?.terminate();
        engine = null;
        if (item !== batch.at(-1)) await ensureEngine();
      }
      processed++;
      ui.progress.value = (processed / batchLength) * 100;
    }
    const failed = items.filter(item => item.status === "error").length;
    status(stopRequested ? "変換を中断しました。完了済みの音声は保存できます。残りは再開できます。" : `変換が終わりました。${finished().length}件が完了${failed ? `、${failed}件は変換できませんでした` : ""}。試聴してから保存してください。`, !!failed && !stopRequested);
  } catch (error) {
    status(stopRequested ? "変換を中断しました。もう一度変換を開始できます。" : `変換を開始できませんでした。${error.message || "ページを再読み込みして再試行してください。"}`, !stopRequested);
    engine?.terminate();
    engine = null;
  } finally {
    activeItem = null;
    busy = false;
    if (stopRequested) ui.progress.hidden = true;
    refreshControls();
  }
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // 保存ダイアログが開いていても、ブラウザが読み取る時間を確保する。
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

ui.choose.addEventListener("click", () => ui.input.click());
ui.input.addEventListener("change", () => addFiles(Array.from(ui.input.files)));
ui.drop.addEventListener("dragover", event => {
  event.preventDefault();
  if (!busy && !adding && !zipBusy) ui.drop.classList.add("is-dragging");
});
ui.drop.addEventListener("dragleave", event => { if (!ui.drop.contains(event.relatedTarget)) ui.drop.classList.remove("is-dragging"); });
ui.drop.addEventListener("drop", event => {
  event.preventDefault();
  ui.drop.classList.remove("is-dragging");
  addFiles(Array.from(event.dataTransfer.files));
});
// 領域外へのファイルドロップで、このページから移動してしまうのを防ぐ。
document.addEventListener("dragover", event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); });
document.addEventListener("drop", event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); });
ui.convert.addEventListener("click", convertAll);
ui.cancel.addEventListener("click", () => {
  stopRequested = true;
  engine?.terminate();
  engine = null;
  status("変換を中断しています…");
  refreshControls();
});
ui.clear.addEventListener("click", () => {
  if (busy || adding || zipBusy) return;
  items.forEach(release);
  items = [];
  ui.list.replaceChildren();
  notice("");
  resetProgress();
  refreshControls();
});
ui.zip.addEventListener("click", async () => {
  if (busy || adding || zipBusy || !finished().length) return;
  items.forEach(updateNames);
  zipBusy = true;
  refreshControls();
  ui.zip.textContent = "ZIPをまとめています…";
  try {
    const files = finished().flatMap(item => ["ogg", "m4a"].map(extension => ({ name: `${item.base}.${extension}`, blob: item.outputs[extension].blob })));
    const blob = await createZip(files);
    saveBlob(blob, "tsukuru-audio.zip");
    status("ZIPを保存しました。展開後、中のファイルだけを既存のaudioフォルダへ入れてください。");
  } catch (error) {
    status(`ZIPを作成できませんでした。${error.message || "個別保存をお試しください。"}`, true);
  } finally {
    zipBusy = false;
    ui.zip.textContent = "まとめてZIP保存 ↓";
    refreshControls();
  }
});
window.addEventListener("beforeunload", event => { if (busy) { event.preventDefault(); event.returnValue = ""; } });
$("#copyright-year").textContent = String(new Date().getFullYear());
refreshControls();
