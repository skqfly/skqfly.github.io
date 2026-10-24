import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, labels, setLabel } from './client.mjs';
import { acknowledgeNative } from './native.mjs';
import { refreshFolderPages } from './install-folders.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const localTime = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const safeError = value => String(value ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏]').replace(/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+/g, '[已隐藏]').slice(0, 5000);
const statusText = { running: '进行中', success: '同步成功（部署已触发）', failure: '失败', cancelled: '已取消' };

export function renderLog(state) {
  const status = statusText[state.status] || state.status;
  const table = (rows, headings) => `<table><thead><tr>${headings.map(v => `<th>${escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const steps = state.steps || [];
  const failed = steps.filter(step => step.conclusion === 'failure').map(step => step.name);
  return `<h2>${escape(status)}</h2><p><strong>当前阶段：</strong>${escape(state.stage)}<br><strong>更新时间：</strong>${escape(localTime(state.updatedAt))}（北京时间）<br><strong>开始时间：</strong>${escape(localTime(state.startedAt))}<br><strong>触发方式：</strong>${escape(state.trigger || '手动诊断')}</p>`
    + (state.runUrl ? `<p><a href="${escape(state.runUrl)}">查看 GitHub 本次完整日志</a> · <a href="${escape(state.runUrl)}?check_suite_focus=true">查看步骤和错误</a></p>` : '')
    + (failed.length ? `<p><strong>失败步骤：</strong>${escape(failed.join('、'))}</p>` : '')
    + (state.errorNote?.noteId && /^[a-zA-Z0-9_-]+$/.test(state.errorNote.noteId) ? `<p><a href="#root/${state.errorNote.noteId}">定位出错笔记：${escape(state.errorNote.noteTitle || state.errorNote.noteId)}</a></p>` : '')
    + (state.error ? `<h3>具体错误</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(safeError(state.error))}</pre><p>先根据上面的笔记标题、ID 或字段修改，再重新提交。依赖安装、构建或推送错误请打开 GitHub 对应步骤完整日志。</p>` : '')
    + (state.plan ? `<p>管理内容 ${Number(state.plan.managedNotes) || 0} 项；更新文件 ${(state.plan.changedFiles || []).length} 个；删除文件 ${(state.plan.removedFiles || []).length} 个。</p>` : '')
    + `<h3>阶段记录</h3>${table((state.events || []).map(event => [localTime(event.time), event.stage, event.detail || '']), ['时间', '阶段', '说明'])}`
    + (steps.length ? `<h3>GitHub 步骤</h3>${table(steps.map(step => [step.name, step.conclusion || step.status]), ['步骤', '结果'])}` : '')
    + (state.plan?.changedFiles?.length ? `<h3>更新文件</h3><ul>${state.plan.changedFiles.map(path => `<li>${escape(path)}</li>`).join('')}</ul>` : '')
    + (state.plan?.removedFiles?.length ? `<h3>下架 / 删除文件</h3><ul>${state.plan.removedFiles.map(path => `<li>${escape(path)}</li>`).join('')}</ul>` : '')
    + '<p>“同步成功”表示内容已推送、部署已触发；网站上线结果请查看 GitHub 的 Deploy Astro to GitHub Pages 工作流。</p>';
}

async function jsonFile(path, fallback) {
  if (!path) return fallback;
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function publishLog(client, config, state) {
  if (!config.controls?.log) return;
  const html = renderLog(state);
  if (!state.noteId) {
    const created = await client('create-note', { method: 'POST', body: { parentNoteId: config.controls.log, title: `同步 ${localTime(state.startedAt)}${state.runId ? ` · #${state.runId}` : ''}`, type: 'text', content: html } });
    state.noteId = created.note.noteId;
    if (state.runId) await client('attributes', { method: 'POST', body: { noteId: state.noteId, type: 'label', name: 'blogLogRun', value: String(state.runId) } });
  } else await client(`notes/${state.noteId}/content`, { method: 'PUT', raw: true, body: html });
  await client(`notes/${config.controls.log}/content`, { method: 'PUT', raw: true, body: `<h1>同步日志 · 最近一次</h1>${html}<p><a href="#root/${state.noteId}">打开本次日志笔记</a></p><p>历史同步日志保存在本笔记的子笔记中，Trinote 可直接打开。</p>` });
  if (state.runId) await setLabel(client, await client(`notes/${config.controls.log}`), 'blogLogRun', String(state.runId));
}

export async function githubSteps(env = process.env) {
  if (!env.GH_TOKEN || !/^\d+$/.test(env.GITHUB_RUN_ID || '')) return [];
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/jobs`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return [];
  return (await response.json()).jobs.flatMap(job => (job.steps || []).map(({ name, status, conclusion }) => ({ name, status, conclusion })));
}

export async function updateLog(command, stage = '', env = process.env) {
  const config = JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
  const client = createClient();
  const path = env.TRILIUM_LOG_STATE;
  const now = new Date().toISOString();
  const state = await jsonFile(path, { startedAt: now, status: 'running', events: [], runId: env.GITHUB_RUN_ID, trigger: env.GITHUB_EVENT_NAME, runUrl: env.GITHUB_RUN_ID ? `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : '' });
  state.updatedAt = now;
  state.stage = stage || (command === 'finish' ? '处理完成' : '准备依赖与测试');
  state.events.push({ time: now, stage: state.stage, detail: env.TRILIUM_LOG_DETAIL || '' });
  state.plan = await jsonFile(env.TRILIUM_PLAN_FILE, state.plan);
  if (command === 'finish') {
    state.status = env.TRILIUM_RESULT || 'failure';
    const error = await jsonFile(env.TRILIUM_ERROR_FILE, {});
    state.error = error.message;
    state.errorNote = error;
    try { state.steps = await githubSteps(env); } catch { state.steps = []; }
    const failures = state.steps.filter(step => step.conclusion === 'failure');
    if (state.status !== 'success' && !state.error) state.error = failures.length ? `失败步骤：${failures.map(s => s.name).join('、')}。请打开本次 GitHub 完整日志查看该步骤输出。` : '同步未完成，请查看本次 GitHub 完整日志。';
    const root = await client(`notes/${config.rootNoteId}`);
    await setLabel(client, root, 'blogSyncStatus', `${localTime(now)} ${statusText[state.status] || state.status} ${state.runUrl}`);
    if (state.status === 'success' && env.TRILIUM_REQUEST && labels(root).blogSyncRequest === env.TRILIUM_REQUEST) {
      const attr = root.attributes.find(a => a.type === 'label' && a.name === 'blogSyncRequest');
      if (attr) await client(`attributes/${attr.attributeId}`, { method: 'DELETE' });
    }
  }
  await publishLog(client, config, state);
  if (path) await writeFile(path, JSON.stringify(state, null, 2));
  // Finish the log before slow index refreshes, so a deployment callback is never overwritten.
  if (command === 'finish' && state.status === 'success') {
    const acknowledged = await acknowledgeNative(client, state.plan?.nativeRequests || []);
    for (const id of acknowledged) await setLabel(client, await client(`notes/${id}`), 'blogPublishedAt', localTime(now));
    try { await refreshFolderPages(client, config); } catch { console.error('Sync succeeded but native folder indexes could not be refreshed.'); }
  }
  console.log(`Trilium log updated: ${state.stage} (${state.status})`);
  return state;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await updateLog(process.argv[2], process.argv[3]); }
  catch (error) { console.error(`Could not update Trilium log: ${safeError(error.message)}`); process.exitCode = 1; }
}
