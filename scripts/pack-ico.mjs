import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dir = process.argv[2] ?? "tmp/icon";
const out = process.argv[3] ?? "build/icon.ico";
const sizes = [16, 24, 32, 48, 64, 128, 256];

const entries = sizes.map((size) => ({
  size,
  data: readFileSync(join(dir, `${size}.png`)),
}));

const headerSize = 6;
const dirEntrySize = 16;
const totalData = entries.reduce((n, e) => n + e.data.length, 0);
const dataStart = headerSize + dirEntrySize * entries.length;
const buf = Buffer.alloc(dataStart + totalData);

buf.writeUInt16LE(0, 0); // reserved
buf.writeUInt16LE(1, 2); // type: icon
buf.writeUInt16LE(entries.length, 4);

let cursor = headerSize;
let dataCursor = dataStart;
for (const e of entries) {
  const dim = e.size === 256 ? 0 : e.size;
  buf.writeUInt8(dim, cursor);
  buf.writeUInt8(dim, cursor + 1);
  buf.writeUInt8(0, cursor + 2);
  buf.writeUInt8(0, cursor + 3);
  buf.writeUInt16LE(1, cursor + 4);
  buf.writeUInt16LE(32, cursor + 6);
  buf.writeUInt32LE(e.data.length, cursor + 8);
  buf.writeUInt32LE(dataCursor, cursor + 12);
  e.data.copy(buf, dataCursor);
  cursor += dirEntrySize;
  dataCursor += e.data.length;
}

writeFileSync(out, buf);
console.log(`wrote ${out} (${buf.length} bytes)`);
