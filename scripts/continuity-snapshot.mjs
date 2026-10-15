import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }).trim();
const digest = async file => {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
};

export async function createSourceSnapshot({ repo = process.cwd(), destination }) {
  assert.ok(destination && isAbsolute(destination), 'Use an absolute output directory');
  repo = await realpath(git(resolve(repo), 'rev-parse', '--show-toplevel'));
  assert.equal(git(repo, 'rev-parse', '--is-shallow-repository'), 'false', 'Fetch complete history before creating a source snapshot');
  let partialClone = '';
  try { partialClone = git(repo, 'config', '--get-regexp', '^(extensions\.partialclone|remote\..*\.promisor)$'); }
  catch (error) { if (error.status !== 1) throw error; }
  assert.equal(partialClone, '', 'Partial clones require complete object hydration before snapshotting');
  assert.equal(git(repo, 'status', '--porcelain', '--untracked-files=normal'), '', 'Commit or resolve tracked/untracked changes before creating a source snapshot');
  const parent = await realpath(dirname(destination));
  const output = join(parent, resolve(destination).split(sep).at(-1));
  assert.ok(output !== repo && !output.startsWith(`${repo}${sep}`), 'Snapshot output must be outside the repository');
  const treeEntries = git(repo, 'ls-tree', '-r', 'HEAD');
  assert.ok(!/^160000 /m.test(treeEntries), 'Submodules require a separate preservation procedure');
  const files = git(repo, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n');
  for (const path of files.filter(p => p.endsWith('.gitattributes'))) {
    assert.ok(!/filter\s*=\s*lfs/.test(git(repo, 'show', `HEAD:${path}`)), 'Git LFS requires a separate preservation procedure');
  }
  const head = git(repo, 'rev-parse', 'HEAD'), tree = git(repo, 'rev-parse', 'HEAD^{tree}');
  const refs = git(repo, 'for-each-ref', '--format=%(refname) %(objectname)').split('\n').filter(Boolean).map(line => {
    const [name, object] = line.split(' '); return { name, object };
  });
  await mkdir(output, { mode: 0o700 }); // Fails if anything already exists at this destination.
  try {
    const bundle = join(output, 'source.bundle');
    git(repo, 'bundle', 'create', bundle, '--all');
    await chmod(bundle, 0o600);
    const manifest = {
      schema: 1, createdAt: new Date().toISOString(), head, tree, refs,
      bundle: 'source.bundle', sha256: await digest(bundle),
      scope: 'Committed Git objects and local refs only. Excludes ignored/uncommitted files, issues/comments/release binaries/settings, provider data, credentials and external originals. Independent durable copying is a separate owner step.'
    };
    await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    return { output, head, tree, refs: refs.length, sha256: manifest.sha256 };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

export async function verifySourceSnapshot(directory) {
  assert.ok(directory && isAbsolute(directory), 'Use an absolute snapshot directory');
  const source = await realpath(directory);
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.bundle, 'source.bundle');
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.head, /^[a-f0-9]{40}$/);
  assert.match(manifest.tree, /^[a-f0-9]{40}$/);
  assert.ok(Array.isArray(manifest.refs));
  assert.equal(await digest(join(source, 'source.bundle')), manifest.sha256, 'Bundle digest does not match the trusted manifest');
  const temporary = await mkdtemp(join(tmpdir(), 'geek-source-restore-'));
  try {
    const mirror = join(temporary, 'restored.git');
    execFileSync('git', ['clone', '--mirror', '--', join(source, 'source.bundle'), mirror], { stdio: ['ignore', 'pipe', 'pipe'] });
    git(mirror, 'bundle', 'verify', join(source, 'source.bundle'));
    git(mirror, 'fsck', '--full', '--no-reflogs');
    assert.equal(git(mirror, 'rev-parse', '--verify', `${manifest.head}^{tree}`), manifest.tree, 'Restored tree does not match the manifest');
    for (const ref of manifest.refs) {
      assert.match(ref.name, /^refs\/[A-Za-z0-9_./-]+$/);
      assert.match(ref.object, /^[a-f0-9]{40}$/);
      assert.equal(git(mirror, 'rev-parse', '--verify', ref.name), ref.object, `Restored ref mismatch: ${ref.name}`);
    }
    return { verified: true, head: manifest.head, tree: manifest.tree, refs: manifest.refs.length, sha256: manifest.sha256 };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, 'Use --output ABSOLUTE_NEW_DIRECTORY or --verify ABSOLUTE_SNAPSHOT_DIRECTORY');
  assert.ok(['--output', '--verify'].includes(args[0]));
  console.log(JSON.stringify(args[0] === '--verify' ? await verifySourceSnapshot(args[1]) : await createSourceSnapshot({ destination: args[1] })));
}
