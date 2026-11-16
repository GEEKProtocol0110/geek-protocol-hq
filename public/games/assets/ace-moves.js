// Bounded local computer opponents. Every returned action goes through the game engine.
import {Chess} from '../chess/vendor/chess.js';
import {legalCheckers,moveCheckers} from '../classics/checkers-engine.js';
import {moveStrategy,reversiLegal,randomFleet} from '../strategy/engine.js';
const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))]||null;
const value={p:100,n:320,b:330,r:500,q:900,k:0};
export function chessMove(fen,level='steady',random=Math.random){
 const c=new Chess(fen);if(c.isGameOver())return null;
 const side=c.turn(),sign=side==='w'?1:-1;let nodes=0;
 const evaluate=()=>c.board().flat().reduce((score,p)=>{if(!p)return score;const central=7-(Math.abs(p.square.charCodeAt(0)-100.5)+Math.abs(Number(p.square[1])-4.5));return score+(p.color==='w'?1:-1)*(value[p.type]+(p.type==='k'?0:central*3));},0)*sign;
 const ordered=()=>c.moves({verbose:true}).sort((a,b)=>(value[b.captured]||0)+(b.promotion?800:0)-(value[a.captured]||0)-(a.promotion?800:0));
 function search(depth,alpha,beta){
  if(c.isCheckmate())return c.turn()===side?-100000-depth:100000+depth;
  if(++nodes>2400||depth===0)return evaluate();
  const moves=ordered();if(!moves.length)return c.isCheck()?(c.turn()===side?-100000-depth:100000+depth):0;
  const max=c.turn()===side;let best=max?-Infinity:Infinity;
  for(const m of moves){c.move(m);const score=search(depth-1,alpha,beta);c.undo();best=max?Math.max(best,score):Math.min(best,score);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha||nodes>2400)break;}
  return best;
 }
 const legal=ordered();if(level==='relaxed'&&random()<.35){const m=pick(legal,random);return {from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})};}
 let best=-Infinity,chosen=[];
 for(const m of legal){c.move(m);const score=search(level==='relaxed'?0:1,-Infinity,Infinity);c.undo();if(score>best){best=score;chosen=[m];}else if(score===best)chosen.push(m);}
 const m=pick(chosen,random);return m?{from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})}:null;
}
export function checkersMove(state,level='steady',random=Math.random){
 const side=state.turn;let nodes=0;
 function evaluate(s){if(s.winner)return s.winner===side?10000:-10000;return s.board.reduce((v,p,i)=>v+(p?(p.side===side?1:-1)*((p.king?175:100)+(p.side==='cyan'?Math.floor(i/8):7-Math.floor(i/8))*2):0),0);}
 function search(s,d,alpha,beta){if(!d||s.winner||++nodes>2200)return evaluate(s);const max=s.turn===side;let best=max?-Infinity:Infinity;for(const m of legalCheckers(s)){const score=search(moveCheckers(s,m.from,m.to),d-1,alpha,beta);best=max?Math.max(best,score):Math.min(best,score);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}return Number.isFinite(best)?best:evaluate(s);}
 const moves=legalCheckers(state);if(!moves.length)return null;if(level==='relaxed')return pick(moves,random);
 let best=-Infinity,chosen=[];for(const m of moves){const score=search(moveCheckers(state,m.from,m.to),3,-Infinity,Infinity);if(score>best){best=score;chosen=[m];}else if(score===best)chosen.push(m);}return pick(chosen,random);
}
export function strategyMoves(s){
 if(s.winner!==null)return [];
 if(s.game==='battle-geek')return s.phase==='play'?s.target.flatMap((v,cell)=>v==='unknown'?[{kind:'scan',cell}]:[]):[];
 const cells=s.game==='reversi'?reversiLegal(s.board,s.turn):s.game==='connect-four'?Array.from({length:7},(_,i)=>i).filter(i=>s.board[i]===null):(s.game==='dots'?s.edges:s.board).flatMap((v,i)=>v===null?[i]:[]);
 return cells.map(cell=>({cell}));
}
export function strategyMove(view,level='steady',random=Math.random){
 if(view.winner!==null)return null;
 // Battle Geek receives only A.C.E.'s masked view, never the player's hidden fleet.
 if(view.game==='battle-geek'){
  if(view.phase==='deploy')return {kind:'deploy',fleet:randomFleet(random,view.size,view.fleetLengths)};
  const moves=strategyMoves(view);if(level==='relaxed')return pick(moves,random);
  const sunk=new Set(view.sunk.flat()),size=view.size;
  const nearby=[];view.target.forEach((v,i)=>{if(v==='hit'&&!sunk.has(i))for(const n of [i-size,i+size,...(i%size?[i-1]:[]),...(i%size<size-1?[i+1]:[])])if(n>=0&&n<size*size&&view.target[n]==='unknown')nearby.push(n);});
  const candidates=nearby.length?moves.filter(m=>nearby.includes(m.cell)):moves.filter(m=>(Math.floor(m.cell/size)+m.cell%size)%2===0);
  return pick(candidates.length?candidates:moves,random);
 }
 const moves=strategyMoves(view);if(!moves.length)return null;if(level==='relaxed')return pick(moves,random);
 const side=view.turn;
 if(view.game==='tic-tac-toe'){
  const memo=new Map();function score(s){if(s.winner!==null)return s.winner==='draw'?0:s.winner===side?10:-10;const key=s.board.map(v=>v===null?'-':v).join('')+s.turn;if(memo.has(key))return memo.get(key);const values=strategyMoves(s).map(m=>score(moveStrategy(s,s.turn,m)));const v=s.turn===side?Math.max(...values):Math.min(...values);memo.set(key,v);return v;}
  let best=-Infinity,chosen=[];for(const m of moves){const n=moveStrategy(view,side,m),v=score(n);if(v>best){best=v;chosen=[m];}else if(v===best)chosen.push(m);}const center=chosen.find(m=>m.cell===4);return center||pick(chosen,random);
 }
 function evaluate(s){
  if(s.winner!==null)return s.winner==='draw'?0:s.winner===side?100000:-100000;
  if(s.game==='connect-four'){
   let score=0;for(let r=0;r<6;r++)for(let c=0;c<7;c++){if(s.board[r*7+c]!==null&&c===3)score+=s.board[r*7+c]===side?6:-6;for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){const cells=Array.from({length:4},(_,i)=>[r+i*dr,c+i*dc]);if(cells.some(([y,x])=>y<0||y>5||x<0||x>6))continue;const a=cells.filter(([y,x])=>s.board[y*7+x]===side).length,b=cells.filter(([y,x])=>s.board[y*7+x]===1-side).length;if(!b)score+=[0,1,7,45,1000][a];if(!a)score-=[0,1,8,60,1000][b];}}return score;
  }
  if(s.game==='dots'){
   const size=s.size,w=size-1,h=size*w;let danger=0;for(let r=0;r<w;r++)for(let c=0;c<w;c++)if(s.boxes[r*w+c]===null&&[r*w+c,(r+1)*w+c,h+r*size+c,h+r*size+c+1].filter(i=>s.edges[i]!==null).length===3)danger++;
   return (s.scores[side]-s.scores[1-side])*100+(s.turn===side?1:-1)*danger*18;
  }
  return s.board.reduce((v,p,i)=>v+(p===null?0:(p===side?1:-1)*([0,7,56,63].includes(i)?140:Math.floor(i/8)%7===0||i%8%7===0?12:2)),0)+(reversiLegal(s.board,side).length-reversiLegal(s.board,1-side).length)*4;
 }
 const depth=view.game==='connect-four'?2:view.game==='reversi'?1:0;
 function search(s,d,alpha,beta){if(!d||s.winner!==null)return evaluate(s);const max=s.turn===side;let best=max?-Infinity:Infinity;for(const m of strategyMoves(s)){const v=search(moveStrategy(s,s.turn,m),d-1,alpha,beta);best=max?Math.max(best,v):Math.min(best,v);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}return Number.isFinite(best)?best:evaluate(s);}
 let best=-Infinity,chosen=[];for(const m of moves){const v=search(moveStrategy(view,side,m),depth,-Infinity,Infinity);if(v>best){best=v;chosen=[m];}else if(v===best)chosen.push(m);}return pick(chosen,random);
}
