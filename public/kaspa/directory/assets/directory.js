(() => {
  const controls = document.querySelector('[data-directory-controls]');
  if (!controls) return;
  const search = document.querySelector('[data-directory-search]');
  const category = document.querySelector('[data-directory-category]');
  const reset = document.querySelector('[data-directory-reset]');
  const status = document.querySelector('[data-directory-status]');
  const empty = document.querySelector('[data-directory-empty]');
  const cards = [...document.querySelectorAll('[data-directory-card]')];
  const sections = [...document.querySelectorAll('[data-directory-section]')];
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const texts = new Map(cards.map(card => [card,normalize(card.dataset.search)]));
  function filter() {
    const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      card.hidden = !(category.value === 'all' || category.value === card.dataset.category) || !terms.every(term => texts.get(card).includes(term));
      if (!card.hidden) count++;
    }
    for (const section of sections) section.hidden = ![...section.querySelectorAll('[data-directory-card]')].some(card => !card.hidden);
    status.textContent = `${count} of ${cards.length} resources shown.`;
    empty.hidden = count !== 0;
    reset.disabled = !search.value && category.value === 'all';
  }
  controls.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input',filter);
  category.addEventListener('change',filter);
  reset.addEventListener('click',() => { search.value = ''; category.value = 'all'; filter(); search.focus(); });
  for (const shortcut of document.querySelectorAll('[data-directory-category-link]')) shortcut.addEventListener('click',() => {
    search.value = ''; category.value = shortcut.dataset.directoryCategoryLink; filter();
  });
  document.querySelector('[data-directory-jump]').hidden = true;
  controls.hidden = false;
  filter();
})();
