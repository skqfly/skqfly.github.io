import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installManager } from './install-manager.mjs';

test('installer updates only the existing render panel and preserves its activation', async () => {
  const writes = [];
  const reads = [];
  const notes = {
    panel: { noteId: 'panel', attributes: [{ type: 'relation', name: 'renderNote', value: 'html' }] },
    html: { noteId: 'html', childNoteIds: ['frontend'] },
    frontend: { noteId: 'frontend', type: 'code', mime: 'application/javascript;env=frontend' },
  };
  const client = async (path, options) => {
    if (options) { writes.push({ path, ...options }); return; }
    reads.push(path);
    return notes[path.split('/')[1]];
  };
  const result = await installManager(client, { rootNoteId: 'blog-root', controls: { panel: 'panel', settings: 'private-settings' } });
  assert.equal(result.backendScriptingRequired, false);
  assert.equal(writes.filter(write => write.path.endsWith('/content')).length, 2);
  assert.equal(writes.some(write => write.path === 'create-note'), false);
  assert.equal(writes.some(write => write.body?.type === 'relation'), false);
  const installedSource = writes.find(write => write.path === 'notes/frontend/content').body;
  assert.match(installedSource, /const rootId = 'blog-root'/);
  assert.match(installedSource, /const settingsId = 'private-settings'/);
  assert.doesNotMatch(installedSource, /fixture-private-token|ETAPI_TOKEN|runOnBackend|__SETTINGS__/);
  assert.equal(reads.some(path => path.includes('private-settings')), false);
});

let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
catch { /* Browser tests are opt-in on machines without Playwright. */ }

