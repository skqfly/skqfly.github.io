import { z } from 'astro/zod';

const text = z.string();
const nonempty = text.min(1);
const link = text.refine(v => v.startsWith('/') && !v.startsWith('//') || /^(https?:\/\/|mailto:)/.test(v), 'Use a site path or HTTP(S)/mailto URL');
const seo = z.object({ title: nonempty, description: text, image: link });
const nav = z.object({ title: nonempty, url: link, external: z.boolean().optional() });
const social = nav.extend({ icon: nonempty });
const date = text.regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date (YYYY-MM-DD)');
const company = z.object({ name: nonempty, image: link, url: link });
export const photoSchema = z.object({ src: link, width: z.number().int().positive(), height: z.number().int().positive(), alt: nonempty, preview: link, previewLarge: link });
export const friendSchema = z.object({ id: nonempty, title: nonempty, description: text, url: z.url().refine(v => /^https?:/.test(v)), domain: nonempty, image: link });
export const projectSchema = z.object({ id: nonempty, title: nonempty, description: text, image: link, categories: z.array(nonempty), tags: z.array(nonempty), url: link });
export const talkSchema = z.object({ id: nonempty, title: nonempty, date, description: text, images: z.array(photoSchema) });
export const siteSchema = z.object({
  identity: z.object({ name: nonempty, logo: link, email: text.optional() }),
  navBarLinks: z.array(nav), socialLinks: z.array(social),
  homePageContent: z.object({ seo, role: text, description: text, avatar: z.union([link, z.literal('')]).optional(), socialLinks: z.array(social), links: z.array(nav) }),
  aboutPageContent: z.object({ seo, subtitle: text, about: z.object({ description: text }), work: z.object({ description: text, items: z.array(z.object({ title: nonempty, company, date: nonempty })) }), connect: z.object({ description: text, links: z.array(social) }) }),
  blogPageContent: z.object({ seo }),
  talksPageContent: z.object({ seo, subtitle: text, entries: z.array(talkSchema) }),
  projectsPageContent: z.object({ seo, subtitle: text, projects: z.array(projectSchema.omit({ id: true })) }),
  friendsPageContent: z.object({ seo, subtitle: text, friends: z.array(friendSchema.omit({ id: true })) }),
});
export const postSchema = z.object({ title: nonempty, pubDate: date.transform(v => new Date(v)), description: nonempty, author: nonempty, category: nonempty, image: z.object({ url: link, alt: text }) });
export const validId = id => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)) throw new Error(`Invalid blogId: ${id}`);
  return id;
};

export function applyRecords(snapshot, records) {
  const result = structuredClone(snapshot);
  const used = new Set();
  const removedPhotos = new Set(records.filter(r => r.attrs.blogKind === 'photo' && r.attrs.blogDeleted === 'true' && Object.hasOwn(r.attrs, 'publish')).map(r => r.attrs.blogId));
  const collections = { talk: result.site.talksPageContent.entries, friend: result.site.friendsPageContent.friends, project: result.site.projectsPageContent.projects };
  for (const { title, attrs, content, noteId } of records) {
    const { blogKind: kind, blogId: id } = attrs;
    try {
    if (!['post', 'talk', 'photo', 'friend', 'project', 'settings'].includes(kind)) throw new Error(`Unknown blogKind: ${kind}`);
    validId(id);
    const key = `${kind}/${id}`;
    if (used.has(key)) throw new Error(`Duplicate ${key}`);
    used.add(key);
    // Unchecked publish means keep the last published version, never silently delete it.
    if (!Object.hasOwn(attrs, 'publish')) continue;
    if (attrs.blogDeleted === 'true') {
      if (kind === 'settings') throw new Error('Site settings cannot be deleted.');
      if (kind === 'post') delete result.posts[id];
      else if (kind === 'photo') {
        const photo = result.photos[id];
        if (photo) result.site.talksPageContent.entries.forEach(t => { t.images = t.images.filter(p => p.src !== photo.src); });
        delete result.photos[id];
      } else {
        const index = result.ids[kind].indexOf(id);
        if (index >= 0) { result.ids[kind].splice(index, 1); collections[kind].splice(index, 1); }
      }
      continue;
    }
    if (kind === 'settings') {
      if (!Object.hasOwn(result.site, id)) throw new Error(`Unknown settings section: ${id}`);
      const data = JSON.parse(content);
      if (['entries', 'friends', 'projects'].some(k => Object.hasOwn(data, k))) throw new Error('Edit entries in their individual notes.');
      if (Array.isArray(result.site[id])) result.site[id] = data;
      else Object.assign(result.site[id], data);
    } else if (kind === 'post') {
      const meta = postSchema.parse({ title, pubDate: attrs.pubDate, description: attrs.description, author: attrs.author, category: attrs.category || 'Notes', image: { url: attrs.image || '/logo.svg', alt: attrs.imageAlt || '' } });
      result.posts[id] = { meta: { ...meta, pubDate: meta.pubDate.toISOString().slice(0, 10) }, content };
    } else if (kind === 'photo') {
      result.photos[id] = photoSchema.parse({ src: attrs.src, width: Number(attrs.width), height: Number(attrs.height), alt: content.trim() || title, preview: attrs.preview || attrs.src, previewLarge: attrs.previewLarge || attrs.src });
    } else {
      const data = { id, title, description: content.trim() };
      if (kind === 'talk') Object.assign(data, { date: attrs.date, images: (attrs.photos || '').split(',').map(s => s.trim()).filter(id => id && !removedPhotos.has(id)).map(photoId => {
        const photo = result.photos[photoId];
        if (!photo) throw new Error(`Unknown photo: ${photoId}`);
        return photo;
      }) });
      if (kind === 'friend') Object.assign(data, { url: attrs.url, domain: attrs.domain, image: attrs.image || '/logo.svg' });
      if (kind === 'project') Object.assign(data, { url: attrs.url, image: attrs.image || '/logo.svg', categories: (attrs.categories || '').split(',').map(s => s.trim()).filter(Boolean), tags: (attrs.tags || '').split(',').map(s => s.trim()).filter(Boolean) });
      const schema = { talk: talkSchema, friend: friendSchema, project: projectSchema }[kind];
      const parsed = schema.parse(data);
      const list = collections[kind];
      const index = result.ids[kind].indexOf(id);
      const { id: _, ...withoutId } = parsed;
      if (index < 0) { result.ids[kind].push(id); list.push(kind === 'talk' ? parsed : withoutId); }
      else list[index] = kind === 'talk' ? parsed : withoutId;
    }
    } catch (error) {
      const aliases = { title: '标题', pubDate: '发布日期', date: '日期', description: '摘要 / 简介', author: '作者', category: '分类', image: '图片', width: '图片宽度', height: '图片高度', url: '链接' };
      const detail = Array.isArray(error.issues) ? error.issues.map(issue => `${aliases[issue.path[0]] || issue.path.join('.')}（${issue.path.join('.')}）：${issue.message}`).join('\n') : error.message;
      const failure = new Error(`内容「${title}」[${kind}/${id}]：${detail}`);
      Object.assign(failure, { noteId, noteTitle: title, blogKind: kind, blogId: id });
      throw failure;
    }
  }
  result.site.talksPageContent.entries.forEach(talk => {
    talk.images = talk.images.map(photo => Object.values(result.photos).find(p => p.src === photo.src) || photo);
  });
  siteSchema.parse(result.site);
  z.record(z.string(), photoSchema).parse(result.photos);
  return result;
}
