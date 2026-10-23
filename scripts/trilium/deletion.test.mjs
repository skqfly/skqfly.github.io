import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyRecords } from './model.mjs';

const initial = () => readFile(new URL('../../trilium/published.json', import.meta.url), 'utf8').then(JSON.parse);
const record = (kind, id, attrs = {}, content = '测试正文') => ({ title: '测试标题', attrs: { blogKind: kind, blogId: id, publish: '', ...attrs }, content });

test('published soft deletion removes a post and leaves its source snapshot unchanged', async () => {
  const base = await initial();
  const id = Object.keys(base.posts)[0];
  const result = applyRecords(base, [record('post', id, { blogDeleted: 'true' })]);
  assert.equal(Object.hasOwn(result.posts, id), false);
  assert.deepEqual(Object.keys(result.posts), Object.keys(base.posts).filter(key => key !== id));
  assert.deepEqual(base, await initial());
});

for (const [kind, section, key] of [
  ['talk', 'talksPageContent', 'entries'],
  ['project', 'projectsPageContent', 'projects'],
  ['friend', 'friendsPageContent', 'friends'],
]) {
  test(`soft deletion keeps ${kind} IDs and ordered entries aligned`, async () => {
    const base = await initial();
    const index = base.ids[kind].length - 1;
    const id = base.ids[kind][index];
    const result = applyRecords(base, [record(kind, id, { blogDeleted: 'true' })]);
    assert.deepEqual(result.ids[kind], base.ids[kind].filter((_, i) => i !== index));
    assert.deepEqual(result.site[section][key], base.site[section][key].filter((_, i) => i !== index));
  });
}

test('deleting a photo also removes it from existing and republished Talk images in either record order', async () => {
  const base = await initial();
  const photoId = Object.keys(base.photos)[0];
  const src = base.photos[photoId].src;
  const deletion = record('photo', photoId, { blogDeleted: 'true' });
  const talk = record('talk', 'new-talk', { date: '2026-10-23', photos: photoId });
  assert.ok(base.site.talksPageContent.entries.some(entry => entry.images.some(image => image.src === src)));
  for (const records of [[deletion, talk], [talk, deletion]]) {
    const result = applyRecords(base, records);
    assert.equal(Object.hasOwn(result.photos, photoId), false);
    assert.ok(result.site.talksPageContent.entries.every(entry => entry.images.every(image => image.src !== src)));
    assert.deepEqual(result.site.talksPageContent.entries.at(-1).images, []);
  }
});

test('unchecked deletion is only a draft; deleting a missing item is harmless; settings cannot be deleted', async () => {
  const base = await initial();
  const draft = record('post', Object.keys(base.posts)[0], { blogDeleted: 'true' });
  delete draft.attrs.publish;
  assert.deepEqual(applyRecords(base, [draft]), base);
  assert.deepEqual(applyRecords(base, [record('friend', 'already-absent', { blogDeleted: 'true' })]), base);
  assert.throws(() => applyRecords(base, [record('settings', 'identity', { blogDeleted: 'true' })]), /cannot be deleted/);
});

test('publishing restored content re-adds a deleted photo and its Talk reference', async () => {
  const base = await initial();
  const id = Object.keys(base.photos)[0];
  const original = base.photos[id];
  const deleted = applyRecords(base, [record('photo', id, { blogDeleted: 'true' })]);
  const restored = applyRecords(deleted, [
    record('photo', id, { ...original, width: String(original.width), height: String(original.height), blogDeleted: 'false' }, original.alt),
    record('talk', 'restored-talk', { date: '2026-10-23', photos: id }),
  ]);
  assert.deepEqual(restored.photos[id], original);
  assert.deepEqual(restored.site.talksPageContent.entries.at(-1).images, [original]);
});

test('publishing a restored post re-adds its Markdown body', async () => {
  const base = await initial();
  const id = Object.keys(base.posts)[0];
  const original = base.posts[id];
  const deleted = applyRecords(base, [record('post', id, { blogDeleted: 'true' })]);
  const { title, image, ...meta } = original.meta;
  const restored = applyRecords(deleted, [{ title, attrs: { blogKind: 'post', blogId: id, publish: 'restore', blogDeleted: 'false', ...meta, image: image.url, imageAlt: image.alt }, content: original.content }]);
  assert.deepEqual(restored.posts[id], original);
});
