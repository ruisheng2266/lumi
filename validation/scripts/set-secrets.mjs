/**
 * 一次性脚本：通过 GitHub API 加密并设置 Actions secrets
 */
import sodium from 'libsodium-wrappers';
import { readFileSync } from 'node:fs';

const GH_TOKEN = process.env.GH_TOKEN;
const REPO = process.env.REPO;
const SECRETS = JSON.parse(readFileSync('./secrets.json', 'utf8'));

if (!GH_TOKEN || !REPO) {
  console.error('GH_TOKEN and REPO must be set');
  process.exit(1);
}

await sodium.ready;

async function gh(path, method = 'GET', body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      'User-Agent': 'lumi-secret-setter',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

console.log('Fetching repo public key...');
const keyRes = await gh(`/repos/${REPO}/actions/secrets/public-key`);
if (keyRes.status !== 200) {
  console.error('Failed:', keyRes);
  process.exit(1);
}
const { key, key_id } = keyRes.data;
console.log(`Key ID: ${key_id}`);

const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

for (const [name, value] of Object.entries(SECRETS)) {
  const encrypted = sodium.crypto_box_seal(sodium.from_string(value), keyBytes);
  const encrypted_b64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

  console.log(`Setting ${name}...`);
  const putRes = await gh(`/repos/${REPO}/actions/secrets/${name}`, 'PUT',
    { encrypted_value: encrypted_b64, key_id });
  if (putRes.status === 201 || putRes.status === 204) {
    console.log(`[OK] ${name}`);
  } else {
    console.error(`[FAIL] ${name}:`, JSON.stringify(putRes.data));
    process.exit(1);
  }
}

console.log('Done!');