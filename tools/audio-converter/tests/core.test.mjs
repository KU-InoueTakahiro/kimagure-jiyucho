import test from "node:test";
import assert from "node:assert/strict";
import { safeBaseName, uniqueBaseName, sniffFormat, audioFilters } from "../audio-utils.js";
import { crc32, createZip } from "../archive.js";

test("保存名はWindows・URLで扱える形にし、同名は大文字小文字を区別せず回避", () => {
  assert.equal(safeBaseName("../../my voice?"), "my_voice");
  assert.equal(safeBaseName("パワハラ", "audio_01"), "audio_01");
  assert.equal(safeBaseName("CON"), "audio_CON");
  assert.equal(safeBaseName("ＡＢＣ１２３"), "ABC123");
  assert.equal(uniqueBaseName("Voice", ["voice", "Voice_2"]), "Voice_3");
});

test("入力は拡張子を信用せず内容から判定する", async () => {
  const header = new Uint8Array(44);
  header.set(new TextEncoder().encode("RIFF"), 0);
  header.set(new TextEncoder().encode("WAVE"), 8);
  const disguised = new File([header], "actually-wave.mp3", { type: "audio/mpeg" });
  assert.equal(await sniffFormat(disguised), "WAV");
  assert.equal(await sniffFormat(new File(["fLaC"], "track.bin")), "FLAC");
  assert.equal(await sniffFormat(new File(["not audio"], "fake.wav")), "変換時に形式を確認");
});

test("仕上げの加工は明示的な選択時だけ有効になる", () => {
  assert.deepEqual(audioFilters({ trim: false, normalize: false }), []);
  assert.equal(audioFilters({ trim: false, normalize: true }).length, 1);
  assert.ok(audioFilters({ trim: true, normalize: false }).some(s => s.includes("start_silence=0.03")));
  const both = audioFilters({ trim: true, normalize: true });
  assert.equal(both.at(-2), "aresample=44100");
});

test("ZIPは正しいCRCで直下にファイルを保存し、フォルダや重複名を作らない", async () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const files = [
    { name: "voice.ogg", blob: new Blob(["OggS-test"]) },
    { name: "voice.m4a", blob: new Blob(["m4a-test"]) },
  ];
  const bytes = new Uint8Array(await (await createZip(files)).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let directory = view.getUint32(end + 16, true);
  for (const file of files) {
    assert.equal(view.getUint32(directory, true), 0x02014b50);
    const length = view.getUint16(directory + 28, true);
    assert.equal(new TextDecoder().decode(bytes.slice(directory + 46, directory + 46 + length)), file.name);
    const offset = view.getUint32(directory + 42, true);
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    const bodyStart = offset + 30 + view.getUint16(offset + 26, true);
    const size = view.getUint32(offset + 18, true);
    assert.equal(view.getUint32(offset + 14, true), crc32(bytes.slice(bodyStart, bodyStart + size)));
    directory += 46 + length;
  }
  await assert.rejects(createZip([{ name: "audio/se/x.ogg", blob: new Blob([]) }]));
  await assert.rejects(createZip([{ name: "voice.ogg", blob: new Blob([]) }, { name: "VOICE.ogg", blob: new Blob([]) }]));
});
