(() => {
  const host = document.querySelector('[data-news-feed]');
  const status = document.querySelector('[data-news-status]');
  const pause = document.querySelector('[data-news-pause]');
  const buttons = [...document.querySelectorAll('[data-news-panel]')];
  if (!host || !status || !pause || !buttons.length) return;
  const common = { colorTheme: 'dark', isTransparent: false, width: '100%', height: '100%', utm_source: 'www.geekprotocol.xyz', utm_medium: 'widget', 'page-uri': 'https://www.geekprotocol.xyz/news/' };
  const group = (name, symbols) => ({ name, symbols: symbols.map(([name, displayName]) => ({ name, displayName })) });
  // Fixed provider configurations only. No query-string URLs or page/account data enter the frame.
  const panels = {
    markets: { title: 'Kaspa and crypto spot prices', widget: 'market-quotes', settings: { showSymbolLogo: true, symbolsGroups: [group('Crypto spot · USD', [['KRAKEN:KASUSD', 'Kaspa / USD'], ['KRAKEN:BTCUSD', 'Bitcoin / USD'], ['KRAKEN:ETHUSD', 'Ethereum / USD'], ['KRAKEN:SOLUSD', 'Solana / USD']])] } },
    crypto: { title: 'Crypto news headlines', widget: 'timeline', query: 'market=crypto', settings: { displayMode: 'regular', market: 'crypto' } },
    world: { title: 'Global market news headlines', widget: 'timeline', settings: { displayMode: 'regular' } },
    futures: { title: 'Crypto perpetual futures · USDT', widget: 'market-quotes', settings: { showSymbolLogo: true, symbolsGroups: [group('Perpetual futures · USDT', [['BINANCE:KASUSDT.P', 'KAS perpetual / USDT'], ['BINANCE:BTCUSDT.P', 'BTC perpetual / USDT'], ['BINANCE:ETHUSDT.P', 'ETH perpetual / USDT'], ['BINANCE:SOLUSDT.P', 'SOL perpetual / USDT']])] } },
  };
  let selected = 'markets', paused = false;
  const render = () => {
    host.replaceChildren();
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.newsPanel === selected));
    pause.textContent = paused ? 'Resume feed' : 'Pause feed';
    pause.setAttribute('aria-pressed', String(paused));
    if (paused) { status.textContent = 'Feed paused. Source links below remain available.'; return; }
    const panel = panels[selected];
    host.dataset.newsKind = panel.widget;
    const frame = document.createElement('iframe');
    frame.title = panel.title;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('loading', 'eager');
    // Match the iframe URL emitted by TradingView's official embedding bootstrap,
    // without loading its third-party JavaScript into the Geek account origin.
    const url = new URL(`https://www.tradingview-widget.com/embed-widget/${panel.widget}/`);
    url.search = panel.query || 'locale=en';
    url.hash = encodeURIComponent(JSON.stringify({ ...common, ...panel.settings }));
    frame.src = url.href;
    status.textContent = `${panel.title}. Provider data may be delayed. If the feed is blank, open the source links below.`;
    host.append(frame);
  };
  for (const button of buttons) button.addEventListener('click', () => {
    const key = button.dataset.newsPanel;
    if (!Object.hasOwn(panels, key)) return;
    if (selected === key && !paused) return;
    selected = key; paused = false; render();
  });
  pause.hidden = false;
  pause.addEventListener('click', () => { paused = !paused; render(); });
  render();
})();
