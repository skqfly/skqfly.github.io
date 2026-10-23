import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, labels, setLabel } from './client.mjs';
import { applyRecords } from './model.mjs';
import { publicationRequest } from './publication.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = value => JSON.stringify(value, null, 2) + '\n';

export async function collect(client, rootId) {
  const records = [];
  const visited = new Set();
  async function walk(id, depth = 0) {
    if (visited.has(id)) return;
    if (visited.size > 1000 || depth > 8) throw new Error('Blog tree exceeds safety limit.');
    visited.add(id);
    const note = await client(`notes/${encodeURIComponent(id)}`);
    const attrs = labels(note);
    if (attrs.blogKind) {
      if (note.type !== 'code' || !['text/markdown', 'application/json', 'text/plain'].includes(note.mime)) throw new Error(`Use a Markdown or JSON code note: ${note.title}`);
      records.push({ title: note.title, attrs, content: await client(`notes/${id}/content`, { raw: true }), noteId: id });
    }
    for (const child of note.childNoteIds || []) await walk(child, depth + 1);
  }
  await walk(rootId);
  // Photos must be resolved before talks reference them.
  return records.sort((a, b) => Number(b.attrs.blogKind === 'photo') - Number(a.attrs.blogKind === 'photo'));
}

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
  const { request, signals } = await publicationRequest(client, config, note);
  if (process.argv.includes('--queued') && !request) {
    console.log('No pending publication request.');
    return;
  }
  if (request && !/^\d{13}-[a-zA-Z0-9]{8}$/.test(request)) throw new Error('Invalid publication request ID.');
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `request=${request}\n`, { flag: 'a' });
  const snapshot = JSON.parse(await readFile(resolve(root, 'trilium/published.json'), 'utf8'));
  const records = await collect(client, config.rootNoteId);
  if (!records.length) throw new Error('No managed content found; refusing to publish an empty tree.');
  const updated = applyRecords(snapshot, records);
  updated.signals = signals;
  const changes = [];
  for (const [path, content] of outputFiles(updated)) {
    const current = await readFile(resolve(root, path), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    if (current !== content) changes.push([path, content]);
  }
  console.log(JSON.stringify({ managedNotes: records.length, publishedNotes: records.filter(r => Object.hasOwn(r.attrs, 'publish')).length, dryRun, changedFiles: changes.map(([p]) => p) }, null, 2));
  if (dryRun) return;
  // Everything has been fetched and validated before the first local write.
  for (const [path, content] of changes) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), content);
  }
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
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
