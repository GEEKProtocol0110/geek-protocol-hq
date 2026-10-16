import { holidayById } from './holiday-calendar.js';

// Authored guides, not a chat service. Never read a player record or game answer.
const routes = {
  '': ['WELCOME TO THE GRID', 'Curiosity is your way in. Pick a lesson or jump into a free quiz.', 'Start with one idea. Read the explanation, then make the next connection.'],
  study: ['LEARNING SIGNAL', 'Take your time. I’ll keep you company while you explore.', 'Follow the lesson, examine the source, and connect each new idea.'],
  quest: ['ADVENTURE CHANNEL', 'Every chapter starts with a little curiosity. Let’s explore.', 'Read the story and learning notes. Your next discovery is one step away.'],
  play: ['GEEK ARENA', 'Ready when you are. Choose your game and give it a try.', 'Check the rules before starting. Learning continues in the explanations.'],
  practice: ['PRACTICE CHANNEL', 'Try, learn, and try again. That’s how a Geek grows.', 'Use your lifelines thoughtfully and read each explanation before moving on.'],
  profile: ['YOUR CORNER OF THE GRID', 'Your Geek, your journey. Find the next small step that feels right.', 'Your saved progress helps you choose what to revisit and what to explore next.'],
  'sign-in': ['BACK TO YOUR GEEK', 'Welcome back. Keep your saved player close.', 'Use your saved passkey or a supported wallet proof. Keep recovery phrases private.'],
  royale: ['ROYALE LOBBY', 'Bring a friend. A small crew can still have a big game.', 'Check the room settings and wait for your host before the round begins.'],
  duel: ['DUEL CHANNEL', 'A friendly challenge is another chance to learn.', 'Choose your match, read carefully, and give the explanations a look afterward.'],
  memory: ['MEMORY GRID', 'One pair at a time. There’s no need to rush.', 'Match each word with its meaning, then read how the ideas fit together.'],
  mint: ['GEEK ON KASPA', 'Explore the token side of our world at your own pace.', 'Check the network, amount and wallet prompt before approving a token operation.'],
  store: ['GEAR UP, GEEK', 'Find a little flair for your next adventure.', 'Read each item’s requirements and effects before choosing it.'],
  thanks: ['THE COMMUNITY HEART', 'This world grows because people show up and help.', 'Explore the people and projects behind the learning signal.']
};

export const initCharacters = () => {
  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-hq-companions]')) return;
  const route = location.pathname.split('/').filter(Boolean)[0] || '';
  const [channel, giga, ace] = routes[route] || ['OMNISCIENT GRID', 'Keep exploring. There’s always another connection to make.', 'Follow your curiosity, check the sources, and build your understanding.'];
  document.body.classList.add('hq-world');
  const panel = document.createElement('aside'); panel.className = 'hq-companions'; panel.dataset.hqCompanions = '';
  panel.setAttribute('aria-label', 'GIGA and A.C.E., your Geek guides');
  const strip = document.createElement('p'); strip.className = 'hq-terminal-line'; strip.textContent = `> ${channel} // HEART + MIND`;
  const greeting = document.createElement('p'); greeting.className = 'hq-holiday-greeting'; greeting.hidden = true;
  const crew = document.createElement('div'); crew.className = 'hq-crew';
  for (const person of [
    { id: 'giga', name: 'GIGA', role: 'THE HEART', message: giga, image: '/assets/kaspa-culture.png', alt: 'GIGA, the friendly gold robot' },
    { id: 'ace', name: 'A.C.E.', role: 'THE MIND', message: ace, image: '/collection/archive/legacy-art/ace-corrupted-code.webp', alt: 'A.C.E., the blue digital guide' }
  ]) {
    const card = document.createElement('div'); card.className = `hq-guide hq-guide--${person.id}`;
    const portrait = document.createElement('div'); portrait.className = `hq-portrait hq-portrait--${person.id}`;
    const image = document.createElement('img'); image.src = person.image; image.alt = person.alt; image.width = 96; image.height = 96; image.loading = 'lazy'; image.decoding = 'async';
    portrait.append(image);
    const copy = document.createElement('div'), label = document.createElement('p'), message = document.createElement('p');
    label.className = 'hq-guide-label'; label.textContent = `${person.name} // ${person.role}`;
    message.className = 'hq-guide-message'; message.textContent = person.message;
    copy.append(label, message); card.append(portrait, copy); crew.append(card);
  }
  panel.append(strip, greeting, crew);
  // A sibling of the intro, never inside a question, answer list, form or dialog.
  const intro = main.firstElementChild;
  if (intro) intro.after(panel); else main.append(panel);
  const heading = main.querySelector('h1'); heading?.classList.add('hq-signal-title');
  const syncHoliday = () => {
    const holiday = holidayById(document.documentElement.dataset.holidayTheme);
    greeting.hidden = !holiday;
    greeting.textContent = holiday ? `${holiday.icon} ${holiday.greeting} // ${channel.toLowerCase()}` : '';
  };
  document.addEventListener('geek:holiday-change', syncHoliday); syncHoliday();
};

initCharacters();
