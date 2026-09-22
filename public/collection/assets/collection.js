(() => {
  'use strict';

  const PAGE_SIZE = 60;
  const state = { manifest: null, filtered: [], shown: PAGE_SIZE };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

  const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;

  const renderDistricts = () => {
    $('[data-district-grid]').innerHTML = state.manifest.blueprint.districts.map((district, index) => `<article style="--district:${escapeHtml(district.palette[0])};--district-dark:${escapeHtml(district.palette[1])}"><span>${String(index + 1).padStart(2, '0')} / ${escapeHtml(district.category.toUpperCase())}</span><div class="district-node" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div><h3>${escapeHtml(district.name)}</h3><p>${escapeHtml(district.environment)} · ${escapeHtml(district.discipline)}</p><blockquote>${escapeHtml(district.credo)}</blockquote></article>`).join('');
  };

  const cardArt = (identity) => {
    if (identity.id === 'geek-499') return '<img src="../assets/kaspa-culture.png" alt="GIGA concept art" loading="lazy" />';
    if (identity.id === 'geek-500') return '<img src="../assets/omniscient-grid.png" alt="A.C.E. concept art" loading="lazy" />';
    return `<div class="slot-art" aria-hidden="true"><i></i><strong>${String(identity.number).padStart(3, '0')}</strong><span>${escapeHtml(identity.traits.signal.slice(0, 3).toUpperCase())}</span></div>`;
  };

  const renderGrid = () => {
    const visible = state.filtered.slice(0, state.shown);
    $('[data-result-count]').textContent = `${state.filtered.length} ${state.filtered.length === 1 ? 'identity' : 'identities'} matched`;
    $('[data-geek-grid]').innerHTML = visible.length ? visible.map((identity) => `<article class="geek-card tier-${identity.tier.toLowerCase()}" id="${escapeHtml(identity.id)}" style="--primary:${escapeHtml(identity.traits.palette[0])};--deep:${escapeHtml(identity.traits.palette[1])}"><button type="button" data-geek-id="${escapeHtml(identity.id)}" aria-label="Open ${escapeHtml(identity.name)} details"><div class="card-art">${cardArt(identity)}<em>${identity.production.artStatus === 'anchor-concept' ? 'CONCEPT ART' : 'DESIGN SLOT'}</em></div><div class="card-copy"><span>#${String(identity.number).padStart(3, '0')} · ${escapeHtml(identity.tier)}</span><h3>${escapeHtml(identity.name)}</h3><p>${escapeHtml(identity.districtName)} / ${escapeHtml(identity.role)}</p><b>${escapeHtml(identity.traits.signal)} SIGNAL</b></div></button></article>`).join('') : '<p class="collection-loading">No identities match those filters.</p>';
    const more = $('[data-load-more]');
    more.hidden = state.shown >= state.filtered.length;
    more.textContent = `Load more identities · ${Math.min(PAGE_SIZE, state.filtered.length - state.shown)} next`;
  };

  const applyFilters = () => {
    const query = $('[data-search]').value.trim().toLowerCase();
    const tier = $('[data-tier]').value;
    const district = $('[data-district]').value;
    state.filtered = state.manifest.identities.filter((identity) => {
      const searchable = `${identity.number} ${identity.id} ${identity.name} ${identity.role} ${identity.districtName} ${identity.traits.signal}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!tier || identity.tier === tier) && (!district || identity.district === district);
    });
    state.shown = PAGE_SIZE;
    renderGrid();
  };

  const openIdentity = (id) => {
    const identity = state.manifest.identities.find((item) => item.id === id);
    if (!identity) return;
    const traits = [['DISTRICT', identity.districtName], ['ROLE', identity.role], ['SIGNAL', identity.traits.signal], ['FRAME', identity.traits.frame], ['VISOR', identity.traits.visor], ['CORE', identity.traits.core], ['TOOL', identity.traits.tool], ['AURA', identity.traits.aura]];
    $('[data-dialog-content]').innerHTML = `<div class="dialog-art" style="--primary:${escapeHtml(identity.traits.palette[0])};--deep:${escapeHtml(identity.traits.palette[1])}">${cardArt(identity)}</div><div class="dialog-copy"><span>${escapeHtml(identity.tier)} · ${escapeHtml(identity.lore.sector)}</span><h2 id="dialog-name">${escapeHtml(identity.name)}</h2><p>${escapeHtml(identity.description)}</p><blockquote>“${escapeHtml(identity.lore.credo)}”</blockquote><div class="trait-grid">${traits.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`).join('')}</div><div class="dispatch"><small>GRID DISPATCH</small><p>${escapeHtml(identity.lore.dispatch)}</p></div><div class="production-state"><b>${identity.production.artStatus === 'anchor-concept' ? 'ANCHOR CONCEPT' : 'ARTWORK PENDING'}</b><span>NOT MINTED · OWNERSHIP OFF</span></div></div>`;
    history.replaceState(null, '', `#${identity.id}`);
    $('[data-geek-dialog]').showModal();
  };

  const closeDialog = () => {
    $('[data-geek-dialog]').close();
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  };

  const initialize = async () => {
    try {
      const response = await fetch('../data/geek-500.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Manifest unavailable');
      state.manifest = await response.json();
      state.filtered = state.manifest.identities;
      $('[data-tier]').insertAdjacentHTML('beforeend', state.manifest.blueprint.tiers.map((tier) => option(tier.name, `${tier.name} · ${tier.count}`)).join(''));
      $('[data-district]').insertAdjacentHTML('beforeend', state.manifest.blueprint.districts.map((district) => option(district.id, district.name)).join(''));
      renderDistricts();
      renderGrid();
      if (/^#geek-\d{3}$/.test(location.hash)) openIdentity(location.hash.slice(1));
    } catch {
      $('[data-geek-grid]').innerHTML = '<p class="collection-loading">The Grid manifest could not be verified. No collection data will be shown from an unverified source.</p>';
      $('[data-result-count]').textContent = 'Manifest verification unavailable';
    }
  };

  $('[data-search]').addEventListener('input', applyFilters);
  $('[data-tier]').addEventListener('change', applyFilters);
  $('[data-district]').addEventListener('change', applyFilters);
  $('[data-clear]').addEventListener('click', () => { $('[data-search]').value = ''; $('[data-tier]').value = ''; $('[data-district]').value = ''; applyFilters(); });
  $('[data-load-more]').addEventListener('click', () => { state.shown += PAGE_SIZE; renderGrid(); });
  $('[data-geek-grid]').addEventListener('click', (event) => { const button = event.target.closest('[data-geek-id]'); if (button) openIdentity(button.dataset.geekId); });
  $('[data-dialog-close]').addEventListener('click', closeDialog);
  $('[data-geek-dialog]').addEventListener('click', (event) => { if (event.target === $('[data-geek-dialog]')) closeDialog(); });
  initialize();
})();
