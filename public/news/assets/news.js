(() => {
  const host = document.querySelector('[data-news-feed]');
  const status = document.querySelector('[data-news-status]');
  const pause = document.querySelector('[data-news-pause]');
  const buttons = [...document.querySelectorAll('[data-news-panel]')];
  if (!host || !status || !pause || !buttons.length) return;
  const common = { colorTheme: 'dark', isTransparent: false, width: '100%', height: '100%', utm_source: 'www.geekprotocol.xyz', utm_medium: 'widget', 'page-uri': 'https://www.geekprotocol.xyz/news/' };
  const group = (name, symbols) => ({ name, symbols: symbols.map(([name, displayName]) => ({ name, displayName })) });
  // Fixed provider configurations only. No query-string URLs or page/account data enter the frame.
  const quotes = (title, description, href, groups) => ({ title, description, href, widget: 'market-quotes', settings: { showSymbolLogo: true, symbolsGroups: groups.map(([name, symbols]) => group(name, symbols)) } });
  const panels = {
    overview: quotes('World market overview', 'US, European and Asian benchmarks, major currencies and commodities. Index-linked CFDs are labeled; they are broker quotes, not the underlying cash index.', 'https://www.tradingview.com/markets/indices/', [
      ['United States · index CFDs', [['FOREXCOM:SPXUSD', 'US 500 · CFD'], ['FOREXCOM:NSXUSD', 'US 100 · CFD'], ['FOREXCOM:DJI', 'Wall Street 30 · CFD']]],
      ['Europe & Asia', [['FOREXCOM:UKXGBP', 'UK 100 · CFD'], ['INDEX:DEU40', 'Germany DAX'], ['INDEX:NKY', 'Japan Nikkei 225']]],
      ['Currencies & commodities', [['FX:EURUSD', 'EUR / USD'], ['FX:USDJPY', 'USD / JPY'], ['OANDA:XAUUSD', 'Gold spot / USD'], ['TVC:USOIL', 'WTI oil · CFD']]]
    ]),
    stocks: quotes('Major US stocks', 'A cross-sector watchlist of ten US-listed companies. Exchange coverage and delays vary; this is not a complete stock screener.', 'https://www.tradingview.com/markets/stocks-usa/', [
      ['Technology & communication', [['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:AMD', 'AMD']]],
      ['Consumer, finance & energy', [['NASDAQ:AMZN', 'Amazon'], ['NASDAQ:TSLA', 'Tesla'], ['NYSE:JPM', 'JPMorgan Chase'], ['NYSE:XOM', 'Exxon Mobil']]]
    ]),
    forex: quotes('Global currencies', 'Eight currency pairs. Read the base and quote currency together; these are provider forex quotes, not a currency-conversion guarantee.', 'https://www.tradingview.com/markets/currencies/', [
      ['Major pairs', [['FX:EURUSD', 'Euro / US dollar'], ['FX:GBPUSD', 'British pound / US dollar'], ['FX:USDJPY', 'US dollar / Japanese yen'], ['FX:USDCHF', 'US dollar / Swiss franc'], ['FX:AUDUSD', 'Australian dollar / US dollar'], ['FX:USDCAD', 'US dollar / Canadian dollar'], ['FX:NZDUSD', 'New Zealand dollar / US dollar'], ['FX:EURGBP', 'Euro / British pound']]]
    ]),
    commodities: quotes('Metals & energy', 'Gold and silver spot quotes alongside continuous energy and copper futures. Futures are labeled; prices use different units and contracts.', 'https://www.tradingview.com/markets/futures/quotes-all/', [
      ['Precious metals · spot USD', [['OANDA:XAUUSD', 'Gold spot / USD'], ['OANDA:XAGUSD', 'Silver spot / USD']]],
      ['Energy & industrial metals · futures', [['NYMEX:CL1!', 'WTI crude · continuous futures'], ['NYMEX:NG1!', 'Natural gas · continuous futures'], ['COMEX:HG1!', 'Copper · continuous futures']]]
    ]),
    bonds: quotes('Government bond yields', 'US Treasury maturities and ten-year government yields in Germany, Britain and Japan. Values are yields in percent, not bond prices; a percentage change is not a basis-point change.', 'https://www.tradingview.com/markets/bonds/', [
      ['United States · yield %', [['TVC:US02Y', 'US 2-year yield'], ['TVC:US10Y', 'US 10-year yield'], ['TVC:US30Y', 'US 30-year yield']]],
      ['Global 10-year yields · %', [['TVC:DE10Y', 'Germany 10-year yield'], ['TVC:GB10Y', 'UK 10-year yield'], ['TVC:JP10Y', 'Japan 10-year yield']]]
    ]),
    macrofutures: quotes('Index, commodity & Treasury futures', 'Continuous front-contract series, not a specific deliverable contract. Rolls can affect charts; exchange quotes may be delayed or unavailable.', 'https://www.tradingview.com/markets/futures/', [
      ['Equity index futures', [['CME_MINI:ES1!', 'S&P 500 E-mini · continuous'], ['CME_MINI:NQ1!', 'Nasdaq 100 E-mini · continuous']]],
      ['Metals & energy futures', [['COMEX:GC1!', 'Gold · continuous'], ['COMEX:SI1!', 'Silver · continuous'], ['NYMEX:CL1!', 'WTI crude · continuous'], ['NYMEX:NG1!', 'Natural gas · continuous']]],
      ['Treasury futures · price, not yield', [['CBOT:ZN1!', 'US 10-year T-note · continuous']]]
    ]),
    markets: { title: 'Kaspa and crypto spot prices', description: 'Eight crypto spot pairs quoted in USD on Kraken. Prices differ by exchange; Kaspa stays first.', href: 'https://www.tradingview.com/markets/cryptocurrencies/prices-all/', widget: 'market-quotes', settings: { showSymbolLogo: true, symbolsGroups: [group('Crypto spot · USD', [['KRAKEN:KASUSD', 'Kaspa / USD'], ['KRAKEN:BTCUSD', 'Bitcoin / USD'], ['KRAKEN:ETHUSD', 'Ethereum / USD'], ['KRAKEN:SOLUSD', 'Solana / USD'], ['KRAKEN:XRPUSD', 'XRP / USD'], ['KRAKEN:ADAUSD', 'Cardano / USD'], ['KRAKEN:DOGEUSD', 'Dogecoin / USD'], ['KRAKEN:LINKUSD', 'Chainlink / USD']])] } },
    crypto: { title: 'Crypto news headlines', description: 'Crypto publisher headlines. Open the original reporting and check its publication date.', href: 'https://www.tradingview.com/markets/cryptocurrencies/news/', widget: 'timeline', query: 'market=crypto', settings: { displayMode: 'regular', market: 'crypto' } },
    world: { title: 'Global market news headlines', description: 'Global financial headlines covering stocks, economies and markets. Coverage and ordering are selected by the provider.', href: 'https://www.tradingview.com/news/', widget: 'timeline', settings: { displayMode: 'regular' } },
    futures: { title: 'Crypto perpetual futures · USDT', description: 'KAS, BTC, ETH and SOL perpetual derivatives on Binance, quoted in USDT. These have no fixed expiry and differ from spot ownership.', href: 'https://www.tradingview.com/markets/cryptocurrencies/prices-all/', widget: 'market-quotes', settings: { showSymbolLogo: true, symbolsGroups: [group('Perpetual futures · USDT', [['BINANCE:KASUSDT.P', 'KAS perpetual / USDT'], ['BINANCE:BTCUSDT.P', 'BTC perpetual / USDT'], ['BINANCE:ETHUSDT.P', 'ETH perpetual / USDT'], ['BINANCE:SOLUSDT.P', 'SOL perpetual / USDT']])] } },
  };
  let selected = 'overview', paused = false;
  const render = () => {
    host.replaceChildren();
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.newsPanel === selected));
    pause.textContent = paused ? 'Resume feed' : 'Pause feed';
    pause.setAttribute('aria-pressed', String(paused));
    if (paused) { status.textContent = 'Feed paused. Source links below remain available.'; return; }
    const panel = panels[selected];
    const heading = document.querySelector('[data-news-heading]');
    const description = document.querySelector('[data-news-description]');
    const sourceLink = document.querySelector('[data-news-source]');
    if (heading) heading.textContent = panel.title;
    if (description) description.textContent = panel.description;
    if (sourceLink) sourceLink.href = panel.href;
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
