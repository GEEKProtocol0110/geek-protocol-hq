export const MODES = ['sequence', 'math', 'switch'];
export const LEVELS = ['easy', 'steady', 'stretch'];
export function setup(mode, level) {
  return { mode: MODES.includes(mode) ? mode : 'sequence', level: LEVELS.includes(level) ? level : 'easy', round: 0, correct: 0, phase: 'ready' };
}
export function question(state, random = Math.random) {
  const tier = LEVELS.indexOf(state.level);
  const int = n => Math.min(n - 1, Math.max(0, Math.floor(random() * n)));
  if (state.mode === 'sequence') {
    const length = Math.min(12, 3 + tier + Math.floor(state.round / 2));
    const answer = Array.from({length}, () => String(int(10))).join('');
    return { prompt: answer, answer, rule: 'Remember the digits in order.', explanation: `The sequence was ${answer}.`, length };
  }
  if (state.mode === 'math') {
    const max = [10, 30, 100][tier];
    let a = 1 + int(max), b = 1 + int(max);
    const op = state.round % (tier ? 3 : 2);
    if (op === 1 && b > a) [a, b] = [b, a];
    if (op === 2) { a = 2 + int(tier === 2 ? 11 : 6); b = 2 + int(tier === 2 ? 11 : 6); }
    const symbol = ['+', '−', '×'][op];
    const answer = String(op === 0 ? a + b : op === 1 ? a - b : a * b);
    const hint = op === 0 ? 'Try adding the tens, then the ones.' : op === 1 ? 'Try counting up from the smaller number.' : 'Try splitting one factor into smaller groups.';
    return { prompt: `${a} ${symbol} ${b}`, answer, rule: 'Work it out at your own pace.', explanation: `${a} ${symbol} ${b} = ${answer}. ${hint}` };
  }
  const n = 1 + int([10, 30, 100][tier]);
  const alternate = state.round % 2 === 1;
  const rule = alternate ? 'Is the number greater than 5?' : 'Is the number even?';
  const yes = alternate ? n > 5 : n % 2 === 0;
  return { prompt: String(n), answer: yes ? 'yes' : 'no', rule, explanation: `${n} ${alternate ? (yes ? 'is greater than 5' : 'is 5 or less') : (yes ? 'is even' : 'is odd')}.` };
}
export function grade(state, item, input) {
  if (state.phase !== 'answer') return null;
  const value = String(input).trim();
  const valid = state.mode === 'switch' ? ['yes','no'].includes(value) : /^\d+$/.test(value);
  if (!valid) return null;
  const correct = state.mode === 'math' ? Number(value) === Number(item.answer) : value === item.answer;
  return { ...state, phase: 'feedback', correct: state.correct + Number(correct), lastCorrect: correct };
}
export function advance(state) {
  if (state.phase !== 'feedback') return state;
  return { ...state, round: state.round + 1, phase: state.round === 9 ? 'complete' : 'ready' };
}
