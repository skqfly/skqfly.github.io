import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { photoLibrary } from "../src/data/photos.ts";

const outputDirectory = new URL("../public/photos/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const results = [];

for (const [name, photo] of Object.entries(photoLibrary)) {
  const original = await readFile(new URL(`../public${photo.src}`, import.meta.url));
  const previews = {};

  for (const width of [480, 960]) {
    if (photo.src === `/photos/${name}-${width}.webp`) {
      previews[width] = original.byteLength;
      continue;
    }
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
