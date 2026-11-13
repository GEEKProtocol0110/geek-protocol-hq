// In-repo stroke marks. No remote assets, no operator-supplied paths.
const NS = 'http://www.w3.org/2000/svg';
const HEX = '32,8 52,20 52,44 32,56 12,44 12,20';

const node = (name, attrs) => {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};

export const holidayMark = kind => {
  const svg = node('svg', { viewBox: '0 0 64 64', class: 'holiday-mark', 'data-mark': kind, 'aria-hidden': 'true', focusable: 'false' });
  const add = (name, attrs) => { const shape = node(name, { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }); svg.append(shape); return shape; };
  const dot = (cx, cy, cool = false) => add('circle', { cx, cy, r: 3.2, fill: 'currentColor', stroke: 'none', ...(cool ? { class: 'cool', fill: 'var(--cyan)' } : {}) });
  const hex = (points = HEX) => add('polygon', { points });
  switch (kind) {
    case 'terminal':
      add('rect', { x: 8, y: 14, width: 48, height: 36, rx: 6 });
      add('path', { d: 'M16 28h14M16 36h8' });
      add('path', { d: 'M40 40h8', class: 'cool' });
      break;
    case 'star':
      dot(32, 12); dot(52, 28); dot(44, 52); dot(20, 52); dot(12, 28);
      add('path', { d: 'M32 12 52 28 44 52 20 52 12 28Z' });
      break;
    case 'dag':
      add('polygon', { points: '18,16 30,22 30,38 18,44 6,38 6,22' });
      add('polygon', { points: '46,16 58,22 58,38 46,44 34,38 34,22' });
      add('path', { d: 'M30 30h4', class: 'cool' });
      break;
    case 'heart':
      add('circle', { cx: 22, cy: 24, r: 8 });
      add('circle', { cx: 42, cy: 24, r: 8 });
      add('path', { d: 'M14 28 32 50 50 28', class: 'cool' });
      break;
    case 'shamrock':
      add('circle', { cx: 32, cy: 18, r: 8 });
      add('circle', { cx: 18, cy: 32, r: 8 });
      add('circle', { cx: 46, cy: 32, r: 8 });
      add('path', { d: 'M32 36v16', class: 'cool' });
      break;
    case 'cross':
      add('path', { d: 'M32 10v44M16 26h32' });
      break;
    case 'bud':
      hex('32,18 44,26 44,40 32,48 20,40 20,26');
      dot(32, 33, true);
      break;
    case 'line':
      add('path', { d: 'M8 32h48' });
      dot(32, 32, true);
      break;
    case 'burst':
      add('path', { d: 'M32 8v10M32 46v10M8 32h10M46 32h10M14 14l8 8M42 42l8 8M50 14l-8 8M14 50l8-8' });
      dot(32, 32, true);
      break;
    case 'gear':
      add('circle', { cx: 32, cy: 32, r: 10 });
      add('path', { d: 'M32 8v8M32 48v8M8 32h8M48 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M14 50l6-6' });
      break;
    case 'robot':
      add('path', { d: 'M22 18v-4M42 18v-4M24 12h16' });
      add('rect', { x: 16, y: 18, width: 32, height: 28, rx: 10 });
      add('rect', { x: 22, y: 26, width: 6, height: 8, rx: 3, fill: 'currentColor', stroke: 'none' });
      add('rect', { x: 36, y: 26, width: 6, height: 8, rx: 3, fill: 'var(--cyan)', stroke: 'none', class: 'cool' });
      add('path', { d: 'M24 38q8 6 16 0' });
      break;
    case 'ribbon':
      add('path', { d: 'M10 24h44M10 40h44' });
      dot(32, 32, true);
      break;
    case 'tree':
      add('polygon', { points: '32,6 42,18 22,18' });
      add('polygon', { points: '32,16 46,32 18,32' });
      add('polygon', { points: '32,28 50,48 14,48' });
      add('path', { d: 'M32 48v8', class: 'cool' });
      break;
    case 'candle':
      hex('32,28 46,36 46,52 32,60 18,52 18,36');
      add('path', { d: 'M32 28c0-8 6-10 4-16-6 4-8 10-4 16z', class: 'cool' });
      break;
    case 'tablet':
      add('rect', { x: 14, y: 8, width: 36, height: 48, rx: 4 });
      add('path', { d: 'M22 22h20M22 32h16M22 42h12' });
      break;
    case 'spark':
      add('path', { d: 'M32 8v48M12 32h40M18 18l28 28M46 18 18 46' });
      break;
    case 'pizza':
      hex();
      add('path', { d: 'M32 8v48M12 44 52 20', class: 'cool' });
      break;
    case 'diamond':
      add('polygon', { points: '32,8 54,32 32,56 10,32' });
      add('polygon', { points: '32,20 44,32 32,44 20,32', class: 'cool' });
      break;
    case 'staff':
      add('path', { d: 'M12 44h10M12 32h24M12 20h40' });
      break;
    case 'keys':
      add('rect', { x: 6, y: 22, width: 10, height: 20, rx: 2 });
      add('rect', { x: 20, y: 22, width: 10, height: 20, rx: 2 });
      add('rect', { x: 34, y: 26, width: 10, height: 16, rx: 2, fill: 'currentColor', stroke: 'none' });
      add('rect', { x: 48, y: 22, width: 10, height: 20, rx: 2, class: 'cool' });
      break;
    case 'seal':
      hex();
      dot(32, 32, true);
      break;
    default:
      hex();
  }
  return svg;
};
