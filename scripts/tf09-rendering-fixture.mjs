import { deflateSync } from "node:zlib";

/** PNG fixture encodes a flat 1000 meter terrain tile without external services. */
export const terrainPng = () => {
  const crc32 = (bytes) => {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  };
  const chunk = (name, bytes) => {
    const type = Buffer.from(name);
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    type.copy(result, 4);
    bytes.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([type, bytes])), bytes.length + 8);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256);
  header.writeUInt32BE(256, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(256 * (256 * 3 + 1));
  for (let y = 0; y < 256; y += 1)
    for (let x = 0; x < 256; x += 1) {
      const offset = y * 769 + 1 + x * 3;
      const meters = 1000 + (x >= 80 && x < 120 ? (x - 80) * 30 : 0);
      const encoded = Math.round((meters + 10000) * 10);
      pixels[offset] = encoded >> 16;
      pixels[offset + 1] = (encoded >> 8) & 255;
      pixels[offset + 2] = encoded & 255;
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
