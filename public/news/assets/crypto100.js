(() => {
  const money = (value, compact = false) => typeof value !== 'number' || !Number.isFinite(value) ? '—' :
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : value < 1 ? 8 : 2 }).format(value);
  // Loaded by the market desk only when its Top 100 panel is selected.
  window.GeekCrypto100 = async ({ host, status, signal }) => {
    const node = (tag, text, className) => {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    };
    status.textContent = 'Loading the top 100 by CoinGecko market cap…';
    try {
      const response = await fetch('/api/widget?service=markets', { credentials: 'same-origin', signal });
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (signal.aborted) return;
      if (!Array.isArray(data.coins) || data.coins.length !== 100 || data.source !== 'CoinGecko' ||
          !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error('Incomplete data');
      const shell = node('div', undefined, 'crypto100');
      const tools = node('div', undefined, 'crypto100-tools');
      const label = node('label', 'Search these 100 coins');
      const search = node('input'); search.type = 'search'; search.placeholder = 'Coin name or symbol'; search.setAttribute('aria-label', 'Search the top 100 coins');
      label.append(search); tools.append(label);
      const count = node('p'); count.setAttribute('role', 'status');
      const scroll = node('div', undefined, 'crypto100-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Top 100 crypto table, scroll for more coins and columns');
      const table = node('table'); const caption = node('caption', 'Top 100 by market capitalization · USD · includes stablecoins and wrapped assets');
      const head = node('thead'), heading = node('tr');
      for (const text of ['Rank', 'Coin', 'Price', '24h change', 'Market cap', '24h volume']) {
        const th = node('th', text); th.scope = 'col'; heading.append(th);
      }
      head.append(heading); const body = node('tbody'); table.append(caption, head, body); scroll.append(table);
      const render = () => {
        body.replaceChildren();
        const query = search.value.trim().toLowerCase();
        const coins = data.coins.filter(c => (c.name + ' ' + c.symbol).toLowerCase().includes(query));
        for (const coin of coins) {
          const tr = node('tr'); tr.append(node('td', String(coin.rank)));
          const name = node('td'); const link = node('a', coin.name); link.href = 'https://www.coingecko.com/en/coins/' + encodeURIComponent(coin.id); link.target = '_blank'; link.rel = 'noopener noreferrer';
          name.append(link, node('span', coin.symbol.toUpperCase(), 'crypto100-symbol')); tr.append(name, node('td', money(coin.price)));
          const change = node('td', typeof coin.change24h === 'number' && Number.isFinite(coin.change24h) ? (coin.change24h > 0 ? '+' : '') + coin.change24h.toFixed(2) + '%' : '—');
          if (coin.change24h > 0) change.className = 'crypto100-up'; else if (coin.change24h < 0) change.className = 'crypto100-down';
          tr.append(change, node('td', money(coin.marketCap, true)), node('td', money(coin.volume, true))); body.append(tr);
        }
        count.textContent = coins.length + ' of 100 coins' + (query ? ' match your search.' : ' · scroll to browse all ranks.');
      };
      search.value = ''; search.addEventListener('input', render); render();
      shell.append(tools, count, scroll); host.replaceChildren(shell);
      status.textContent = 'CoinGecko top 100 · snapshot fetched ' + new Date(data.fetchedAt).toLocaleString() + '. Cached for up to five minutes; provider quotes may be older. Reselect this view to request a refresh.';
    } catch {
      if (signal.aborted) return;
      host.replaceChildren();
      status.textContent = 'Top 100 data is temporarily unavailable. Open CoinGecko below for the current rankings, or try another market view.';
      const link = node('a', 'Open CoinGecko crypto rankings ↗', 'crypto100-fallback'); link.href = 'https://www.coingecko.com/'; link.target = '_blank'; link.rel = 'noopener noreferrer'; host.append(link);
    }
  };
})();
