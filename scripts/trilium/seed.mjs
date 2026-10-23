import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import yaml from 'js-yaml';
import { createClient, setLabel } from './client.mjs';
import { outputFiles } from './sync.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const destination = resolve(root, 'trilium/config.json');
const client = createClient();
const json = v => JSON.stringify(v, null, 2) + '\n';
await mkdir(resolve(root, 'trilium'), { recursive: true });
let previous;
try { previous = JSON.parse(await readFile(destination, 'utf8')); if (previous.initialized) throw new Error('Already initialized; refusing to duplicate or overwrite notes.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

// Evaluate only this repository's configuration, never content received from Trilium.
const source = (await readFile(resolve(root, 'src/config.ts'), 'utf8')).replace('./data/photos', pathToFileURL(resolve(root, 'src/data/photos.ts')).href);
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const config = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { photoLibrary } = await import(pathToFileURL(resolve(root, 'src/data/photos.ts')).href);
const snapshot = { site: JSON.parse(JSON.stringify(config)), photos: photoLibrary, posts: {}, ids: { talk: [], project: [], friend: [] } };
for (const file of await readdir(resolve(root, 'src/content/posts'))) {
  if (!file.endsWith('.md')) throw new Error(`Unsupported existing post: ${file}`);
  const source = await readFile(resolve(root, 'src/content/posts', file), 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing frontmatter: ${file}`);
  const meta = yaml.load(match[1]);
  meta.pubDate = new Date(meta.pubDate).toISOString().slice(0, 10);
  snapshot.posts[file.slice(0, -3)] = { meta, content: match[2].replace(/^\r?\n/, '').replaceAll('\r\n', '\n') };
}
const children = new Map();
async function create(parentNoteId, title, content = '', attrs = {}, mime = 'text/markdown') {
  if (!children.has(parentNoteId)) {
    const parent = await client(`notes/${parentNoteId}`);
    const byTitle = new Map();
    for (const child of parent.childNoteIds || []) {
      const candidate = await client(`notes/${child}`);
      byTitle.set(candidate.title, candidate);
    }
    children.set(parentNoteId, byTitle);
  }
  const byTitle = children.get(parentNoteId);
  let note = byTitle.get(title);
  if (!note) {
    const created = await client('create-note', { method: 'POST', body: { parentNoteId, title, type: 'code', mime, content } });
    note = await client(`notes/${created.note.noteId}`);
    byTitle.set(title, note);
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (!note.attributes.some(a => a.type === 'label' && a.name === name)) await setLabel(client, note, name, String(value));
  }
  console.log(`Imported: ${title}`);
  return note.noteId;
}
const rootId = previous?.rootNoteId || await create('root', '博客管理 · skqfly', await readFile(resolve(root, 'trilium/使用说明.md'), 'utf8'));
// Persist the root immediately so a failed import can be inspected and resumed deliberately.
await writeFile(destination, json({ rootNoteId: rootId, repository: 'skqfly/skqfly.github.io', branch: 'main', initialized: false }));
const folders = {};
for (const [kind, title] of Object.entries({ post: '文章 Posts', talk: '动态 Talks', photo: '照片 Photos', friend: '友链 Friends', project: '项目 Projects', settings: '站点设置' })) folders[kind] = await create(rootId, title);
for (const [id, post] of Object.entries(snapshot.posts)) {
  const { title, pubDate, description, author, category, image } = post.meta;
  await create(folders.post, title, post.content, { blogKind: 'post', blogId: id, publish: '', pubDate, description, author, category: category || 'Notes', image: image?.url || '/logo.svg', imageAlt: image?.alt || '' });
}
for (const [id, photo] of Object.entries(photoLibrary)) await create(folders.photo, photo.alt, photo.alt, { blogKind: 'photo', blogId: id, publish: '', ...Object.fromEntries(Object.entries(photo).filter(([key]) => key !== 'alt')) });
const photoIds = Object.entries(photoLibrary);
for (const talk of snapshot.site.talksPageContent.entries) {
  snapshot.ids.talk.push(talk.id);
  await create(folders.talk, talk.title, talk.description, { blogKind: 'talk', blogId: talk.id, publish: '', date: talk.date, photos: talk.images.map(img => photoIds.find(([, p]) => p.src === img.src)?.[0]).filter(Boolean).join(',') });
}
for (const [kind, items] of [['friend', snapshot.site.friendsPageContent.friends], ['project', snapshot.site.projectsPageContent.projects]]) {
  for (const [i, item] of items.entries()) {
    const id = `${kind}-${i + 1}`;
    snapshot.ids[kind].push(id);
    const { title, description, ...attrs } = item;
    await create(folders[kind], title, description, { blogKind: kind, blogId: id, publish: '', ...Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value])) });
  }
}
for (const [id, value] of Object.entries(snapshot.site)) {
  const content = Array.isArray(value) ? value : Object.fromEntries(Object.entries(value).filter(([key]) => !['entries', 'friends', 'projects'].includes(key)));
  await create(folders.settings, id, json(content), { blogKind: 'settings', blogId: id, publish: '' }, 'application/json');
}
for (const [path, content] of outputFiles(snapshot)) {
  // The initial import never rewrites the existing Markdown articles.
  if (path.startsWith('src/content/posts/')) continue;
  await writeFile(resolve(root, path), content);
}
await writeFile(destination, json({ rootNoteId: rootId, repository: 'skqfly/skqfly.github.io', branch: 'main', initialized: true }));
console.log(JSON.stringify({ rootNoteId: rootId, posts: Object.keys(snapshot.posts).length, photos: Object.keys(photoLibrary).length, talks: snapshot.ids.talk.length, friends: snapshot.ids.friend.length, projects: snapshot.ids.project.length }));
