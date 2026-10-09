(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const format = new Intl.NumberFormat('en-US');
  let profile = null, busy = false, prestigeNeedsRefresh = false, boardSequence = 0, challengeSequence = 0;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const api = async (url, body) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { credentials: 'same-origin', signal: controller.signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await res.json().catch(error => { if (controller.signal.aborted) throw error; return {}; });
      if (!res.ok || !data.ok) throw new Error(data.error || 'The dashboard could not reconnect. Try again.');
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The dashboard took too long to respond. Refresh to check your saved progress.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const renderPrestige = () => {
    const p = profile?.progression;
    $('[data-prestige-open]').disabled = busy || !p?.canPrestige;
    $('[data-prestige-confirm]').disabled = busy || !p?.canPrestige || !$('[data-prestige-check]').checked;
    $('[data-prestige-open]').textContent = p?.maxed ? 'Prestige Master achieved' : p?.prestige === 25 ? 'Final prestige reached' : p?.canPrestige ? `Enter Prestige ${p.prestige + 1} →` : 'Unlock at level 50';
    $('[data-prestige-summary]').textContent = p ? `Prestige ${p.prestige} / 25 · Level ${p.level} / 50` : 'Connect your profile to see your rank.';
    $('[data-prestige-note]').textContent = !p ? 'Your saved progress will appear when the profile service reconnects.' : p.maxed ? 'You completed the final cycle. Lifetime XP and your career record keep growing.' : p.canPrestige ? 'Level 50 reached. You can stay here or choose a fresh level-1 cycle. XP earned while you wait stays in lifetime totals and does not carry into the new cycle.' : p.prestige === 25 ? `${format.format(p.xpToPrestige)} XP to Prestige Master. There is no Prestige 26.` : `${format.format(p.xpToPrestige)} XP to level 50. Prestige is always your choice.`;
    $('[data-prestige-road]').replaceChildren(...Array.from({ length: 25 }, (_, i) => {
      const rank = i + 1, earned = p && rank <= p.prestige;
      const item = node('li', undefined, earned ? 'earned' : p && rank === p.prestige + 1 ? 'next' : 'locked');
      item.append(node('span', `P${String(rank).padStart(2, '0')}`, 'prestige-emblem'), node('small', earned ? 'EARNED' : p && rank === p.prestige + 1 ? 'NEXT' : 'LOCKED'));
      item.setAttribute('aria-label', `Prestige ${rank}: ${earned ? 'earned' : 'not yet earned'}`);
      return item;
    }));
    const earned = profile?.achievements?.filter(a => a.unlocked).length || 0;
    $('[data-achievement-count]').textContent = profile ? `${earned} / ${profile.achievements.length} achievements unlocked` : 'Achievements load from your career record.';
    if (p?.legacyPrestige) $('[data-legacy-note]').hidden = false;
  };

  const refreshBoard = async () => {
    const sequence = ++boardSequence;
    $('[data-board-panel]').setAttribute('aria-busy', 'true');
    $('[data-dashboard-board]').replaceChildren();
    $('[data-dashboard-rank]').textContent = '';
    $('[data-dashboard-board-note]').textContent = 'Loading verified standings…';
    const query = new URLSearchParams({ category: $('[data-board-category]').value, mode: $('[data-board-mode]').value, limit: '50', ...(profile ? { mine: '1' } : {}) });
    try {
      const data = await api(`/api/leaderboard/?${query}`);
      if (sequence !== boardSequence) return;
      $('[data-dashboard-board-note]').textContent = data.entries.length ? 'Best verified score per player · top 50 · equal scores share rank' : 'No submitted scores in this mode and category yet. Complete a verified run to join.';
      $('[data-dashboard-rank]').textContent = !profile ? 'Connect your profile to see your standing.' : data.mine ? `Your rank: #${data.mine.rank} · ${format.format(data.mine.score)} best score` : 'Your rank: no submitted score here yet';
      $('[data-dashboard-board]').replaceChildren(...data.entries.map(entry => {
        const row = node('tr');
        row.append(node('td', `#${entry.rank}`), node('td', entry.name), node('td', entry.level === null ? 'Unavailable' : `P${entry.prestige} · L${entry.level}`), node('td', format.format(entry.score)));
        return row;
      }));
    } catch (error) { if (sequence === boardSequence) $('[data-dashboard-board-note]').textContent = error.message; }
    finally { if (sequence === boardSequence) $('[data-board-panel]').setAttribute('aria-busy', 'false'); }
  };

  const refreshChallenges = async () => {
    const sequence = ++challengeSequence;
    $('[data-dashboard-challenges]').setAttribute('aria-busy', 'true');
    $('[data-dashboard-challenge-note]').textContent = 'Loading your current challenge attempts…';
    try {
      const [catalog, status] = await Promise.all([api('/api/ranked/?service=challenges'), profile ? api('/api/ranked/?service=challenges', { action: 'status' }) : Promise.resolve({ attempts: [] })]);
      if (sequence !== challengeSequence) return;
      $('[data-dashboard-challenge-note]').textContent = 'Weekly and monthly standings are score-only. Timed Gauntlet, Daily Signal, and Speed Signal award career XP.';
      $('[data-dashboard-challenges]').replaceChildren(...catalog.periods.map(period => {
        const own = status.attempts.find(a => a.periodId === period.id);
        const card = node('article', undefined, 'dashboard-challenge-card');
        const link = node('a', own?.canResume ? 'Resume challenge →' : own ? 'Review your result →' : 'Open challenge →', 'dashboard-text-link');
        link.href = `../challenges/?kind=${period.kind}`;
        const close = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(period.closesAt);
        card.append(node('span', `${period.kind.toUpperCase()} / KASPA`, 'dashboard-kicker'), node('h3', period.title), node('p', `${period.questionCount} questions · ${period.completed} submitted`), node('p', `Closes ${close}`), node('strong', own ? `${own.status === 'complete' ? 'Submitted' : own.canResume ? 'In progress' : 'Closed'} · ${own.score} points · ${own.answered}/${own.total}` : 'One attempt this period'), link);
        return card;
      }));
    } catch (error) {
      if (sequence === challengeSequence) { $('[data-dashboard-challenges]').replaceChildren(); $('[data-dashboard-challenge-note]').textContent = `${error.message} Open Challenges to retry.`; }
    } finally { if (sequence === challengeSequence) $('[data-dashboard-challenges]').setAttribute('aria-busy', 'false'); }
  };

  const refreshProfile = async () => {
    const data = await api('/api/profile/');
    prestigeNeedsRefresh = false;
    window.GeekProfile.renderProfile(data.profile);
  };
  $('[data-dashboard-refresh]').addEventListener('click', async () => {
    if (busy) return;
    busy = true; $('[data-dashboard-refresh]').disabled = true; renderPrestige();
    try { await refreshProfile(); $('[data-prestige-feedback]').textContent = 'Dashboard updated.'; }
    catch (error) {
      prestigeNeedsRefresh = true;
      profile = null; window.GeekProfile.currentProfile = null;
      window.dispatchEvent(new Event('geek:profile-unavailable'));
      $('[data-prestige-feedback]').textContent = error.message;
    }
    finally { busy = false; $('[data-dashboard-refresh]').disabled = false; renderPrestige(); }
  });
  $('[data-prestige-open]').addEventListener('click', () => {
    if (!profile?.progression.canPrestige || busy) return;
    $('[data-prestige-dialog-title]').textContent = `Enter Prestige ${profile.progression.prestige + 1}?`;
    $('[data-prestige-check]').checked = false;
    $('[data-prestige-confirm]').disabled = true;
    $('[data-prestige-dialog-error]').textContent = '';
    $('[data-prestige-dialog]').showModal();
  });
  $('[data-prestige-check]').addEventListener('change', renderPrestige);
  $('[data-prestige-dialog]').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('[data-prestige-confirm]').addEventListener('click', async () => {
    if (busy || !profile?.progression.canPrestige || !$('[data-prestige-check]').checked) return;
    const expectedPrestige = profile.progression.prestige;
    busy = true; $('[data-prestige-confirm]').disabled = true; $('[data-prestige-cancel]').disabled = true; renderPrestige();
    $('[data-prestige-dialog-error]').textContent = 'Saving your prestige…';
    try {
      const data = await api('/api/session/?service=prestige', { action: 'prestige', expectedPrestige, confirm: true });
      window.GeekProfile.renderProfile(data.profile);
      $('[data-prestige-dialog]').close();
      $('[data-prestige-feedback]').textContent = `Prestige ${data.profile.progression.prestige} earned. Your level restarts at 1; your career stays with you.`;
      window.GeekProfile.refreshCollectibles?.().catch(() => { $('[data-trade-feedback]').textContent = 'Prestige saved. Reload your collectibles to see newly unlocked identities.'; });
      $('[data-dashboard-refresh]').focus();
    } catch (error) {
      // A failed reply can follow an accepted prestige. Require a canonical
      // profile read before another attempt, including checkbox changes.
      profile = null;
      prestigeNeedsRefresh = true;
      window.GeekProfile.currentProfile = null;
      window.dispatchEvent(new Event('geek:profile-unavailable'));
      $('[data-prestige-dialog-error]').textContent = `${error.message} Close this dialog and refresh your dashboard before retrying.`;
    } finally { busy = false; $('[data-prestige-cancel]').disabled = false; renderPrestige(); }
  });
  $('[data-board-mode]').addEventListener('change', refreshBoard);
  $('[data-board-category]').addEventListener('change', refreshBoard);
  $('[data-board-refresh]').addEventListener('click', refreshBoard);
  window.addEventListener('geek:profile', event => { if (prestigeNeedsRefresh) return; profile = event.detail; renderPrestige(); refreshBoard(); refreshChallenges(); });
  window.addEventListener('geek:profile-unavailable', () => { profile = null; renderPrestige(); refreshBoard(); refreshChallenges(); });
  renderPrestige();
})();
