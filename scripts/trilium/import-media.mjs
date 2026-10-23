import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createClient, labels, setLabel } from './client.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(await readFile(resolve(root, 'trilium/config.json'), 'utf8'));
const client = createClient();
const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const result = await client(`notes?search=${encodeURIComponent('#blogKind')}&ancestorNoteId=${config.rootNoteId}&fastSearch=true`);
const notes = result.results;
const rootNote = await client(`notes/${config.rootNoteId}`);
let folder;
for (const id of rootNote.childNoteIds) {
  const note = await client(`notes/${id}`);
  if (note.title === '图片素材 Media') folder = note;
}
if (!folder) folder = (await client('create-note', { method: 'POST', body: { parentNoteId: config.rootNoteId, title: '图片素材 Media', type: 'code', mime: 'text/markdown', content: '原始图片保存在这里，可预览、下载和恢复。日常管理请打开博客管理台。' } })).note;
const imported = new Map(notes.filter(n => labels(n).blogKind === 'asset').map(n => [labels(n).blogSource, n]));
async function importFile(source) {
  if (!mime[extname(source).toLowerCase()]) return source;
  if (/^https?:/.test(source) || source.startsWith('trilium:')) return source;
  const path = source === 'avatar' ? resolve(root, 'src/assets/me.webp') : resolve(root, `public${source}`);
  if (relative(root, path).startsWith('..')) throw new Error('Image source is outside the repository.');
  const bytes = await readFile(path);
  const hash = createHash('sha256').update(bytes).digest('hex');
  let note = imported.get(source);
  if (!note) {
    note = (await client('create-note', { method: 'POST', body: { parentNoteId: folder.noteId, title: basename(path), type: 'image', mime: mime[extname(path)], content: '' } })).note;
    note = await client(`notes/${note.noteId}`);
    await setLabel(client, note, 'blogKind', 'asset');
    await setLabel(client, note, 'blogSource', source);
    imported.set(source, note);
  }
  if (labels(note).blogSourceSha !== hash) {
    await client(`notes/${note.noteId}/content`, { method: 'PUT', body: bytes, binary: true });
    await setLabel(client, note, 'blogSourceSha', hash);
  }
  console.log(`Image imported: ${basename(path)}`);
  return `trilium:${note.noteId}`;
}
for (const note of notes) {
  const attrs = labels(note);
  const field = attrs.blogKind === 'photo' ? 'src' : ['post', 'project', 'friend'].includes(attrs.blogKind) ? 'image' : null;
  if (field && attrs[field]?.startsWith('/')) {
    const value = await importFile(attrs[field]);
    if (value !== attrs[field]) await setLabel(client, note, field, value);
  }
}
const home = notes.find(n => labels(n).blogKind === 'settings' && labels(n).blogId === 'homePageContent');
if (home) {
  const content = JSON.parse(await client(`notes/${home.noteId}/content`, { raw: true }));
  if (!content.avatar) {
    // Avatar is bundled as a source asset, rather than a public URL.
    const bytes = await readFile(resolve(root, 'src/assets/me.webp'));
    let asset = imported.get('avatar');
    if (!asset) {
      asset = (await client('create-note', { method: 'POST', body: { parentNoteId: folder.noteId, title: '博客头像.webp', type: 'image', mime: 'image/webp', content: '' } })).note;
      asset = await client(`notes/${asset.noteId}`);
      await setLabel(client, asset, 'blogKind', 'asset');
      await setLabel(client, asset, 'blogSource', 'avatar');
    }
    await client(`notes/${asset.noteId}/content`, { method: 'PUT', binary: true, body: bytes });
    content.avatar = `trilium:${asset.noteId}`;
    await client(`notes/${home.noteId}/content`, { method: 'PUT', raw: true, body: JSON.stringify(content, null, 2) });
  }
}
console.log('Existing blog images are available inside Trilium.');
