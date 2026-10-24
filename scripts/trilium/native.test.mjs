import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeNative, collectNative, nativeRequest, selectPublicationRecords } from './native.mjs';
import { publicationRequest } from './publication.mjs';

const attribute = (noteId, name, value, type = 'label') => ({ noteId, attributeId: `${noteId}-${name}`, type, name, value, utcDateModified: '2026-10-24 00:00:00Z' });
const note = (id, attrs = {}, children = [], mime = 'text/markdown', type = 'code') => ({ noteId: id, title: id, type, mime, blobId: `blob-${id}`, utcDateModified: '2026-10-24 00:00:00Z', childNoteIds: children, attributes: Object.entries(attrs).map(([name, value]) => attribute(id, name, value)) });
function fakeClient(notes, bodies = {}) {
  const calls = [];
  const client = async (path, options) => {
    calls.push({ path, options });
    const [, id, content] = path.split('/');
    assert.ok(notes[id], `unexpected note ${id}`);
    return content ? bodies[id] || '' : structuredClone(notes[id]);
  };
  return { client, calls };
}

test('native collection skips template subtrees, private controls and its rich-text folder pages', async () => {
  const notes = {
    root: note('root', {}, ['posts', 'private', 'log']),
    posts: note('posts', { blogFolder: 'post' }, ['template', 'post']),
    template: note('template', { template: '', blogKind: 'post' }, ['templateChild']),
    post: note('post', { blogPublishRequested: 'true' }, [], 'text/x-markdown'),
  };
  const { client, calls } = fakeClient(notes, { post: '# 正文' });
  const records = await collectNative(client, 'root', { controls: { settings: 'private', log: 'log' } });
  assert.equal(records.length, 1);
  assert.equal(records[0].attrs.blogKind, 'post');
  assert.equal(records[0].attrs.blogId, 'post');
  assert.equal(records[0].content, '# 正文');
  assert.equal(records[0].nativeRequested, true);
  assert.ok(!calls.some(call => /private|log|templateChild/.test(call.path)));
});

test('native collection supports folder IDs from config and all Markdown MIME variants', async () => {
  const notes = {
    root: note('root', {}, ['category']),
    category: note('category', {}, ['a', 'b', 'c']),
    a: note('a', {}, [], 'text/markdown'), b: note('b', {}, [], 'text/x-markdown'), c: note('c', {}, [], 'text/x-gfm'),
  };
  const { client } = fakeClient(notes);
  assert.deepEqual((await collectNative(client, 'root', { folders: { post: 'category' } })).map(r => r.attrs.blogKind), ['post', 'post', 'post']);
});

test('native image, photo and avatar relations resolve only within the managed tree', async () => {
  const notes = {
    root: note('root', {}, ['assets', 'photos', 'talk', 'home']),
    assets: note('assets', { blogFolder: 'asset' }, ['image']),
    image: note('image', {}, [], 'image/png', 'image'),
    photos: note('photos', { blogFolder: 'photo' }, ['photo']),
    photo: note('photo', { blogId: 'photo-slug', blogPublishRequested: 'true' }),
    talk: note('talk', { blogKind: 'talk', blogPublishRequested: 'true' }),
    home: note('home', { blogKind: 'settings', blogId: 'homePageContent', blogPublishRequested: 'true' }, [], 'application/json'),
  };
  notes.photo.attributes.push(attribute('photo', 'blogImage', 'image', 'relation'));
  notes.talk.attributes.push(attribute('talk', 'blogPhotos', 'photo', 'relation'));
  notes.home.attributes.push(attribute('home', 'blogAvatar', 'image', 'relation'));
  const { client } = fakeClient(notes, { home: '{"role":"研究生"}' });
  const records = selectPublicationRecords(await collectNative(client, 'root'), {});
  assert.equal(records[0].noteId, 'photo');
  assert.equal(records.find(r => r.noteId === 'photo').attrs.src, 'trilium:image');
  assert.equal(records.find(r => r.noteId === 'talk').attrs.photos, 'photo-slug');
  assert.equal(JSON.parse(records.find(r => r.noteId === 'home').content).avatar, 'trilium:image');
  notes.photo.attributes.find(a => a.name === 'blogImage').value = 'private-image';
  assert.throws(() => selectPublicationRecords(records.map(r => r.noteId === 'photo' ? { ...r, relations: [attribute('photo', 'blogImage', 'private-image', 'relation')] } : r), {}), /outside the managed/);
});

