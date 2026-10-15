import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkTaskGraph } from '../scripts/continuity.mjs';
import { createSourceSnapshot, verifySourceSnapshot } from '../scripts/continuity-snapshot.mjs';

const fixture = async fn => {
  const parent = await mkdtemp(join(tmpdir(), 'geek-continuity-test-'));
  const repo = join(parent, 'repo');
  const run = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    execFileSync('git', ['init', '-b', 'main', repo], { stdio: ['ignore', 'pipe', 'pipe'] });
    await writeFile(join(repo, 'record.txt'), 'A recoverable project record.\n');
    run('add', 'record.txt');
    run('-c', 'user.name=Continuity Test', '-c', 'user.email=continuity@example.invalid', 'commit', '-m', 'Initial record');
    await fn({ repo, parent, run });
  } finally { await rm(parent, { recursive: true, force: true }); }
};

test('continuation dependencies reject missing tasks and circular pickup plans', () => {
  assert.throws(() => checkTaskGraph([{ id: 'A', dependsOn: ['missing'] }]), /Unknown dependency/);
  assert.throws(() => checkTaskGraph([{ id: 'A', dependsOn: ['B'] }, { id: 'B', dependsOn: ['A'] }]), /cycle/);
  assert.doesNotThrow(() => checkTaskGraph([{ id: 'A', dependsOn: [] }, { id: 'B', dependsOn: ['A'] }]));
});

test('a source snapshot restores commits, a second branch and a tag without running application code', async () => fixture(async ({ repo, parent, run }) => {
  run('branch', 'continuation'); run('tag', 'checkpoint');
  const result = await createSourceSnapshot({ repo, destination: join(parent, 'snapshot') });
  const verified = await verifySourceSnapshot(join(parent, 'snapshot'));
  assert.equal(verified.verified, true);
  assert.equal(verified.tree, result.tree);
  assert.equal(verified.head, result.head);
  assert.equal(verified.refs, 3);
}));

test('source snapshots refuse uncommitted data and refuse output inside the source repository', async () => fixture(async ({ repo, parent }) => {
  await writeFile(join(repo, 'untracked.txt'), 'Not part of committed history.');
  await assert.rejects(createSourceSnapshot({ repo, destination: join(parent, 'snapshot') }), /Commit or resolve/);
  await rm(join(repo, 'untracked.txt'));
  await assert.rejects(createSourceSnapshot({ repo, destination: join(repo, 'snapshot') }), /outside the repository/);
}));

test('snapshot restore detects bundle corruption and a false claimed tree', async () => fixture(async ({ repo, parent }) => {
  const directory = join(parent, 'snapshot');
  await createSourceSnapshot({ repo, destination: directory });
  const bundle = await readFile(join(directory, 'source.bundle'));
  await appendFile(join(directory, 'source.bundle'), 'corruption');
  await assert.rejects(verifySourceSnapshot(directory), /digest/);
  await writeFile(join(directory, 'source.bundle'), bundle);
  const path = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')); manifest.tree = '1'.repeat(40);
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(verifySourceSnapshot(directory), /Restored tree/);
}));

test('source snapshots reject incomplete history and never replace an existing destination', async () => fixture(async ({ repo, parent }) => {
  const shallow = join(parent, 'shallow');
  execFileSync('git', ['clone', '--depth=1', `file://${repo}`, shallow], { stdio: ['ignore', 'pipe', 'pipe'] });
  await assert.rejects(createSourceSnapshot({ repo: shallow, destination: join(parent, 'incomplete') }), /complete history/);
  const destination = join(parent, 'snapshot');
  await createSourceSnapshot({ repo, destination });
  const before = await readFile(join(destination, 'manifest.json'), 'utf8');
  await assert.rejects(createSourceSnapshot({ repo, destination }), { code: 'EEXIST' });
  assert.equal(await readFile(join(destination, 'manifest.json'), 'utf8'), before);
}));
