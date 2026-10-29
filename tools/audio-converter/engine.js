// 同一オリジンの単一スレッド版。COOP/COEPヘッダーのないGitHub Pagesにも対応。
const asset = name => new URL(`vendor/ffmpeg/${name}`, import.meta.url).href;
let wrapperPromise;

export function loadFFmpegClass() {
  if (globalThis.FFmpegWASM?.FFmpeg) return Promise.resolve(globalThis.FFmpegWASM.FFmpeg);
  if (!wrapperPromise) {
    wrapperPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = asset("ffmpeg.js");
      script.onload = () => resolve(globalThis.FFmpegWASM.FFmpeg);
      script.onerror = () => {
        script.remove();
        wrapperPromise = undefined;
        reject(new Error("変換ライブラリを読み込めませんでした。"));
      };
      document.head.append(script);
    });
  }
  return wrapperPromise;
}

export const engineAssets = Object.freeze({
  coreURL: asset("ffmpeg-core.js"),
  wasmURL: asset("ffmpeg-core.wasm"),
});

export async function probeAudio(ffmpeg, input, output = "probe.json") {
  const messages = [];
  const collect = ({ message }) => messages.push(message);
  ffmpeg.on("log", collect);
  try {
    const code = await ffmpeg.ffprobe([
      "-v", "error", "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,codec_type,sample_rate,channels:format=duration,format_name",
      "-of", "json", "-o", output, input,
    ], 30000);
    // core 0.12.10のFFprobeは成功時も-1を返すため、解析JSONを検証する。
    if (code > 0) throw new Error("probe failed");
    const metadata = JSON.parse(await ffmpeg.readFile(output, "utf8"));
    const stream = metadata.streams?.find(item => item.codec_type === "audio");
    if (!stream?.codec_name || !(Number(stream.channels) > 0)) throw new Error("no audio stream");
    return {
      codec: stream.codec_name,
      sampleRate: Number(stream.sample_rate),
      channels: Number(stream.channels),
      duration: Number(metadata.format?.duration),
    };
  } catch (error) {
    console.warn("FFprobe could not read audio:", messages.slice(-12).join("\n"));
    throw new Error("音声の形式を読み取れませんでした。音声を含むファイルか、破損がないか確認してください。");
  } finally {
    ffmpeg.off("log", collect);
  }
}
