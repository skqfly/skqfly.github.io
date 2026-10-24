import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { folderSpecs, folderPage, rootPage, previewSource, templateDefinition, installFolders, refreshFolderPages } from './install-folders.mjs';

test('native folder pages use ordinary note links, image references and real native instructions', () => {
  const config = { rootNoteId: 'root1', controls: { log: 'log1' }, folders: { asset: 'assets1' } };
  const page = folderPage('post', [
    { noteId: 'post1', title: '<script>unsafe</script>', attrs: { publish: 'old', image: 'trilium:asset1', description: 'A & B', pubDate: '2026-10-24' } },
    { noteId: 'template1', title: 'Not a published article', attrs: { template: '', blogKind: 'post' } },
  ], config, 'template1');
  assert.match(page, /href="#root\/log1"/);
  assert.match(page, /href="#root\/post1"/);
  assert.match(page, /src="api\/images\/asset1\/image"/);
  assert.match(page, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.match(page, /A &amp; B/);
  assert.match(page, /提交发布/);
  assert.match(page, /模板选择器/);
  assert.match(page, /同步成功后此开关会自动复位/);
  assert.match(page, /Run workflow/);
  assert.doesNotMatch(page, /<script|onclick|<button|javascript:|Not a published article/);
  assert.match(folderPage('asset', [], config), /转换为笔记（Convert to note）/);
  const nativeCover = folderPage('post', [{ noteId: 'post2', title: '原生封面', attrs: { image: 'trilium:old', blogPublishedAt: '2026-10-24T12:00:00Z' }, attributes: [{ type: 'relation', name: 'blogImage', value: 'newCover' }] }], config);
  assert.match(nativeCover, /api\/images\/newCover\/image/);
  assert.doesNotMatch(nativeCover, /api\/images\/old\/image/);
  assert.match(nativeCover, /已同步 · 2026-10-24T12:00:00Z/);
  const talkPreview = folderPage('talk', [{ noteId: 'talk1', title: '动态', attrs: {}, attributes: [{ type: 'relation', name: 'blogPhotos', value: 'photo1' }] }], config, undefined, [{ noteId: 'photo1', title: '配图', attrs: { src: 'trilium:photoAsset' } }]);
  assert.match(talkPreview, /api\/images\/photoAsset\/image/);
  const home = rootPage({ ...config, folders: Object.fromEntries(Object.keys(folderSpecs).map(kind => [kind, `folder-${kind}`])) });
  for (const kind of Object.keys(folderSpecs)) assert.match(home, new RegExp(`#root/folder-${kind}`));
  assert.match(home, /Trinote 不支持 Trilium 的脚本面板/);
  assert.doesNotMatch(home, /<script|onclick|<button/);
});

test('image source handling excludes executable URLs and supports native inline image caching', () => {
  assert.equal(previewSource('trilium:MediaNote01'), 'api/images/MediaNote01/image');
  assert.equal(previewSource('/photos/example.webp'), 'https://mmddskq.top/photos/example.webp');
  assert.equal(previewSource('https://example.com/image.png'), 'https://example.com/image.png');
  assert.equal(previewSource('javascript:alert(1)'), '');
  assert.equal(previewSource('//example.com/image.png'), '');
  assert.equal(previewSource('trilium:../escape'), '');
});

test('templates are unpublished native drafts with no reusable blogId', () => {
  for (const kind of ['post', 'talk', 'photo', 'friend', 'project']) {
    const template = templateDefinition(kind, '2026-10-24');
    assert.equal(template.type, 'code');
    assert.equal(template.mime, 'text/markdown');
    assert.equal(template.attrs.blogKind, kind);
    assert.equal(template.attrs.blogPublishRequested, 'false');
    assert.equal(Object.hasOwn(template.attrs, 'blogId'), false);
    assert.equal(Object.hasOwn(template.attrs, 'publish'), false);
  }
  assert.equal(templateDefinition('post', '2026-10-24').attrs.pubDate, '2026-10-24');
  assert.equal(templateDefinition('photo').attrs.width, '');
});

test('installation preserves records and children, creates native templates and remains idempotent', async () => {
  const notes = new Map();
  let serial = 1;
  const make = (id, title, parent, attrs = {}, content = '') => {
    const note = { noteId: id, title, type: 'code', mime: 'text/markdown', childNoteIds: [], parentNoteIds: parent ? [parent] : [], attributes: [], content };
    note.attributes = Object.entries(attrs).map(([name, value]) => ({ attributeId: `attr${serial++}`, noteId: id, type: 'label', name, value, isInheritable: false }));
    notes.set(id, note);
    if (parent) notes.get(parent).childNoteIds.push(id);
    return note;
  };
  make('root1', '博客管理');
  const inheritedDefinition = { attributeId: 'inherited-control', noteId: 'root1', type: 'label', name: 'label:blogPublishRequested', value: 'promoted,alias=全局自定义,single,boolean', isInheritable: true };
  notes.get('root1').attributes.push(inheritedDefinition);
  make('log1', '同步日志', 'root1');
  for (const [kind, spec] of Object.entries(folderSpecs)) make(`folder-${kind}`, spec.title, 'root1');
  const post = make('post1', '文章正文', 'folder-post', { blogKind: 'post', blogId: 'existing-id', publish: 'old-version' }, '# 保留正文');
  const home = make('home1', 'homePageContent', 'folder-settings', { blogKind: 'settings', blogId: 'homePageContent' }, '{"avatar":"trilium:asset1"}');
  const originalPost = structuredClone(post);
  const originalHome = structuredClone(home);
  const client = async (path, { method = 'GET', body } = {}) => {
    const parts = path.split('/');
    if (path === 'create-note') return { note: structuredClone(make(`new${serial++}`, body.title, body.parentNoteId, {}, body.content)) };
    if (parts[0] === 'notes') {
      const note = notes.get(parts[1]);
      if (!note) throw new Error(`Unknown fixture note: ${parts[1]}`);
      if (method === 'GET') {
        const result = structuredClone(note);
        if (note.noteId.startsWith('folder-')) result.attributes.push(structuredClone(inheritedDefinition));
        return result;
      }
      if (parts[2] === 'content') note.content = body;
      else Object.assign(note, body);
      return;
    }
    if (path === 'attributes') {
      const attr = { attributeId: `attr${serial++}`, ...body };
      notes.get(body.noteId).attributes.push(attr);
      return structuredClone(attr);
    }
    const owner = [...notes.values()].find(note => note.attributes.some(attr => attr.attributeId === parts[1]));
    if (!owner) throw new Error('Unknown fixture attribute');
    if (method === 'DELETE') owner.attributes = owner.attributes.filter(attr => attr.attributeId !== parts[1]);
    else Object.assign(owner.attributes.find(attr => attr.attributeId === parts[1]), body);
  };
  const config = { rootNoteId: 'root1', controls: { log: 'log1' } };
  await installFolders(client, config);
  assert.equal(Object.keys(config.folders).length, 7);
  assert.equal(Object.keys(config.templates).length, 5);
  assert.equal(notes.get('root1').type, 'text');
  assert.match(notes.get('root1').content, /内容分类/);
  assert.match(notes.get('root1').content, /href="#root\/log1"/);
  for (const kind of Object.keys(folderSpecs)) {
    const folder = notes.get(config.folders[kind]);
    assert.equal(folder.type, 'text'); assert.equal(folder.mime, 'text/html');
    assert.match(folder.content, /href="#root\/log1"/);
    const hide = folder.attributes.find(attr => attr.name === 'hidePromotedAttributes');
    assert.equal(hide.value, 'true'); assert.equal(hide.isInheritable, false);
    if (kind !== 'asset') {
      const publishDefinition = folder.attributes.find(attr => attr.name === 'label:blogPublishRequested');
      assert.equal(publishDefinition.isInheritable, true);
      assert.equal(publishDefinition.value, 'promoted,alias=提交发布,single,boolean');
    }
  }
  for (const [kind, id] of Object.entries(config.templates)) {
    const template = notes.get(id);
    assert.ok(notes.get(config.folders[kind]).childNoteIds.includes(id));
    assert.ok(template.attributes.some(attr => attr.name === 'template' && attr.value === ''));
    assert.ok(template.attributes.some(attr => attr.type === 'relation' && attr.name === 'template:newNoteDefaultParent' && attr.value === config.folders[kind]));
    assert.equal(template.attributes.some(attr => ['blogId', 'publish'].includes(attr.name)), false);
  }
  assert.deepEqual(notes.get('post1'), originalPost);
  assert.equal(inheritedDefinition.value, 'promoted,alias=全局自定义,single,boolean');
  assert.equal(notes.get('home1').content, originalHome.content);
  assert.ok(notes.get('home1').attributes.some(attr => attr.name === 'relation:blogAvatar'));
  assert.ok(notes.get('folder-post').childNoteIds.includes('post1'));
  const count = notes.size;
  const templatePost = notes.get(config.templates.post);
  templatePost.content = '# 用户自定义模板';
  await installFolders(client, config);
  assert.equal(notes.size, count);
  assert.equal(templatePost.content, '# 用户自定义模板');
  const latest = make('post2', '新增条目', 'folder-post', { blogKind: 'post', blogPublishRequested: 'true' }, '正文');
  await refreshFolderPages(client, config);
  assert.match(notes.get('folder-post').content, /href="#root\/post2"/);
  assert.match(notes.get('folder-post').content, /等待同步/);
  assert.equal(latest.content, '正文');
});

let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); } catch { /* Optional visual QA. */ }
test('native HTML remains readable at phone width without a Trilium script runtime', { skip: !chromium }, async t => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const { default: sharp } = await import('sharp');
  const image = await sharp({ create: { width: 480, height: 300, channels: 3, background: '#a9c8de' } }).png().toBuffer();
  await page.route('**/api/images/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: image }));
  const content = folderPage('post', [{ noteId: 'article1', title: '从这里开始：记录与计算', attrs: { blogKind: 'post', pubDate: '2026-10-24', category: 'Notes', blogPublishRequested: 'true', image: 'trilium:asset1', description: '在 Trinote 里直接编辑文章，保存后提交发布。' } }], { rootNoteId: 'root1', controls: { log: 'log1' }, folders: { asset: 'assets1' } }, 'template1');
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><base href="https://native.test/"><style>body{font:16px/1.65 system-ui,sans-serif;margin:20px;color:#202932}a{color:#245fc4}h2{font-size:23px}h3{font-size:18px}ol{padding-left:25px}li{margin:10px 0}img{max-width:100%;height:auto}hr{border:0;border-top:1px solid #ddd;margin:24px 0}</style>${content}`);
  await page.locator('img').evaluate(img => img.decode());
  assert.equal(await page.evaluate(() => typeof window.api), 'undefined');
  assert.equal(await page.locator('button').count(), 0);
  assert.equal(await page.locator('a[href="#root/log1"]').count(), 2);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const screenshot = process.env.TRILIUM_NATIVE_SCREENSHOT || join(tmpdir(), 'trilium-native-folder.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await writeFile(join(tmpdir(), 'trilium-native-folder.html'), content);
});
