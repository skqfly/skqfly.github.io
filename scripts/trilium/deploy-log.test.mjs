import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentSection, updateDeploymentLog } from './deploy-log.mjs';

const env = { SYNC_RUN_ID: '123', GITHUB_RUN_ID: '456', GITHUB_REPOSITORY: 'owner/blog', DEPLOY_RESULT: 'success', DEPLOY_URL: 'https://owner.github.io/blog/' };
const attr = (owner, name, value) => ({ noteId: owner, attributeId: `${owner}-${name}`, type: 'label', name, value });
function fixture(currentRun = '123') {
  const notes = {
    child: { noteId: 'child', attributes: [attr('child', 'blogLogRun', '123')] },
    log: { noteId: 'log', attributes: [attr('log', 'blogLogRun', currentRun)] },
    root: { noteId: 'root', attributes: [attr('root', 'blogSyncStatus', '同步原结果')] },
  };
  const bodies = { child: '<h2>同步失败详情保留</h2><pre>original error</pre>', log: '<h1>最新同步记录</h1>' };
  const writes = [];
  const client = async (path, options) => {
    if (path.startsWith('notes?')) return { results: [structuredClone(notes.log), structuredClone(notes.child)] };
    const [entity, id, content] = path.split('/');
    if (!options?.method) return content ? bodies[id] : structuredClone(notes[id]);
    writes.push({ path, options });
    if (entity === 'attributes' && options.method === 'PATCH') {
      Object.values(notes).flatMap(note => note.attributes).find(a => a.attributeId === id).value = options.body.value;
    } else if (entity === 'attributes') {
      const { noteId, name, value } = options.body;
      notes[noteId].attributes.push(attr(noteId, name, value));
    } else if (content) bodies[id] = options.body;
  };
  return { notes, bodies, writes, client, config: { rootNoteId: 'root', controls: { log: 'log' } } };
}

test('deployment success appends actual run and page links without losing sync history', async () => {
  const f = fixture();
  assert.deepEqual(await updateDeploymentLog(f.client, f.config, env), { updated: true, current: true });
  assert.match(f.bodies.child, /^<h2>同步失败详情保留<\/h2><pre>original error<\/pre>/);
  assert.match(f.bodies.child, /网站部署成功/);
  assert.match(f.bodies.child, /https:\/\/github.com\/owner\/blog\/actions\/runs\/456/);
  assert.match(f.bodies.child, /https:\/\/owner.github.io\/blog\//);
  assert.match(f.bodies.log, /网站部署成功/);
  assert.match(f.notes.root.attributes.find(a => a.name === 'blogSyncStatus').value, /网站部署成功/);
  const count = f.writes.length;
  assert.deepEqual(await updateDeploymentLog(f.client, f.config, env), { updated: false, current: true });
  assert.equal(f.writes.length, count, 'a retry does not duplicate the deployment section');
});

test('failed deployment keeps original error and points to the failing deployment run', async () => {
  const f = fixture();
  await updateDeploymentLog(f.client, f.config, { ...env, DEPLOY_RESULT: 'failure' });
  assert.match(f.bodies.child, /original error/);
  assert.match(f.bodies.child, /网站部署失败/);
  assert.doesNotMatch(f.bodies.child, /打开已部署的博客/);
  assert.match(f.notes.root.attributes.find(a => a.name === 'blogSyncStatus').value, /网站部署失败/);
});

test('an older deployment updates its historical child but cannot clobber a newer sync', async () => {
  const f = fixture('999');
  assert.deepEqual(await updateDeploymentLog(f.client, f.config, env), { updated: true, current: false });
  assert.match(f.bodies.child, /网站部署成功/);
  assert.equal(f.bodies.log, '<h1>最新同步记录</h1>');
  assert.equal(f.notes.root.attributes.find(a => a.name === 'blogSyncStatus').value, '同步原结果');
  assert.ok(!f.writes.some(write => write.path === 'notes/log/content' || write.path.includes('root-blogSyncStatus')));
});

test('deployment HTML escapes URLs and rejects script schemes', () => {
  const rendered = deploymentSection({ ...env, DEPLOY_URL: 'https://example.com/?x="><img src=x onerror=alert(1)>' });
  assert.match(rendered.html, /&quot;&gt;&lt;img/);
  assert.doesNotMatch(rendered.html, /<img/);
  assert.doesNotMatch(deploymentSection({ ...env, DEPLOY_URL: 'javascript:alert(1)' }).html, /javascript:/);
  assert.match(deploymentSection({ ...env, DEPLOY_RESULT: 'skipped', DEPLOY_BUILD_RESULT: 'failure' }).html, /构建失败/);
});

test('ordinary push deployments do not access Trilium', async () => {
  assert.deepEqual(await updateDeploymentLog(async () => assert.fail('no Trilium calls for ordinary pushes'), fixture().config, { ...env, SYNC_RUN_ID: '' }), { updated: false });
});
