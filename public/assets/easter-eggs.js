// Optional, browser-local fun. No player records, storage, requests or game hooks.
export const initGridDiscovery = () => {
  const routes = new Set(['/', '/start/', '/study/', '/kaspa/', '/quest/', '/memory/', '/play/', '/duel/', '/royale/', '/thanks/', '/tools/', '/litepaper/']);
  const footer = document.querySelector('footer');
  if (!routes.has(location.pathname) || !footer || document.querySelectorAll('[data-grid-discovery]').length) return;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const panel = element('details', 'grid-discovery');
  panel.dataset.gridDiscovery = '';
  const summary = element('summary', '', '✦ Stray signal');
  const terminal = element('div', 'grid-terminal');
  const title = element('p', 'grid-terminal-title', '// curiosity channel');
  const hint = element('p', '', 'A quiet corner of the Grid. Try help, decode or ping.');
  const output = element('p', 'grid-terminal-output', '> Signal found. Curiosity looks good on you.');
  output.dataset.gridOutput = '';
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-atomic', 'true');
  const form = element('form', 'grid-terminal-form');
  const label = element('label', '', 'Grid command');
  const input = element('input', '');
  input.id = 'grid-command';
  label.setAttribute('for', input.id);
  input.name = 'command';
  input.type = 'text';
  input.maxLength = 64;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'none');
  input.dataset.gridCommand = '';
  const send = element('button', '', 'Send →');
  send.type = 'submit';
  form.append(label, input, send);
  const shortcuts = element('div', 'grid-terminal-shortcuts');
  let ping = 0;
  const pings = ['PONG ✦ A little signal in a very big universe.', 'PONG ✦ Somewhere, a rubber duck just solved a bug.', 'PONG ✦ Side quest: teach someone one thing you learned today.'];
  const messages = new Map([
    ['help', 'Commands: decode, ping, hope, giga, ace, clear. No secret handshake required.'],
    ['decode', '01001011 01000001 01010011 → K A S. Three bytes. One curious beginning. Next stop: the Kaspa field guide.'],
    ['hope', 'ALL HOPE, NO HYPE. Hidden signal unlocked: stay curious, check your sources, bring a friend.'],
    ['giga', 'GIGA left a note: “Even a giant adventure starts with one small question.”'],
    ['ace', 'A.C.E. left a note: “A good question is a power-up for your brain.”'],
    ['sudo', 'Nice try, space coder. Curiosity needs no administrator privileges.'],
    ['clear', 'Signal cleared. Curiosity stays.']
  ]);
  const run = command => {
    const key = command.trim().toLowerCase().replace(/^\//, '');
    output.textContent = `> ${key === 'ping' ? pings[ping++ % pings.length] : messages.get(key) || 'Unknown signal. Try help for a few coordinates.'}`;
    input.value = '';
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(input.value);
  });
  for (const [command, text] of [['decode', 'Decode signal'], ['ping', 'Ping the Grid']]) {
    const button = element('button', '', text);
    button.type = 'button';
    button.dataset.gridShortcut = command;
    button.addEventListener('click', () => run(command));
    shortcuts.append(button);
  }
  terminal.append(title, hint, output, form, shortcuts, element('small', '', 'Just for fun · no XP or rewards'));
  panel.append(summary, terminal);
  footer.append(panel);
};

initGridDiscovery();
