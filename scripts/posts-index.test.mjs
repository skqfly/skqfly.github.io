import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { postsIndex, updatePostsIndex, frontmatter } from './posts-index.mjs';
import { publicationFiles } from './trilium/sync.mjs';

const post = (meta = '') => `---\ntitle: Article\n${meta}---\n\nBody\n`;
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'posts-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/content/posts/nested'), { recursive: true });
  return root;
}
const put = (root, path, text) => writeFile(resolve(root, `src/content/posts/${path}`), text);

test('index follows Markdown loader paths, sorts deterministically and excludes drafts', async t => {
  const root = await fixture(t);
  await put(root, 'z.md', post());
  await put(root, 'nested/a.mdx', post('draft: false\n'));
  await put(root, 'private.md', post('draft: true\n'));
  await put(root, '_ignored.md', 'not frontmatter');
  await put(root, '.hidden.md', 'not frontmatter');
  await mkdir(resolve(root, 'src/content/posts/.private'));
  await put(root, '.private/hidden.md', 'not frontmatter');
  await put(root, 'notes.txt', 'not an article');
  assert.deepEqual(JSON.parse(await postsIndex(root)), ['src/content/posts/nested/a.mdx', 'src/content/posts/z.md']);
  await updatePostsIndex(root);
  const before = await readFile(resolve(root, 'src/content/posts.json'), 'utf8');
  await updatePostsIndex(root);
  assert.equal(await readFile(resolve(root, 'src/content/posts.json'), 'utf8'), before);
  assert.equal(await readFile(resolve(root, 'src/content/posts/private.md'), 'utf8'), post('draft: true\n'));
});

test('pending sync additions, explicit deletions and manual additions use the same index', async t => {
  const root = await fixture(t);
  await put(root, 'old.md', post());
  await put(root, 'manual.md', post());
  const writes = new Map([['src/content/posts/new.md', post()], ['src/data/site.json', '{}']]);
  assert.deepEqual(JSON.parse(await postsIndex(root, writes, ['src/content/posts/old.md'])), ['src/content/posts/manual.md', 'src/content/posts/new.md']);
  await put(root, 'new.md', post());
  await rm(resolve(root, 'src/content/posts/old.md'));
  await updatePostsIndex(root);
  assert.equal(await readFile(resolve(root, 'src/content/posts.json'), 'utf8'), await postsIndex(root, writes));
});

test('malformed metadata fails before replacing the last good index', async t => {
  const root = await fixture(t);
  await put(root, 'good.md', post());
  await updatePostsIndex(root);
  const original = await readFile(resolve(root, 'src/content/posts.json'), 'utf8');
  await put(root, 'bad.md', post('draft: "false"\n'));
  await assert.rejects(updatePostsIndex(root), /draft must be a boolean/);
  assert.equal(await readFile(resolve(root, 'src/content/posts.json'), 'utf8'), original);
  await put(root, 'bad.md', '---\ntitle: [broken\n---\nBody');
  await assert.rejects(postsIndex(root));
  assert.equal(frontmatter('\uFEFF---\r\ndraft: true\r\n---\r\n').draft, true);
});

test('sync writes submitted posts only and retains GitHub frontmatter including draft', async t => {
  const root = await fixture(t);
  await put(root, 'edited.md', post('draft: true\ncustom: keep\n'));
  const snapshot = { posts: { edited: { meta: { title: 'Published', pubDate: '2026-11-07' }, content: 'New body' }, untouched: { meta: { title: 'Snapshot' }, content: 'Stale' } } };
  const records = [
    { attrs: { blogKind: 'post', blogId: 'edited', publish: '' } },
    { attrs: { blogKind: 'post', blogId: 'untouched' } },
  ];
  const files = await publicationFiles(snapshot, records, root);
  assert.ok(!files.has('src/content/posts/untouched.md'));
  assert.equal(frontmatter(files.get('src/content/posts/edited.md')).draft, true);
  assert.equal(frontmatter(files.get('src/content/posts/edited.md')).custom, 'keep');
  assert.equal(frontmatter(files.get('src/content/posts/edited.md')).title, 'Published');
  assert.deepEqual(JSON.parse(await postsIndex(root, files)), []);
  assert.deepEqual(snapshot.posts.edited.meta, { title: 'Published', pubDate: '2026-11-07' });
});