test('invalid relations, JSON and MIME in unsubmitted drafts cannot block another publication', async () => {
  const notes = {
    root: note('root', {}, ['draft', 'home', 'ready']),
    draft: note('draft', { blogKind: 'post', publish: 'v1' }, [], 'text/html', 'text'),
    home: note('home', { blogKind: 'settings', blogId: 'homePageContent' }, [], 'application/json'),
    ready: note('ready', { blogKind: 'post', blogPublishRequested: 'true' }),
  };
  notes.draft.attributes.push(attribute('draft', 'blogImage', 'missing', 'relation'));
  notes.home.attributes.push(attribute('home', 'blogAvatar', 'missing', 'relation'));
  const { client } = fakeClient(notes, { home: 'not valid JSON' });
  const records = await collectNative(client, 'root');
  const selected = selectPublicationRecords(records, { signals: { draft: 'draft-publish:v1' } });
  assert.equal(Object.hasOwn(selected.find(r => r.noteId === 'draft').attrs, 'publish'), false);
  assert.equal(Object.hasOwn(selected.find(r => r.noteId === 'home').attrs, 'publish'), false);
  assert.equal(selected.find(r => r.noteId === 'ready').attrs.publish, 'native');
  records.find(r => r.noteId === 'draft').nativeRequested = true;
  assert.throws(() => selectPublicationRecords(records, {}), /Use a Markdown or JSON code note: draft \(draft\)/);
});

test('only a changed legacy signal or an explicit native request publishes edits', () => {
  const make = (id, value, signal, nativeRequested = false) => ({ noteId: id, attrs: { blogKind: 'post', publish: value }, publishSignal: signal, nativeRequested });
  const source = [make('unchanged', '', 'attr:'), make('changed', 'v2', 'attr:v2'), make('off', 'false', 'attr:false'), make('zero', '0', 'attr:0'), make('native', 'false', 'attr:false', true)];
  const selected = selectPublicationRecords(source, { signals: { unchanged: 'attr:', changed: 'attr:v1' } });
  assert.equal(Object.hasOwn(selected[0].attrs, 'publish'), false);
  assert.equal(selected[1].attrs.publish, 'v2');
  assert.equal(Object.hasOwn(selected[2].attrs, 'publish'), false);
  assert.equal(Object.hasOwn(selected[3].attrs, 'publish'), false);
  assert.equal(selected[4].attrs.publish, 'native');
  assert.equal(source[0].attrs.publish, '', 'selection does not modify fetched records');
});

test('a native request remains queued until acknowledged and can be requested again', async () => {
  const pending = note('new-post', { blogKind: 'post', blogPublishRequested: 'true' });
  const root = note('native-root');
  const client = async path => ({ results: path.includes(encodeURIComponent('#blogPublishRequested = true')) ? [pending] : [] });
  const first = await publicationRequest(client, { rootNoteId: root.noteId }, root);
  const repeated = await publicationRequest(client, { rootNoteId: root.noteId }, root);
  assert.match(first.request, /^\d{13}-[a-f0-9]{8}$/);
  assert.equal(first.nativeRequests.length, 1);
  assert.equal(repeated.nativeRequests.length, 1);
  pending.attributes.find(a => a.name === 'blogPublishRequested').value = 'false';
  assert.equal((await publicationRequest(client, { rootNoteId: root.noteId }, root)).request, '');
  pending.attributes.find(a => a.name === 'blogPublishRequested').value = 'true';
  assert.ok((await publicationRequest(client, { rootNoteId: root.noteId }, root)).request);
});

test('native acknowledgement clears only an unchanged owned request', async () => {
  const pending = note('post', { blogPublishRequested: 'true', description: '保存的简介' });
  const request = nativeRequest(pending);
  const writes = [];
  const client = async (path, options) => options ? writes.push({ path, options }) : structuredClone(pending);
  assert.deepEqual(await acknowledgeNative(client, [request]), ['post']);
  assert.deepEqual(writes, [{ path: 'attributes/post-blogPublishRequested', options: { method: 'PATCH', body: { value: 'false' } } }]);
  writes.length = 0;
  pending.attributes.find(a => a.name === 'description').value = '运行期间的新简介';
  assert.deepEqual(await acknowledgeNative(client, [request]), []);
  assert.deepEqual(writes, []);
  pending.attributes.find(a => a.name === 'description').value = '保存的简介';
  pending.blobId = 'new-content';
  assert.deepEqual(await acknowledgeNative(client, [request]), []);
  pending.attributes.find(a => a.name === 'blogPublishRequested').noteId = 'template';
  assert.equal(nativeRequest(pending), null, 'template request attributes must never be acknowledged');
});

test('template source publication switches never enqueue requests', async () => {
  const template = note('template', { template: '', blogKind: 'post', publish: 'true', blogPublishRequested: 'true' });
  const root = note('native-root');
  const result = await publicationRequest(async () => ({ results: [template] }), { rootNoteId: root.noteId }, root);
  assert.equal(result.request, '');
  assert.deepEqual(result.nativeRequests, []);
  assert.deepEqual(result.signals, {});
});
