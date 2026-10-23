import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { labels } from './client.mjs';

export async function publicationRequest(client, config, rootNote) {
  const old = JSON.parse(await readFile(new URL('../../trilium/signals.json', import.meta.url), 'utf8'));
  const result = await client(`notes?search=${encodeURIComponent('#publish')}&ancestorNoteId=${encodeURIComponent(config.rootNoteId)}&fastSearch=true`);
  const notes = [...result.results, rootNote];
  const signals = {};
  for (const note of notes) {
    const attr = note.attributes.find(a => a.type === 'label' && a.name === 'publish');
    if (attr && (labels(note).blogKind || note.noteId === config.rootNoteId)) signals[note.noteId] = `${attr.attributeId}:${attr.value}`;
  }
  const changed = Object.entries(signals).some(([id, value]) => old[id] !== value);
  const fingerprint = createHash('sha256').update(JSON.stringify(signals)).digest('hex').slice(0, 8);
  const request = labels(rootNote).blogSyncRequest || (changed ? `${Date.now()}-${fingerprint}` : '');
  return { request, signals };
}
