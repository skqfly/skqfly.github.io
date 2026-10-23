import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { mediaPath, mediaReferences, prepareMedia, replaceMedia, unusedMedia } from './media.mjs';

const image = () => sharp({ create: { width: 12, height: 8, channels: 4, background: '#287ab4' } }).png().toBuffer();
const asset = (noteId = 'image_1', mime = 'image/png') => ({ noteId, mime, attrs: { blogKind: 'asset' }, content: '' });
const photo = (attrs = {}) => ({ noteId: 'photo_1', title: '测试照片', attrs: { blogKind: 'photo', publish: 'v1', src: 'trilium:image_1', ...attrs }, content: '照片描述' });

test('published image exports a WebP and both previews with real image dimensions', async () => {
  const png = await image();
  const calls = [];
  const result = await prepareMedia(async (path, options) => {
    calls.push({ path, options });
    return png;
  }, [asset(), photo()], {});
  assert.deepEqual(calls, [{ path: 'notes/image_1/content', options: { binary: true } }]);
  assert.deepEqual([...result.files.keys()], [
    'public/trilium-media/image_1.webp',
    'public/trilium-media/image_1-480.webp',
    'public/trilium-media/image_1-960.webp',
  ]);
  for (const bytes of result.files.values()) {
    const info = await sharp(bytes).metadata();
    assert.equal(info.format, 'webp');
    assert.equal(info.width, 12);
    assert.equal(info.height, 8);
  }
  assert.deepEqual(result.assets.image_1, {
    path: '/trilium-media/image_1.webp',
    sha256: createHash('sha256').update(png).digest('hex'),
    width: 12,
    height: 8,
  });
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0].attrs, {
    blogKind: 'photo', publish: 'v1', src: '/trilium-media/image_1.webp',
    width: '12', height: '8', preview: '/trilium-media/image_1-480.webp', previewLarge: '/trilium-media/image_1-960.webp',
  });
});

test('drafts and soft-deleted content do not export or resolve their private images', async () => {
  const draft = photo();
  delete draft.attrs.publish;
  const deleted = photo({ blogDeleted: 'true' });
  const result = await prepareMedia(async () => assert.fail('private images must not be downloaded'), [asset(), draft, deleted], {});
  assert.equal(result.files.size, 0);
  assert.deepEqual(result.assets, {});
  assert.deepEqual(result.records, [draft, deleted]);
  assert.equal(result.records[0].attrs.src, 'trilium:image_1');
});

test('unsupported image types and references outside the managed library fail before downloading', async () => {
  const client = async () => assert.fail('invalid media must not be downloaded');
  await assert.rejects(prepareMedia(client, [asset('image_1', 'image/svg+xml'), photo()], {}), /Unsupported image type/);
  await assert.rejects(prepareMedia(client, [photo()], {}), /removed from Trilium/);
  await assert.rejects(prepareMedia(client, [photo()], { assets: { image_1: { path: '/old.webp' } } }), /removed from Trilium/);
});

test('repeated references download once and an unchanged hash skips image rewrites', async () => {
  const png = await image();
  let downloads = 0;
  const client = async () => { downloads++; return png; };
  const post = { noteId: 'post_1', attrs: { blogKind: 'post', publish: '', image: 'trilium:image_1' }, content: '![图片](trilium:image_1)' };
  const records = [asset(), photo(), post];
  const first = await prepareMedia(client, records, {});
  assert.equal(downloads, 1);
  const second = await prepareMedia(client, records, { assets: first.assets });
  assert.equal(downloads, 2);
  assert.equal(second.files.size, 0);
  assert.deepEqual(second.assets, first.assets);
  assert.deepEqual(second.records, first.records);
  assert.equal(post.content, '![图片](trilium:image_1)', 'input records remain unchanged');
});

test('media replacement handles nested settings, Markdown and lists and rejects unresolved references', () => {
  const data = { avatar: 'trilium:avatar_1', images: ['trilium:image_1', null], post: '![图](trilium:image_1)', count: 3 };
  assert.deepEqual([...mediaReferences(data)], ['avatar_1', 'image_1']);
  assert.deepEqual(replaceMedia(data, { avatar_1: '/avatar.webp', image_1: '/photo.webp' }), {
    avatar: '/avatar.webp', images: ['/photo.webp', null], post: '![图](/photo.webp)', count: 3,
  });
  assert.throws(() => replaceMedia(data, { avatar_1: '/avatar.webp' }), /Image image_1 is missing/);
  assert.equal(mediaPath('valid-id_123'), '/trilium-media/valid-id_123.webp');
  assert.throws(() => mediaPath('../escape'), /Invalid image note ID/);
});

test('unused media detection includes photo, site and post references', () => {
  assert.deepEqual(unusedMedia({
    site: { avatar: '/avatar.webp' }, photos: { p: { src: '/photo.webp' } }, posts: { p: { content: '![](/post.webp)' } },
    assets: { avatar: { path: '/avatar.webp' }, photo: { path: '/photo.webp' }, post: { path: '/post.webp' }, orphan: { path: '/unused.webp' } },
  }), ['orphan']);
});
