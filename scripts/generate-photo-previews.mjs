import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { photoLibrary } from "../src/data/photos.ts";

const outputDirectory = new URL("../public/photos/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const results = [];

for (const [name, photo] of Object.entries(photoLibrary)) {
  const response = await fetch(photo.src, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const original = Buffer.from(await response.arrayBuffer());
  const previews = {};

  for (const width of [480, 960]) {
    const preview = await sharp(original)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await writeFile(new URL(`${name}-${width}.webp`, outputDirectory), preview);
    previews[width] = preview.byteLength;
  }

  results.push({ name, originalBytes: original.byteLength, previewBytes: previews });
  console.log(`${name}: ${original.byteLength} bytes -> ${previews[480]} / ${previews[960]} bytes`);
}

console.log(JSON.stringify(results, null, 2));
