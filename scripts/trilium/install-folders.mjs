import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient, labels, setLabel } from './client.mjs';

// Trinote supports native text HTML, promoted fields and Trilium templates. It does not execute render-note scripts.
export const folderSpecs = {
  post: { title: '文章 Posts', name: '文章 Blog', template: '文章模板', summary: '写文章、修改摘要、选择封面，并管理文章的发布与下架。', fields: { pubDate: ['发布日期', 'date'], author: ['作者', 'text'], description: ['摘要', 'text'], category: ['分类', 'text'] } },
  talk: { title: '动态 Talks', name: '动态 Talks', template: '动态模板', summary: '每条动态对应一篇独立笔记，正文写动态内容，配图直接选择照片条目。', fields: { date: ['日期', 'date'] } },
  photo: { title: '照片 Photos', name: '照片 Photos', template: '照片模板', summary: '在图片素材中导入图片，再新建照片条目并选择图片；照片条目可加入相册和动态。', fields: { width: ['图片宽度（像素）', 'number'], height: ['图片高度（像素）', 'number'] } },
  friend: { title: '友链 Friends', name: '友链 Friends', template: '友链模板', summary: '正文填写朋友简介，链接和域名在标题下方填写，头像从图片素材中选择。', fields: { url: ['网站链接', 'text'], domain: ['域名', 'text'] } },
  project: { title: '项目 Projects', name: '项目 Projects', template: '项目模板', summary: '正文填写项目简介，填写项目链接、分类和标签，再选择项目图片。', fields: { url: ['项目链接', 'text'], categories: ['分类（英文逗号分隔）', 'text'], tags: ['标签（英文逗号分隔）', 'text'] } },
  settings: { title: '站点设置', name: '站点设置', summary: '首页、导航、关于页面和其他站点信息按配置条目分别管理；请保留已有 JSON 字段。', fields: {} },
  asset: { title: '图片素材 Media', name: '图片素材', summary: '使用客户端的导入图片功能，把原图保存在这里。文章、照片、友链和项目通过“选择图片”关联这些原图。', fields: {} },
};

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const isId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
export const noteLink = (id, title) => isId(id) ? `<a class="reference-link" href="#root/${id}">${html(title)}</a>` : html(title);
const stateName = attrs => attrs.blogPublishRequested === 'true' ? attrs.blogDeleted === 'true' ? '等待同步下架' : '等待同步' : attrs.blogDeleted === 'true' ? '已标记下架' : attrs.blogPublishedAt ? `已同步 · ${attrs.blogPublishedAt}` : Object.hasOwn(attrs, 'publish') && attrs.publish !== 'false' ? '已有发布记录' : '草稿 / 尚未提交';

