// Trilium backend script; placeholders are replaced during installation.
const root = api.getNote('__ROOT__');
const origin = api.originEntity;
if (origin && 'name' in origin && (origin.type !== 'label' || origin.name !== 'publish' || origin.isDeleted)) return;
const request = `${Date.now()}-${api.randomString(8)}`;
root.setLabel('blogSyncRequest', request);
root.setLabel('blogSyncStatus', '已排队，等待 GitHub 处理');
const settings = JSON.parse(api.getNote('__SETTINGS__').getContent());
if (!settings.githubToken) return { queued: true, immediate: false };
try {
  const response = await fetch('https://api.github.com/repos/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml/dispatches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  root.setLabel('blogSyncStatus', '已触发 GitHub 同步，请查看 Actions 执行结果');
  return { queued: true, immediate: true };
} catch (error) {
  root.setLabel('blogSyncStatus', `即时触发失败，已保留队列：${error.message}`);
  throw error;
}
