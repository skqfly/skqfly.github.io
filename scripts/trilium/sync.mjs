import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, labels, setLabel } from './client.mjs';
import { applyRecords } from './model.mjs';
import { publicationRequest } from './publication.mjs';
import { prepareMedia, unusedMedia, mediaPath } from './media.mjs';
import { collectNative, selectPublicationRecords } from './native.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = value => JSON.stringify(value, null, 2) + '\n';

export const collect = collectNative;

export function outputFiles(snapshot) {
  const files = new Map([
    ['src/data/site.json', json(snapshot.site)],
    ['src/data/photo-library.json', json(snapshot.photos)],
    ['trilium/published.json', json(snapshot)],
    ['trilium/signals.json', json(snapshot.signals || {})],
  ]);
  for (const [id, post] of Object.entries(snapshot.posts)) {
    // JSON is valid YAML; quoting every string keeps frontmatter values unambiguous.
    const meta = Object.entries(post.meta).map(([key, value]) => `${key}: ${key === 'pubDate' ? value : JSON.stringify(value)}`).join('\n');
    files.set(`src/content/posts/${id}.md`, `---\n${meta}\n---\n\n${post.content.replace(/^\n+/, '')}`);
  }
  return files;
}

export async function run({ dryRun = false } = {}) {
  const config = JSON.parse(await readFile(resolve(root, 'trilium/config.json'), 'utf8'));
  const client = createClient();
  const note = await client(`notes/${config.rootNoteId}`);
  const { request, signals, nativeRequests } = await publicationRequest(client, config, note);
  if (process.argv.includes('--queued') && !request) {
    console.log('No pending publication request.');
    return;
  }
  if (request && !/^\d{13}-[a-zA-Z0-9]{8}$/.test(request)) throw new Error('Invalid publication request ID.');
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `request=${request}\n`, { flag: 'a' });
  const snapshot = JSON.parse(await readFile(resolve(root, 'trilium/published.json'), 'utf8'));
  const allRecords = await collect(client, config.rootNoteId, config);
  const records = selectPublicationRecords(allRecords, snapshot);
  if (!records.length) throw new Error('No managed content found; refusing to publish an empty tree.');
  const mediaBase = { ...snapshot, assets: { ...snapshot.assets } };
  for (const id of Object.keys(mediaBase.assets)) {
    const path = mediaPath(id);
    try { await Promise.all(['', '-480', '-960'].map(suffix => access(resolve(root, `public${path.replace('.webp', `${suffix}.webp`)}`)))); }
    catch (error) { if (error.code === 'ENOENT') delete mediaBase.assets[id]; else throw error; }
  }
  const media = await prepareMedia(client, records, mediaBase);
  const updated = applyRecords(snapshot, media.records);
  updated.assets = media.assets;
  const removed = Object.keys(snapshot.posts).filter(id => !Object.hasOwn(updated.posts, id)).map(id => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)) throw new Error('Invalid removed post ID.');
    return `src/content/posts/${id}.md`;
  });
  for (const id of unusedMedia(updated)) {
    delete updated.assets[id];
    const path = mediaPath(id);
    for (const suffix of ['', '-480', '-960']) {
      const file = `public${path.replace('.webp', `${suffix}.webp`)}`;
      media.files.delete(file);
      if (snapshot.assets?.[id]) removed.push(file);
    }
  }
  updated.signals = signals;
  const changes = [];
  for (const [path, content] of new Map([...outputFiles(updated), ...media.files])) {
    const current = await readFile(resolve(root, path), Buffer.isBuffer(content) ? undefined : 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    if (Buffer.isBuffer(content) ? !current?.equals(content) : current !== content) changes.push([path, content]);
  }
  console.log(JSON.stringify({ managedNotes: records.length, publishedNotes: records.filter(r => Object.hasOwn(r.attrs, 'publish')).length, dryRun, changedFiles: changes.map(([p]) => p), removedFiles: removed }, null, 2));
  if (process.env.TRILIUM_PLAN_FILE) await writeFile(process.env.TRILIUM_PLAN_FILE, JSON.stringify({ managedNotes: records.length, changedFiles: changes.map(([path]) => path), removedFiles: removed, nativeRequests }, null, 2));
  if (dryRun) return;
  // Everything has been fetched and validated before the first local write.
  for (const [path, content] of changes) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), content);
  }
  for (const path of removed) await unlink(resolve(root, path)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}

export async function report(status) {
  const config = JSON.parse(await readFile(resolve(root, 'trilium/config.json'), 'utf8'));
  const client = createClient();
  const note = await client(`notes/${config.rootNoteId}`);
  const run = process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
  await setLabel(client, note, 'blogSyncStatus', `${new Date().toISOString()} ${status} ${run}`);
  // Never acknowledge a newer request submitted while this run was in progress.
  const request = process.env.TRILIUM_REQUEST;
  if (status === 'success' && request && labels(note).blogSyncRequest === request) {
    const attr = note.attributes.find(a => a.type === 'label' && a.name === 'blogSyncRequest');
    if (attr) await client(`attributes/${attr.attributeId}`, { method: 'DELETE' });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'report') await report(process.argv[3]);
    else await run({ dryRun: process.argv.includes('--dry-run') });
  } catch (error) {
    if (process.env.TRILIUM_ERROR_FILE) await writeFile(process.env.TRILIUM_ERROR_FILE, JSON.stringify({ message: error.message, noteId: error.noteId, noteTitle: error.noteTitle, blogKind: error.blogKind, blogId: error.blogId }));
    console.error(error.message); process.exitCode = 1;
  }
}