export function previewSource(value) {
  const internal = String(value || '').match(/^trilium:([a-zA-Z0-9_-]+)$/);
  if (internal) return `api/images/${internal[1]}/image`;
  if (/^https?:\/\//.test(value || '')) return value;
  if (String(value || '').startsWith('/') && !String(value || '').startsWith('//')) return new URL(value, 'https://mmddskq.top').href;
  return '';
}

function picture(value, title) {
  const source = previewSource(value);
  return source ? `<p><img src="${html(source)}" alt="${html(title)}" width="240"></p>` : '';
}

export function rootPage(config) {
  const sections = Object.entries(folderSpecs).filter(([kind]) => config.folders?.[kind]).map(([kind, spec]) => `<li><strong>${noteLink(config.folders[kind], spec.name)}</strong><br>${html(spec.summary)}</li>`).join('');
  return `<h2>博客管理</h2><p>在 Trinote 中直接打开分类、编辑原笔记、选择图片并提交发布。</p><p><strong>${noteLink(config.controls?.log, '同步日志：查看进度与失败原因')}</strong></p><h3>内容分类</h3><ul>${sections}</ul><h3>日常使用</h3><ol><li><strong>新增：</strong>进入对应分类，点客户端“＋ / 新建子笔记”，选择文章、动态、照片、友链或项目模板。</li><li><strong>修改：</strong>正文在原生编辑器中编辑；日期、摘要、链接和图片选择在条目标题下方填写。</li><li><strong>提交：</strong>保存修改后打开<strong>提交发布</strong>开关。处理成功后自动复位，下次修改后再次提交。</li><li><strong>立即同步：</strong>打开 <a href="https://github.com/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml">GitHub 同步工作流</a>，点击 <strong>Run workflow → Run workflow</strong>。也可以等待自动检查，GitHub 调度可能延迟。</li><li><strong>下架：</strong>在条目中打开<strong>从网站下架</strong>，再提交发布；关闭下架开关并重新提交可恢复。</li></ol><p>每个分类顶部都有内容链接、图片预览与专用操作说明。同步日志记录读取、校验、构建、推送、部署和错误详情。</p><h3>浏览器管理面板</h3><p><strong>Trinote 不支持 Trilium 的脚本面板。</strong>需要桌面网页管理界面时，请使用浏览器访问 <a href="https://note.mmddskq.top/">Trilium 网页</a>，再打开“博客管理面板 · 编辑与发布”。在 Trinote 中使用上面的原生分类和字段即可。</p>`;
}

export function folderPage(kind, records, config, templateId, photoRecords = []) {
  const spec = folderSpecs[kind];
  if (!spec) throw new Error(`Unknown native folder: ${kind}`);
  const useful = records.filter(record => !Object.hasOwn(record.attrs, 'template'));
  const visible = useful.filter(record => record.attrs.blogDeleted !== 'true');
  const deleted = useful.filter(record => record.attrs.blogDeleted === 'true');
  const logLink = noteLink(config.controls?.log, '查看同步日志');
  const links = [`${noteLink(config.rootNoteId, '返回博客管理')}`, logLink];
  if (config.folders?.asset && kind !== 'asset') links.push(noteLink(config.folders.asset, '导入 / 管理图片'));
  const createGuide = spec.template
    ? `<li><strong>新增：</strong>在本分类点客户端的“＋ / 新建子笔记”，在模板选择器选择<strong>${html(spec.template)}</strong>。${noteLink(templateId, '查看模板内容')}。</li>`
    : kind === 'settings' ? '<li><strong>修改：</strong>打开下方已有设置条目，使用编辑器修改对应内容。站点设置不需要新增空白条目。</li>'
      : '<li><strong>导入：</strong>打开本分类的详情（Note details）→ 附件（Attachments）→ 上传（Upload），选择相册或文件。上传后长按附件，选择<strong>转换为笔记（Convert to note）</strong>。原图会成为本分类的子笔记，可预览、分享和导出。</li>';
  const publishingGuide = kind === 'asset'
    ? '<li><strong>使用：</strong>回到文章、照片、友链或项目，在标题下方的“选择图片”中选择刚导入的图片笔记；随后提交对应内容发布。</li><li><strong>移除：</strong>先解除其他内容对该图片的引用，再使用客户端删除图片。正在使用的图片请先保留。</li>'
    : '<li><strong>编辑：</strong>点下方条目，在原生编辑器修改正文；日期、摘要、链接和图片关系在标题下方填写。Markdown 正文可切换“源码”编辑。</li><li><strong>发布：</strong>保存修改后，打开标题下方的<strong>提交发布</strong>开关。同步成功后此开关会自动复位；下次修改后再次打开即可。</li><li><strong>立即处理：</strong>打开 <a href="https://github.com/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml">GitHub 同步工作流</a>，点击 <strong>Run workflow → Run workflow</strong>（需登录 GitHub）。也可以等待自动检查；GitHub 定时任务可能延迟。</li>';
  const removalGuide = !['settings', 'asset'].includes(kind) ? '<li><strong>下架 / 恢复：</strong>打开或关闭<strong>从网站下架</strong>，再打开<strong>提交发布</strong>。下架保留原笔记，恢复时无需重建。</li>' : '';
  const extraGuide = kind === 'photo' ? '<p><strong>照片尺寸：</strong>标题下方填写原图宽高。已有照片尺寸可以直接保留；替换图片后请按新图尺寸填写。</p>'
    : kind === 'talk' ? '<p><strong>动态配图：</strong>在“选择照片”中添加多个 Photos 条目，移除某项关系即可去掉这张配图。照片条目可在“照片 Photos”中新建。</p>'
      : kind === 'settings' ? '<p><strong>博客头像：</strong>打开 homePageContent，在“博客头像”关系中选择图片素材里的原图，然后提交发布。其他字段继续使用 JSON 编辑。</p>' : '';
  const item = record => {
    const attrs = record.attrs;
    const imageRelation = record.attributes?.find(attr => attr.type === 'relation' && attr.name === 'blogImage');
    const cover = kind === 'asset' ? `trilium:${record.noteId}` : imageRelation ? `trilium:${imageRelation.value}` : kind === 'photo' ? attrs.src : attrs.image;
    const talkRelations = record.attributes?.filter(attr => attr.type === 'relation' && attr.name === 'blogPhotos') || [];
    const selectedPhotos = talkRelations.length ? talkRelations.map(attr => photoRecords.find(photo => photo.noteId === attr.value)) : (attrs.photos || '').split(',').filter(Boolean).map(id => photoRecords.find(photo => (photo.attrs.blogId || photo.noteId) === id));
    const talkPictures = kind === 'talk' ? selectedPhotos.filter(Boolean).map(photo => {
      const relation = photo.attributes?.find(attr => attr.type === 'relation' && attr.name === 'blogImage');
      return picture(relation ? `trilium:${relation.value}` : photo.attrs.src, photo.title);
    }).join('') : '';
    const detail = [attrs.pubDate || attrs.date, attrs.category || attrs.categories, stateName(attrs)].filter(Boolean).join(' · ');
    return `<h3>${noteLink(record.noteId, record.title)}</h3><p>${html(detail)}</p>${picture(cover, record.title)}${talkPictures}${attrs.description ? `<p>${html(attrs.description)}</p>` : ''}`;
  };
  const list = visible.length ? visible.map(item).join('\n') : '<p>此分类暂时没有内容。按上方“新增”步骤创建第一条内容。</p>';
  const quickGuide = kind === 'asset' ? '导入图片：详情 → 附件 → 上传 → 长按附件 → 转换为笔记。'
    : `${spec.template ? `新增：本分类“＋” → 选择${spec.template}。` : ''}发布：打开条目，编辑并保存后，勾选标题下方的“提交发布”。`;
  return `<h2>${html(spec.name)}</h2><p>${html(spec.summary)}</p><p>${links.join('　|　')}</p><p><strong>快速操作：</strong>${html(quickGuide)}</p>${extraGuide}<hr><h2>内容列表（${visible.length}）</h2>${list}${deleted.length ? `<hr><h2>已标记下架（${deleted.length}）</h2>${deleted.map(item).join('\n')}` : ''}<hr><h3>详细操作说明</h3><ol>${createGuide}${publishingGuide}${removalGuide}<li><strong>结果：</strong>${logLink}，查看本次同步的条目、文件变化、构建、推送、部署和失败原因。</li></ol><p><strong>Trinote 使用提示：</strong>这里使用原生笔记、原生字段和普通笔记链接。Trinote 不会执行 Trilium 的 render 笔记脚本；立即启动同步请打开上方 GitHub 链接。</p>`;
}

export function templateDefinition(kind, today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())) {
  const common = { blogKind: kind, blogPublishRequested: 'false', blogDeleted: 'false' };
  const defaults = {
    post: { attrs: { pubDate: today, author: 'skqfly', category: 'Notes', description: '', image: '/logo.svg', imageAlt: '' }, content: '# 在这里填写文章标题\n\n在这里填写文章正文。\n' },
    talk: { attrs: { date: today, photos: '' }, content: '在这里填写动态内容。\n' },
    photo: { attrs: { width: '', height: '', src: '', preview: '', previewLarge: '' }, content: '在这里填写照片说明。\n' },
    friend: { attrs: { url: '', domain: '', image: '/logo.svg' }, content: '在这里填写朋友简介。\n' },
    project: { attrs: { url: '/', categories: 'Projects', tags: '', image: '/logo.svg' }, content: '在这里填写项目简介。\n' },
  }[kind];
  if (!defaults) throw new Error(`No template for ${kind}`);
  return { title: folderSpecs[kind].template, type: 'code', mime: 'text/markdown', content: defaults.content, attrs: { ...common, ...defaults.attrs } };
}

