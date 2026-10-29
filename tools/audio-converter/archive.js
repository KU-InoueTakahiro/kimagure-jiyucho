// 音声はすでに圧縮済みなので、再圧縮しない標準ZIP（STORE）を生成。
// 追加ライブラリ不要。ZIPの直下にファイルを並べ、フォルダは作りません。
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDate(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export async function createZip(files, date = new Date()) {
  if (!files.length || files.length > 65535) throw new Error("保存できるファイルがありません。");
  const chunks = [];
  const directory = [];
  const names = new Set();
  const stamp = dosDate(date);
  let offset = 0;
  let directorySize = 0;
  for (const { name, blob } of files) {
    if (/[\\/]/.test(name) || names.has(name.toLowerCase())) throw new Error("保存名が重複しているか、不正です。");
    names.add(name.toLowerCase());
    const encodedName = new TextEncoder().encode(name);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (offset + bytes.length > 0xffffffff) throw new Error("ZIPが大きすぎます。個別に保存してください。");
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + encodedName.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true); // UTF-8
    header.setUint16(10, stamp.time, true);
    header.setUint16(12, stamp.date, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, bytes.length, true);
    header.setUint32(22, bytes.length, true);
    header.setUint16(26, encodedName.length, true);
    local.set(encodedName, 30);

    const central = new Uint8Array(46 + encodedName.length);
    const index = new DataView(central.buffer);
    index.setUint32(0, 0x02014b50, true);
    index.setUint16(4, 20, true);
    index.setUint16(6, 20, true);
    index.setUint16(8, 0x0800, true);
    index.setUint16(12, stamp.time, true);
    index.setUint16(14, stamp.date, true);
    index.setUint32(16, crc, true);
    index.setUint32(20, bytes.length, true);
    index.setUint32(24, bytes.length, true);
    index.setUint16(28, encodedName.length, true);
    index.setUint32(42, offset, true);
    central.set(encodedName, 46);
    chunks.push(local, bytes);
    directory.push(central);
    offset += local.length + bytes.length;
    directorySize += central.length;
  }
  const end = new Uint8Array(22);
  const header = new DataView(end.buffer);
  header.setUint32(0, 0x06054b50, true);
  header.setUint16(8, files.length, true);
  header.setUint16(10, files.length, true);
  header.setUint32(12, directorySize, true);
  header.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: "application/zip" });
}
