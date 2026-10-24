import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyRecords } from './model.mjs';
import { outputFiles } from './sync.mjs';
import { publicationRequest } from './publication.mjs';

const initial = () => readFile(new URL('../../trilium/published.json', import.meta.url), 'utf8').then(JSON.parse);
const record = (kind, id, attrs = {}, content = '测试正文') => ({ title: '测试标题', attrs: { blogKind: kind, blogId: id, publish: '', ...attrs }, content });

test('unpublished drafts preserve the published version', async () => {
  const base = await initial();
  const draft = record('post', Object.keys(base.posts)[0]);
  delete draft.attrs.publish;
  assert.deepEqual(applyRecords(base, [draft]), base);
});
test('reject duplicate IDs and path traversal before writing', async () => {
  const base = await initial();
  assert.throws(() => applyRecords(base, [record('photo', '../config')]));
  const photo = record('photo', 'new', { src: 'https://example.com/a.jpg', width: '10', height: '20' });
  assert.throws(() => applyRecords(base, [photo, photo]), /Duplicate/);
});
test('reject invalid date, URL and missing photo references', async () => {
  const base = await initial();
  assert.throws(() => applyRecords(base, [record('post', 'new', { pubDate: 'bad' })]));
  assert.throws(() => applyRecords(base, [record('friend', 'new', { url: 'javascript:alert(1)', domain: 'bad', image: '/logo.svg' })]));
  assert.throws(() => applyRecords(base, [record('talk', 'new', { date: '2026-10-23', photos: 'not-a-photo' })]), /Unknown photo/);
});
test('publish all supported content kinds and preserve literal Markdown', async () => {
  const base = await initial();
  const result = applyRecords(base, [
    record('photo', 'new', { src: 'https://example.com/a.jpg', width: '100', height: '200' }),
    record('post', 'new', { pubDate: '2026-10-23', description: '简介', author: 'skqfly' }, '$a^2$\n\n```js\nconst x = 1;\n```\n'),
    record('talk', 'new', { date: '2026-10-23', photos: 'new' }),
    record('friend', 'new', { url: 'https://example.com', domain: 'example.com', image: '/logo.svg' }),
    record('project', 'new', { url: 'https://example.com', image: '/logo.svg', categories: 'Web', tags: 'Tool' }),
    record('settings', 'identity', {}, '{"name":"new name","logo":"/logo.svg"}'),
  ]);
  assert.equal(result.site.identity.name, 'new name');
  assert.equal(result.site.talksPageContent.entries.at(-1).images[0].width, 100);
  assert.equal(result.site.friendsPageContent.friends.at(-1).title, '测试标题');
  assert.equal(result.site.projectsPageContent.projects.at(-1).title, '测试标题');
  assert.ok(outputFiles(result).get('src/content/posts/new.md').includes('$a^2$\n\n```js'));
  assert.deepEqual(base, await initial());
});
test('settings arrays can shrink without leaving stale entries', async () => {
  const result = applyRecords(await initial(), [record('settings', 'navBarLinks', {}, '[{"title":"Blog","url":"/blog"}]')]);
  assert.equal(result.site.navBarLinks.length, 1);
});
test('publishing controls enqueue requests and ignore unrelated attributes', async () => {
  const source = await readFile(new URL('./request.js', import.meta.url), 'utf8');
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('api', source);
  const values = {};
  const api = { originEntity: { type: 'label', name: 'description' }, getNote: id => id === '__ROOT__' ? { setLabel: (key, value) => { values[key] = value; } } : { getContent: () => '{"githubToken":""}' }, randomString: () => 'abcdefgh' };
  await run(api);
  assert.deepEqual(values, {});
  api.originEntity.name = 'publish';
  assert.deepEqual(await run(api), { queued: true, immediate: false });
  assert.match(values.blogSyncRequest, /^\d{13}-abcdefgh$/);
});
test('tag polling detects new publish signals and ignores unchanged or removed tags', async () => {
  const config = JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
  const old = JSON.parse(await readFile(new URL('../../trilium/signals.json', import.meta.url), 'utf8'));
  const notes = Object.entries(old).map(([noteId, signal]) => {
    const colon = signal.indexOf(':');
    return { noteId, attributes: [{ type: 'label', name: 'blogKind', value: 'post' }, { type: 'label', name: 'publish', attributeId: signal.slice(0, colon), value: signal.slice(colon + 1) }] };
  });
  const root = notes.find(n => n.noteId === config.rootNoteId) || { noteId: config.rootNoteId, attributes: [] };
  const client = async path => ({ results: path.includes(encodeURIComponent('#blogPublishRequested = true')) ? [] : notes });
  assert.equal((await publicationRequest(client, config, root)).request, '');
  notes.push({ noteId: 'newNote', attributes: [{ type: 'label', name: 'blogKind', value: 'post' }, { type: 'label', name: 'publish', attributeId: 'newSignal', value: 'v1' }] });
  assert.match((await publicationRequest(client, config, root)).request, /^\d{13}-[a-f0-9]{8}$/);
  notes.pop();
  notes.pop();
  assert.equal((await publicationRequest(client, config, root)).request, '');
});