function definitions(kind) {
  if (kind === 'asset') return [];
  const result = [['label:blogPublishRequested', 'promoted,alias=提交发布,single,boolean']];
  if (kind !== 'settings') result.push(['label:blogDeleted', 'promoted,alias=从网站下架,single,boolean']);
  for (const [name, [alias, type]] of Object.entries(folderSpecs[kind].fields)) result.push([`label:${name}`, `promoted,alias=${alias},single,${type}`]);
  if (['post', 'project', 'friend', 'photo'].includes(kind)) result.push(['relation:blogImage', `promoted,alias=${kind === 'photo' ? '选择原图' : kind === 'friend' ? '选择头像' : '选择图片'},single`]);
  if (kind === 'talk') result.push(['relation:blogPhotos', 'promoted,alias=选择照片']);
  return result;
}

async function ownLabel(client, note, name, value, isInheritable = false) {
  const existing = note.attributes?.find(attr => attr.noteId === note.noteId && attr.type === 'label' && attr.name === name);
  if (existing && existing.value === value && Boolean(existing.isInheritable) === isInheritable) return;
  // ETAPI only lets value change; inheritance changes need replacing this owned definition.
  if (existing && Boolean(existing.isInheritable) !== isInheritable) await client(`attributes/${existing.attributeId}`, { method: 'DELETE' });
  else if (existing) return client(`attributes/${existing.attributeId}`, { method: 'PATCH', body: { value } });
  return client('attributes', { method: 'POST', body: { noteId: note.noteId, type: 'label', name, value, isInheritable } });
}

