// Decoration only: no player records, game state, telemetry or external resources.
export const initAtmosphere = () => {
  // Never place decorative text in normal document flow when its CSS is absent.
  if (typeof window.getComputedStyle !== 'function' || window.getComputedStyle(document.documentElement).getPropertyValue('--hq-atmosphere-ready').trim() !== '1') return;
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
};

initAtmosphere();
// A late stylesheet can enable decoration at load; a failed one leaves it absent.
window.addEventListener('load', initAtmosphere, { once:true });
