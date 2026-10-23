import sharp from 'sharp';
import { createHash } from 'node:crypto';

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const reference = /trilium:([a-zA-Z0-9_-]{1,64})/g;

export function mediaPath(id) {
  if (!idPattern.test(id)) throw new Error('Invalid image note ID.');
  return `/trilium-media/${id}.webp`;
}

export function mediaReferences(value) {
  const refs = new Set();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const match of serialized.matchAll(reference)) refs.add(match[1]);
  return refs;
}

export function replaceMedia(value, paths) {
  if (typeof value === 'string') return value.replace(reference, (_, id) => {
    if (!paths[id]) throw new Error(`Image ${id} is missing from the blog media library.`);
    return paths[id];
  });
  if (Array.isArray(value)) return value.map(item => replaceMedia(item, paths));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceMedia(item, paths)]));
  return value;
}

export async function prepareMedia(client, records, snapshot) {
  const assets = records.filter(r => r.attrs.blogKind === 'asset');
  const content = records.filter(r => r.attrs.blogKind !== 'asset');
  const referenced = new Set();
  for (const record of content) {
    if (Object.hasOwn(record.attrs, 'publish') && record.attrs.blogDeleted !== 'true') {
      for (const id of mediaReferences([record.attrs, record.content])) referenced.add(id);
    }
  }
  const paths = {};
  for (const [id, asset] of Object.entries(snapshot.assets || {})) paths[id] = asset.path;
  const published = { ...snapshot.assets };
  const files = new Map();
  for (const id of referenced) {
    const record = assets.find(r => r.noteId === id);
    // Every referenced note must remain inside the managed tree, including soft-deleted assets.
    if (!record) throw new Error(`Image ${id} was removed from Trilium. Restore it before publishing.`);
    if (!allowedMime.has(record.mime)) throw new Error(`Unsupported image type: ${record.mime}`);
    const original = await client(`notes/${id}/content`, { binary: true });
    const sha256 = createHash('sha256').update(original).digest('hex');
    const path = mediaPath(id);
    paths[id] = path;
    published[id] = { ...snapshot.assets?.[id], path, sha256 };
    if (snapshot.assets?.[id]?.sha256 === sha256) continue;
    const { data: full, info } = await sharp(original, { animated: true, limitInputPixels: 40000000 }).rotate().resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    Object.assign(published[id], { width: info.width, height: info.pageHeight || info.height });
    files.set(`public${path}`, full);
    for (const width of [480, 960]) files.set(`public${path.replace('.webp', `-${width}.webp`)}`, await sharp(full, { animated: true }).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
  }
  const resolved = content.map(record => {
    if (!Object.hasOwn(record.attrs, 'publish') || record.attrs.blogDeleted === 'true') return record;
    const result = replaceMedia(record, paths);
    if (record.attrs.blogKind === 'photo' && record.attrs.src?.startsWith('trilium:')) {
      const id = record.attrs.src.slice('trilium:'.length);
      result.attrs.width = String(published[id].width);
      result.attrs.height = String(published[id].height);
      result.attrs.preview = result.attrs.src.replace('.webp', '-480.webp');
      result.attrs.previewLarge = result.attrs.src.replace('.webp', '-960.webp');
    }
    return result;
  });
  return { records: resolved, assets: published, files };
}

export function unusedMedia(snapshot) {
  const content = JSON.stringify([snapshot.site, snapshot.photos, snapshot.posts]);
  return Object.entries(snapshot.assets || {}).filter(([, asset]) => !content.includes(asset.path)).map(([id]) => id);
}
