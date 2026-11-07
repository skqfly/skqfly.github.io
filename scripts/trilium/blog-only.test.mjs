import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyBlogRecords } from './model.mjs';
import { outputFiles } from './sync.mjs';
import { collectNative, selectPublicationRecords } from './native.mjs';
import { publicationRequest } from './publication.mjs';

const initial = () => readFile(new URL('../../trilium/published.json', import.meta.url), 'utf8').then(JSON.parse);
const post = (attrs = {}) => ({ noteId: 'article', title: 'Article', attrs: { blogKind: 'post', blogId: 'new-article', publish: '', pubDate: '2026-11-07', description: 'Description', author: 'skqfly', ...attrs }, content: '![inline](/trilium-media/shared.webp)\n\n$x^2$' });
const note = (id, attrs = {}, children = [], type = 'code', mime = 'text/markdown') => ({ noteId: id, title: id, type, mime, childNoteIds: children, attributes: Object.entries(attrs).map(([name, value]) => ({ type: 'label', name, value, noteId: id, attributeId: `${id}-${name}` })) });

test('only posts can change; stale non-blog data cannot block blog updates', async () => {
  const base = await initial();
  base.site = { appManaged: true };
  base.photos = { appPhoto: { src: '/photos/app.jpg', alt: 'Accessible only' } };
  const retired = ['talk', 'photo', 'friend', 'project', 'settings'].map(blogKind => post({ blogKind, blogDeleted: 'true', blogId: '../invalid' }));
  const updated = applyBlogRecords(base, [post(), ...retired]);
  assert.deepEqual(updated.site, base.site);
  assert.deepEqual(updated.photos, base.photos);
  assert.deepEqual(updated.ids, base.ids);
  assert.match(updated.posts['new-article'].content, /shared.webp/);
  const paths = [...outputFiles(updated).keys()];
  assert.ok(!paths.some(path => path.startsWith('src/data/')));
  assert.ok(paths.every(path => path.startsWith('src/content/posts/') || ['trilium/published.json', 'trilium/signals.json'].includes(path)));
  const deleted = applyBlogRecords(updated, [post({ blogDeleted: 'true' })]);
  assert.ok(!deleted.posts['new-article']);
  assert.deepEqual(deleted.assets, base.assets);
  const draft = post(); delete draft.attrs.publish;
  assert.deepEqual(applyBlogRecords(updated, [draft]), updated);
  assert.throws(() => applyBlogRecords(base, [post({ blogId: '../escape' })]), /Invalid blogId/);
  assert.throws(() => applyBlogRecords(base, [post(), post()]), /Duplicate/);
});

test('collection ignores retired subtrees but resolves article cover and nested images', async () => {
  const notes = {
    root: note('root', {}, ['posts', 'media', 'retired', 'talk', 'panel']),
    posts: note('posts', { blogFolder: 'post' }, ['article']),
    article: note('article', { blogPublishRequested: 'true' }, ['inline', 'source']),
    inline: note('inline', {}, [], 'image', 'image/png'),
    source: note('source', {}, [], 'code', 'text/x-mermaid'),
    media: note('media', { blogFolder: 'asset' }, ['cover']),
    cover: note('cover', {}, [], 'image', 'image/png'),
    talk: note('talk', { blogKind: 'talk' }, ['must-not-fetch']),
  };
  notes.article.attributes.push({ type: 'relation', name: 'blogImage', value: 'cover' });
  const calls = [];
  const client = async path => {
    calls.push(path);
    const [, id, content] = path.split('/');
    assert.ok(notes[id], `Unexpected fetch: ${path}`);
    return content ? '![image](trilium:inline)' : structuredClone(notes[id]);
  };
  const config = { retiredFolders: { photo: 'retired' }, retiredControls: { panel: 'panel' } };
  const records = selectPublicationRecords(await collectNative(client, 'root', config), {});
  assert.deepEqual(records.map(r => r.attrs.blogKind).sort(), ['asset', 'asset', 'post']);
  assert.equal(records.find(r => r.noteId === 'article').attrs.image, 'trilium:cover');
  assert.ok(!calls.some(path => /retired|panel|must-not-fetch/.test(path)));
});

test('retired signals and requests never enqueue; implicit native article kinds still work', async () => {
  const root = note('root');
  const retired = ['talk', 'photo', 'friend', 'project', 'settings', 'asset'].map(kind => note(kind, { blogKind: kind, publish: 'changed', blogPublishRequested: 'true' }));
  const config = { rootNoteId: 'root', folders: { post: 'posts' } };
  const paths = [];
  let matches = retired;
  const client = async path => { paths.push(path); return { results: matches }; };
  assert.equal((await publicationRequest(client, config, root)).request, '');
  matches = [...retired, note('native-post', { blogPublishRequested: 'true' })];
  const queued = await publicationRequest(client, config, root);
  assert.deepEqual(queued.nativeRequests.map(r => r.noteId), ['native-post']);
  assert.ok(paths.every(path => path.includes('ancestorNoteId=posts')));
});

test('sync does not stage site data or collect shared media garbage', async () => {
  const sync = await readFile(new URL('./sync.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../../.github/workflows/trilium-sync.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(sync, /unusedMedia|removed\.push\(file\)/);
  assert.doesNotMatch(workflow.split('\n').find(line => line.includes('git add')), /src\/data/);
  const gallery = await readFile(new URL('../../src/pages/photos.astro', import.meta.url), 'utf8');
  const lightbox = await readFile(new URL('../../src/components/ImageLightbox.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(gallery + lightbox, /<figcaption|class=["'][^"']*caption/);
  assert.match(gallery, /alt=\{photo\.alt\}/);
  assert.match(lightbox, /image.alt = photo.alt/);
});

test('legacy config ignores retired folders and retains explicit root publication requests', async () => {
  const notes = {
    root: note('root', {}, ['posts', 'old-photos']),
    posts: note('posts', {}, ['article']),
    article: note('article', { blogKind: 'post' }),
  };
  const legacyConfig = { rootNoteId: 'root', folders: { post: 'posts', photo: 'old-photos' } };
  const client = async path => {
    const [, id, content] = path.split('/');
    assert.ok(notes[id], `Retired folder unexpectedly read: ${path}`);
    return content ? 'Article body' : structuredClone(notes[id]);
  };
  assert.deepEqual((await collectNative(client, 'root', legacyConfig)).map(r => r.noteId), ['article']);
  const request = '1794000000000-abcd1234';
  const root = note('root', { blogSyncRequest: request });
  const queued = await publicationRequest(async () => ({ results: [] }), legacyConfig, root);
  assert.equal(queued.request, request);
  assert.deepEqual(queued.nativeRequests, []);
});
