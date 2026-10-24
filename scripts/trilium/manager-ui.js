/* Trilium 0.106.0 frontend render script. Uses the current Trilium session.
 * The private GitHub token is read only at publication time and sent only to the fixed workflow endpoint.
 * Source contracts: apps/client/src/services/server.ts and packages/trilium-core/src/routes/index.ts,
 * routes/api/{notes,attributes,import,search}.ts in github.com/TriliumNext/Trilium at v0.106.0.
 */
await (async () => {
const rootId = '__ROOT__';
const settingsId = '__SETTINGS__';
const logId = '__LOG__';
const publicOrigin = 'https://mmddskq.top';
const host = api.$container.find('.blog-manager')[0];
if (!host) throw new Error('博客管理界面未加载，请重新打开此笔记。');
const tabs = { post: '文章', talk: 'Talks 动态', photo: 'Photos 照片', project: '项目', friend: '友链', avatar: '头像', asset: '图片库', settings: '站点设置', trash: '回收站' };
const folderTitles = { post: '文章 Posts', talk: '动态 Talks', photo: '照片 Photos', friend: '友链 Friends', project: '项目 Projects', settings: '站点设置', asset: '图片素材 Media' };
const state = { tab: 'post', records: [], selected: null, query: '', busy: false, dirty: false, syncStatus: '' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const labels = attrs => Object.fromEntries(attrs.filter(a => a.type === 'label').map(a => [a.name, a.value]));
const gone = record => record.attrs.blogDeleted === 'true';
const revision = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ui = selector => host.querySelector(selector);

async function request(path, method = 'GET', body) {
  const glob = window.glob;
  if (!glob?.baseApiUrl || !glob.csrfToken) throw new Error('Trilium 会话已过期，请刷新页面并重新登录。');
  const headers = { 'x-csrf-token': glob.csrfToken };
  if (glob.componentId) headers['trilium-component-id'] = glob.componentId;
  if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(new URL(path, new URL(glob.baseApiUrl, location.href)), {
    method, headers, credentials: 'same-origin',
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Trilium ${response.status}：操作未完成，请刷新后重试。`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function status(message, error = false) {
  ui('.bm-status').textContent = message;
  ui('.bm-status').dataset.error = String(error);
}

async function triggerGitHub() {
  let githubToken = '';
  try {
    let privateContent;
    try { privateContent = (await request(`notes/${settingsId}/blob`)).content; }
    catch { return { triggered: false, reason: '无法读取即时发布配置，请刷新 Trilium 会话后重试' }; }
    try { githubToken = JSON.parse(privateContent).githubToken; }
    catch { return { triggered: false, reason: '私有发布配置无效，请检查配置笔记中的 JSON' }; }
    privateContent = undefined;
    if (githubToken !== undefined && typeof githubToken !== 'string') return { triggered: false, reason: '私有发布配置无效，令牌必须是文本' };
    if (typeof githubToken !== 'string' || !githubToken.trim()) return { triggered: false, reason: '尚未填写即时发布令牌' };
    const response = await fetch('https://api.github.com/repos/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml/dispatches', {
      method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${githubToken.trim()}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', return_run_details: true }),
    });
    if (response.status === 204) return { triggered: true };
    if (response.status === 200) {
      let details;
      try { details = await response.json(); } catch { /* The dispatch was accepted; details are optional. */ }
      return { triggered: true, runUrl: /^https:\/\/github\.com\/skqfly\/skqfly\.github\.io\/actions\/runs\/\d+$/.test(details?.html_url) ? details.html_url : undefined };
    }
    const reasons = { 401: 'GitHub 令牌无效或已过期', 403: 'GitHub 令牌权限不足，请授予此仓库的 Actions 写入权限', 404: 'GitHub 仓库或同步工作流不可访问，请检查令牌仓库权限' };
    return { triggered: false, reason: `${reasons[response.status] || 'GitHub 未接受同步请求'}（HTTP ${response.status}）` };
  } catch (error) {
    return { triggered: false, reason: ['TimeoutError', 'AbortError'].includes(error.name) ? '连接 GitHub 超时' : '无法连接 GitHub，请检查网络或浏览器跨域限制' };
  } finally { githubToken = ''; }
}

async function notifyPublication(prefix) {
  status(`${prefix}正在触发 GitHub 同步…`);
  const result = await triggerGitHub();
  status(result.triggered
    ? `${prefix}已触发 GitHub 同步，请点击「查看发布进度」查看构建和部署结果。`
    : `${prefix}已排队，尚未触发 GitHub：${result.reason}。可打开「查看发布进度」手动运行同步；定时同步也会继续检查。`, !result.triggered);
  if (result.runUrl) {
    const link = document.createElement('a');
    link.href = result.runUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '打开本次同步 ↗';
    ui('.bm-status').append(document.createTextNode(' '), link);
  }
  if (!await recordPublication(result)) ui('.bm-status').append(document.createTextNode(' 同步日志暂未写入，请在 GitHub 查看执行结果。'));
}

async function recordPublication(result) {
  try {
    const time = new Date().toISOString();
    const outcome = result.triggered ? '已触发 GitHub 同步' : '已排队，尚未触发 GitHub';
    const run = result.runUrl ? `<p><a href="${escape(result.runUrl)}">查看本次 GitHub 同步</a></p>` : '';
    const event = `<h2>发布触发记录</h2><p><strong>时间：</strong>${escape(time)}</p><p><strong>状态：</strong>${outcome}</p>${result.reason ? `<p><strong>原因：</strong>${escape(result.reason)}</p>` : ''}${run}<p>触发成功表示 GitHub 已接收请求。读取内容、校验、构建、推送和部署结果将在同步日志中继续记录。</p>`;
    const { note } = await api.createNote(logId, { title: `${outcome} · ${time}`, type: 'text', content: event, activate: false });
    if (!note || !/^[a-zA-Z0-9_-]+$/.test(note.noteId)) return false;
    await request(`notes/${logId}/data`, 'PUT', { content: `${event}<p><a class="reference-link" href="#root/${note.noteId}">打开这条触发记录</a></p><p>历史明细保留为本笔记的子笔记。GitHub 工作流运行后会更新读取、构建、推送和部署阶段。</p>` });
    await request(`notes/${logId}/set-attribute`, 'PUT', { type: 'label', name: 'blogLogRun', value: result.runUrl?.match(/\/runs\/(\d+)$/)?.[1] || `client-${Date.now()}`, isInheritable: false });
    return true;
  } catch { return false; }
}

async function action(work) {
  if (state.busy) return;
  state.busy = true;
  host.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await work(); }
  catch (error) { status(error.message, true); }
  finally { state.busy = false; host.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}

async function getRecord(noteId) {
  const [note, attributes] = await Promise.all([request(`notes/${noteId}`), request(`notes/${noteId}/attributes`)]);
  const attrs = { ...labels(attributes), ...labels(attributes.filter(a => a.noteId === noteId)) };
  if (!attrs.blogKind && ['image', 'file'].includes(note.type) && imageMimes.has(note.mime)) attrs.blogKind = 'asset';
  attrs.blogId ||= noteId;
  const image = attributes.find(attr => attr.type === 'relation' && attr.name === 'blogImage');
  if (image && ['post', 'project', 'friend', 'photo'].includes(attrs.blogKind)) attrs[attrs.blogKind === 'photo' ? 'src' : 'image'] = `trilium:${image.value}`;
  return { ...note, attributes: attributes.filter(a => a.noteId === noteId), attrs };
}

async function reload() {
  const [managedIds, imageIds, rootAttributes] = await Promise.all([
    request(`search/${encodeURIComponent('#blogKind')}?ancestorNoteId=${encodeURIComponent(rootId)}`),
    request(`search/${encodeURIComponent('note.type = image OR note.type = file')}?ancestorNoteId=${encodeURIComponent(rootId)}`),
    request(`notes/${rootId}/attributes`),
  ]);
  const ids = [...new Set([...managedIds, ...imageIds])];
  state.syncStatus = labels(rootAttributes).blogSyncStatus || '';
  ui('.bm-last-sync').textContent = state.syncStatus ? `上次同步结果：${state.syncStatus}` : '尚无同步结果。';
  const records = [];
  // Keep concurrency modest for self-hosted instances with large photo libraries.
  for (let i = 0; i < ids.length; i += 6) records.push(...await Promise.all(ids.slice(i, i + 6).map(getRecord)));
  state.records = records.filter(record => !Object.hasOwn(record.attrs, 'template') && ['post', 'talk', 'photo', 'project', 'friend', 'settings', 'asset'].includes(record.attrs.blogKind));
  for (const record of state.records.filter(record => record.attrs.blogKind === 'talk')) {
    const photoRelations = record.attributes.filter(attr => attr.type === 'relation' && attr.name === 'blogPhotos');
    if (photoRelations.length) record.attrs.photos = photoRelations.map(attr => state.records.find(photo => photo.noteId === attr.value)?.attrs.blogId).filter(Boolean).join(',');
  }
  if (state.selected && !state.records.some(record => record.noteId === state.selected)) state.selected = null;
}

async function content(record) {
  if (record.content === undefined) record.content = (await request(`notes/${record.noteId}/blob`)).content || '';
  return record.content;
}

async function label(record, name, value) {
  await request(`notes/${record.noteId}/set-attribute`, 'PUT', { type: 'label', name, value: String(value), isInheritable: false });
  record.attrs[name] = String(value);
}

async function unpublish(record) {
  const attrs = await request(`notes/${record.noteId}/attributes`);
  for (const attr of attrs.filter(a => a.noteId === record.noteId && a.type === 'label' && a.name === 'publish')) {
    await request(`notes/${record.noteId}/attributes/${attr.attributeId}`, 'DELETE');
  }
  delete record.attrs.publish;
  if (record.attrs.blogPublishRequested === 'true') await label(record, 'blogPublishRequested', 'false');
}

async function clearNativeRelation(record, name) {
  const attrs = await request(`notes/${record.noteId}/attributes`);
  for (const attr of attrs.filter(a => a.noteId === record.noteId && a.type === 'relation' && a.name === name)) {
    await request(`notes/${record.noteId}/attributes/${attr.attributeId}`, 'DELETE');
  }
}

function imageUrl(value) {
  if (!value) return '';
  const match = value.match(/^trilium:([a-zA-Z0-9_-]+)$/);
  if (match) return new URL(`images/${match[1]}/image`, new URL(window.glob.baseApiUrl, location.href)).href;
  if (value.startsWith('/') && !value.startsWith('//')) return new URL(value, publicOrigin).href;
  if (/^https?:\/\//.test(value)) return value;
  return '';
}

function preview(value, css = 'bm-preview') {
  const url = imageUrl(value);
  return url ? `<img class="${css}" src="${escape(url)}" alt="图片预览" loading="lazy">` : '';
}

function cover(record) {
  if (record.attrs.blogKind === 'asset') return `trilium:${record.noteId}`;
  if (record.attrs.blogKind === 'photo') return record.attrs.src;
  if (record.attrs.blogKind === 'talk') {
    const first = (record.attrs.photos || '').split(',')[0];
    return state.records.find(p => p.attrs.blogKind === 'photo' && p.attrs.blogId === first)?.attrs.src;
  }
  return record.attrs.image;
}

function draftBadge(record) {
  return gone(record) ? '已移入回收站' : Object.hasOwn(record.attrs, 'publish') ? '已提交发布' : '草稿 / 尚未提交';
}

function input(name, title, value = '', options = {}) {
  const { type = 'text', hint = '', wide = false, required = false, body = false } = options;
  const tag = type === 'textarea' ? `<textarea name="${name}" class="${body ? 'bm-body' : ''}" ${required ? 'required' : ''}>${escape(value)}</textarea>` : `<input name="${name}" type="${type}" value="${escape(value)}" ${required ? 'required' : ''}>`;
  return `<label class="${wide ? 'bm-wide' : ''}">${title}${tag}${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function imageTools(name, title, value, { allowEmpty = true } = {}) {
  const assets = state.records.filter(r => r.attrs.blogKind === 'asset' && !gone(r));
  return `<div class="bm-image-tools" data-image-tools="${name}"><strong>${title}</strong><div data-image-preview="${name}">${preview(value)}</div><label>从图片库选择<select data-pick-image="${name}"><option value="">选择已导入的图片…</option>${assets.map(r => `<option value="trilium:${r.noteId}">${escape(r.title)}</option>`).join('')}</select></label><div class="bm-actions"><button type="button" data-upload-for="${name}">导入图片</button>${allowEmpty ? `<button type="button" data-clear-image="${name}">移除此处图片</button>` : ''}<button type="button" data-download-image="${name}">导出原图</button></div><details><summary>使用图片链接（可选）</summary><label>图片地址<input name="${name}" value="${escape(value)}" data-image-field="${name}" placeholder="https://example.com/photo.jpg"></label></details></div>`;
}

async function folder(kind) {
  const root = await api.getNote(rootId);
  const children = await root.getChildNotes();
  const match = children.find(note => note.title === folderTitles[kind]);
  if (match) return match.noteId;
  const { note } = await api.createNote(rootId, { title: folderTitles[kind], type: 'code', mime: 'text/markdown', content: '', activate: false });
  if (!note) throw new Error('创建目录失败。');
  return note.noteId;
}

async function createRecord(kind, title, body = '', attrs = {}) {
  const full = { blogKind: kind, blogId: `${kind}-${revision()}`, ...attrs };
  const { note } = await api.createNote(await folder(kind), {
    title, content: body, type: 'code', mime: kind === 'settings' ? 'application/json' : 'text/markdown', activate: false,
    attributes: Object.entries(full).map(([name, value]) => ({ type: 'label', name, value: String(value), isInheritable: false })),
  });
  if (!note) throw new Error('创建内容失败。');
  const record = await getRecord(note.noteId);
  record.content = body;
  state.records.push(record);
  return record;
}

async function upload(file) {
  if (!imageMimes.has(file.type)) throw new Error('请选择 JPG、PNG、WebP、GIF 或 AVIF 图片。');
  if (file.size > 15 * 1024 * 1024) throw new Error('单张图片不能超过 15 MB。');
  const form = new FormData();
  form.append('upload', file);
  form.append('taskId', revision());
  form.append('last', 'true');
  form.append('safeImport', 'true');
  form.append('shrinkImages', 'false');
  form.append('replaceUnderscoresWithSpaces', 'false');
  const note = await request(`notes/${await folder('asset')}/notes-import`, 'POST', form);
  const record = await getRecord(note.noteId);
  await label(record, 'blogKind', 'asset');
  await label(record, 'blogId', note.noteId);
  state.records.push(record);
  return record;
}

function chooseFiles(multiple, onFiles) {
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = [...imageMimes].join(','); picker.multiple = multiple;
  picker.addEventListener('change', () => { if (picker.files.length) action(() => onFiles([...picker.files])); });
  picker.click();
}

async function dimensions(file) {
  const url = URL.createObjectURL(file);
  try { return await imageDimensions(url); }
  finally { URL.revokeObjectURL(url); }
}

async function imageDimensions(url) {
  const image = new Image(); image.src = url; await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function download(name, data, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadImage(value) {
  const match = value.match(/^trilium:([a-zA-Z0-9_-]+)$/);
  const url = match ? new URL(`notes/${match[1]}/download`, new URL(window.glob.baseApiUrl, location.href)).href : imageUrl(value);
  if (!url) throw new Error('请先选择图片。');
  const anchor = document.createElement('a'); anchor.href = url;
  if (match) anchor.download = state.records.find(record => record.noteId === match[1])?.title || 'image';
  else { anchor.target = '_blank'; anchor.rel = 'noopener'; }
  anchor.click();
}

function mayLeave() { return !state.dirty || window.confirm('表单中有尚未保存的修改，确定放弃这些修改吗？'); }

async function render() {
  ui('.bm-tabs').innerHTML = Object.entries(tabs).map(([kind, title]) => `<button type="button" role="tab" data-tab="${kind}" aria-selected="${state.tab === kind}">${title}</button>`).join('');
  const isCollection = ['post', 'talk', 'photo', 'project', 'friend'].includes(state.tab);
  ui('.bm-toolbar').innerHTML = `${isCollection ? '<button type="button" data-action="new">＋ 新增</button>' : ''}${state.tab === 'photo' ? '<button type="button" data-action="import-photos">导入照片（可多选）</button>' : ''}${state.tab === 'asset' ? '<button type="button" data-action="import-assets">导入图片（可多选）</button>' : ''}${!['avatar'].includes(state.tab) ? `<input type="search" aria-label="搜索当前分类" placeholder="搜索${tabs[state.tab]}" data-search value="${escape(state.query)}">` : ''}`;
  if (state.tab === 'avatar') return renderAvatar();
  const matches = state.records.filter(r => state.tab === 'trash' ? gone(r) : !gone(r) && r.attrs.blogKind === state.tab).filter(r => r.title.toLowerCase().includes(state.query.toLowerCase()));
  const workspace = ui('.bm-workspace');
  if (state.tab === 'asset') {
    workspace.innerHTML = `<p class="bm-muted">图片保存在 Trilium。导入后可用于头像、文章、动态和项目；发布时会同步到博客。</p><div class="bm-gallery">${matches.map(r => `<article class="bm-media">${preview(`trilium:${r.noteId}`, '')}<strong title="${escape(r.title)}">${escape(r.title)}</strong><div class="bm-actions"><button type="button" class="bm-ghost" data-export-asset="${r.noteId}">导出</button><button type="button" class="bm-ghost bm-danger" data-delete-asset="${r.noteId}">移入回收站</button></div></article>`).join('')}</div>${matches.length ? '' : '<p>还没有图片，点击「导入图片」。</p>'}`;
    return;
  }
  const selected = matches.find(r => r.noteId === state.selected) || matches[0];
  state.selected = selected?.noteId || null;
  workspace.innerHTML = `<div class="bm-layout"><aside class="bm-list" aria-label="内容列表">${matches.map(r => `<button type="button" class="bm-record" data-select="${r.noteId}" aria-current="${selected?.noteId === r.noteId}">${preview(cover(r), '')}<span><strong>${escape(r.title)}</strong><small class="bm-badge">${escape(draftBadge(r))}</small></span></button>`).join('') || '<p class="bm-muted">暂无内容</p>'}</aside><div class="bm-editor"></div></div>`;
  if (selected) await renderEditor(selected);
  else ui('.bm-editor').innerHTML = '<p class="bm-muted">点击「新增」开始编辑。</p>';
}

async function renderEditor(record) {
  const kind = record.attrs.blogKind;
  const attrs = record.attrs;
  if (gone(record)) {
    ui('.bm-editor').innerHTML = `<h2>${escape(record.title)}</h2>${preview(cover(record))}<p>已从博客移除（等待下一次同步），原笔记和图片保留，可恢复。</p><div class="bm-actions"><button type="button" data-action="restore">恢复为草稿</button><button type="button" data-action="export">导出内容</button></div>`;
    return;
  }
  let fields = input('title', '标题', record.title, { wide: true, required: true });
  if (kind === 'post') fields += input('pubDate', '发布日期', attrs.pubDate, { type: 'date', required: true }) + input('author', '作者', attrs.author || 'skqfly', { required: true }) + input('category', '分类', attrs.category || 'Notes', { required: true }) + input('description', '摘要', attrs.description, { required: true, wide: true }) + imageTools('image', '文章封面', attrs.image || '/logo.svg') + input('imageAlt', '封面说明', attrs.imageAlt || '');
  if (kind === 'talk') fields += input('date', '日期', attrs.date, { type: 'date', required: true });
  if (kind === 'photo') fields += input('width', '宽度（像素）', attrs.width || '', { type: 'number', required: true }) + input('height', '高度（像素）', attrs.height || '', { type: 'number', required: true }) + `<div class="bm-wide">${imageTools('src', '照片', attrs.src, { allowEmpty: false })}</div>`;
  if (kind === 'project' || kind === 'friend') fields += input('url', '链接', attrs.url, { required: true, wide: true }) + `<div class="bm-wide">${imageTools('image', kind === 'friend' ? '友链头像' : '项目图片', attrs.image)}</div>`;
  if (kind === 'friend') fields += input('domain', '域名', attrs.domain, { required: true, hint: '例如 example.com' });
  if (kind === 'project') fields += input('categories', '分类', attrs.categories, { hint: '多个分类用英文逗号分隔' }) + input('tags', '标签', attrs.tags, { hint: '多个标签用英文逗号分隔' });
  const body = await content(record);
  fields += input('content', kind === 'post' ? '正文（Markdown）' : kind === 'settings' ? '设置内容（JSON）' : kind === 'photo' ? '照片说明' : '内容 / 简介', body, { type: 'textarea', wide: true, body: kind === 'post' || kind === 'settings' });
  if (kind === 'post') fields += `<div class="bm-wide">${imageTools('insertImage', '正文插图', '')}<button type="button" data-action="insert-image">插入图片到正文</button></div>`;
  if (kind === 'talk') {
    const selectedPhotos = (attrs.photos || '').split(',');
    fields += `<div class="bm-wide"><strong>动态配图</strong><p class="bm-muted">勾选照片即可添加；取消勾选即可移除。新照片可到 Photos 中导入。</p><div class="bm-photo-pick">${state.records.filter(r => r.attrs.blogKind === 'photo' && !gone(r)).map(r => `<label>${preview(r.attrs.src, '')}<input type="checkbox" name="talkPhoto" value="${escape(r.attrs.blogId)}" ${selectedPhotos.includes(r.attrs.blogId) ? 'checked' : ''}> ${escape(r.title)}</label>`).join('') || '<p>尚无照片，请先到 Photos 导入。</p>'}</div></div>`;
  }
  ui('.bm-editor').innerHTML = `<form class="bm-form"><div class="bm-actions" style="justify-content:space-between;margin-bottom:15px"><h2 style="margin:0">编辑${escape(tabs[kind] || '内容')}</h2><span class="bm-badge">${escape(draftBadge(record))}</span></div><div class="bm-fields">${fields}</div><details><summary>固定链接标识（创建后保持不变）</summary><code>${escape(attrs.blogId)}</code></details><div class="bm-actions"><button type="button" class="bm-primary" data-action="publish">保存并发布</button><button type="button" data-action="save">保存草稿</button><button type="button" data-action="open-note">打开原笔记</button><button type="button" data-action="export">导出内容</button></div></form>`;
  if (kind !== 'settings') {
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'bm-danger'; remove.dataset.action = 'delete'; remove.textContent = '删除 / 下架';
    ui('.bm-form > .bm-actions:last-child').append(remove);
  }
  ui('.bm-form').addEventListener('submit', e => e.preventDefault());
}

async function renderAvatar() {
  const record = state.records.find(r => r.attrs.blogKind === 'settings' && r.attrs.blogId === 'homePageContent' && !gone(r));
  if (!record) throw new Error('找不到首页设置笔记。');
  state.selected = record.noteId;
  const data = JSON.parse(await content(record));
  const nativeAvatar = record.attributes.find(attr => attr.type === 'relation' && attr.name === 'blogAvatar');
  if (nativeAvatar) data.avatar = `trilium:${nativeAvatar.value}`;
  ui('.bm-workspace').innerHTML = `<form class="bm-avatar-form"><h2>博客头像</h2><p class="bm-muted">导入本地图片或从图片库选择。移除图片会恢复博客默认头像。</p>${imageTools('avatar', '首页头像', data.avatar || '')}<div class="bm-actions"><button type="button" class="bm-primary" data-action="publish-avatar">保存并发布头像</button><button type="button" data-action="save-avatar">保存草稿</button></div></form>`;
  ui('.bm-avatar-form').addEventListener('submit', e => e.preventDefault());
}

async function save(record, publish, avatar = false) {
  const form = ui(avatar ? '.bm-avatar-form' : '.bm-form');
  if (!form.reportValidity()) return false;
  const data = new FormData(form);
  const kind = record.attrs.blogKind;
  const body = avatar ? JSON.stringify({ ...JSON.parse(await content(record)), avatar: data.get('avatar') || '' }, null, 2) + '\n' : data.get('content');
  if (kind === 'settings') JSON.parse(body);
  if (kind === 'photo' && (!Number.isInteger(Number(data.get('width'))) || Number(data.get('width')) <= 0 || !Number.isInteger(Number(data.get('height'))) || Number(data.get('height')) <= 0)) throw new Error('照片宽高必须为正整数。');
  if (kind === 'photo' && !data.get('src')) throw new Error('请导入或选择照片。');
  // Draft first: an interrupted multi-request save must never publish a partially saved form.
  await unpublish(record);
  if (!avatar && data.get('title') !== record.title) {
    await request(`notes/${record.noteId}/title`, 'PUT', { title: data.get('title') }); record.title = data.get('title');
  }
  await request(`notes/${record.noteId}/data`, 'PUT', { content: body }); record.content = body;
  const names = { post: ['pubDate', 'author', 'category', 'description', 'image', 'imageAlt'], talk: ['date'], photo: ['src', 'width', 'height'], project: ['url', 'image', 'categories', 'tags'], friend: ['url', 'image', 'domain'] }[kind] || [];
  for (const name of names) await label(record, name, data.get(name) || '');
  if (kind === 'photo') { await label(record, 'preview', data.get('src')); await label(record, 'previewLarge', data.get('src')); }
  if (kind === 'talk') await label(record, 'photos', data.getAll('talkPhoto').join(','));
  if (avatar) await clearNativeRelation(record, 'blogAvatar');
  else if (['post', 'project', 'friend', 'photo'].includes(kind)) await clearNativeRelation(record, 'blogImage');
  else if (kind === 'talk') await clearNativeRelation(record, 'blogPhotos');
  if (publish) await label(record, 'publish', revision());
  state.dirty = false;
  if (publish) await notifyPublication('已提交发布。');
  else status('草稿已保存。点击「保存并发布」或「发布全部更改」后上线。');
  await render();
  return true;
}

async function markDeleted(record) {
  if (!window.confirm(`确定从博客删除「${record.title}」吗？下次同步会下架，原笔记保留在回收站。`)) return;
  await unpublish(record);
  await label(record, 'blogDeleted', 'true');
  await label(record, 'publish', revision());
  state.dirty = false;
  await notifyPublication('已移入回收站并提交下架请求。图片若仍被其他内容使用，会继续保留。');
  state.selected = null;
  await render();
}

host.addEventListener('input', event => {
  if (event.target.matches('[data-search]')) return;
  if (event.target.closest('form')) state.dirty = true;
  const name = event.target.dataset.imageField;
  if (name) ui(`[data-image-preview="${name}"]`).innerHTML = preview(event.target.value);
});

host.addEventListener('change', event => {
  if (event.target.matches('[data-search]')) {
    if (!mayLeave()) return;
    state.dirty = false; state.query = event.target.value;
    action(render);
  }
  const name = event.target.dataset.pickImage;
  if (name && event.target.value) {
    ui(`[name="${name}"]`).value = event.target.value;
    ui(`[data-image-preview="${name}"]`).innerHTML = preview(event.target.value);
    state.dirty = true;
  }
  if ((name === 'src' || event.target.dataset.imageField === 'src') && imageUrl(ui('[name="src"]').value)) {
    action(async () => {
      const size = await imageDimensions(imageUrl(ui('[name="src"]').value));
      ui('[name="width"]').value = size.width; ui('[name="height"]').value = size.height;
    });
  }
});

host.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || state.busy) return;
  const selected = () => state.records.find(r => r.noteId === state.selected);
  if (button.dataset.uploadFor) {
    const name = button.dataset.uploadFor;
    chooseFiles(false, async ([file]) => {
      const asset = await upload(file);
      const value = `trilium:${asset.noteId}`;
      ui(`[name="${name}"]`).value = value;
      ui(`[data-image-preview="${name}"]`).innerHTML = preview(value);
      if (name === 'src') {
        const size = await dimensions(file);
        ui('[name="width"]').value = size.width; ui('[name="height"]').value = size.height;
      }
      state.dirty = true;
      status('图片已导入 Trilium，请保存并发布使其出现在博客。');
    });
    return;
  }
  action(async () => {
    if (button.dataset.tab || button.dataset.select) {
      if (!mayLeave()) return;
      state.dirty = false;
      if (button.dataset.tab) { state.tab = button.dataset.tab; state.query = ''; state.selected = null; }
      else state.selected = button.dataset.select;
      await render(); return;
    }
    if (button.dataset.pickImage) return;
    if (button.dataset.clearImage) {
      const name = button.dataset.clearImage;
      ui(`[name="${name}"]`).value = ''; ui(`[data-image-preview="${name}"]`).innerHTML = ''; state.dirty = true; return;
    }
    if (button.dataset.downloadImage) { downloadImage(ui(`[name="${button.dataset.downloadImage}"]`).value); return; }
    if (button.dataset.exportAsset) { downloadImage(`trilium:${button.dataset.exportAsset}`); return; }
    if (button.dataset.deleteAsset) { await markDeleted(state.records.find(r => r.noteId === button.dataset.deleteAsset)); return; }
    const command = button.dataset.action;
    if (command === 'refresh') {
      if (!mayLeave()) return;
      state.dirty = false; status('正在刷新…'); await reload(); await render(); status('已刷新。');
    } else if (command === 'logs') {
      if (mayLeave()) { state.dirty = false; await api.activateNote(logId); }
    } else if (command === 'new') {
      if (!mayLeave()) return;
      const today = new Date().toLocaleDateString('sv-SE');
      const defaults = { post: { pubDate: today, author: 'skqfly', category: 'Notes', image: '/logo.svg' }, talk: { date: today }, photo: { width: '1', height: '1' }, project: { image: '/logo.svg', url: '/', categories: 'Projects', tags: '' }, friend: { image: '/logo.svg', url: 'https://', domain: '' } };
      const record = await createRecord(state.tab, `新的${tabs[state.tab]}`, '', defaults[state.tab]);
      state.selected = record.noteId; state.dirty = false; state.query = ''; await render(); status('已创建草稿，填写后点击「保存并发布」。');
    } else if (command === 'save' || command === 'publish') await save(selected(), command === 'publish');
    else if (command === 'save-avatar' || command === 'publish-avatar') await save(selected(), command === 'publish-avatar', true);
    else if (command === 'delete') await markDeleted(selected());
    else if (command === 'restore') {
      await unpublish(selected()); await label(selected(), 'blogDeleted', 'false'); state.selected = null; await render(); status('已恢复为草稿，到对应分类点击「保存并发布」即可重新上线。');
    } else if (command === 'open-note') {
      if (mayLeave()) { state.dirty = false; await api.activateNote(selected().noteId); }
    } else if (command === 'export') {
      const record = selected();
      const body = record.attrs.blogKind === 'asset' ? undefined : await content(record);
      if (body === undefined) downloadImage(`trilium:${record.noteId}`);
      else download(`${record.attrs.blogId}.json`, JSON.stringify({ title: record.title, attrs: record.attrs, content: body }, null, 2));
      status('已导出内容与属性；图片可在图片库中单独导出原图。');
    } else if (command === 'insert-image') {
      const image = ui('[name="insertImage"]').value;
      if (!imageUrl(image)) throw new Error('请先选择或导入正文插图。');
      const textarea = ui('[name="content"]');
      textarea.setRangeText(`\n![图片说明](${image})\n`, textarea.selectionStart, textarea.selectionEnd, 'end'); state.dirty = true;
    } else if (command === 'publish-all') {
      if (state.dirty) {
        if (!window.confirm('当前表单有未保存修改，先保存为草稿再选择要发布的内容吗？')) return;
        if (!await save(selected(), false, state.tab === 'avatar')) return;
      }
      const records = state.records.filter(r => r.attrs.blogKind !== 'asset');
      const drafts = records.filter(r => !Object.hasOwn(r.attrs, 'publish') && !gone(r));
      if (!window.confirm(`将提交 ${records.length} 项内容（含 ${drafts.length} 项草稿和已删除内容）。确认这些内容都可以公开发布吗？`)) return;
      const version = revision();
      for (const record of records) await label(record, 'publish', version);
      await request(`notes/${rootId}/set-attribute`, 'PUT', { type: 'label', name: 'publish', value: version, isInheritable: false });
      await notifyPublication('所有内容已提交发布。');
      await render();
    } else if (command === 'import-assets' || command === 'import-photos') {
      chooseFiles(true, async files => {
        status(`正在导入 ${files.length} 张图片…`);
        for (const file of files) {
          const asset = await upload(file);
          if (command === 'import-photos') {
            const size = await dimensions(file);
            const src = `trilium:${asset.noteId}`;
            const photo = await createRecord('photo', file.name.replace(/\.[^.]+$/, ''), file.name.replace(/\.[^.]+$/, ''), { ...size, src, preview: src, previewLarge: src });
            state.selected = photo.noteId;
          }
        }
        await render(); status(`已导入 ${files.length} 张图片${command === 'import-photos' ? '并创建照片草稿，请点击「保存并发布」或「发布全部更改」' : '，可在各内容中选用'}。`);
      });
    }
  });
});

await action(async () => { status('正在读取博客内容…'); await reload(); await render(); status('已加载。选择内容编辑，点击「保存并发布」即可上线。'); });
})();
