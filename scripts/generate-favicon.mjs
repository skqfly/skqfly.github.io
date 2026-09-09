import { writeFile } from "node:fs/promises";
import sharp from "sharp";

// Keeps all raster icons in sync with the source mark in public/favicon.svg.
const PUBLIC = new URL("../public/", import.meta.url);
const BACKGROUND = "#fafafa";
const MARK = "#24211f";

const armPath =
  '<path d="M13 -13H-10.8L1 0L-10.8 13H13V7.1H2.7L9.6 0L2.7 -7.1H13V-13Z" fill="' +
  MARK +
  '"/>';

function iconSvg(size) {
  const arms = [0, 90, 180, 270]
    .map(
      (deg) =>
        `<g transform="rotate(${deg} 32 32)"><g transform="translate(32 20) rotate(-90) scale(0.56)">${armPath}</g></g>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BACKGROUND}"/>
  <defs>
    <mask id="center-hole">
      <rect width="64" height="64" fill="white"/>
      <circle cx="32" cy="32" r="2.2" fill="black"/>
    </mask>
  </defs>
  <g transform="translate(32 32) scale(1.3) translate(-32 -32)">
    ${arms}
    <path d="M32 23.3L40.7 32L32 40.7L23.3 32L32 23.3Z" fill="${MARK}" mask="url(#center-hole)"/>
  </g>
</svg>`;
}

async function renderPng(size) {
  return sharp(Buffer.from(iconSvg(size))).png().toBuffer();
}

// ICO container wrapping PNG-compressed frames (supported by IE9+ and all modern engines).
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + 16 * frames.length;
  const entries = [];
  const images = [];
  for (const { size, data } of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
    images.push(data);
  }
  return Buffer.concat([header, ...entries, ...images]);
}

const icoSizes = [16, 32, 48, 64];
const frames = [];
for (const size of icoSizes) {
  frames.push({ size, data: await renderPng(size) });
}
await writeFile(new URL("favicon.ico", PUBLIC), buildIco(frames));

const touchIcon = await renderPng(180);
await writeFile(new URL("apple-touch-icon.png", PUBLIC), touchIcon);

console.log(
  `favicon.ico (${icoSizes.join("/")}) ${buildIco(frames).byteLength} bytes, apple-touch-icon.png ${touchIcon.byteLength} bytes`
);
