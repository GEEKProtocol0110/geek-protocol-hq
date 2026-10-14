// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: chart-line;

// Geek Kaspa Widget 1.0.0 · MIT · GEEKProtocol0110
// Install: Scriptable > + > paste this entire file > name Geek Kaspa Widget > Run.
// Home Screen > Edit > Add Widget > Scriptable > Medium > Edit Widget > select script.
// Optional widget Parameter: mint, cyan, violet, xray
// Advanced example: theme=violet;chart=off;refresh=15
// No wallet, login, API key, or Apple Developer membership required.

const OPTIONS = { theme: "mint", chart: true, refresh: 30 };
const VERSION = 1;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ENDPOINTS = {
  price: "https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true",
  fallback: "https://api.kucoin.com/api/v1/market/stats?symbol=KAS-USDT",
  history: "https://api.coingecko.com/api/v3/coins/kaspa/market_chart?vs_currency=usd&days=1",
  network: "https://api.kaspa.org/info/blockdag",
  hash: "https://api.kaspa.org/info/hashrate"
};
const THEMES = {
  mint: { background: "050C18", text: "DEFFF9", accent: "78FFE0" },
  cyan: { background: "030F1D", text: "E0F9FF", accent: "58D9FF" },
  violet: { background: "10091C", text: "F3EAFF", accent: "C499FF" },
  xray: { background: "000000", text: "FFFFFF", accent: "FFFFFF" }
};
function isTheme(name) { return ["mint", "cyan", "violet", "xray"].includes(name); }
// Embedded media-kit mark, derived from app/src/main/res/drawable/kaspa_mark.xml.
const KASPA_MARK = "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";

function settings(parameter) {
  const result = Object.assign({}, OPTIONS);
  const text = typeof parameter === "string" ? parameter.trim().toLowerCase() : "";
  if (isTheme(text)) result.theme = text;
  text.split(";").forEach(part => {
    const pair = part.split("=").map(s => s.trim());
    if (pair.length !== 2) return;
    if (pair[0] === "theme" && isTheme(pair[1])) result.theme = pair[1];
    if (pair[0] === "chart" && ["on", "off"].includes(pair[1])) result.chart = pair[1] === "on";
    if (pair[0] === "refresh" && ["15", "30", "60"].includes(pair[1])) result.refresh = Number(pair[1]);
  });
  if (!isTheme(result.theme)) result.theme = "mint";
  if (typeof result.chart !== "boolean") result.chart = true;
  if (![15, 30, 60].includes(result.refresh)) result.refresh = 30;
  return result;
}

