import { questChapters } from '../../quest/assets/chapter.js';

const $ = selector => document.querySelector(selector);
const text = (selector, value) => { $(selector).textContent = value; };
let profile = window.GeekProfile?.currentProfile, campaign = window.GeekProfile?.campaign, filter = 'all';
const goalLink = id => id.startsWith('prestige') || id === 'level-fifty' ? '#prestige' : id === 'kaspa-initiate' ? '../play/?category=kaspa' : '../play/?mode=gauntlet';
const renderCareer = () => {
  const root = $('[data-hq-milestones]'); root.replaceChildren();
  if (!profile) {
    text('[data-hq-career-title]', 'Your career is reconnecting.');
    text('[data-hq-career-copy]', 'Refresh the dashboard to retrieve saved milestones.');
    text('[data-hq-achievement-title]', 'Your milestones are reconnecting.');
    text('[data-hq-achievement-copy]', 'Saved achievements will appear when your profile reconnects.');
    root.textContent = 'Career milestones are unavailable. Use Refresh dashboard to retry.';
    return;
  }
  const next = profile.milestones.find(m => !m.unlocked), p = profile.progression;
  text('[data-hq-career-title]', next?.name || 'Your legacy keeps growing.');
  text('[data-hq-career-copy]', next ? `${next.detail}. ${next.prestige && p.canPrestige ? 'Ready when you choose to prestige.' : `${next.xpRemaining.toLocaleString()} XP to ${next.prestige ? 'level 50, then choose Prestige 1' : `level ${next.level}`}`}.` : p.maxed ? 'Prestige Master achieved. Your lifetime record keeps growing.' : 'All starter career milestones earned. Continue toward Prestige 25 and Prestige Master.');
  $('[data-hq-career-link]').href = p.canPrestige || !next ? '#prestige' : '../play/?mode=gauntlet';
  text('[data-hq-career-link]', next?.unlocked ? 'See your unlocks →' : p.canPrestige ? 'Choose your prestige →' : 'Build your career →');
  const unfinished = profile.achievements.filter(a => !a.unlocked);
  const gameGoals = unfinished.filter(a => !a.id.startsWith('prestige') && a.id !== 'level-fifty');
  const achievement = (gameGoals.length ? gameGoals : unfinished).sort((a, b) => b.progress / b.target - a.progress / a.target)[0];
  text('[data-hq-achievement-title]', achievement?.name || 'Every milestone earned.');
  text('[data-hq-achievement-copy]', achievement ? `${achievement.detail} ${achievement.progress} / ${achievement.target} so far.` : 'Your career achievements are complete. Keep exploring the Grid.');
  $('[data-hq-achievement-link]').href = achievement ? goalLink(achievement.id) : '#achievement-title';
  text('[data-hq-achievement-link]', achievement ? 'Work toward this goal →' : 'See earned achievements →');
  for (const milestone of profile.milestones) {
    const card = document.createElement('a'); card.href = milestone.href; card.className = `hq-milestone ${milestone.unlocked ? 'earned' : ''}`;
    const stage = document.createElement('span'); stage.textContent = milestone.prestige ? `PRESTIGE ${milestone.prestige}` : `LEVEL ${milestone.level}`;
    const name = document.createElement('h3'); name.textContent = milestone.name;
    const detail = document.createElement('p'); detail.textContent = milestone.detail;
    const progress = document.createElement('progress'); progress.max = 100; progress.value = milestone.progressPercent; progress.setAttribute('aria-label', `${milestone.name} career progress`);
    const state = document.createElement('strong'); state.textContent = milestone.unlocked ? '✓ EARNED' : milestone.prestige && p.canPrestige ? 'READY · PRESTIGE IS YOUR CHOICE' : `${milestone.xpRemaining.toLocaleString()} XP${milestone.prestige ? ' + PRESTIGE CHOICE' : ' REMAINING'}`;
    card.append(stage, name, detail, progress, state); root.append(card);
  }
};
const renderQuest = () => {
  if (!campaign) {
    text('[data-hq-quest-title]', 'Reconnect your adventure.');
    text('[data-hq-quest-copy]', 'Open the campaign to retrieve your saved place.');
    $('[data-hq-quest-link]').href = '../quest/'; text('[data-hq-quest-link]', 'Reconnect adventure →'); return;
  }
  // Unknown status is never treated as a completed chapter.
  const chapter = questChapters.find(c => { const saved = campaign.find(s => s.chapterId === c.id); return !saved?.available || !saved.badge; });
  const saved = campaign.find(s => s.chapterId === chapter?.id);
  text('[data-hq-quest-title]', chapter?.title || 'Three signals connected.');
  text('[data-hq-quest-copy]', !chapter ? 'All three chapter badges saved. Replay a chapter or revisit your notes.' : !saved?.available ? 'Saved status unavailable. Open the chapter to retry.' : saved.locked ? `Complete ${saved.prerequisite.title} to continue.` : saved.status === 'unstarted' ? chapter.subtitle : `${saved.answered} / ${saved.total} checks attempted. Resume your saved visit.`);
  $('[data-hq-quest-link]').href = !chapter ? '../profile/#quest-progress' : saved?.locked ? saved.prerequisite.href : `/quest/?chapter=${chapter.id}`;
  text('[data-hq-quest-link]', !chapter ? 'See your chapter badges →' : saved?.locked ? 'Open prerequisite →' : saved?.status === 'unstarted' ? 'Begin your next chapter →' : 'Resume adventure →');
};
const filterAchievements = () => {
  const cards = [...document.querySelectorAll('[data-achievement-state]')];
  for (const card of cards) card.hidden = filter !== 'all' && card.dataset.achievementState !== filter;
  for (const button of document.querySelectorAll('[data-achievement-filter]')) button.setAttribute('aria-pressed', String(button.dataset.achievementFilter === filter));
  text('[data-achievement-filter-count]', `${cards.filter(card => !card.hidden).length} achievements shown${cards.length && !cards.some(card => !card.hidden) ? ' · none in this view yet' : ''}`);
};
for (const button of document.querySelectorAll('[data-achievement-filter]')) button.addEventListener('click', () => { filter = button.dataset.achievementFilter; filterAchievements(); });
window.addEventListener('geek:profile', event => { profile = event.detail; renderCareer(); filterAchievements(); });
window.addEventListener('geek:profile-unavailable', () => { profile = null; renderCareer(); });
window.addEventListener('geek:campaign', event => { campaign = event.detail; renderQuest(); });
window.addEventListener('geek:campaign-unavailable', () => { campaign = null; renderQuest(); });
renderCareer(); renderQuest(); filterAchievements();
