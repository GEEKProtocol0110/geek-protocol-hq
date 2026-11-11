// Optional, browser-local fun. No player records, storage, requests or game hooks.
export const initGridDiscovery = () => {
  const routes = new Set(['/', '/start/', '/study/', '/kaspa/', '/quest/', '/memory/', '/play/', '/duel/', '/royale/', '/thanks/', '/tools/', '/litepaper/', '/games/', '/news/', '/kaspa/directory/', '/whitepaper/']);
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
  const hint = element('p', '', 'A quiet corner of the Grid. Try help, scan or riddle. Some signals reveal themselves only if you ask. Looking for hidden words? Visit Rewarded Challenges.');
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
  let ping = 0, fortune = 0, riddleIndex = -1, activeRiddle = null;
  const found = new Set();
  const secrets = new Set(['scan','riddle','fortune','launch','giga','quack','42','blockdag']);
  const fortunes = ['Your next level may be one good question away.', 'A wrong turn can still teach you the map.', 'Save your best move for the moment it matters.', 'Today’s side quest: explain one idea without jargon.', 'GIGA predicts a promising future for snacks and curiosity.'];
  const riddles = [
    {question:'What has keys but cannot open a door?', answers:['keyboard','a keyboard','piano','a piano'], clue:'Think of something you can type on or play.'},
    {question:'What gets wetter as it dries?', answers:['towel','a towel'], clue:'You probably used one after washing your hands.'},
    {question:'What can travel around the world while staying in a corner?', answers:['stamp','a stamp','postage stamp','a postage stamp'], clue:'Look in the corner of an old-fashioned letter.'}
  ];
  const art = element('div', 'grid-secret-art');art.hidden = true;art.setAttribute('aria-hidden','true');
  const routeNotes = new Map([
    ['/','Home beacon: every Geek adventure starts with curiosity.'],
    ['/games/','Arcade beacon: the best power-up is learning from your last move.'],
    ['/news/','News beacon: check the source before you share the signal.'],
    ['/kaspa/directory/','Builder beacon: somewhere in this directory is someone’s first big idea.'],
    ['/whitepaper/','Deep-space beacon: you made it to the long read. GIGA packed extra snacks.'],
    ['/thanks/','Community beacon: no universe gets built alone.']
  ]);
  const pings = ['PONG ✦ A little signal in a very big universe.', 'PONG ✦ Somewhere, a rubber duck just solved a bug.', 'PONG ✦ Side quest: teach someone one thing you learned today.'];
  const messages = new Map([
    ['help', 'Commands: decode, ping, scan, riddle, answer YOUR ANSWER, hint, fortune, launch, matrix, discoveries, hope, giga, ace, clear. A rubber duck may know a few unlisted commands.'],
    ['decode', '01001011 01000001 01010011 → K A S. Three bytes. One curious beginning. Next stop: the Kaspa field guide.'],
    ['hope', 'ALL HOPE, NO HYPE. Hidden signal unlocked: stay curious, check your sources, bring a friend.'],
    ['giga', 'GIGA left a note: “Even a giant adventure starts with one small question.”'],
    ['ace', 'A.C.E. left a note: “A good question is a power-up for your brain.”'],
    ['sudo', 'Nice try, space coder. Curiosity needs no administrator privileges.'],
    ['clear', 'Signal cleared. Curiosity stays.']
  ]);
  const run = command => {
    const key = command.trim().toLowerCase().replace(/^\//, '');
    art.replaceChildren();art.hidden = true;
    if(secrets.has(key))found.add(key);
    let message;
    if(key==='scan')message=routeNotes.get(location.pathname)||'Learning beacon: slow progress is still progress. GIGA is glad you stopped by.';
    else if(key==='fortune')message=`GIGA’s fortune cookie: ${fortunes[fortune++ % fortunes.length]}`;
    else if(key==='riddle'){riddleIndex=(riddleIndex+1)%riddles.length;activeRiddle=riddles[riddleIndex];message=`Riddle ${riddleIndex+1}: ${activeRiddle.question} Type answer followed by your guess, or hint.`;}
    else if(key==='hint')message=activeRiddle?activeRiddle.clue:'Ask for a riddle first.';
    else if(key.startsWith('answer ')){
      if(!activeRiddle)message='Ask for a riddle first.';
      else if(activeRiddle.answers.includes(key.slice(7).trim().replace(/[.!?]+$/,''))){found.add('riddle');activeRiddle=null;message='Correct! ✦ GIGA awards you one imaginary high five. Type riddle for another.';}
      else message='Not quite. Try another answer, or ask for a hint.';
    }else if(key==='discoveries')message=`Signals found in this page visit: ${found.size}/${secrets.size}. ${[...found].join(', ')||'Try scan to begin.'} Just for fun; this list resets when you leave or reload.`;
    else if(key==='launch'){
      message='Launch sequence complete. ✦ Curiosity cleared for orbit.';
      const rocket=element('span','grid-secret-rocket','🚀'),stars=element('span','grid-secret-stars','✦ · ✧ · ✦');art.append(rocket,stars);art.hidden=false;
    }else if(key==='matrix'||key==='matrix on'||key==='matrix off'){
      const on=key==='matrix'?undefined:key==='matrix on';
      document.dispatchEvent(new CustomEvent('geek:matrix-toggle',{detail:{on}}));
      message=`Code rain ${on===false?'paused':on?'flowing':'toggled'} for this tab visit.`;
    }else if(key==='quack')message='QUACK. Rubber-duck debugging protocol: explain the problem out loud. The duck is listening.';
    else if(key==='42')message='42. The answer arrived before the question. Please allow one universe for clarification.';
    else if(key==='blockdag')message='Secret builder channel: many blocks, one curious community. Keep learning how the pieces connect.';
    else message=key==='ping'?pings[ping++ % pings.length]:messages.get(key)||'Unknown signal. Try help for a few coordinates.';
    output.textContent=`> ${message}`;
    input.value = '';
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(input.value);
  });
  for (const [command, text] of [['decode', 'Decode signal'], ['ping', 'Ping the Grid'], ['riddle','Try a riddle'], ['fortune','Fortune cookie'], ['launch','Launch signal']]) {
    const button = element('button', '', text);
    button.type = 'button';
    button.dataset.gridShortcut = command;
    button.addEventListener('click', () => run(command));
    shortcuts.append(button);
  }
  const hunt = element('a', '', 'Explore Rewarded Challenges →'); hunt.href = '/challenges/#rewarded-challenges';
  terminal.append(title, hint, output, art, form, shortcuts, hunt, element('small', '', 'Terminal commands are just for fun. Hidden words are claimed in Challenges.'));
  panel.append(summary, terminal);
  footer.append(panel);
};

initGridDiscovery();