async function discover(client, config) {
  const root = await client(`notes/${config.rootNoteId}`);
  const children = await Promise.all((root.childNoteIds || []).map(id => client(`notes/${id}`)));
  const folders = {};
  for (const [kind, spec] of Object.entries(folderSpecs)) {
    const match = children.find(note => note.noteId === config.folders?.[kind] || labels(note).blogFolder === kind || note.title === spec.title);
    if (match) folders[kind] = match;
  }
  return folders;
}

export async function refreshFolderPages(client, config) {
  const folders = await discover(client, config);
  config.folders = Object.fromEntries(Object.entries(folders).map(([kind, note]) => [kind, note.noteId]));
  const childrenByFolder = new Map();
  const childrenOf = folder => {
    if (!childrenByFolder.has(folder.noteId)) childrenByFolder.set(folder.noteId, Promise.all((folder.childNoteIds || []).map(id => client(`notes/${id}`))));
    return childrenByFolder.get(folder.noteId);
  };
  for (const [kind, folder] of Object.entries(folders)) {
    const children = await childrenOf(folder);
    const records = children.filter(note => labels(note).blogKind === kind || kind === 'asset' && ['image', 'file'].includes(note.type)).map(note => ({ ...note, attrs: labels(note) }));
    const photos = kind === 'talk' && folders.photo ? (await childrenOf(folders.photo)).filter(note => labels(note).blogKind === 'photo' && !Object.hasOwn(labels(note), 'template')).map(note => ({ ...note, attrs: labels(note) })) : [];
    const content = folderPage(kind, records, config, config.templates?.[kind], photos);
    await client(`notes/${folder.noteId}/content`, { method: 'PUT', raw: true, body: content });
  }
  await client(`notes/${config.rootNoteId}/content`, { method: 'PUT', raw: true, body: rootPage(config) });
  return config;
}

export async function installFolders(client = createClient(), config) {
  config ||= JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
  if (!config.controls?.log) throw new Error('Create the native sync-log note before installing folder pages.');
  const folders = await discover(client, config);
  for (const kind of Object.keys(folderSpecs)) if (!folders[kind]) throw new Error(`Missing existing folder: ${folderSpecs[kind].title}`);
  config.folders = Object.fromEntries(Object.entries(folders).map(([kind, note]) => [kind, note.noteId]));
  config.templates ||= {};
  await client(`notes/${config.rootNoteId}`, { method: 'PATCH', body: { type: 'text', mime: 'text/html' } });
  for (const [kind, folder] of Object.entries(folders)) {
    await client(`notes/${folder.noteId}`, { method: 'PATCH', body: { type: 'text', mime: 'text/html' } });
    await ownLabel(client, folder, 'blogFolder', kind);
    for (const [name, value] of definitions(kind)) await ownLabel(client, folder, name, value, true);
    // Definitions are inherited by records; the index itself must not show an inert publication toggle.
    await ownLabel(client, folder, 'hidePromotedAttributes', 'true');
    if (!folderSpecs[kind].template) continue;
    const children = await Promise.all((folder.childNoteIds || []).map(id => client(`notes/${id}`)));
    let template = children.find(note => note.noteId === config.templates[kind] || labels(note).template !== undefined && labels(note).blogTemplateKind === kind);
    if (!template) {
      const definition = templateDefinition(kind);
      template = (await client('create-note', { method: 'POST', body: { parentNoteId: folder.noteId, title: definition.title, type: definition.type, mime: definition.mime, content: definition.content } })).note;
      template = await client(`notes/${template.noteId}`);
      for (const [name, value] of Object.entries(definition.attrs)) await setLabel(client, template, name, value);
      await ownLabel(client, template, 'template', '');
      await ownLabel(client, template, 'blogTemplateKind', kind);
      await client('attributes', { method: 'POST', body: { noteId: template.noteId, type: 'relation', name: 'template:newNoteDefaultParent', value: folder.noteId, isInheritable: false } });
    }
    config.templates[kind] = template.noteId;
  }
  const settings = folders.settings;
  for (const id of settings.childNoteIds || []) {
    const note = await client(`notes/${id}`);
    if (labels(note).blogId === 'homePageContent') await ownLabel(client, note, 'relation:blogAvatar', 'promoted,alias=博客头像,single');
  }
  return refreshFolderPages(client, config);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = await installFolders();
  await writeFile(new URL('../../trilium/config.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
  console.log(JSON.stringify({ nativeFolders: config.folders, templates: config.templates }));
}
