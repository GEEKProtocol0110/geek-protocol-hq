export const GAME_META={
 'tic-tac-toe':{name:'Geek Tac Toe',icon:'×',players:2,skill:'Pattern recognition',rules:'Gold X starts. Place a mark in an empty square. Three in a row, column or diagonal wins. A full board without a line is a draw.'},
 'dots':{name:'Dots & Boxes',icon:'▦',players:2,skill:'Planning chains',rules:'Join neighboring dots by claiming an edge. Complete the fourth side of a box to claim it and take another turn. Most of the nine boxes wins.'},
 'battle-geek':{name:'Battle Geek',icon:'⌖',players:2,skill:'Deduction',rules:'Each player deploys three straight ships (lengths 3, 2 and 2) on a 6×6 grid. Ships cannot overlap but may touch. Scan one enemy cell per turn, even after a hit. Sink all three ships to win. Local play uses a pass-device privacy curtain; online only your own fleet is sent to your browser.'},
 'connect-four':{name:'Geek Connect Four',icon:'◉',players:2,skill:'Planning threats',rules:'Gold starts. Choose a column to drop a token into its lowest empty slot. Four in a row horizontally, vertically or diagonally wins. A full board without four is a draw.'},
 'reversi':{name:'Geek Reversi',icon:'◐',players:2,skill:'Positioning',rules:'Gold starts. Place a disc to bracket at least one opponent disc in a straight line between your discs. All bracketed discs flip. If a player has no legal move, their turn passes automatically. The game ends when neither player can move. Most discs wins.'},
 'codebreaker':{name:'Geek Codebreaker',icon:'◇',players:1,skill:'Eliminating possibilities',rules:'Find the secret four-symbol code in ten guesses. Each position uses a digit from 1 to 6; repeats are allowed. Exact counts correct symbol and position. Elsewhere counts correct symbols in different positions, without double counting.'},
 'hanoi':{name:'Tower of Hanoi',icon:'△',players:1,skill:'Sequencing',rules:'Move all four discs from tower A to tower C. Tap the source tower, then the destination. Move only the top disc; a larger disc can never sit on a smaller one. The minimum is 15 moves.'},
 'sudoku':{name:'Geek Sudoku',icon:'9',players:1,skill:'Logical deduction',rules:'Fill each row, column and 3×3 box with 1–9 exactly once. Given clues are locked. Select an empty or entered cell, then use the number pad. Conflicting placements are blocked. New puzzles vary by transformations of one uniquely solvable starting puzzle.'},
 'peg-quest':{name:'Geek Peg Quest',icon:'⋰',players:1,skill:'Spatial planning',rules:'Jump one peg over a neighboring peg into an empty hole in a straight line. The jumped peg is removed. Finish with one peg. Choose any starting empty hole; undo lets you explore a different route.'}
};
export const ONLINE_STRATEGY=['tic-tac-toe','dots','battle-geek','connect-four','reversi'];
const clone=x=>structuredClone(x),inside=(r,c,n)=>r>=0&&r<n&&c>=0&&c<n;
const refuse=()=>{throw new Error('ONLINE_ILLEGAL');};
export const isStrategy=g=>ONLINE_STRATEGY.includes(g);
export function newStrategy(game){
 const base={game,turn:0,winner:null,moves:0};
 if(game==='tic-tac-toe')return {...base,board:Array(9).fill(null)};
 if(game==='connect-four')return {...base,board:Array(42).fill(null)};
 if(game==='dots')return {...base,edges:Array(24).fill(null),boxes:Array(9).fill(null),scores:[0,0]};
 if(game==='reversi'){const board=Array(64).fill(null);board[27]=1;board[28]=0;board[35]=0;board[36]=1;return {...base,board};}
 if(game==='battle-geek')return {...base,phase:'deploy',ready:[false,false],fleets:[[],[]],shots:[Array(36).fill(false),Array(36).fill(false)]};
 throw new Error('INVALID_REQUEST');
}
function lineWinner(board,rows,cols,length){
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const side=board[r*cols+c];if(side===null)continue;for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
  const cells=Array.from({length},(_,k)=>[r+dr*k,c+dc*k]);if(cells.every(([y,x])=>y>=0&&y<rows&&x>=0&&x<cols&&board[y*cols+x]===side))return side;
 }}return board.every(x=>x!==null)?'draw':null;
}
export function reversiFlips(board,index,side){
 if(!Number.isInteger(index)||index<0||index>63||board[index]!==null)return [];
 const result=[],r=Math.floor(index/8),c=index%8;
 for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
  const path=[];let y=r+dr,x=c+dc;while(inside(y,x,8)&&board[y*8+x]===1-side){path.push(y*8+x);y+=dr;x+=dc;}
  if(path.length&&inside(y,x,8)&&board[y*8+x]===side)result.push(...path);
 }return result;
}
export const reversiLegal=(board,side)=>board.flatMap((_,i)=>reversiFlips(board,i,side).length?[i]:[]);
export function validateFleet(fleet){
 if(!Array.isArray(fleet)||fleet.length!==3)return false;
 const all=[];for(let i=0;i<3;i++){
  const ship=fleet[i];if(!Array.isArray(ship)||ship.length!==[3,2,2][i]||!ship.every(v=>Number.isInteger(v)&&v>=0&&v<36))return false;
  const cells=[...ship].sort((a,b)=>a-b),horizontal=cells.every(v=>Math.floor(v/6)===Math.floor(cells[0]/6));
  if(!cells.every((v,k)=>v===cells[0]+k*(horizontal?1:6)))return false;all.push(...cells);
 }return new Set(all).size===7;
}
export function randomFleet(random=Math.random){
 const used=new Set(),fleet=[];for(const length of [3,2,2]){
  const options=[];for(let i=0;i<36;i++)for(const step of [1,6]){
   const cells=Array.from({length},(_,k)=>i+k*step);if(cells.at(-1)<36&&(step===6||Math.floor(i/6)===Math.floor(cells.at(-1)/6))&&cells.every(x=>!used.has(x)))options.push(cells);
  }const ship=options[Math.floor(random()*options.length)];fleet.push(ship);ship.forEach(x=>used.add(x));
 }return fleet;
}
export function strategyView(s,side){
 if(s.game!=='battle-geek')return clone(s);
 return {game:s.game,turn:s.turn,winner:s.winner,moves:s.moves,phase:s.phase,ready:[...s.ready],ownFleet:clone(s.fleets[side]),incoming:[...s.shots[1-side]],target:s.shots[side].map((shot,i)=>!shot?'unknown':s.fleets[1-side].some(ship=>ship.includes(i))?'hit':'miss'),sunk:s.fleets[1-side].filter(ship=>ship.every(i=>s.shots[side][i])).map(ship=>[...ship])};
}
export function moveStrategy(state,side,body){
 if(![0,1].includes(side)||state.winner!==null)refuse();const s=clone(state);const n=body.cell;
 if(s.game==='battle-geek'&&s.phase==='deploy'){
  if(body.kind!=='deploy'||s.ready[side]||!validateFleet(body.fleet))refuse();
  s.fleets[side]=clone(body.fleet);s.ready[side]=true;if(s.ready.every(Boolean))s.phase='play';s.moves++;return s;
 }
 if(s.turn!==side)throw new Error('ONLINE_TURN');
 if(s.game==='tic-tac-toe'){
  if(!Number.isInteger(n)||n<0||n>=9||s.board[n]!==null)refuse();s.board[n]=side;s.winner=lineWinner(s.board,3,3,3);s.turn=1-side;
 }else if(s.game==='connect-four'){
  if(!Number.isInteger(n)||n<0||n>6)refuse();let i=35+n;while(i>=0&&s.board[i]!==null)i-=7;if(i<0)refuse();s.board[i]=side;s.winner=lineWinner(s.board,6,7,4);s.turn=1-side;
 }else if(s.game==='dots'){
  if(!Number.isInteger(n)||n<0||n>=24||s.edges[n]!==null)refuse();s.edges[n]=side;let scored=0;
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){const box=r*3+c;if(s.boxes[box]===null&&[r*3+c,(r+1)*3+c,12+r*4+c,12+r*4+c+1].every(i=>s.edges[i]!==null)){s.boxes[box]=side;s.scores[side]++;scored++;}}
  if(!scored)s.turn=1-side;if(s.boxes.every(v=>v!==null))s.winner=s.scores[0]===s.scores[1]?'draw':s.scores[0]>s.scores[1]?0:1;
 }else if(s.game==='reversi'){
  const flips=reversiFlips(s.board,n,side);if(!flips.length)refuse();s.board[n]=side;flips.forEach(i=>s.board[i]=side);
  s.turn=1-side;if(!reversiLegal(s.board,s.turn).length){s.turn=side;if(!reversiLegal(s.board,side).length){const a=s.board.filter(x=>x===0).length,b=s.board.filter(x=>x===1).length;s.winner=a===b?'draw':a>b?0:1;}}
 }else if(s.game==='battle-geek'){
  if(body.kind!=='scan'||!Number.isInteger(n)||n<0||n>=36||s.shots[side][n])refuse();s.shots[side][n]=true;if(s.fleets[1-side].flat().every(i=>s.shots[side][i]))s.winner=side;s.turn=1-side;
 }else refuse();s.moves++;return s;
}
const pegCoords=Array.from({length:5},(_,r)=>Array.from({length:r+1},(_,c)=>[r,c])).flat();
export const pegLabel=i=>{const [r,c]=pegCoords[i];return `row ${r+1}, hole ${c+1}`;};
export function pegMoves(board){
 const moves=[];for(let i=0;i<15;i++)if(board[i]){const [r,c]=pegCoords[i];for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1]]){
  const middle=pegCoords.findIndex(([a,b])=>a===r+dr&&b===c+dc),to=pegCoords.findIndex(([a,b])=>a===r+2*dr&&b===c+2*dc);
  if(middle>=0&&to>=0&&board[middle]&&!board[to])moves.push({from:i,to,middle});
 }}return moves;
}
const puzzle='530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const solution='534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const shuffle=(a,random)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function newSolo(game,option=0,random=Math.random){
 if(game==='peg-quest'){const board=Array(15).fill(true);board[Number.isInteger(option)&&option>=0&&option<15?option:0]=false;return {game,board,moves:0,done:false};}
 if(game==='hanoi')return {game,towers:[[4,3,2,1],[],[]],moves:0,done:false};
 if(game==='codebreaker')return {game,secret:Array.from({length:4},()=>1+Math.floor(random()*6)),guesses:[],moves:0,done:false};
 if(game==='sudoku'){
  const digits=shuffle([1,2,3,4,5,6,7,8,9],random),rows=shuffle([0,1,2],random).flatMap(b=>shuffle([0,1,2],random).map(r=>b*3+r)),cols=shuffle([0,1,2],random).flatMap(b=>shuffle([0,1,2],random).map(c=>b*3+c));
  const transform=str=>rows.flatMap(r=>cols.map(c=>Number(str[r*9+c])?digits[Number(str[r*9+c])-1]:0));const board=transform(puzzle);
  return {game,board,given:[...board],solution:transform(solution),moves:0,done:false};
 }throw new Error('INVALID_REQUEST');
}
export function codeFeedback(secret,guess){
 let exact=0;const a=[],b=[];secret.forEach((v,i)=>{if(v===guess[i])exact++;else{a.push(v);b.push(guess[i]);}});let elsewhere=0;for(const v of b){const i=a.indexOf(v);if(i>=0){elsewhere++;a.splice(i,1);}}return {exact,elsewhere};
}
export function moveSolo(state,body){
 if(state.done)refuse();const s=clone(state);
 if(s.game==='peg-quest'){
  const move=pegMoves(s.board).find(m=>m.from===body.from&&m.to===body.to);if(!move)refuse();s.board[move.from]=false;s.board[move.middle]=false;s.board[move.to]=true;s.done=s.board.filter(Boolean).length===1;
 }else if(s.game==='hanoi'){
  const {from,to}=body;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>2||to<0||to>2||from===to||!s.towers[from].length)refuse();const disk=s.towers[from].at(-1);if(s.towers[to].length&&s.towers[to].at(-1)<disk)refuse();s.towers[to].push(s.towers[from].pop());s.done=s.towers[2].length===4;
 }else if(s.game==='codebreaker'){
  const guess=body.guess;if(!Array.isArray(guess)||guess.length!==4||!guess.every(n=>Number.isInteger(n)&&n>=1&&n<=6))refuse();const feedback=codeFeedback(s.secret,guess);s.guesses.push({guess:[...guess],...feedback});s.won=feedback.exact===4;s.done=s.won||s.guesses.length===10;
 }else if(s.game==='sudoku'){
  const {cell,value}=body;if(!Number.isInteger(cell)||cell<0||cell>80||s.given[cell]||!Number.isInteger(value)||value<0||value>9)refuse();
  const r=Math.floor(cell/9),c=cell%9;if(value&&s.board.some((v,i)=>i!==cell&&v===value&&(Math.floor(i/9)===r||i%9===c||Math.floor(Math.floor(i/9)/3)===Math.floor(r/3)&&Math.floor(i%9/3)===Math.floor(c/3))))refuse();s.board[cell]=value;s.done=s.board.every((v,i)=>v===s.solution[i]);
 }else refuse();s.moves++;return s;
}
