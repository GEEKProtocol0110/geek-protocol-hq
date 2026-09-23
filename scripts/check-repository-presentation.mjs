import { access, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  '.env.example',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'README.md',
  'SECURITY.md',
  'docs/ARCHITECTURE.md',
  'docs/PROJECT-STATUS.md',
  'docs/README.md',
  'docs/assets/github-hero.svg',
];

for (const path of requiredFiles) {
  await access(resolve(root, path));
}

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const expectedMetadata = {
  license: 'MIT',
  homepage: 'https://www.geekprotocol.xyz/',
};

for (const [field, expected] of Object.entries(expectedMetadata)) {
  if (packageJson[field] !== expected) {
    throw new Error(`package.json ${field} must equal ${expected}`);
  }
}

if (packageJson.repository?.url !== 'git+https://github.com/GEEKProtocol0110/geek-protocol-hq.git') {
  throw new Error('package.json must point to the canonical GitHub repository');
}

const envExample = await readFile(resolve(root, '.env.example'), 'utf8');
for (const name of [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CCE_ADMIN_TOKEN',
  'AUDIT_LOG_SECRET',
  'AUDIT_ADMIN_TOKEN',
  'PAYOUT_REVIEW_ADMIN_TOKEN',
]) {
  if (!new RegExp(`^${name}=`, 'm').test(envExample)) {
    throw new Error(`.env.example is missing ${name}`);
  }
}

const hero = await readFile(resolve(root, 'docs/assets/github-hero.svg'), 'utf8');
if (/<script\b|(?:href|xlink:href)=["']https?:/i.test(hero)) {
  throw new Error('GitHub hero must remain self-contained and script-free');
}

const markdownFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'docs/README.md',
  'docs/PROJECT-STATUS.md',
  'docs/ARCHITECTURE.md',
];
const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const markdownPath of markdownFiles) {
  const source = await readFile(resolve(root, markdownPath), 'utf8');
  for (const match of source.matchAll(linkPattern)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    const decoded = decodeURIComponent(target.split('#')[0]);
    if (!decoded) continue;
    const absolute = resolve(root, dirname(markdownPath), decoded);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
      throw new Error(`${markdownPath} links outside the repository: ${target}`);
    }
    try {
      await access(absolute);
    } catch {
      throw new Error(`${markdownPath} contains a broken local link: ${target}`);
    }
  }
}

console.log(`Repository presentation verified (${requiredFiles.length} required files, ${markdownFiles.length} Markdown documents).`);
