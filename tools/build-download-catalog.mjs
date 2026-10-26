import { mkdir, writeFile } from 'node:fs/promises';
import { loadAssets } from '../assets/js/downloads-core.mjs';

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('A GitHub Actions read token is required to build the download catalog.');
const assets = await loadAssets((url, options) => fetch(url, {
  ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }
}));
const directory = new URL('../assets/data/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('downloads.json', directory), JSON.stringify({
  generatedAt: new Date().toISOString(), assets
}));
console.log(`Software catalog updated: ${assets.length} files.`);
