import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { questionBankReadiness, cceReadiness } from '../server/question-bank-readiness.js';
import { studyBank } from '../server/study-curriculum.js';
import { questChapters } from '../public/quest/assets/chapter.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, 'docs/continuity');
const read = name => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const md = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\r?\n/g, ' ');
const localLink = path => `[${md(path)}](${/\s/.test(path) ? `<../../${path}>` : `../../${path}`})`;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const sha = value => /^[a-f0-9]{40}$/.test(value);
const safeLocal = path => {
  assert.equal(typeof path, 'string');
  const target = resolve(root, path.split('#')[0]);
  assert.ok(target.startsWith(`${root}${sep}`), `Reference outside repository: ${path}`);
  assert.ok(existsSync(target), `Missing evidence: ${path}`);
  return target;
};
const unique = (records, field) => assert.equal(new Set(records.map(x => x[field])).size, records.length, `Duplicate ${field}`);

export function checkTaskGraph(tasks) {
  unique(tasks, 'id');
  const byId = new Map(tasks.map(t => [t.id, t]));
  const done = new Set(), stack = new Set();
  const visit = id => {
    assert.ok(byId.has(id), `Unknown dependency: ${id}`);
    assert.ok(!stack.has(id), `Dependency cycle: ${id}`);
    if (done.has(id)) return;
    stack.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    stack.delete(id); done.add(id);
  };
  for (const t of tasks) visit(t.id);
}

