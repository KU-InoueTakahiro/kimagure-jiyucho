// ファイル名と表示用の小さな共通処理。音声は外部へ送信しません。
export const LIMITS = Object.freeze({ count: 20, perFile: 50 * 1024 ** 2, total: 200 * 1024 ** 2 });

export function safeBaseName(value, fallback = "audio") {
  let name = String(value).normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 64);
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `audio_${name}`;
  return name;
}

export function uniqueBaseName(value, used, fallback) {
  const base = safeBaseName(value, fallback);
  let result = base;
  let suffix = 2;
  const occupied = new Set(Array.from(used, name => name.toLowerCase()));
  while (occupied.has(result.toLowerCase())) result = `${base}_${suffix++}`;
  return result;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "長さ不明";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

// 拡張子は信用せず、先頭のシグネチャを軽く確認。詳細はFFprobeで判定する。
export async function sniffFormat(file) {
  const data = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const text = (start, length) => String.fromCharCode(...data.slice(start, start + length));
  if (text(0, 4) === "RIFF" && text(8, 4) === "WAVE") return "WAV";
  if (text(0, 4) === "OggS") return "OGG";
  if (text(0, 4) === "fLaC") return "FLAC";
  if (text(0, 4) === "FORM" && ["AIFF", "AIFC"].includes(text(8, 4))) return "AIFF";
  if (text(4, 4) === "ftyp") return "M4A / MP4";
  if (text(0, 3) === "ID3") return "MP3";
  if (data[0] === 0xff && (data[1] & 0xf6) === 0xf0) return "AAC";
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "MPEG Audio";
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return "WebM / Matroska";
  return "変換時に形式を確認";
}

export function audioFilters({ trim, normalize }) {
  const filters = [];
  if (trim) {
    filters.push(
      "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:start_silence=0.03",
      "areverse",
      "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:start_silence=0.08",
      "areverse"
    );
  }
  // loudnormの192kHzへの自動昇格が前段のareverseまで波及しないよう区切る。
  // 長い音声で無音短縮と音量調整を併用しても、逆順バッファが膨らまない。
  if (normalize && trim) filters.push("aresample=44100");
  if (normalize) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  return filters;
}
