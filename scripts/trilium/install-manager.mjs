import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient, setLabel } from './client.mjs';

export async function installManager(client = createClient(), config) {
  config ||= JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
  if (!config.controls?.panel) throw new Error('Missing existing render panel; install publication controls first.');
  if (!config.controls.settings) throw new Error('Missing private publication settings note.');
  if (!config.controls.log) throw new Error('Missing native sync-log note.');
  const panel = await client(`notes/${config.controls.panel}`);
  const relation = panel.attributes.find(attr => attr.type === 'relation' && attr.name === 'renderNote');
  if (!relation) throw new Error('Existing panel must already have an activated renderNote relation.');
  const html = await client(`notes/${relation.value}`);
  const scripts = await Promise.all((html.childNoteIds || []).map(id => client(`notes/${id}`)));
  const script = scripts.find(note => note.type === 'code' && note.mime === 'application/javascript;env=frontend');
  if (!script) throw new Error('Missing existing frontend render script.');
  const htmlSource = await readFile(new URL('./manager-ui.html', import.meta.url), 'utf8');
  const scriptSource = (await readFile(new URL('./manager-ui.js', import.meta.url), 'utf8')).replaceAll('__ROOT__', config.rootNoteId).replaceAll('__SETTINGS__', config.controls.settings).replaceAll('__LOG__', config.controls.log);
  await client(`notes/${html.noteId}/content`, { method: 'PUT', raw: true, body: htmlSource });
  await client(`notes/${script.noteId}/content`, { method: 'PUT', raw: true, body: scriptSource });
  await client(`notes/${panel.noteId}`, { method: 'PATCH', body: { title: '博客管理面板 · 编辑与发布' } });
  await setLabel(client, panel, 'iconClass', 'bx bx-edit');
  return { panel: panel.noteId, html: html.noteId, script: script.noteId, backendScriptingRequired: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = createClient();
  const config = JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await installManager(client, config)));
  if (!config.folders) await client(`notes/${config.rootNoteId}/content`, { method: 'PUT', raw: true, body: await readFile(new URL('../../trilium/使用说明.md', import.meta.url), 'utf8') });
  const root = await client(`notes/${config.rootNoteId}`);
  for (const attr of root.attributes.filter(a => a.type === 'relation' && ['runOnAttributeCreation', 'runOnAttributeChange'].includes(a.name) && a.value === config.controls.backend)) {
    await client(`attributes/${attr.attributeId}`, { method: 'DELETE' });
  }
}