test('browser workflow: drafts, publication, deletions, images, photos and avatar', { skip: !chromium }, async t => {
  const rootId = 'blog-root';
  const { default: sharp } = await import('sharp');
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dcebf9"/><circle cx="253" cy="42" r="21" fill="#f4ce81"/><path d="M0 180L105 55L215 180Z" fill="#789caf"/><path d="M110 180L235 75L320 180Z" fill="#416b7d"/><path d="M81 84L105 55L132 87L108 77Z" fill="#fff"/></svg>')).png().toBuffer();
  const notes = new Map();
  const operations = [];
  const dispatches = [];
  const fixtureToken = 'fixture-private-token-kept-out-of-ui';
  let githubMode = 'success';
  let privateReads = 0;
  let serial = 1;
  const make = (noteId, title, kind, attrs = {}, body = '', parent = rootId, mime = 'text/markdown') => {
    const record = { noteId, title, type: kind === 'asset' ? 'image' : 'code', mime: kind === 'asset' ? 'image/png' : mime, parent, content: body, attrs: { ...(kind ? { blogKind: kind, blogId: `${kind}-${noteId}` } : {}), ...attrs } };
    notes.set(noteId, record); return record;
  };
  make(rootId, '博客管理', null, { blogSyncStatus: '同步成功 · 已发布' });
  make('private-settings', '即时发布配置（私有）', null, {}, JSON.stringify({ githubToken: fixtureToken }));
  for (const [kind, title] of Object.entries({ post: '文章 Posts', talk: '动态 Talks', photo: '照片 Photos', friend: '友链 Friends', project: '项目 Projects', settings: '站点设置', asset: '图片素材 Media' })) make(`folder-${kind}`, title, null);
  const article = make('post1', '第一篇文章', 'post', { publish: 'initial', pubDate: '2026-10-23', author: 'skqfly', description: '文章摘要', category: 'Notes', image: 'trilium:asset1', imageAlt: '' }, '# 原有正文', 'folder-post');
  make('photo1', '原有照片', 'photo', { publish: 'initial', src: 'trilium:asset1', preview: 'trilium:asset1', previewLarge: 'trilium:asset1', width: '320', height: '180' }, '原有照片说明', 'folder-photo');
  make('talk1', '一条动态', 'talk', { publish: 'initial', date: '2026-10-23', photos: 'photo-photo1' }, '动态正文', 'folder-talk');
  make('friend1', '朋友', 'friend', { publish: 'initial', url: 'https://example.com', domain: 'example.com', image: 'trilium:asset1' }, '友链简介', 'folder-friend');
  make('project1', '示例项目', 'project', { publish: 'initial', url: 'https://example.com', image: 'trilium:asset1', categories: 'Projects', tags: 'web' }, '项目简介', 'folder-project');
  make('home', 'homePageContent', 'settings', { publish: 'initial', blogId: 'homePageContent' }, JSON.stringify({ avatar: 'trilium:asset1', role: '研究与开发', seo: { title: '首页' } }), 'folder-settings', 'application/json');
  make('asset1', '测试图片.png', 'asset', {}, '', 'folder-asset');
  const attributes = record => Object.entries(record.attrs).map(([name, value]) => ({ attributeId: `${record.noteId}--${name}`, noteId: record.noteId, type: 'label', name, value, isInheritable: false }));
  const metadata = record => ({ noteId: record.noteId, title: record.title, type: record.type, mime: record.mime });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = decodeURIComponent(url.pathname);
    const method = req.method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const empty = () => route.fulfill({ status: 204, body: '' });
    if (url.hostname === 'api.github.com') {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization,content-type,x-github-api-version,accept' };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
      assert.equal(req.url(), 'https://api.github.com/repos/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml/dispatches');
      assert.equal(method, 'POST');
      assert.equal(req.headers().authorization, `Bearer ${fixtureToken}`);
      assert.equal(req.headers()['x-github-api-version'], '2022-11-28');
      assert.deepEqual(req.postDataJSON(), { ref: 'main', return_run_details: true });
      dispatches.push({ precedingOperation: operations.at(-1) });
      if (githubMode === 'network') return route.abort('failed');
      if (githubMode === 'success') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ workflow_run_id: 123456789, html_url: 'https://github.com/skqfly/skqfly.github.io/actions/runs/123456789' }) });
      return route.fulfill({ status: githubMode === 'success204' ? 204 : Number(githubMode), headers: cors, body: '' });
    }
    if (url.hostname !== 'trilium.test' || req.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' });
    if (path.startsWith('/api/fixture-children/')) return json([...notes.values()].filter(n => n.parent === path.split('/').at(-1)).map(metadata));
    if (path.startsWith('/api/search/')) return json([...notes.values()].filter(n => n.attrs.blogKind).map(n => n.noteId));
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'api' || parts[1] !== 'notes') throw new Error(`Unhandled ${method} ${path}`);
    const id = parts[2];
    const endpoint = parts[3];
    const record = notes.get(id);
    if (method !== 'GET') {
      assert.equal(req.headers()['x-csrf-token'], 'fixture-csrf');
      operations.push({ method, id, endpoint, body: req.headers()['content-type']?.includes('json') ? req.postDataJSON() : undefined });
    }
    if (endpoint === 'children') {
      assert.equal(url.searchParams.get('target'), 'into');
      const data = req.postDataJSON();
      const created = make(`new${serial++}`, data.title, null, Object.fromEntries((data.attributes || []).map(a => [a.name, a.value])), data.content || '', id, data.mime);
      return json({ note: metadata(created), branch: { noteId: created.noteId } });
    }
    if (endpoint === 'notes-import') {
      const incoming = new Request(req.url(), { method: 'POST', headers: req.headers(), body: req.postDataBuffer() });
      const form = await incoming.formData();
      assert.equal(form.get('shrinkImages'), 'false');
      const file = form.get('upload');
      const created = make(`asset${serial++}`, file.name, null, {}, '', id, file.type);
      created.type = 'image';
      return json(metadata(created));
    }
    if (!record) throw new Error(`Missing fixture ${id}`);
    if (endpoint === 'attributes' && method === 'GET') return json(attributes(record));
    if (endpoint === 'attributes' && method === 'DELETE') { delete record.attrs[parts[4].split('--')[1]]; return empty(); }
    if (endpoint === 'set-attribute') { const { name, value } = req.postDataJSON(); record.attrs[name] = value; return empty(); }
    if (endpoint === 'blob') { if (id === 'private-settings') privateReads++; return json({ content: record.content }); }
    if (endpoint === 'title') { record.title = req.postDataJSON().title; return json(metadata(record)); }
    if (endpoint === 'data') { record.content = req.postDataJSON().content; return empty(); }
    if (endpoint === 'download') return route.fulfill({ status: 200, contentType: record.mime, headers: { 'content-disposition': `attachment; filename="image.png"; filename*=UTF-8''${encodeURIComponent(record.title)}` }, body: png });
    if (!endpoint && method === 'GET') return json(metadata(record));
    throw new Error(`Unhandled ${method} ${path}`);
  });
  await page.goto('http://trilium.test/');
  await page.setContent(await readFile(new URL('./manager-ui.html', import.meta.url), 'utf8'));
  await page.evaluate(() => {
    window.glob = { baseApiUrl: '/api/', csrfToken: 'fixture-csrf', componentId: 'fixture-component' };
    window.api = {
      $container: { find: selector => [...document.querySelectorAll(selector)] },
      getNote: async id => ({ noteId: id, getChildNotes: async () => (await fetch(`/api/fixture-children/${id}`)).json() }),
      createNote: async (id, data) => (await fetch(`/api/notes/${id}/children?target=into`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': 'fixture-csrf' }, body: JSON.stringify(data) })).json(),
      activateNote: async id => { window.lastActivated = id; },
    };
  });
  const source = (await readFile(new URL('./manager-ui.js', import.meta.url), 'utf8')).replaceAll('__ROOT__', rootId).replaceAll('__SETTINGS__', 'private-settings');
  await page.evaluate(code => new Function('api', `return (async () => {${code}\n})();`)(window.api), source);
  const waitStatus = async text => {
    await page.locator('.bm-status').filter({ hasText: text }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-action="publish-all"]').disabled);
  };
  const click = async command => { await page.locator(`[data-action="${command}"]`).click(); };
  const tab = async kind => { await page.locator(`[data-tab="${kind}"]`).click(); };
  const upload = async (selector, files) => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator(selector).click();
    await (await chooser).setFiles(files.map(name => ({ name, mimeType: 'image/png', buffer: png })));
  };

  await t.test('loads content and visible last synchronization result', async () => {
    assert.equal(privateReads, 0);
    assert.equal(dispatches.length, 0);
    assert.match(await page.locator('.bm-last-sync').innerText(), /同步成功/);
    assert.equal(await page.locator('[name="title"]').inputValue(), '第一篇文章');
    await page.waitForFunction(() => document.querySelector('.bm-preview')?.naturalWidth > 0);
    assert.equal(await page.locator('.bm-preview').first().evaluate(image => image.naturalWidth), 320);
  });
  await t.test('saving a draft removes publication before editing and keeps the new content private', async () => {
    const start = operations.length;
    await page.locator('[name="content"]').fill('# 草稿正文');
    await click('save'); await waitStatus('草稿已保存');
    assert.equal(article.content, '# 草稿正文');
    assert.equal(Object.hasOwn(article.attrs, 'publish'), false);
    assert.equal(operations[start].method, 'DELETE');
    assert.equal(operations[start].endpoint, 'attributes');
    assert.equal(privateReads, 0);
    assert.equal(dispatches.length, 0);
  });
  await t.test('publication writes its marker only after the body and fields are saved', async () => {
    const start = operations.length;
    const before = dispatches.length;
    await page.locator('[name="description"]').fill('更新摘要');
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    const writes = operations.slice(start);
    assert.equal(writes.at(-1).body.name, 'publish');
    assert.equal(article.attrs.description, '更新摘要');
    assert.ok(article.attrs.publish);
    assert.ok(writes.findIndex(write => write.endpoint === 'data') < writes.length - 1);
    assert.equal(dispatches.length, before + 1);
    assert.equal(dispatches.at(-1).precedingOperation.body.name, 'publish');
    assert.equal(privateReads, 1);
    assert.equal(await page.locator('.bm-status a').getAttribute('href'), 'https://github.com/skqfly/skqfly.github.io/actions/runs/123456789');
    assert.equal((await page.content()).includes(fixtureToken), false);
    assert.equal(await page.evaluate(token => JSON.stringify({ local: localStorage, session: sessionStorage }).includes(token), fixtureToken), false);
  });
  await t.test('deletion queues removal and restore returns to an unpublished draft', async () => {
    await click('delete'); await waitStatus('已触发 GitHub 同步');
    assert.equal(article.attrs.blogDeleted, 'true'); assert.ok(article.attrs.publish);
    const beforeRestore = dispatches.length;
    await tab('trash'); await click('restore'); await waitStatus('已恢复为草稿');
    assert.equal(article.attrs.blogDeleted, 'false'); assert.equal(Object.hasOwn(article.attrs, 'publish'), false);
    assert.equal(dispatches.length, beforeRestore);
  });
  await t.test('new content can be added from the interface', async () => {
    await tab('friend'); await click('new'); await waitStatus('已创建草稿');
    await page.locator('[name="title"]').fill('新增朋友');
    await page.locator('[name="url"]').fill('https://new.example.com');
    await page.locator('[name="domain"]').fill('new.example.com');
    await page.locator('[name="content"]').fill('新的友链');
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    const friend = [...notes.values()].find(note => note.title === '新增朋友');
    assert.equal(friend.attrs.blogKind, 'friend'); assert.ok(friend.attrs.publish);
  });
  await t.test('uploading a cover stores a Trilium image and assigns it to the record', async () => {
    await tab('project');
    const beforeUpload = dispatches.length;
    await upload('[data-upload-for="image"]', ['project-cover.png']); await waitStatus('图片已导入');
    assert.equal(dispatches.length, beforeUpload);
    const ref = await page.locator('[name="image"]').inputValue();
    assert.match(ref, /^trilium:asset/);
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    assert.equal(notes.get('project1').attrs.image, ref);
    assert.equal(notes.get(ref.split(':')[1]).attrs.blogKind, 'asset');
  });
  await t.test('multi-photo import creates editable drafts and measures image dimensions', async () => {
    const beforeUpload = dispatches.length;
    await tab('photo'); await upload('[data-action="import-photos"]', ['photo-a.png', 'photo-b.png']); await waitStatus('已导入 2 张图片');
    const added = [...notes.values()].filter(note => ['photo-a', 'photo-b'].includes(note.title));
    assert.equal(dispatches.length, beforeUpload);
    assert.equal(added.length, 2);
    for (const photo of added) { assert.equal(photo.attrs.blogKind, 'photo'); assert.equal(photo.attrs.width, '320'); assert.equal(photo.attrs.height, '180'); assert.equal(Object.hasOwn(photo.attrs, 'publish'), false); }
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    assert.ok(added.some(photo => photo.attrs.publish));
  });
  await t.test('avatar upload and publication preserve other homepage settings', async () => {
    await tab('avatar'); await upload('[data-upload-for="avatar"]', ['avatar.png']); await waitStatus('图片已导入');
    const ref = await page.locator('[name="avatar"]').inputValue();
    const beforePublish = dispatches.length;
    await click('publish-avatar'); await waitStatus('已触发 GitHub 同步');
    assert.equal(dispatches.length, beforePublish + 1);
    const homepage = JSON.parse(notes.get('home').content);
    assert.equal(homepage.avatar, ref); assert.equal(homepage.role, '研究与开发'); assert.equal(homepage.seo.title, '首页');
    await page.locator('[data-clear-image="avatar"]').click();
    await click('save-avatar'); await waitStatus('草稿已保存');
    assert.equal(dispatches.length, beforePublish + 1);
    assert.equal(JSON.parse(notes.get('home').content).avatar, '');
    assert.equal(Object.hasOwn(notes.get('home').attrs, 'publish'), false);
  });
  await t.test('talk photo selection and removal use photo identifiers', async () => {
    await tab('talk');
    await page.locator('[name="talkPhoto"][value="photo-photo1"]').uncheck();
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    assert.equal(notes.get('talk1').attrs.photos, '');
  });
  await t.test('media library exports originals and provides recoverable deletion', async () => {
    await tab('asset');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('[data-export-asset="asset1"]').click();
    const exported = await downloadEvent; assert.equal(exported.suggestedFilename(), '测试图片.png');
    const beforeDelete = dispatches.length;
    await page.locator('[data-delete-asset="asset1"]').click(); await waitStatus('已触发 GitHub 同步');
    assert.equal(dispatches.length, beforeDelete + 1);
    assert.equal(notes.get('asset1').attrs.blogDeleted, 'true');
    assert.ok(notes.get('asset1').attrs.publish);
    assert.equal(operations.some(operation => operation.method === 'DELETE' && !operation.endpoint), false);
  });
  await t.test('missing token retains queued publication and never dispatches', async () => {
    await tab('post');
    notes.get('private-settings').content = '{"githubToken":""}';
    const before = dispatches.length;
    await click('publish'); await waitStatus('尚未填写即时发布令牌');
    assert.equal(dispatches.length, before);
    assert.ok(article.attrs.publish);
    assert.match(await page.locator('.bm-status').innerText(), /已排队，尚未触发 GitHub/);
  });
  await t.test('malformed private configuration never exposes its contents', async () => {
    notes.get('private-settings').content = `{"githubToken":"${fixtureToken}"`;
    const before = dispatches.length;
    await click('publish'); await waitStatus('私有发布配置无效');
    assert.equal(dispatches.length, before);
    assert.equal((await page.content()).includes(fixtureToken), false);
    assert.ok(article.attrs.publish);
    notes.get('private-settings').content = JSON.stringify({ githubToken: fixtureToken });
  });
  await t.test('invalid private token type is rejected without revealing its value', async () => {
    notes.get('private-settings').content = JSON.stringify({ githubToken: { secret: fixtureToken } });
    const before = dispatches.length;
    await click('publish'); await waitStatus('私有发布配置无效，令牌必须是文本');
    assert.equal(dispatches.length, before);
    assert.equal((await page.content()).includes(fixtureToken), false);
    notes.get('private-settings').content = JSON.stringify({ githubToken: fixtureToken });
  });
  for (const [mode, message] of [['401', '令牌无效或已过期'], ['403', '令牌权限不足'], ['network', '无法连接 GitHub']]) {
    await t.test(`GitHub ${mode} failure preserves the queue and reports no false success`, async () => {
      githubMode = mode;
      const before = dispatches.length;
      const beforeWrites = operations.length;
      await click('publish'); await waitStatus(message);
      assert.equal(dispatches.length, before + 1);
      assert.ok(article.attrs.publish);
      assert.match(await page.locator('.bm-status').innerText(), /已排队，尚未触发 GitHub/);
      assert.doesNotMatch(await page.locator('.bm-status').innerText(), /已触发 GitHub/);
      assert.equal(operations.slice(beforeWrites).some(write => write.id !== article.noteId), false);
      assert.equal((await page.content()).includes(fixtureToken), false);
    });
  }
  await t.test('legacy GitHub 204 acknowledgement is treated as a successful trigger', async () => {
    githubMode = 'success204';
    const before = dispatches.length;
    await click('publish'); await waitStatus('已触发 GitHub 同步');
    assert.equal(dispatches.length, before + 1);
    assert.equal(await page.locator('.bm-status a').count(), 0);
    githubMode = 'success';
  });
  await t.test('publish-all requires a confirmation and queues the root after record updates', async () => {
    const before = dispatches.length;
    await click('publish-all'); await waitStatus('所有内容已提交发布。已触发 GitHub');
    assert.equal(operations.at(-1).id, rootId); assert.equal(operations.at(-1).body.name, 'publish');
    assert.equal(dispatches.length, before + 1);
    assert.equal(dispatches.at(-1).precedingOperation.id, rootId);
  });
  await tab('photo');
  await page.locator('[data-action="publish"]').waitFor();
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
  await page.screenshot({ path: process.env.TRILIUM_UI_SCREENSHOT || join(tmpdir(), 'trilium-manager-ui.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(failures, []);
});
