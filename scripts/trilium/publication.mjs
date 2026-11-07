import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { labels } from './client.mjs';
import { isPublishValue, nativeRequest } from './native.mjs';

export async function publicationRequest(client, config, rootNote) {
  const old = JSON.parse(await readFile(new URL('../../trilium/signals.json', import.meta.url), 'utf8'));
  const scope = `&ancestorNoteId=${encodeURIComponent(config.folders?.post || config.rootNoteId)}&fastSearch=true`;
  const result = await client(`notes?search=${encodeURIComponent('#publish')}${scope}`);
  const native = await client(`notes?search=${encodeURIComponent('#blogPublishRequested = true')}${scope}`);
  const notes = [...new Map([...result.results, ...native.results, rootNote].map(note => [note.noteId, note])).values()];
  const signals = {};
  const nativeRequests = [];
  for (const note of notes) {
    if (note.attributes.some(a => a.type === 'label' && ['template', 'workspaceTemplate', 'workspacetemplate'].includes(a.name) && (!a.noteId || a.noteId === note.noteId))) continue;
    if (note.noteId === config.rootNoteId) continue;
    // The query is scoped to Posts; native articles may inherit their kind from
    // the folder instead of carrying a blogKind label on the note itself.
    const kind = labels(note).blogKind;
    if (kind && kind !== 'post' || !kind && !config.folders?.post) continue;
    const attr = note.attributes.find(a => a.type === 'label' && a.name === 'publish');
    if (attr && isPublishValue(attr.value)) signals[note.noteId] = `${attr.attributeId}:${attr.value}`;
    const pending = nativeRequest(note);
    if (pending) nativeRequests.push(pending);
  }
  const changed = Object.entries(signals).some(([id, value]) => old[id] !== value);
  const fingerprint = createHash('sha256').update(JSON.stringify(signals)).digest('hex').slice(0, 8);
  const request = labels(rootNote).blogSyncRequest || (changed || nativeRequests.length ? `${Date.now()}-${fingerprint}` : '');
  return { request, signals, nativeRequests };
}