export function maintainContinuity({ write = false } = {}) {
  assert.equal(resolve(process.cwd()), root, 'Run continuity commands from the repository root');
  const project = read('project.json'), backlog = read('backlog.json'), decisions = read('decisions.json');
  const releases = read('releases.json'), commits = read('commits.json'), repositories = read('repositories.json'), assets = read('assets.json');
  const readiness = questionBankReadiness(), cce = cceReadiness();
  const kaspa = readiness.categories.find(c => c.id === 'kaspa');
  const counts = { active: readiness.active, reviewed: readiness.reviewed, remaining: readiness.remaining, kaspaActive: kaspa.active, kaspaReviewed: kaspa.reviewed, studyConcepts: studyBank().length, questChapters: questChapters.length };
  if (write && JSON.stringify(project.questionCheckpoint) !== JSON.stringify(counts)) {
    project.questionCheckpoint = counts;
    project.updatedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(resolve(folder, 'project.json'), JSON.stringify(project, null, 2) + '\n');
  }
  assert.deepEqual(project.questionCheckpoint, counts, 'Continuity counts stale: run npm run continuity:write');
  for (const record of [project, backlog, decisions, releases, commits, repositories, assets]) {
    assert.equal(record.schema, 1);
    assert.ok(date(record.updatedAt || record.checkedAt || record.capturedAt), 'Invalid record date');
  }
  assert.equal(project.canonicalRepository, 'GEEKProtocol0110/geek-protocol-hq');
  assert.equal(project.holds.cce, cce.stage, 'CCE policy changed: review and update continuity evidence');
  assert.equal(project.holds.targetPerCategory, readiness.targetPerCategory);
  assert.equal(project.holds.requiredCategories, readiness.requiredCategories);
  assert.equal(project.holds.settlement, 'disabled');
  assert.equal(project.holds.collectionOwnership, 'disabled');
  assert.ok(sha(project.productBaseline.commit));
  assert.ok(backlog.tasks.some(t => t.id === project.nextTask));
  checkTaskGraph(backlog.tasks);
  for (const task of backlog.tasks) {
    assert.match(task.id, /^[A-Z]+-\d{3}$/);
    assert.ok(backlog.priorityOrder.includes(task.priority), task.id);
    assert.ok(Object.hasOwn(backlog.statusMeaning, task.status), task.id);
    for (const value of [task.title, task.owner, task.nextAction]) assert.ok(typeof value === 'string' && value.trim(), task.id);
    assert.ok(task.acceptance.length > 0, task.id);
    if (task.status === 'blocked') assert.ok(task.blocker, task.id);
    if (task.status === 'done') assert.ok(task.completedAt && task.completionEvidence?.length, `${task.id}: completion evidence required`);
    task.evidence.forEach(safeLocal);
  }
  unique(decisions.records, 'id');
  for (const decision of decisions.records) {
    assert.ok(['founder-direction', 'implementation-choice', 'existing-boundary', 'existing-direction', 'proposal', 'unresolved', 'superseded'].includes(decision.status));
    assert.ok(date(decision.recordedAt));
    assert.ok(decision.basis && decision.decision);
    if (decision.supersedes) assert.ok(decisions.records.some(d => d.id === decision.supersedes));
    decision.evidence.forEach(safeLocal);
  }
  unique(releases.records, 'number'); unique(commits.records, 'commit'); unique(repositories.records, 'repository'); unique(assets.records, 'id');
  for (const release of releases.records) {
    assert.ok(sha(release.commit));
    assert.ok(Number.isFinite(Date.parse(release.mergedAt)));
    assert.equal(release.url, `https://github.com/${project.canonicalRepository}/pull/${release.number}`);
  }
  assert.ok(releases.records.some(r => r.number === project.productBaseline.pullRequest && r.commit === project.productBaseline.commit), 'Product baseline missing from release ledger');
  assert.ok(commits.records.some(c => c.commit === project.productBaseline.commit), 'Product baseline missing from commit ledger');
  for (const commit of commits.records) {
    assert.ok(sha(commit.commit) && commit.parents.every(sha));
    assert.ok(Number.isFinite(Date.parse(commit.authoredAt)));
  }
  assert.ok(repositories.records.some(r => r.repository === project.canonicalRepository && r.role === 'canonical-hq'));
  for (const repo of repositories.records) assert.equal(repo.url, `https://github.com/${repo.repository}`);
  const sourceIndex = read('founding/source-index.json');
  for (const asset of assets.records) {
    if (asset.location) safeLocal(asset.location);
    if (asset.sha256) {
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      const bytes = readFileSync(safeLocal(asset.location));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Preserved original changed: ${asset.id}`);
      if (asset.sourcePath) {
        assert.equal(asset.sourceCommit, sourceIndex.commit);
        const source = sourceIndex.records.find(r => r.path === asset.sourcePath);
        assert.ok(source, asset.id);
        assert.equal(bytes.length, source.size);
        assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), source.gitBlobSha, asset.id);
      }
    }
    if (['awaiting-original', 'referenced-not-ingested'].includes(asset.status)) assert.equal(asset.location, null);
  }

  const header = title => `# ${title}\n\nGenerated from the maintained JSON by \`npm run continuity:write\`. Update the source record, then regenerate. [Start Here](../../START-HERE.md).\n\n`;
  const table = (columns, rows) => `| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n`;
  const outputs = new Map();
  outputs.set('CURRENT-STATE.md', header('Current project state') +
    `Record date: ${project.updatedAt}. **${md(project.releaseChannel)}**. Canonical: [${project.canonicalRepository}](https://github.com/${project.canonicalRepository}).\n\n` +
    `## Last verified product release\n\n[PR #${project.productBaseline.pullRequest}](${project.productBaseline.url}), commit \`${project.productBaseline.commit}\`. ${md(project.productBaseline.evidence)} Recorded tests: ${project.productBaseline.testsPassed} passed, ${project.productBaseline.testsFailed} failed, ${project.productBaseline.testsSkipped} skipped; ${project.productBaseline.productionProbesPassed} read-only probes passed. Later documentation candidates are separate from this baseline.\n\n` +
    `## Current checkout counts\n\n${counts.active.toLocaleString('en-US')} active questions; ${counts.reviewed} recorded internal source reviews; ${counts.remaining.toLocaleString('en-US')} further reviews needed across eight targets. ${counts.studyConcepts} Study concepts and ${counts.questChapters} Quest chapters. These are local code counts, not independent educational certification.\n\n` +
    table(['Category', 'Active', 'Recorded reviews', 'Still needed'], readiness.categories.map(c => [c.name, c.active, c.reviewed, c.remaining])) +
    `\n## Current work and pickup\n\n**${project.currentWork.id}: ${md(project.currentWork.status)}.** ${md(project.currentWork.description)}\n\nNext task: **${project.nextTask}**. ${md(project.nextAction)}\n\n## Holds\n\nCCE: **${md(project.holds.cce)}**. Contributor rate: ${md(project.holds.contributorRate)}. Settlement: ${project.holds.settlement}. Collection ownership: ${project.holds.collectionOwnership}. Counts cannot reopen these gates.\n\n## Unresolved\n\n` + project.unresolved.map(x => `- ${md(x)}`).join('\n') + '\n');
  outputs.set('BACKLOG.md', header('Maintained backlog') +
    'P0 is the immediate product/recovery queue. Planned and proposed work is not automatically authorized implementation. An owner role labeled unassigned has no appointed person.\n\n' +
    table(['ID', 'Priority', 'Status', 'Work', 'Owner'], backlog.tasks.map(t => [t.id, t.priority, t.status, md(t.title), md(t.owner)])) + '\n' +
    backlog.tasks.map(t => `## ${t.id}: ${md(t.title)}\n\n**${t.priority} / ${t.status}.** Owner: ${md(t.owner)}. Dependencies: ${t.dependsOn.join(', ') || 'none'}.\n\nNext action: ${md(t.nextAction)}${t.blocker ? `\n\nBlocker: ${md(t.blocker)}` : ''}\n\nAcceptance:\n\n${t.acceptance.map(a => `- ${md(a)}`).join('\n')}\n\nEvidence/specification: ${t.evidence.map(localLink).join(', ')}.\n`).join('\n'));
  outputs.set('DECISIONS.md', header('Decision register') +
    'Founder direction, earlier product boundaries, implementation choices, proposals and unresolved questions retain distinct labels. Append a superseding record when changing a decision.\n\n' +
    decisions.records.map(d => `## ${d.id}: ${md(d.title)}\n\n**${d.status}** · ${d.recordedAt}.\n\n${md(d.decision)}\n\nBasis: ${md(d.basis)}\n\nEvidence: ${d.evidence.map(localLink).join(', ')}.${d.supersedes ? ` Supersedes ${d.supersedes}.` : ''}\n`).join('\n'));
  outputs.set('HISTORY.md', header('Evidence-based project history') +
    `The ledger preserves **${releases.records.length} merged HQ PR records** and **${commits.records.length} Git commit records** through the declared commit snapshot \`${commits.through}\`. The product runtime baseline remains #${project.productBaseline.pullRequest}. Merged means code reached the target branch; it does not establish deployment, independent review or learning outcomes. Git metadata dates are not original founding proof.\n\n` +
    '## Founding record\n\nThree exact historical master/litepaper snapshots are preserved with source commit and hashes. Original conversation and remaining phone files are still missing. The founder recalls 23 hours; an earlier assistant kit used approximately 29 hours. Neither duration is established here. See [archive instructions](ARCHIVE-GUIDE.md).\n\n' +
    '## HQ merged changes\n\n' + table(['PR', 'Merged (UTC)', 'Change', 'Commit'], [...releases.records].sort((a, b) => b.mergedAt.localeCompare(a.mergedAt)).map(r => [`[#${r.number}](${r.url})`, r.mergedAt, md(r.title), `\`${r.commit.slice(0, 12)}\``])) +
    '\nThe [commit ledger](commits.json) preserves hashes, parents, authored dates and titles. The [release ledger](releases.json) preserves normalized PR metadata. Comments, reviews, attachments, releases and provider state need separate exports.\n');
  outputs.set('REPOSITORIES.md', header('Public ecosystem repository directory') +
    `Checked ${repositories.checkedAt}. ${repositories.scope}\n\n` +
    table(['Repository', 'Role', 'Evidence limit'], repositories.records.map(r => [`[${md(r.name)}](${r.url})`, r.role, md(r.verification)])) +
    '\nUse ECO-001 to record each component\'s exact commit, maintainer, deployment, verified behavior and next task. Do not infer that a repository is complete or live because it exists. Production links currently advertised by HQ include Geek Jr, Mini and Wallet; their independent release checks remain per-component work.\n');
  outputs.set('ASSET-REGISTER.md', header('Founding and preservation asset register') +
    'Exact preserved bytes, indexed metadata and missing originals are different states. A null location or digest is an explicit gap. Preserve originals before deriving a public copy.\n\n' +
    table(['ID', 'Asset', 'Status', 'Location'], assets.records.map(a => [a.id, md(a.title), a.status, a.location ? localLink(a.location) : 'Not ingested'])) + '\n' +
    assets.records.map(a => `## ${a.id}: ${md(a.title)}\n\n${md(a.provenance)}${a.sha256 ? `\n\nSHA-256: \`${a.sha256}\`.` : ''}${a.sourceCommit ? `\n\nSource: [${md(a.sourceRepository)} at ${a.sourceCommit.slice(0, 12)}](https://github.com/${a.sourceRepository}/blob/${a.sourceCommit}/${a.sourcePath}).` : ''}\n`).join('\n'));
  for (const [name, content] of outputs) {
    const path = resolve(folder, name);
    if (write) writeFileSync(path, content);
    else assert.equal(readFileSync(path, 'utf8'), content, `${name} stale: run npm run continuity:write`);
  }
  const handwritten = ['START-HERE.md', 'AGENTS.md', 'docs/HANDOFF.md', 'docs/continuity/README.md', 'docs/continuity/VISION-2076.md', 'docs/continuity/INSTITUTIONAL-PATH.md', 'docs/continuity/PILOT-CHARTER.md', 'docs/continuity/PARTNER-BRIEF.md', 'docs/continuity/ARCHIVE-GUIDE.md', 'docs/continuity/OPERATING-GUIDE.md', 'docs/continuity/SUCCESSION.md', 'docs/continuity/SOURCES.md', 'docs/continuity/WORKLOG.md', 'docs/continuity/founding/README.md'];
  for (const path of [...handwritten, ...[...outputs.keys()].map(name => `docs/continuity/${name}`)]) {
    const content = readFileSync(safeLocal(path), 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))\)/g)) {
      const target = match[1] || match[2];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      safeLocal(relative(root, resolve(root, dirname(path), target.split('#')[0])));
    }
  }
  return { tasks: backlog.tasks.length, decisions: decisions.records.length, mergedReleases: releases.records.length, commitRecords: commits.records.length, publicRepositories: repositories.records.length, preservedOriginals: assets.records.filter(a => a.sha256).length, generatedViews: outputs.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(maintainContinuity({ write: process.argv.includes('--write') })));
