import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const indexPath = 'src/content/posts.json';

export function frontmatter(content, path = 'post') {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  const meta = yaml.load(match[1]);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error(`Invalid frontmatter: ${path}`);
  return meta;
}

// Pending writes/deletions let sync validate the index before changing any files.
export async function postsIndex(directory = root, writes = new Map(), removed = []) {
  const posts = new Map();
  async function walk(relative) {
    for (const entry of await readdir(resolve(directory, relative), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /^[^_].*\.(md|mdx)$/.test(entry.name)) posts.set(path, null);
    }
  }
  await walk('src/content/posts');
  for (const [path, content] of writes) {
    if (/^src\/content\/posts\/(?:.*\/)?[^_/][^/]*\.(md|mdx)$/.test(path)) posts.set(path, content);
  }
  for (const path of removed) posts.delete(path);
  const paths = [];
  for (const [path, pending] of posts) {
    const meta = frontmatter(pending ?? await readFile(resolve(directory, path), 'utf8'), path);
    if (meta.draft !== undefined && typeof meta.draft !== 'boolean') throw new Error(`draft must be a boolean: ${path}`);
    if (meta.draft !== true) paths.push(path);
  }
  return JSON.stringify(paths.sort(), null, 2) + '\n';
}

export async function updatePostsIndex(directory = root) {
  const content = await postsIndex(directory);
  const path = resolve(directory, indexPath);
  const current = await readFile(path, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (current !== content) await writeFile(path, content);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await updatePostsIndex();
}
