import { setup, question, grade, advance, MODES, LEVELS } from './engine.js';
const $ = id => document.getElementById(id);
const names = { sequence: 'Signal Sequence', math: 'Number Forge', switch: 'Rule Shift' };
const key = 'geek-brain-v1';
let records = {};
let storageOK = true;
try {
  const data = JSON.parse(localStorage.getItem(key) || '{}');
  for (const mode of MODES) for (const level of LEVELS) {
    const id = `${mode}:${level}`, score = data?.[id];
    if (Number.isInteger(score) && score >= 0 && score <= 10) records[id] = score;
  }
} catch { storageOK = false; }
let state = setup('sequence', 'easy'), item;
const params = new URLSearchParams(location.search);
if (MODES.includes(params.get('mode'))) $('mode').value = params.get('mode');
function saved() {
  const id = `${$('mode').value}:${$('level').value}`;
  $('best').textContent = storageOK ? (records[id] === undefined ? 'No completed session at this level yet.' : `Device best: ${records[id]}/10 · ${names[$('mode').value]} · ${$('level').value}.`) : 'Device saving is unavailable. You can still play this session.';
}
function focus(el) { el.focus(); }
function renderQuestion() {
  item = question(state);
  const memory = state.mode === 'sequence';
  state.phase = memory ? 'memorize' : 'answer';
  $('progress').textContent = `Round ${state.round + 1} of 10 · ${state.correct} correct`;
  $('rule').textContent = item.rule;
  $('prompt').textContent = item.prompt;
  $('prompt').classList.toggle('digits', memory);
  $('memorized').hidden = !memory;
  $('answers').hidden = memory;
  $('number-form').hidden = state.mode === 'switch';
  $('binary').hidden = state.mode !== 'switch';
  $('feedback').textContent = '';
  $('next').hidden = true;
  $('answer').value = '';
  $('answer').maxLength = memory ? 12 : 6;
  $('answer-label').textContent = memory ? 'Type the digits in the same order' : 'Your answer';
  $('session-title').textContent = names[state.mode];
  focus($('rule'));
}
function respond(value) {
  const result = grade(state, item, value);
  if (!result) { $('feedback').textContent = 'Enter digits to answer, then choose Check answer.'; return; }
  state = result;
  $('answers').hidden = true;
  $('feedback').textContent = `${state.lastCorrect ? 'Correct.' : 'Keep practicing.'} ${item.explanation}`;
  $('next').textContent = state.round === 9 ? 'See session results' : 'Next round';
  $('next').hidden = false;
  focus($('feedback'));
}
$('start').addEventListener('click', () => {
  state = setup($('mode').value, $('level').value);
  $('setup').hidden = true; $('session').hidden = false; $('results').hidden = true;
  renderQuestion();
});
$('memorized').addEventListener('click', () => {
  if (state.phase !== 'memorize') return;
  state.phase = 'answer'; $('prompt').textContent = 'Recall the signal';
  $('memorized').hidden = true; $('answers').hidden = false; focus($('answer'));
});
$('number-form').addEventListener('submit', event => { event.preventDefault(); respond($('answer').value); });
for (const value of ['yes','no']) $(value).addEventListener('click', () => respond(value));
$('next').addEventListener('click', () => {
  if (state.phase !== 'feedback') return;
  state = advance(state);
  if (state.phase !== 'complete') { renderQuestion(); return; }
  $('session').hidden = true; $('results').hidden = false;
  $('result').textContent = `${state.correct}/10 correct · ${names[state.mode]} · ${state.level}`;
  const id = `${state.mode}:${state.level}`;
  records[id] = Math.max(records[id] || 0, state.correct);
  if (storageOK) try { localStorage.setItem(key, JSON.stringify(records)); } catch { storageOK = false; }
  saved(); focus($('result'));
});
function back() { state.phase = 'ready'; $('session').hidden = true; $('results').hidden = true; $('setup').hidden = false; saved(); focus($('mode')); }
$('exit').addEventListener('click', back);
$('again').addEventListener('click', back);
$('mode').addEventListener('change', saved); $('level').addEventListener('change', saved);
$('clear').addEventListener('click', () => {
  records = {};
  try { localStorage.removeItem(key); storageOK = true; } catch { storageOK = false; }
  saved(); $('save-status').textContent = storageOK ? 'Brain Games device scores cleared.' : 'Saving is unavailable; this visit’s scores were cleared.';
});
$('setup').hidden = false; $('loading').hidden = true; saved();
