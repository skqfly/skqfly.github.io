export function createClient() {
  const url = process.env.TRILIUM_SERVER_URL;
  const token = process.env.TRILIUM_ETAPI_TOKEN;
  if (!url || !token) throw new Error('Set TRILIUM_SERVER_URL and TRILIUM_ETAPI_TOKEN.');
  const base = new URL(url);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new Error('Trilium requires HTTPS.');
  return async (path, { method = 'GET', body, raw = false, binary = false, contentType } = {}) => {
    const response = await fetch(new URL(`/etapi/${path}`, base), {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: token, ...(body !== undefined ? { 'Content-Type': contentType || (raw || binary ? 'text/plain' : 'application/json') } : {}) },
      body: body === undefined ? undefined : raw || binary ? body : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Trilium ${method} ${path}: HTTP ${response.status}`);
    if (response.status === 204) return;
    if (binary) {
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 15 * 1024 * 1024) throw new Error('Image exceeds the 15 MB limit.');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    return raw ? response.text() : response.json();
  };
}

export const labels = note => Object.fromEntries(note.attributes.filter(a => a.type === 'label').map(a => [a.name, a.value]));

export async function setLabel(client, note, name, value) {
  const old = note.attributes.find(a => a.type === 'label' && a.name === name);
  if (old) return client(`attributes/${old.attributeId}`, { method: 'PATCH', body: { value } });
  return client('attributes', { method: 'POST', body: { noteId: note.noteId, type: 'label', name, value } });
}