function validTime(time, now) {
  return Number.isFinite(time) && time > 0 && time <= now + 5 * MINUTE;
}
function unsigned(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    value = String(value);
  }
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) return null;
  const clean = value.replace(/^0+(?=\d)/, "");
  const max = "18446744073709551615";
  return clean.length < 20 || (clean.length === 20 && clean <= max) ? clean : null;
}
// Subtract counters as decimal strings before converting the small difference.
// JSON uint64 strings never pass through a floating-point Number.
function counterDelta(next, previous) {
  const a = unsigned(next), b = unsigned(previous);
  if (a === null || b === null || a.length < b.length || (a.length === b.length && a < b)) return null;
  const padded = b.padStart(a.length, "0");
  let borrow = 0, output = "";
  for (let i = a.length - 1; i >= 0; i--) {
    let digit = Number(a[i]) - Number(padded[i]) - borrow;
    borrow = digit < 0 ? 1 : 0;
    if (digit < 0) digit += 10;
    output = String(digit) + output;
  }
  const delta = Number(output);
  return Number.isSafeInteger(delta) ? delta : null;
}
function parseQuote(data, now, fallback) {
  let price, change, time, source;
  if (fallback) {
    if (!data || data.code !== "200000" || !data.data) return null;
    const q = data.data;
    if (typeof q.last !== "string" || q.last.trim() === "") return null;
    price = Number(q.last); time = q.time;
    change = typeof q.changeRate === "string" && q.changeRate.trim() !== "" ? Number(q.changeRate) * 100 : null;
    source = "KuCoin · USDT ≈ USD";
  } else {
    if (!data || !data.kaspa) return null;
    const q = data.kaspa;
    price = q.usd; change = q.usd_24h_change;
    time = typeof q.last_updated_at === "number" ? q.last_updated_at * 1000 : null;
    source = "CoinGecko · USD";
  }
  if (!Number.isFinite(price) || price <= 0 || !validTime(time, now)) return null;
  return { price, change: Number.isFinite(change) && change >= -100 ? change : null, time, source };
}
function parseNetwork(data, previous, now) {
  if (!data || !["mainnet", "kaspa-mainnet"].includes(data.networkName)) return null;
  const count = unsigned(data.blockCount), score = unsigned(data.virtualDaaScore);
  if (!count || !score || count === "0" || score === "0") return null;
  const old = previous && previous.sample;
  const elapsed = old && validTime(old.time, now) ? (now - old.time) / 1000 : null;
  const delta = old ? counterDelta(count, old.count) : null;
  let bps = null, sample = { count, time: now };
  if (elapsed !== null && elapsed >= 0 && elapsed < 30 && delta !== null) sample = old;
  if (elapsed !== null && elapsed >= 30 && elapsed <= 21600 && delta !== null) {
    const rate = delta / elapsed;
    if (rate <= 10000) bps = rate;
  }
  return { count, score, bps, time: now, sample };
}
function parseHash(data, now) {
  return data && Number.isFinite(data.hashrate) && data.hashrate > 0 ? { th: data.hashrate, time: now } : null;
}
function validHistory(points, now) {
  return Array.isArray(points) && points.length >= 2 && points.length <= 1000 &&
    points.every((p, i) => p && Number.isFinite(p.price) && p.price > 0 && validTime(p.time, now) &&
      p.time >= now - 26 * HOUR && (!i || p.time > points[i - 1].time)) &&
    points[points.length - 1].time - points[0].time >= 22 * HOUR &&
    points[points.length - 1].time >= now - HOUR;
}
function parseHistory(data, now) {
  if (!data || !Array.isArray(data.prices) || data.prices.length < 2 || data.prices.length > 1000) return null;
  const points = [];
  for (const row of data.prices) {
    if (!Array.isArray(row) || row.length !== 2 || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) return null;
    points.push({ time: row[0], price: row[1] });
  }
  points.sort((a, b) => a.time - b.time);
  const distinct = points.filter((p, i) => !i || p.time !== points[i - 1].time);
  return validHistory(distinct, now) ? distinct : null;
}
function validCachedHistory(points, fetched, now) {
  return validTime(fetched, now) && now - fetched <= 24 * HOUR && validHistory(points, fetched);
}
function validateCache(value, now) {
  const result = { version: VERSION, history: [], delayed: false };
  if (!value || value.version !== VERSION) return result;
  const q = value.quote, n = value.network, h = value.hash;
  if (q && Number.isFinite(q.price) && q.price > 0 && validTime(q.time, now) &&
      ["CoinGecko · USD", "KuCoin · USDT ≈ USD"].includes(q.source)) {
    result.quote = { price: q.price, change: Number.isFinite(q.change) && q.change >= -100 ? q.change : null, time: q.time, source: q.source };
  }
  if (n && unsigned(n.count) && unsigned(n.score) && unsigned(n.count) !== "0" && unsigned(n.score) !== "0" && validTime(n.time, now)) {
    result.network = { count: unsigned(n.count), score: unsigned(n.score), time: n.time,
      bps: Number.isFinite(n.bps) && n.bps >= 0 && n.bps <= 10000 ? n.bps : null };
    if (n.sample && unsigned(n.sample.count) && validTime(n.sample.time, now) && n.sample.time <= n.time) {
      result.network.sample = { count: unsigned(n.sample.count), time: n.sample.time };
    }
  }
  if (h && Number.isFinite(h.th) && h.th > 0 && validTime(h.time, now)) result.hash = { th: h.th, time: h.time };
  if (validCachedHistory(value.history, value.historyFetched, now)) {
    result.history = value.history; result.historyFetched = value.historyFetched;
  }
  return result;
}
async function getJSON(url) {
  try {
    const request = new Request(url);
    request.timeoutInterval = 8;
    request.headers = { Accept: "application/json" };
    const text = await request.loadString();
    if (!request.response || request.response.statusCode !== 200 || text.length > 1000000) return null;
    return JSON.parse(text);
  } catch (_) { return null; }
}
async function refresh(previous, options, now, get) {
  const result = validateCache(previous, now);
  const needsHistory = options.chart && (!result.history.length || now - result.historyFetched >= HOUR);
  const quote = async () => {
    const primary = parseQuote(await get(ENDPOINTS.price), now, false);
    return primary || parseQuote(await get(ENDPOINTS.fallback), now, true);
  };
  const readings = await Promise.all([
    quote(), get(ENDPOINTS.network), get(ENDPOINTS.hash),
    needsHistory ? get(ENDPOINTS.history) : Promise.resolve(null)
  ]);
  const q = readings[0], n = parseNetwork(readings[1], result.network, now), h = parseHash(readings[2], now);
  const points = needsHistory ? parseHistory(readings[3], now) : null;
  if (q && (!result.quote || q.time >= result.quote.time)) result.quote = q;
  if (n) result.network = n;
  if (h) result.hash = h;
  if (points) { result.history = points; result.historyFetched = now; }
  result.delayed = !q || (q && result.quote.time > q.time) || !n || !h || (needsHistory && !points);
  result.attempted = now;
  return result;
}
function loadCache(fm, path, now) {
  try { return validateCache(JSON.parse(fm.readString(path)), now); }
  catch (_) { return validateCache(null, now); }
}
function saveCache(fm, path, result) {
  try { fm.writeString(path, JSON.stringify(result)); return true; }
  catch (_) { return false; }
}
function ageLabel(reading, now) {
  if (!reading) return "Unavailable";
  const minutes = Math.max(0, Math.floor((now - reading.time) / MINUTE));
  const label = minutes < 1 ? "Just updated" : minutes < 60 ? minutes + "m ago" :
    minutes < 1440 ? Math.floor(minutes / 60) + "h ago" : Math.floor(minutes / 1440) + "d ago";
  return (minutes >= 30 ? "Stale · " : "") + label;
}
function chartLabel(snapshot, options, now) {
  if (!options.chart) return "24h chart off";
  if (!validCachedHistory(snapshot.history, snapshot.historyFetched, now)) return "24h chart unavailable";
  if (!validHistory(snapshot.history, now)) return "24h chart · cached";
  return "24h USD chart";
}
function priceText(quote) {
  return quote ? "$" + (quote.price < 0.0001 ? quote.price.toPrecision(3) : quote.price.toFixed(4)) : "—";
}
function changeText(quote) {
  if (!quote || quote.change === null) return "24h change unavailable";
  return (quote.change > 0 ? "+" : "") + quote.change.toFixed(2) + "% · 24h";
}
function scoreText(network, compact) {
  if (!network) return "—";
  const s = network.score;
  if (compact && s.length > 12) return s.slice(0, s.length - 9) + "." + s.slice(s.length - 9, s.length - 7) + "B";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function bpsText(network) {
  return !network ? "Unavailable" : network.bps === null ? "Sampling…" : network.bps.toFixed(2) + " avg BPS";
}
function hashText(hash) {
  if (!hash) return "—";
  return hash.th >= 1000000 ? (hash.th / 1000000).toFixed(2) + " EH/s" :
    hash.th >= 1000 ? (hash.th / 1000).toFixed(2) + " PH/s" : hash.th.toFixed(2) + " TH/s";
}
function text(parent, value, size, color, bold) {
  const item = parent.addText(value);
  item.font = bold ? Font.boldMonospacedSystemFont(size) : Font.mediumSystemFont(size);
  item.textColor = new Color(color);
  item.lineLimit = 1; item.minimumScaleFactor = 0.6;
  return item;
}
function line(context, points, color, width, alpha) {
  const path = new Path();
  points.forEach((p, i) => i ? path.addLine(new Point(p.x, p.y)) : path.move(new Point(p.x, p.y)));
  context.setStrokeColor(new Color(color, alpha)); context.setLineWidth(width);
  context.addPath(path); context.strokePath();
}
function background(snapshot, options, family, now) {
  const theme = THEMES[options.theme];
  const w = family === "small" ? 160 : 340, h = family === "large" ? 340 : 160;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h); ctx.opaque = true; ctx.respectScreenScale = false;
  ctx.setFillColor(new Color(theme.background)); ctx.fillRect(new Rect(0, 0, w, h));
  // A translucent etched grid and wide, low-opacity strokes create the glass look.
  for (let x = 16; x < w; x += 24) line(ctx, [{ x, y: 0 }, { x, y: h }], theme.accent, 0.5, 0.07);
  for (let y = 16; y < h; y += 24) line(ctx, [{ x: 0, y }, { x: w, y }], theme.accent, 0.5, 0.07);
  if (options.chart && validCachedHistory(snapshot.history, snapshot.historyFetched, now)) {
    const prices = snapshot.history.map(p => p.price), low = Math.min(...prices), high = Math.max(...prices);
    const first = snapshot.history[0].time, last = snapshot.history[snapshot.history.length - 1].time;
    const points = snapshot.history.map(p => ({ x: 12 + (p.time - first) / (last - first) * (w - 24),
      y: h * 0.8 - (high === low ? 0.5 : (p.price - low) / (high - low)) * h * 0.48 }));
    line(ctx, points, theme.accent, 14, 0.035);
    line(ctx, points, theme.accent, 7, 0.07);
    line(ctx, points, theme.accent, 2, 0.35);
  }
  ctx.setFillColor(new Color(theme.background, 0.65));
  ctx.fillRect(new Rect(8, 32, w - 16, family === "large" ? 96 : 59));
  ctx.fillRect(new Rect(8, family === "large" ? 160 : 99, w - 16, family === "large" ? 145 : 45));
  line(ctx, [{ x: 12, y: 2 }, { x: w - 12, y: 2 }], theme.accent, 1, 0.45);
  return ctx.getImage();
}
function header(widget, theme, family, now) {
  const row = widget.addStack(); row.centerAlignContent();
  const logo = row.addImage(Image.fromData(Data.fromBase64String(KASPA_MARK)));
  logo.imageSize = new Size(family === "large" ? 21 : 19, family === "large" ? 21 : 19);
  row.addSpacer(6); text(row, "KASPA", 12, theme.accent, true);
  row.addSpacer();
  if (family === "small") text(row, "GEEK", 7, theme.text, true);
  else {
    const date = row.addDate(new Date(now)); date.applyTimeStyle();
    date.font = Font.mediumSystemFont(11); date.textColor = new Color(theme.text);
  }
}
function metric(parent, label, value, detail, theme, valueSize, compact) {
  const stack = parent.addStack(); stack.layoutVertically();
  text(stack, label, compact ? 8 : 9, theme.accent, false); stack.addSpacer(3);
  text(stack, value, valueSize || 17, theme.text, true); stack.addSpacer(2);
  text(stack, detail, compact ? 8 : 9, theme.text, false);
  return stack;
}
function buildWidget(snapshot, options, family, now) {
  const theme = THEMES[options.theme], widget = new ListWidget();
  widget.setPadding(family === "large" ? 10 : 8, 12, family === "large" ? 10 : 8, 12);
  widget.backgroundImage = background(snapshot, options, family, now);
  widget.refreshAfterDate = new Date(now + options.refresh * MINUTE);
  header(widget, theme, family, now); widget.addSpacer(family === "large" ? 7 : 5);
  const isApprox = snapshot.quote && snapshot.quote.source.indexOf("KuCoin") === 0;
  if (family === "small") {
    text(widget, (isApprox ? "≈ " : "") + priceText(snapshot.quote), 25, theme.accent, true);
    text(widget, changeText(snapshot.quote), 9, theme.text, false);
    text(widget, ageLabel(snapshot.quote, now), 8, theme.text, false);
    widget.addSpacer();
    text(widget, "DAA SCORE", 8, theme.accent, false);
    text(widget, scoreText(snapshot.network, true), 12, theme.text, true);
    text(widget, bpsText(snapshot.network) + " · " + ageLabel(snapshot.network, now), 8, theme.text, false);
  } else {
    const priceRow = widget.addStack(); priceRow.layoutHorizontally();
    const price = priceRow.addStack(); price.layoutVertically();
    text(price, (isApprox ? "KAS / USDT ≈ USD" : "KAS / USD"), family === "large" ? 9 : 8, theme.text, false);
    text(price, priceText(snapshot.quote), family === "large" ? 35 : 26, theme.accent, true);
    text(price, changeText(snapshot.quote), family === "large" ? 11 : 10, theme.text, false);
    text(price, ageLabel(snapshot.quote, now), family === "large" ? 9 : 8, theme.text, false);
    priceRow.addSpacer(12);
    if (family === "medium") metric(priceRow, "DAA SCORE", scoreText(snapshot.network, true),
      ageLabel(snapshot.network, now), theme, 14, true);
    widget.addSpacer();
    if (family === "large") {
      text(widget, chartLabel(snapshot, options, now), 9, theme.accent, false);
      widget.addSpacer(12);
      metric(widget, "DAA SCORE", scoreText(snapshot.network, true), ageLabel(snapshot.network, now), theme, 20);
      widget.addSpacer(12);
    }
    const stats = widget.addStack();
    metric(stats, "BLOCK RATE", bpsText(snapshot.network), ageLabel(snapshot.network, now), theme, family === "large" ? 12 : 11, family !== "large");
    stats.addSpacer();
    metric(stats, "HASHRATE", hashText(snapshot.hash), ageLabel(snapshot.hash, now), theme, family === "large" ? 12 : 11, family !== "large");
  }
  widget.addSpacer(3);
  const chart = chartLabel(snapshot, options, now);
  let footer = family === "small" ? chart.replace("24h USD chart", "24h chart") :
    family === "large" ? "Geek Protocol · " + (snapshot.quote ? snapshot.quote.source : "Waiting for price") : chart;
  if (family === "small" && isApprox) footer = "USDT ≈ USD · " + footer;
  if (snapshot.delayed) footer = "Feeds delayed · " + (family === "large" ? "cached readings kept" : footer);
  if (snapshot.saveFailed) footer = "Cache unavailable · BPS may need resampling";
  text(widget, footer, 8, theme.text, false);
  return widget;
}
async function run() {
  const options = settings(args.widgetParameter), now = Date.now();
  const supported = ["small", "medium", "large"];
  let family = supported.includes(config.widgetFamily) ? config.widgetFamily : "medium";
  if (!config.runsInWidget) {
    const alert = new Alert(); alert.title = "Geek Kaspa Widget";
    alert.message = "Choose a preview. To install: add a Scriptable Home Screen widget, edit it, and select this script. Optional Parameter: mint, cyan, violet, or xray. iOS controls refresh timing.";
    alert.addAction("Preview medium"); alert.addAction("Preview small"); alert.addAction("Preview large");
    alert.addCancelAction("Cancel");
    const choice = await alert.presentSheet();
    if (choice < 0) { Script.complete(); return; }
    family = ["medium", "small", "large"][choice];
  }
  if (config.runsInWidget && !supported.includes(config.widgetFamily)) {
    const widget = new ListWidget();
    widget.addText("Add a small, medium, or large Home Screen widget.");
    Script.setWidget(widget); Script.complete(); return;
  }
  const fm = FileManager.local(), path = fm.joinPath(fm.documentsDirectory(), "geek-kaspa-cache-v1.json");
  const snapshot = await refresh(loadCache(fm, path, now), options, now, getJSON);
  snapshot.saveFailed = !saveCache(fm, path, snapshot);
  const widget = buildWidget(snapshot, options, family, Date.now());
  Script.setWidget(widget);
  if (!config.runsInWidget) {
    if (family === "small") await widget.presentSmall();
    else if (family === "large") await widget.presentLarge();
    else await widget.presentMedium();
  }
  Script.complete();
}

await run();
