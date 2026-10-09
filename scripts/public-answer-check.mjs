import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const normalize = value => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
const literal = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
const decodeEscapes = value => value
  .replace(/\\u\{([a-f0-9]{1,6})\}/gi, (all, digits) => Number.parseInt(digits, 16) <= 0x10ffff ? String.fromCodePoint(Number.parseInt(digits, 16)) : all)
  .replace(/\\u([a-f0-9]{4})|\\x([a-f0-9]{2})/gi, (_, unicode, hex) => String.fromCharCode(Number.parseInt(unicode || hex, 16)));
const stringValue = value => {
  try { if (value.startsWith('"')) return JSON.parse(value); } catch { /* JS literal below. */ }
  return decodeEscapes(value.slice(1, -1)).replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
};

export const loadPrivateAnswerIndex = async directory => {
  const ids = new Set(), prompts = new Set(), filenames = new Set();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const bank = JSON.parse(await readFile(join(directory, entry.name), 'utf8'));
    if (!Array.isArray(bank.questions)) throw new Error('PRIVATE_BANK_INVALID');
    filenames.add(entry.name);
    for (const question of bank.questions) {
      if (typeof question.id !== 'string' || typeof question.prompt !== 'string') throw new Error('PRIVATE_BANK_INVALID');
      ids.add(question.id); prompts.add(normalize(question.prompt));
    }
  }
  if (!ids.size) throw new Error('PRIVATE_BANK_EMPTY');
  return { ids, prompts, filenames };
};

const hasGradedPrompt = (text, index) => {
  if (!/["']?correctIndex["']?\s*:\s*\d/.test(text) || !/["']?options["']?\s*:\s*\[/.test(text)) return false;
  const pattern = /(?:\bprompt|["']prompt["'])\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  return [...text.matchAll(pattern)].some(match => index.prompts.has(normalize(stringValue(match[1]))));
};

// Inspect balanced object literals, not individual answer words: every question
// must display all answer options, and public Quest teaching checks are intentional.
const objectLiterals = function* (text) {
  const starts = []; let quote = '', escaped = false;
  for (let position = 0; position < text.length; position++) {
    const character = text[position];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (['"', "'", '`'].includes(character)) quote = character;
    else if (character === '{') starts.push(position);
    else if (character === '}' && starts.length) yield text.slice(starts.pop(), position + 1);
  }
};

const inspectText = (raw, index, depth = 0) => {
  const text = decodeEscapes(raw), issues = new Set();
  for (const token of text.match(/[A-Za-z][A-Za-z0-9_-]*/g) || []) {
    if (index.ids.has(token)) { issues.add('PRIVATE_QUESTION_ID'); break; }
  }
  if (/(?:^|[\\/'"\s])server[\\/]questions[\\/]/.test(text)) issues.add('PRIVATE_BANK_PATH');
  if (hasGradedPrompt(text, index)) {
    for (const object of objectLiterals(text)) {
      if (hasGradedPrompt(object, index)) { issues.add('PRIVATE_GRADED_RECORD'); break; }
    }
  }
  // A source map or JSON.parse wrapper can contain escaped source text. Decode
  // literal strings without executing JS, and inspect at most two nested layers.
  if (depth < 2) {
    for (const match of text.matchAll(literal)) {
      const decoded = stringValue(match[0]);
      if (decoded.includes('correctIndex') && decoded.includes('prompt')) {
        for (const issue of inspectText(decoded, index, depth + 1)) issues.add(issue);
      }
    }
  }
  return issues;
};

export const scanPublicAnswers = async ({ outputDirectory, questionDirectory }) => {
  const index = await loadPrivateAnswerIndex(questionDirectory), violations = [];
  let assets = 0;
  const report = (path, codes) => { for (const code of codes) violations.push({ path, code }); };
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name), path = relative(outputDirectory, absolute);
      if (entry.isSymbolicLink()) { report(path, ['PUBLIC_SYMLINK']); continue; }
      if (entry.isDirectory()) { await walk(absolute); continue; }
      if (!entry.isFile()) { report(path, ['UNSUPPORTED_PUBLIC_ASSET']); continue; }
      assets++;
      if (index.filenames.has(basename(path).replace(/\.(?:gz|br)$/i, ''))) report(path, ['PRIVATE_BANK_FILENAME']);
      try {
        if ((await lstat(absolute)).size > MAX_ASSET_BYTES) throw new Error('PUBLIC_ASSET_TOO_LARGE');
        let bytes = await readFile(absolute);
        if (/\.gz$/i.test(path) || (bytes[0] === 0x1f && bytes[1] === 0x8b)) bytes = gunzipSync(bytes, { maxOutputLength: MAX_ASSET_BYTES });
        else if (/\.br$/i.test(path)) bytes = brotliDecompressSync(bytes, { maxOutputLength: MAX_ASSET_BYTES });
        report(path, inspectText(bytes.toString('utf8'), index));
      } catch { report(path, ['PUBLIC_ASSET_UNREADABLE']); }
    }
  };
  const root = await lstat(outputDirectory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('PUBLIC_OUTPUT_INVALID');
  await walk(outputDirectory);
  if (!assets) throw new Error('PUBLIC_OUTPUT_EMPTY');
  return { assets, privateQuestions: index.ids.size, violations };
};

export const configuredPublicOutput = async (root = process.cwd()) => {
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
  const directory = config.outputDirectory;
  if (typeof directory !== 'string' || !directory || resolve(root, directory) === resolve(root)
      || relative(resolve(root), resolve(root, directory)).startsWith('..')) throw new Error('PUBLIC_OUTPUT_INVALID');
  return resolve(root, directory);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await scanPublicAnswers({ outputDirectory: await configuredPublicOutput(), questionDirectory: resolve('server/questions') });
  if (result.violations.length) {
    for (const issue of result.violations) console.error(`FAIL ${issue.code}: ${issue.path}`);
    process.exitCode = 1;
  } else console.log(`Public answer check passed (${result.assets} assets; ${result.privateQuestions} active/retired private question identifiers).`);
}
