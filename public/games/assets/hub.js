// Presentation-only discovery. Opening the hub never starts a game or creates a session.
(() => {
  const tools = document.querySelector('[data-game-tools]');
  const search = document.querySelector('[data-game-search]');
  const count = document.querySelector('[data-game-count]');
  const empty = document.querySelector('[data-game-empty]');
  const cards = [...document.querySelectorAll('[data-game-card]')];
  const sections = [...document.querySelectorAll('[data-game-section]')];
  const buttons = [...document.querySelectorAll('[data-game-filter]')];
  if (!tools || !search || !count || !empty || !cards.length) return;
  let category = 'all';
  const update = () => {
    const term = search.value.trim().toLocaleLowerCase('en-US');
    let visible = 0;
    for (const card of cards) {
      card.hidden = (category !== 'all' && card.dataset.category !== category) ||
        !card.dataset.search.toLocaleLowerCase('en-US').includes(term);
      if (!card.hidden) visible++;
    }
    for (const section of sections) {
      section.hidden = ![...section.querySelectorAll('[data-game-card]')].some(card => !card.hidden);
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.gameFilter === category));
    count.textContent = `${visible} ${visible === 1 ? 'game' : 'games'}${category === 'all' && !term ? ' to explore' : ' found'}`;
    empty.hidden = visible !== 0;
  };
  for (const button of buttons) button.addEventListener('click', () => { category = button.dataset.gameFilter; update(); });
  search.addEventListener('input', update);
  // Deep links keep their original destination visible after a filter has been used.
  window.addEventListener('hashchange', () => {
    if (!['#quick', '#brain-games', '#classics', '#strategy-puzzles', '#adventures', '#friends'].includes(location.hash)) return;
    category = 'all'; search.value = ''; update();
    document.querySelector(location.hash)?.scrollIntoView({ block: 'start' });
  });
  tools.hidden = false;
  const jumps = document.querySelector('[data-game-jumps]');
  if (jumps) jumps.hidden = true;
  update();
})();
