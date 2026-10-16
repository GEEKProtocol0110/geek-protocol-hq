import { holidayById } from './holiday-calendar.js';

// Decoration only: no player records, game state, telemetry or external resources.
export const initAtmosphere = () => {
  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-hq-cosmos]')) return;
  document.body.classList.add('hq-world');
  main.querySelector('h1')?.classList.add('hq-signal-title');
  const cosmos = document.createElement('div');
  cosmos.className = 'hq-cosmos'; cosmos.dataset.hqCosmos = ''; cosmos.setAttribute('aria-hidden', 'true');
  for (const [index, text] of [
    '01001011  01000001  01010011\n{ curiosity: true }\nlearn.connect();\n> explore_the_grid',
    'const next = discover();\n01100111  01100101  01100101  01101011\nknowledge.push(idea);\n// all hope, no hype'
  ].entries()) {
    const rail = document.createElement('span'); rail.className = `hq-code-rail hq-code-rail--${index}`; rail.textContent = text; cosmos.append(rail);
  }
  document.body.prepend(cosmos);
  for (const scene of document.querySelectorAll('.space-scene')) {
    const code = document.createElement('span'); code.className = 'hq-space-code'; code.setAttribute('aria-hidden', 'true');
    code.textContent = '01100111  01100101\n{ curiosity: true }\nlearn.connect();\n01001011  01000001\n// discover something';
    scene.append(code);
  }
  // Seasonal greetings remain available without putting characters on every page.
  const note = document.createElement('aside'); note.className = 'hq-seasonal-note'; note.hidden = true;
  const greeting = document.createElement('p'); greeting.className = 'hq-holiday-greeting'; note.append(greeting);
  const intro = main.firstElementChild;
  if (intro) intro.after(note); else main.append(note);
  const syncHoliday = () => {
    const holiday = holidayById(document.documentElement.dataset.holidayTheme);
    note.hidden = !holiday;
    greeting.textContent = holiday ? `${holiday.icon} ${holiday.greeting}` : '';
  };
  document.addEventListener('geek:holiday-change', syncHoliday); syncHoliday();
};

initAtmosphere();
