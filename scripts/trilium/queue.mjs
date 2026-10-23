import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from './client.mjs';
import { publicationRequest } from './publication.mjs';

const config = JSON.parse(await readFile(new URL('../../trilium/config.json', import.meta.url), 'utf8'));
const client = createClient();
const note = await client(`notes/${config.rootNoteId}`);
const { request } = await publicationRequest(client, config, note);
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `pending=${Boolean(request)}\n`, { flag: 'a' });
console.log(request ? 'Publication queued.' : 'No publication queued.');
