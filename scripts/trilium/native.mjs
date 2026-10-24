import { createHash } from 'node:crypto';
import { labels } from './client.mjs';

const contentKinds = new Set(['post', 'talk', 'photo', 'project', 'friend', 'settings']);
const contentMimes = new Set(['text/markdown', 'text/x-markdown', 'text/x-gfm', 'application/json', 'text/plain']);
const templateNames = new Set(['template', 'workspaceTemplate', 'workspacetemplate']);
const ownLabel = (note, name) => note.attributes.find(a => a.type === 'label' && a.name === name && (!a.noteId || a.noteId === note.noteId));
const isTemplate = note => note.attributes.some(a => a.type === 'label' && templateNames.has(a.name) && (!a.noteId || a.noteId === note.noteId));
export const isPublishValue = value => !['false', '0'].includes(String(value).trim().toLowerCase());

// Compare both content identity and attributes before acknowledging a native request.
export function nativeFingerprint(note) {
  const attributes = note.attributes
    .filter(a => !['blogSyncStatus', 'blogSyncRequest'].includes(a.name))
    .map(a => [a.attributeId, a.noteId, a.type, a.name, a.value, a.utcDateModified])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash('sha256').update(JSON.stringify([note.title, note.type, note.mime, note.blobId, note.utcDateModified, attributes])).digest('hex');
}

export function nativeRequest(note) {
  const attr = ownLabel(note, 'blogPublishRequested');
  return attr?.value === 'true' && !isTemplate(note)
    ? { noteId: note.noteId, attributeId: attr.attributeId, fingerprint: nativeFingerprint(note) }
    : null;
}

export async function collectNative(client, rootId, config = {}) {
  const records = [];
  const visited = new Set();
  const controls = new Set(Object.values(config.controls || {}).filter(value => typeof value === 'string'));
  const folderKinds = new Map();
  for (const [kind, id] of Object.entries(config.folders || {})) {
    if (contentKinds.has(kind) || kind === 'asset') folderKinds.set(id, kind);
    else if (contentKinds.has(id) || id === 'asset') folderKinds.set(kind, id);
  }
  async function walk(id, folderKind, depth = 0) {
    if (visited.has(id) || controls.has(id)) return;
    if (visited.size >= 1000 || depth > 8) throw new Error('Blog tree exceeds safety limit.');
    visited.add(id);
    const note = await client(`notes/${encodeURIComponent(id)}`);
    if (isTemplate(note)) return;
    const attrs = labels(note);
    const currentFolder = attrs.blogFolder || folderKinds.get(id);
    const managedKind = currentFolder || folderKind;
    const isImage = ['image', 'file'].includes(note.type) && note.mime?.startsWith('image/');
    const kind = attrs.blogKind || (!currentFolder && isImage && managedKind ? 'asset' : !currentFolder && managedKind !== 'asset' ? managedKind : undefined);
    if (kind && id !== rootId && !currentFolder) {
      attrs.blogKind = kind;
      attrs.blogId ||= id;
      const publish = ownLabel(note, 'publish');
      const record = {
        title: note.title, attrs, mime: note.mime, type: note.type, noteId: id,
        publishSignal: publish ? `${publish.attributeId}:${publish.value}` : '',
        nativeRequested: Boolean(nativeRequest(note)),
        nativeRequest: nativeRequest(note),
        relations: note.attributes.filter(a => a.type === 'relation'),
      };
      if (kind === 'asset') {
        if (!isImage) throw new Error(`Invalid media note: ${note.title}`);
      } else {
        if (!contentKinds.has(kind)) throw new Error(`Unknown blogKind: ${kind}`);
        record.content = await client(`notes/${id}/content`, { raw: true });
      }
      records.push(record);
    }
    const nextKind = kind === 'post' ? 'asset' : managedKind;
    for (const child of note.childNoteIds || []) await walk(child, nextKind, depth + 1);
  }
  await walk(rootId, undefined);
  return records.sort((a, b) => Number(b.attrs.blogKind === 'photo') - Number(a.attrs.blogKind === 'photo'));
}

export function selectPublicationRecords(records, snapshot) {
  const selectedRecords = records.map(record => {
    const selected = { ...record, attrs: { ...record.attrs } };
    if (record.attrs.blogKind === 'asset') return selected;
    if (record.nativeRequested) selected.attrs.publish = 'native';
    else if (!Object.hasOwn(record.attrs, 'publish') || !isPublishValue(record.attrs.publish)
      || !record.publishSignal || record.publishSignal === snapshot.signals?.[record.noteId]) delete selected.attrs.publish;
    return selected;
  });
  const byId = new Map(selectedRecords.map(record => [record.noteId, record]));
  function assetReference(target) {
    if (byId.get(target)?.attrs.blogKind !== 'asset') throw new Error(`Image ${target} is outside the managed blog image library.`);
    return `trilium:${target}`;
  }
  for (const record of selectedRecords) {
    const relations = record.relations || [];
    delete record.relations;
    if (record.attrs.blogKind === 'asset' || !Object.hasOwn(record.attrs, 'publish') || record.attrs.blogDeleted === 'true') continue;
    try {
    if (record.type && (record.type !== 'code' || !contentMimes.has(record.mime))) throw new Error(`Use a Markdown or JSON code note: ${record.title} (${record.noteId})`);
    const image = relations.find(a => a.name === 'blogImage');
    if (image) record.attrs[record.attrs.blogKind === 'photo' ? 'src' : 'image'] = assetReference(image.value);
    const photos = relations.filter(a => a.name === 'blogPhotos');
    if (photos.length) record.attrs.photos = photos.map(a => {
      const photo = byId.get(a.value);
      if (photo?.attrs.blogKind !== 'photo') throw new Error(`Unknown blog photo: ${a.value}`);
      return photo.attrs.blogId;
    }).join(',');
    const avatar = relations.find(a => a.name === 'blogAvatar');
    if (record.attrs.blogKind === 'settings' && record.attrs.blogId === 'homePageContent' && avatar) {
      const data = JSON.parse(record.content);
      data.avatar = assetReference(avatar.value);
      record.content = JSON.stringify(data);
    }
    } catch (error) {
      const failure = new Error(`内容「${record.title}」[${record.attrs.blogKind}/${record.attrs.blogId}]：${error.message}`);
      Object.assign(failure, { noteId: record.noteId, noteTitle: record.title, blogKind: record.attrs.blogKind, blogId: record.attrs.blogId });
      throw failure;
    }
  }
  return selectedRecords;
}

export async function acknowledgeNative(client, requests) {
  const acknowledged = [];
  for (const request of requests) {
    const current = await client(`notes/${request.noteId}`);
    const active = nativeRequest(current);
    if (!active || active.fingerprint !== request.fingerprint || active.attributeId !== request.attributeId) continue;
    await client(`attributes/${active.attributeId}`, { method: 'PATCH', body: { value: 'false' } });
    acknowledged.push(request.noteId);
  }
  return acknowledged;
}
