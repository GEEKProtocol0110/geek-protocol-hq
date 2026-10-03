(() => {
  'use strict';

  let collectibleState = null;
  const $ = (selector) => document.querySelector(selector);
  const format = new Intl.NumberFormat('en-US');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const safeDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => value ? new Intl.DateTimeFormat('en-US', options).format(new Date(value)) : '—';

  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Profile service unavailable.');
    return payload;
  };

  const setText = (selector, value) => { const element = $(selector); if (element) element.textContent = value; };

  const refreshStudy = async () => {
    const button = $('[data-study-retry]'); button.disabled = true;
    $('[data-study-panel]').setAttribute('aria-busy', 'true');
    try {
      const { progress } = await api('/api/ranked/?service=study', { method: 'POST', body: JSON.stringify({ action: 'progress' }) });
      window.GeekGiga?.update('progress', { explored: progress.explored, review: progress.review, topic: progress.next.topic });
      setText('[data-study-explored]', `${progress.explored} / ${progress.total}`);
      setText('[data-study-review]', progress.review);
      setText('[data-study-confidence]', progress.confidence);
      $('[data-study-totals]').hidden = false;
      setText('[data-study-note]', progress.explored ? 'Your saved practice feedback helps you choose what to revisit.' : 'Begin with one lesson and a few untimed questions. Your feedback will appear here.');
      const next = $('[data-study-next]');
      next.href = `../study/?${new URLSearchParams({ topic: progress.next.topic, ...(!progress.explored ? { level: 'foundations' } : {}), ...(progress.next.review ? { review: '1' } : {}) })}`;
      next.textContent = progress.explored ? `${progress.next.review ? 'Review' : 'Continue'}: ${progress.next.name} →` : 'Start your first lesson →';
      next.hidden = false; button.hidden = true;
      const names = { origins: 'Where Kaspa began', blockdag: 'Blocks, graphs & agreement', mining: 'Mining & network security', emission: 'KAS & the emission schedule', wallets: 'Wallets & safe signatures', tokens: 'Tokens & indexers', ecosystem: 'Nodes & builder tools', fundamentals: 'Keys, fees & finality' };
      $('[data-study-topics]').replaceChildren(...progress.topics.map(topic => {
        const card = document.createElement('a');
        card.href = `../study/?${new URLSearchParams({ topic: topic.id, ...(topic.review ? { review: '1' } : {}) })}`;
        const title = document.createElement('strong'); title.textContent = names[topic.id] || topic.id;
        const note = document.createElement('span'); note.textContent = `${topic.explored} / ${topic.total} explored${topic.review ? ` · ${topic.review} to review` : ''}`;
        card.append(title, note); return card;
      }));
    } catch (error) {
      window.GeekGiga?.update('progress', { phase: 'unavailable' });
      setText('[data-study-note]', `${error.message} Your saved feedback has not changed. You can retry or open Study.`);
      button.hidden = false;
    } finally { button.disabled = false; $('[data-study-panel]').setAttribute('aria-busy', 'false'); }
  };

  const postCollectible = (body) => api('/api/collectibles', { method: 'POST', body: JSON.stringify(body) });

  const renderCollectionMetrics = (blueprint) => {
    $('[data-collection-metrics]').innerHTML = [
      ['PLANNED SUPPLY', blueprint.supply],
      ['LORE DISTRICTS', blueprint.districts.length],
      ['RARITY TIERS', blueprint.tiers.length],
      ['MYTHIC ANCHORS', blueprint.anchors.map((anchor) => anchor.name).join(' + ')]
    ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  };

  const renderAvatars = (collection) => {
    const selected = collection.avatar;
    const image = $('[data-avatar-image]');
    const fallback = $('[data-avatar-fallback]');
    const custom = selected?.id === 'giga-builder';
    const customImage = $('[data-avatar-custom]');
    customImage.hidden = !custom;
    if (custom && window.GeekBuilder) { customImage.innerHTML = window.GeekBuilder.svg(collection.customization); customImage.setAttribute('aria-label', 'Your custom Geek'); }
    image.hidden = custom; fallback.hidden = custom;
    if (selected?.asset && !custom) {
      image.src = selected.asset;
      image.hidden = false;
      fallback.hidden = true;
    }
    renderCollectionMetrics(collection.blueprint);
    $('[data-avatar-grid]').innerHTML = collection.avatars.map((avatar) => {
      const active = selected.id === avatar.id;
      return `<article class="avatar-card ${active ? 'selected' : ''} ${avatar.owned ? '' : 'locked'}">${avatar.id === 'giga-builder' ? `<div class="avatar-custom-art" role="img" aria-label="Your customizable Geek">${window.GeekBuilder?.svg(collection.customization) || '<span>Build your Geek ↓</span>'}</div>` : `<img src="${escapeHtml(avatar.asset)}" alt="${escapeHtml(avatar.name)}" loading="lazy" />`}<div><span>${escapeHtml(avatar.tier)} IDENTITY</span><h3>${escapeHtml(avatar.name)}</h3><p>${escapeHtml(avatar.requirement)}</p><button type="button" data-avatar-id="${escapeHtml(avatar.id)}" ${avatar.owned && !active ? '' : 'disabled'}>${active ? 'ACTIVE SIGNAL' : avatar.owned ? 'SELECT GEEK' : 'LOCKED'}</button></div></article>`;
    }).join('');
  };

  const renderStickers = (collection) => {
    $('[data-sticker-grid]').innerHTML = collection.stickers.map((sticker) => `<article class="sticker-card ${sticker.quantity ? 'owned' : 'missing'}" style="--sticker:${escapeHtml(sticker.color)}"><div class="sticker-glyph">${escapeHtml(sticker.glyph)}</div><span>${escapeHtml(sticker.rarity)}</span><h3>${escapeHtml(sticker.name)}</h3><p>${sticker.quantity ? `${format.format(sticker.available)} available${sticker.reserved ? ` · ${format.format(sticker.reserved)} reserved` : ''}` : 'Not discovered'}</p></article>`).join('');
    const owned = collection.stickers.filter((sticker) => sticker.available > 0);
    const options = collection.stickers.map((sticker) => `<option value="${escapeHtml(sticker.id)}">${escapeHtml(sticker.name)}</option>`).join('');
    $('[data-give-sticker]').innerHTML = owned.length ? owned.map((sticker) => `<option value="${escapeHtml(sticker.id)}">${escapeHtml(sticker.name)} (${sticker.available})</option>`).join('') : '<option value="">No stickers available</option>';
    $('[data-want-sticker]').innerHTML = options;
  };

  const renderTrades = (trades) => {
    $('[data-trade-list]').innerHTML = trades.length ? trades.map((trade) => `<article class="trade-card"><div><span>${escapeHtml(trade.sellerName)}</span><b>${trade.give.quantity}× ${escapeHtml(trade.give.name)}</b></div><i aria-hidden="true">FOR</i><div><span>REQUESTS</span><b>${trade.want.quantity}× ${escapeHtml(trade.want.name)}</b></div><button type="button" data-trade-${trade.own ? 'cancel' : 'accept'}="${escapeHtml(trade.id)}">${trade.own ? 'Cancel' : 'Accept'}</button></article>`).join('') : '<p class="profile-empty">No open offers yet. Create the first verified sticker exchange.</p>';
  };

  const renderCollectibles = (payload) => {
    collectibleState = payload;
    window.GeekProfile.trades = payload.trades; window.GeekProfile.collection = payload.collection; window.GeekProfile.offline = false;
    window.GeekBuilder?.receive(payload.collection);
    renderAvatars(payload.collection);
    renderStickers(payload.collection);
    renderTrades(payload.trades);
  };

  window.GeekProfile = { renderCollectibles, collection: null, offline: false };

  const refreshCollectibles = async () => renderCollectibles(await api('/api/collectibles'));

  const collectibleAction = async (body, successMessage) => {
    const feedback = $('[data-trade-feedback]');
    feedback.textContent = 'Verifying server state…';
    try {
      renderCollectibles(await postCollectible(body));
      feedback.textContent = successMessage;
    } catch (error) {
      feedback.textContent = error.message;
    }
  };

  const renderMastery = (categories) => {
    const maximum = Math.max(1, ...categories.map((category) => category.correct));
    $('[data-mastery-grid]').innerHTML = categories.map((category, index) => {
      const accuracy = category.questions ? Math.round((category.correct / category.questions) * 100) : 0;
      const signal = category.questions ? Math.max(8, Math.round((category.correct / maximum) * 100)) : 0;
      return `<article class="mastery-card ${category.rounds ? '' : 'dormant'}"><span>${String(index + 1).padStart(2, '0')} / WORLD</span><h3>${escapeHtml(category.label)}</h3><dl><dt>ROUNDS</dt><dd>${format.format(category.rounds)}</dd><dt>CORRECT</dt><dd>${format.format(category.correct)}</dd><dt>ACCURACY</dt><dd>${accuracy}%</dd><dt>XP</dt><dd>${format.format(category.xp)}</dd></dl><div class="mastery-bar" aria-label="${escapeHtml(category.label)} mastery signal"><i style="width:${signal}%"></i></div></article>`;
    }).join('');
  };

  const renderAchievements = (achievements) => {
    $('[data-achievement-grid]').innerHTML = achievements.map((achievement, index) => `<article class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}"><span>${achievement.unlocked ? '✓' : String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(achievement.name)}</h3><p>${escapeHtml(achievement.detail)}</p><div class="achievement-progress"><b>${achievement.unlocked ? 'UNLOCKED' : 'IN PROGRESS'}</b><span>${format.format(achievement.progress)} / ${format.format(achievement.target)}</span></div></article>`).join('');
  };

  const eventCopy = (event) => {
    if (event.type === 'prestige') return { icon: `P${event.prestige}`, title: `Prestige ${event.prestige} reached`, detail: `${event.title} · A new 25-level cycle began.` };
    if (event.type === 'level') return { icon: `L${event.level}`, title: `Level ${event.level} reached`, detail: `${event.title} · Server-verified XP milestone.` };
    if (event.type === 'sticker') {
      const sticker = collectibleState?.collection?.stickers?.find((item) => item.id === event.stickerId);
      return { icon: sticker?.glyph || '+', title: `${sticker?.name || 'Sticker'} unlocked`, detail: 'Added by the ranked server to your collectible album.' };
    }
    const mode = event.mode === 'daily' ? 'Daily Signal' : event.mode === 'speed' ? 'Speed Signal' : `Gauntlet round ${event.round}`;
    return { icon: event.mode === 'gauntlet' ? `R${String(event.round).padStart(2, '0')}` : event.mode === 'daily' ? 'DAY' : 'SPD', title: `${event.categoryLabel} · ${mode}`, detail: `${event.correct}/${event.answered} correct · ${format.format(event.score)} score · +${format.format(event.xp)} XP${event.reward ? ` · +${format.format(event.reward)} Alpha GEEK` : ''}` };
  };

  const renderJourney = (journey) => {
    $('[data-journey-list]').innerHTML = journey.length ? journey.map((event) => {
      const copy = eventCopy(event);
      return `<li class="journey-event ${escapeHtml(event.type)}"><span class="journey-icon">${escapeHtml(copy.icon)}</span><div><h3>${escapeHtml(copy.title)}</h3><p>${escapeHtml(copy.detail)}</p></div><time datetime="${new Date(event.at).toISOString()}">${safeDate(event.at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></li>`;
    }).join('') : '<li class="profile-empty">Your first verified milestone is waiting. Enter a ranked mode to begin the journey.</li>';
  };

  const render = (profile) => {
    const { player, progression, stats } = profile;
    setText('[data-profile-state]', 'SERVER-VERIFIED JOURNEY ONLINE');
    setText('[data-player-name]', player.name);
    setText('[data-avatar-fallback]', player.name.trim().charAt(0).toUpperCase() || 'G');
    setText('[data-rank-title]', progression.title);
    setText('[data-rank-title-copy]', progression.title.toUpperCase());
    setText('[data-member-since]', safeDate(player.memberSince));
    setText('[data-recovery]', player.walletProtected ? 'Kaspa wallet protected' : 'Not protected');
    setText('[data-protection]', player.walletProtected ? 'WALLET PROTECTED' : 'SESSION PROFILE');
    $('[data-protection]').classList.toggle('protected', player.walletProtected);
    setText('[data-level]', progression.level);
    setText('[data-prestige]', `PRESTIGE ${progression.prestige}`);
    setText('[data-level-xp]', `${format.format(progression.levelXp)} / ${format.format(progression.levelXpRequired)} XP`);
    setText('[data-xp-next]', `${format.format(progression.xpToNext)} XP to ${progression.level === progression.levelsPerPrestige ? 'Prestige' : 'next level'}`);
    $('[data-level-bar]').style.width = `${progression.progressPercent}%`;
    $('[data-level-track]').setAttribute('aria-valuenow', String(progression.progressPercent));
    $('[data-level-orbit]').style.setProperty('--progress', `${progression.progressPercent * 3.6}deg`);
    setText('[data-stat="xp"]', format.format(stats.xp));
    setText('[data-stat="accuracy"]', `${stats.accuracy}%`);
    setText('[data-answer-count]', `${format.format(stats.totalCorrect)} / ${format.format(stats.totalQuestions)} correct`);
    setText('[data-stat="bestRound"]', String(stats.bestRound).padStart(2, '0'));
    setText('[data-stat="longestStreak"]', `${format.format(stats.longestStreak)}×`);
    setText('[data-stat="totalRuns"]', format.format(stats.totalRuns));
    setText('[data-stat="alphaGeek"]', format.format(stats.alphaGeek));
    renderMastery(profile.categories);
    renderAchievements(profile.achievements);
    renderJourney(profile.journey);
  };

  const initialize = async () => {
    try {
      await api('/api/session', { method: 'POST', body: '{}' });
      await Promise.allSettled([
        refreshStudy(),
        api('/api/profile').then(payload => render(payload.profile)).catch(error => {
          setText('[data-profile-state]', 'GAME RECORDS UNAVAILABLE');
          setText('[data-journey-list]', `${error.message} Your game records remain saved.`);
        }),
        refreshCollectibles().catch(error => { window.GeekProfile.offline = true; window.GeekBuilder?.unavailable(); setText('[data-trade-feedback]', `${error.message} Your collection remains saved.`); })
      ]);
    } catch (error) {
      window.GeekProfile.offline = true; window.GeekBuilder?.unavailable();
      window.GeekGiga?.update('progress', { phase: 'unavailable' });
      setText('[data-profile-state]', 'PROFILE SERVICE OFFLINE');
      setText('[data-study-note]', `${error.message} Refresh this page to reconnect. You can still read Kaspa 101.`);
      $('[data-journey-list]').innerHTML = `<li class="profile-empty">${escapeHtml(error.message)} Your verified data remains on the server.</li>`;
    }
  };

  $('[data-geek-reconnect]')?.addEventListener('click', async () => {
    const button = $('[data-geek-reconnect]'); button.disabled = true;
    try { await initialize(); } finally { button.disabled = false; }
  });

  $('[data-study-retry]')?.addEventListener('click', refreshStudy);

  document.addEventListener('click', (event) => {
    const avatarButton = event.target.closest('[data-avatar-id]');
    if (avatarButton) collectibleAction({ action: 'select-avatar', avatarId: avatarButton.dataset.avatarId }, 'Geek identity updated.');
    const acceptButton = event.target.closest('[data-trade-accept]');
    if (acceptButton) collectibleAction({ action: 'accept-trade', tradeId: acceptButton.dataset.tradeAccept }, 'Sticker exchange settled atomically.');
    const cancelButton = event.target.closest('[data-trade-cancel]');
    if (cancelButton) collectibleAction({ action: 'cancel-trade', tradeId: cancelButton.dataset.tradeCancel }, 'Offer cancelled and reserved stickers released.');
  });

  $('[data-trade-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    collectibleAction({
      action: 'create-trade',
      giveSticker: $('[data-give-sticker]').value,
      giveQuantity: $('[data-give-quantity]').value,
      wantSticker: $('[data-want-sticker]').value,
      wantQuantity: $('[data-want-quantity]').value
    }, 'Verified offer opened. Your offered stickers are now reserved.');
  });

  initialize();
})();
