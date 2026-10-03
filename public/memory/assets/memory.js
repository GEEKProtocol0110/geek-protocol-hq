import { memoryPairs, createMemoryGame, flipMemoryCard, closeMemoryComparison } from './memory-model.js';

const $ = selector => document.querySelector(selector);
const byId = new Map(memoryPairs.map(pair => [pair.id, pair]));
const buttons = new Map();
let game = null;
const studyLink = topic => '/study/?' + new URLSearchParams({ topic, level: 'foundations' });
const sourceLink = pair => {
  const a = document.createElement('a'); a.href = pair.source; a.textContent = 'Read the source ↗'; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
};
const track = name => { try { window.GeekAnalytics?.track(name, { pairs: game.cards.length / 2 }); } catch { /* Play also works without analytics. */ } };
const render = () => {
  const total = game.cards.length / 2, matched = game.matched.length / 2;
  $('[data-matches]').textContent = `${matched} / ${total}`;
  $('[data-moves]').textContent = String(game.moves);
  $('[data-pair-progress]').max = total; $('[data-pair-progress]').value = matched;
  for (const card of game.cards) {
    const button = buttons.get(card.id), found = game.matched.includes(card.id), faceUp = found || game.revealed.includes(card.id);
    button.classList.toggle('face-up', faceUp); button.classList.toggle('matched', found);
    button.disabled = found || game.phase !== 'playing' || game.revealed.includes(card.id);
    button.setAttribute('aria-pressed', String(faceUp));
    button.setAttribute('aria-label', `Card ${card.id + 1}, ${found ? 'matched ' : ''}${faceUp ? `${card.kind}: ${card.text}` : 'face down'}`);
    const kicker = document.createElement('small'); kicker.textContent = faceUp ? `${found ? '✓ MATCHED · ' : ''}${card.kind === 'word' ? 'WORD' : 'MEANING'}` : `CARD ${String(card.id + 1).padStart(2, '0')}`;
    const text = document.createElement('span'); text.className = faceUp ? `card-${card.kind}` : 'card-cover'; text.textContent = faceUp ? card.text : 'GEEK';
    button.replaceChildren(kicker, text);
  }
  $('[data-close-pair]').hidden = game.phase !== 'compare';
  $('[data-complete]').hidden = game.phase !== 'complete';
  const pairs = [...new Set(game.matched.map(id => game.cards[id].pairId))].map(id => byId.get(id));
  $('[data-review-panel]').hidden = !pairs.length;
  $('[data-review]').replaceChildren(...pairs.map(pair => {
    const li = document.createElement('li'), h = document.createElement('h3'), p = document.createElement('p'), lesson = document.createElement('a');
    h.textContent = `${pair.term} → ${pair.meaning}`; p.textContent = pair.explanation;
    lesson.href = studyLink(pair.topic); lesson.textContent = 'Explore this lesson →';
    const links = document.createElement('div'); links.className = 'memory-review-links'; links.append(sourceLink(pair), lesson); li.append(h, p, links); return li;
  }));
};
const flip = id => {
  const next = flipMemoryCard(game, id);
  if (next === game) return;
  const previousMatches = game.matched.length; game = next; render();
  if (game.phase === 'compare') {
    $('[data-feedback]').textContent = 'Those cards belong to different ideas. Take your time with both, then turn them back over.';
    $('[data-close-pair]').focus({ preventScroll: true });
  } else if (game.matched.length > previousMatches) {
    const pair = byId.get(game.cards[id].pairId);
    $('[data-feedback]').textContent = `Matched: ${pair.term}. ${pair.explanation}`;
    window.GeekGiga?.update('memory', { phase: game.phase === 'complete' ? 'complete' : 'match' });
    if (game.phase === 'complete') {
      $('[data-complete-text]').textContent = `You connected all ${game.cards.length / 2} pairs in ${game.moves} attempts. Revisit the ideas below or shuffle a new board.`;
      track('Memory Grid completed'); $('[data-complete-title]').focus({ preventScroll: true });
    } else [...buttons.values()].find(button => !button.disabled)?.focus({ preventScroll: true });
  } else $('[data-feedback]').textContent = 'Now look for the card that goes with this idea. Match one word with one meaning.';
};
const start = () => {
  const count = Number($('[data-size]').value);
  game = createMemoryGame([4, 6, 8].includes(count) ? count : 4);
  buttons.clear();
  $('[data-grid]').replaceChildren(...game.cards.map(card => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'memory-card'; button.dataset.card = String(card.id);
    button.addEventListener('click', () => flip(card.id)); buttons.set(card.id, button); return button;
  }));
  $('[data-board]').hidden = false;
  $('[data-board-title]').textContent = `${count} pairs. One idea at a time.`;
  $('[data-start]').textContent = 'Shuffle a new board →';
  $('[data-feedback]').textContent = 'Choose a card, then find its word or meaning. There is no timer.';
  window.GeekGiga?.update('memory', { phase: 'start' });
  render(); track('Memory Grid started');
  $('[data-board]').scrollIntoView({ behavior: 'instant', block: 'start' });
  $('[data-board-title]').focus({ preventScroll: true });
};
$('[data-start]').addEventListener('click', start);
$('[data-close-pair]').addEventListener('click', () => {
  const first = game.revealed[0]; game = closeMemoryComparison(game); render();
  $('[data-feedback]').textContent = 'Try another pair. You can take as many attempts as you need.';
  buttons.get(first)?.focus({ preventScroll: true });
});
