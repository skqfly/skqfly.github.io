import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, labels, setLabel } from './client.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = value => {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : ''; }
  catch { return ''; }
};

export function deploymentSection(env, now = new Date()) {
  const result = env.DEPLOY_RESULT;
  const status = result === 'success' ? '网站部署成功' : result === 'cancelled' ? '网站部署已取消'
    : result === 'skipped' ? `网站部署未执行${env.DEPLOY_BUILD_RESULT === 'failure' ? '（构建失败）' : ''}` : '网站部署失败';
  const runUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const pageUrl = safeUrl(env.DEPLOY_URL);
  const time = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  return {
    status, runUrl,
    html: `<hr><h3>网站部署结果：${escape(status)}</h3><p>更新时间：${escape(time)}（北京时间）<br>部署运行：#${escape(env.GITHUB_RUN_ID)}</p>`
      + `<p><a href="${escape(runUrl)}">查看本次部署步骤和完整错误日志</a>${pageUrl && result === 'success' ? ` · <a href="${escape(pageUrl)}">打开已部署的博客</a>` : ''}</p>`
      + (result === 'success' ? '<p>GitHub Pages 已完成部署。</p>' : '<p>原同步结果和错误记录保留在上方。请打开部署日志定位构建、上传或部署步骤。</p>'),
  };
}

export async function updateDeploymentLog(client, config, env = process.env) {
  if (!env.SYNC_RUN_ID || !config.controls?.log) return { updated: false };
  if (!/^\d+$/.test(env.SYNC_RUN_ID) || !/^\d+$/.test(env.GITHUB_RUN_ID || '')
    || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')) throw new Error('Invalid deployment run identity.');
  const logRootId = config.controls.log;
  const result = await client(`notes?search=${encodeURIComponent(`#blogLogRun = ${env.SYNC_RUN_ID}`)}&ancestorNoteId=${encodeURIComponent(logRootId)}&fastSearch=true`);
  const child = result.results.find(note => note.noteId !== logRootId && labels(note).blogLogRun === env.SYNC_RUN_ID);
  if (!child) throw new Error('The original Trilium sync log could not be found.');
  const section = deploymentSection(env);
  const deploymentKey = `${env.GITHUB_RUN_ID}${env.GITHUB_RUN_ATTEMPT ? `:${env.GITHUB_RUN_ATTEMPT}` : ''}`;
  let childUpdated = false;
  if (labels(child).blogDeployRun !== deploymentKey) {
    const body = await client(`notes/${child.noteId}/content`, { raw: true });
    await client(`notes/${child.noteId}/content`, { method: 'PUT', raw: true, body: body + section.html });
    await setLabel(client, child, 'blogDeployRun', deploymentKey);
    childUpdated = true;
  }
  // A delayed deployment must never replace the status of a newer sync.
  const logRoot = await client(`notes/${logRootId}`);
  const isCurrent = labels(logRoot).blogLogRun === env.SYNC_RUN_ID;
  if (isCurrent && labels(logRoot).blogDeployRun !== deploymentKey) {
    const body = await client(`notes/${logRootId}/content`, { raw: true });
    await client(`notes/${logRootId}/content`, { method: 'PUT', raw: true, body: `<h1>同步日志 · 最近部署结果</h1>${section.html}${body}` });
    await setLabel(client, logRoot, 'blogDeployRun', deploymentKey);
    const root = await client(`notes/${config.rootNoteId}`);
    await setLabel(client, root, 'blogSyncStatus', `${section.status} ${section.runUrl}`);
  }
  return { updated: childUpdated, current: isCurrent };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
    const result = await updateDeploymentLog(createClient(), config);
    console.log(result.updated ? 'Trilium deployment result recorded.' : 'Trilium deployment log is already current.');
  } catch {
    // GitHub retains the deployment's detailed error; never echo credentials or server bodies.
    console.error('Could not record the deployment result in Trilium. Check this workflow and the Trilium connection.');
    process.exitCode = 1;
  }
}
