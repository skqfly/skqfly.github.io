import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLog, publishLog, stageResults } from './log.mjs';

test('step outcomes identify the failed phase without waiting for GitHub API consistency', () => {
  const rows = stageResults('queue=success,dependencies=success,tests=success,sync=failure,build=skipped,commit=skipped');
  assert.equal(rows.find(row => row.conclusion === 'failure').name, '读取与校验内容');
  assert.equal(rows.some(row => row.conclusion === 'in_progress'), false);
});

test('an empty manual run explains that nothing was built or deployed', () => {
  const html = renderLog({ status: 'noop', stage: '检查发布队列', startedAt: '2026-10-24T00:00:00Z', updatedAt: '2026-10-24T00:00:01Z', events: [] });
  assert.match(html, /未发现待发布内容/);
  assert.match(html, /没有执行构建或部署/);
});

test('native log contains stages, specific errors, changed files and direct run links without executable HTML', () => {
  const result = renderLog({ status: 'failure', stage: '读取与校验', startedAt: '2026-10-23T16:00:00Z', updatedAt: '2026-10-23T16:01:00Z', runUrl: 'https://github.com/a/b/actions/runs/123', trigger: 'workflow_dispatch', events: [{ time: '2026-10-23T16:00:00Z', stage: '开始' }], steps: [{ name: 'Fetch and validate', conclusion: 'failure' }], error: '文章<测试> [post/abc]：摘要缺失 <script>alert(1)</script> Bearer secret-token ghp_fakeSecret', plan: { managedNotes: 1, changedFiles: ['src/test.md'], removedFiles: [] } });
  assert.match(result, /失败步骤/);
  assert.match(result, /post\/abc/);
  assert.match(result, /src\/test.md/);
  assert.match(result, /2026\/10\/24/);
  assert.match(result, /&lt;script&gt;/);
  assert.doesNotMatch(result, /<script>|secret-token|ghp_fakeSecret/);
});

test('first log creates a history note, later updates reuse it and maintain a native latest-summary entry', async () => {
  const calls = [];
  const client = async (path, options) => {
    calls.push({ path, options });
    if (path === 'create-note') return { note: { noteId: 'history' } };
    if (path === 'notes/log') return { noteId: 'log', attributes: [] };
  };
  const state = { status: 'running', stage: '准备', startedAt: '2026-10-23T16:00:00Z', updatedAt: '2026-10-23T16:00:00Z', events: [], runId: '123' };
  const config = { controls: { log: 'log' } };
  await publishLog(client, config, state);
  await publishLog(client, config, state);
  assert.equal(state.noteId, 'history');
  assert.equal(calls.filter(c => c.path === 'create-note').length, 1);
  assert.ok(calls.some(c => c.path === 'notes/history/content'));
  assert.equal(calls.filter(c => c.path === 'notes/log/content').length, 2);
});
