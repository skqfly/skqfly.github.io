import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from './client.mjs';

const configUrl = new URL('../../trilium/config.json', import.meta.url);
const config = JSON.parse(await readFile(configUrl, 'utf8'));
const client = createClient();
async function create(title, content, mime, attributes = [], parentNoteId = config.rootNoteId) {
  const parent = await client(`notes/${parentNoteId}`);
  let result;
  for (const child of parent.childNoteIds || []) {
    const note = await client(`notes/${child}`);
    if (note.title === title) {
      result = { note };
      if (!title.startsWith('即时发布配置')) await client(`notes/${child}/content`, { method: 'PUT', raw: true, body: content });
      break;
    }
  }
  result ||= await client('create-note', { method: 'POST', body: { parentNoteId, title, type: 'code', mime, content } });
  for (const attr of attributes) await client('attributes', { method: 'POST', body: { noteId: result.note.noteId, ...attr } });
  return result.note.noteId;
}
const settings = await create('即时发布配置（私有，勿分享）', '{"githubToken":""}\n', 'application/json');
const backend = await create('发布请求处理器', (await readFile(new URL('./request.js', import.meta.url), 'utf8')).replaceAll('__ROOT__', config.rootNoteId).replaceAll('__SETTINGS__', settings), 'application/javascript;env=backend');
const frontend = `if (!api.isBackendScriptingEnabled()) { api.showError('服务器未启用后端脚本。请修改待发布笔记的 publish 标签值，GitHub 会定时同步。'); return; }
const result = await api.runAsyncOnBackendWithManualTransactionHandling(async (id) => {
  return await api.getNote(id).executeScript();
}, [${JSON.stringify(backend)}]);
api.showMessage(result?.immediate ? "已触发 GitHub 同步" : "已排队，等待定时同步；可在 GitHub Actions 手动运行");`;
const button = await create('同步到博客 · 点击运行', frontend, 'application/javascript;env=frontend');
const panel = config.controls?.panel ? { note: await client(`notes/${config.controls.panel}`) } : await client('create-note', { method: 'POST', body: { parentNoteId: config.rootNoteId, title: '发布面板 · 同步到博客', type: 'render', content: '' } });
const html = await create('发布面板界面', '<section style="padding:24px;max-width:640px"><h2>同步到博客</h2><p>发布管理目录中所有带 publish 标签的内容。请先保存修改。</p><p>通用发布方法：给内容添加 publish 标签，或将已有标签值改为当前时间。GitHub 会定时检测并发布。</p><button class="blog-publish btn btn-primary">同步到 GitHub</button><p class="blog-status" role="status"></p><p>按钮需要 Trilium 后端脚本支持；标签发布无需启用后端脚本。</p><p><a href="https://github.com/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml" target="_blank" rel="noopener">查看同步记录</a></p></section>', 'text/html', [], panel.note.noteId);
await create('发布面板交互', `const button = api.$container.find('.blog-publish');
const status = api.$container.find('.blog-status');
button.on('click', async () => {
  if (!api.isBackendScriptingEnabled()) { status.text('服务器未启用后端脚本，请修改待发布笔记的 publish 标签值，或在 GitHub 手动运行同步。'); return; }
  button.prop('disabled', true);
  status.text('正在提交发布请求…');
  try {
    const result = await api.runAsyncOnBackendWithManualTransactionHandling(async id => await api.getNote(id).executeScript(), [${JSON.stringify(backend)}]);
    status.text(result?.immediate ? '已触发 GitHub 同步，请查看同步记录。' : '已排队，等待定时同步；也可在 GitHub Actions 手动运行。');
  } catch (error) { status.text('提交失败：' + error.message); }
  finally { button.prop('disabled', false); }
});`, 'application/javascript;env=frontend', [], html);
for (const [noteId, name, value, isInheritable] of [[panel.note.noteId, 'renderNote', html, false], [config.rootNoteId, 'runOnAttributeCreation', backend, true], [config.rootNoteId, 'runOnAttributeChange', backend, true]]) {
  const note = await client(`notes/${noteId}`);
  if (!note.attributes.some(a => a.type === 'relation' && a.name === name && a.value === value)) await client('attributes', { method: 'POST', body: { noteId, type: 'relation', name, value, isInheritable } });
}
config.controls = { settings, backend, button, panel: panel.note.noteId };
await writeFile(configUrl, JSON.stringify(config, null, 2) + '\n');
console.log('Installed publication script and publish-tag hooks.');
