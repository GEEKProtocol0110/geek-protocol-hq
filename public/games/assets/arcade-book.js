import {Chess} from '../chess/vendor/chess.js';
import {newCheckers,moveCheckers} from '../classics/checkers-engine.js';
import {newStrategy,moveStrategy} from '../strategy/engine.js';

export const ARCADE_GAMES=[
 ['chess','Geek Chess','Read the board. Plan your reply.','♞'],
 ['checkers','Geek Checkers','Set a trap. Follow the chain.','◉'],
 ['tic-tac-toe','Geek Tac Toe','Small board. Every move matters.','×'],
 ['connect-four','Geek Connect Four','Spot the threat before it lands.','▥'],
 ['reversi','Geek Reversi','Win the corners. Turn the board.','◐'],
 ['dots','Dots & Boxes','One edge can change everything.','▦'],
 ['battle-geek','Battle Geek','Trust the clues. Find the fleet.','⌖']
].map(([id,name,tip,icon])=>({id,name,tip,icon}));
const validGame=game=>ARCADE_GAMES.some(g=>g.id===game);
const KEY='geek.arcade.v1',MAX_ACTIONS=1200;
const empty=()=>({version:1,saves:{},results:[],milestones:{played:[],firstWin:false,firstFinish:false}});
const validResult=r=>r&&validGame(r.game)&&['win','loss','draw'].includes(r.result)&&['relaxed','steady'].includes(r.level)&&typeof r.id==='string'&&Number.isFinite(r.at)&&r.at>0&&r.at<=8640000000000000;
const refuse=()=>{throw Error('INVALID_PRACTICE_SAVE');};
// Rebuild through real rules instead of accepting an arbitrary stored board.
export function replayPractice(game,actions,options={}){
 if(!validGame(game)||!Array.isArray(actions)||actions.length>MAX_ACTIONS)refuse();
 if(game==='chess'){
  const chess=new Chess();for(const move of actions){if(typeof move!=='string'||move.length>16||chess.isGameOver())refuse();chess.move(move);}
  return {chess,actions:[...actions],history:[],checkpoints:[],result:chess.isGameOver()?(chess.isDraw()?'draw':chess.turn()==='b'?'win':'loss'):null};
 }
 let state=game==='checkers'?newCheckers():newStrategy(game,{dotsSize:options.dotsSize});
 const history=[],checkpoints=[];
 for(let i=0;i<actions.length;i++){
  const action=actions[i];if(!action||typeof action!=='object'||state.winner!==null)refuse();
  const previous=structuredClone(state);
  if(game==='checkers'){
   if(!Number.isInteger(action.from)||!Number.isInteger(action.to))refuse();state=moveCheckers(state,action.from,action.to);if(!state)refuse();
  }else{
   if(![0,1].includes(action.side)||!action.move||typeof action.move!=='object')refuse();
   state=moveStrategy(state,action.side,action.move);
  }
  // The initial computer fleet does not consume the player's undo step.
  if(!(game==='battle-geek'&&previous.phase==='deploy'&&action.side===1)){history.push(previous);checkpoints.push(i);if(history.length>200){history.shift();checkpoints.shift();}}
 }
 const result=state.winner===null?null:state.winner==='draw'?'draw':state.winner===(game==='checkers'?'gold':0)?'win':'loss';
 return {state,history,checkpoints,actions:structuredClone(actions),result};
}
export class ArcadeBook {
 constructor(storage){this.storage=storage;this.available=true;}
 read(){try{const raw=this.storage.getItem(KEY);if(!raw)return empty();if(raw.length>1000000)return empty();const d=JSON.parse(raw);if(d?.version!==1||!d.saves||typeof d.saves!=='object'||Array.isArray(d.saves)||!Array.isArray(d.results))return empty();d.results=d.results.filter(validResult).slice(-200);const played=new Set([...(Array.isArray(d.milestones?.played)?d.milestones.played:[]),...d.results.map(r=>r.game)].filter(validGame));d.milestones={played:[...played],firstWin:d.milestones?.firstWin===true||d.results.some(r=>r.result==='win'),firstFinish:d.milestones?.firstFinish===true||d.results.length>0};return d;}catch{this.available=false;return empty();}}
 write(data){try{this.storage.setItem(KEY,JSON.stringify(data));this.available=true;return true;}catch{this.available=false;return false;}}
 save(game,id,level,actions,options={}){
  if(!validGame(game)||typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||!['relaxed','steady'].includes(level))refuse();
  const rebuilt=replayPractice(game,actions,options),data=this.read(),at=Date.now();
  if(rebuilt.result){
   if(!data.results.some(r=>r.id===id)){data.results.push({id,game,level,result:rebuilt.result,at});data.milestones.firstFinish=true;if(rebuilt.result==='win')data.milestones.firstWin=true;if(!data.milestones.played.includes(game))data.milestones.played.push(game);}
   data.results=data.results.slice(-200);if(data.saves[game]?.id===id)delete data.saves[game];
  }else data.saves[game]={id,game,level,actions,options:{dotsSize:options.dotsSize},at};
  return this.write(data);
 }
 load(game){
  const save=this.read().saves[game];if(!save)return null;
  try{if(!validGame(game)||save.game!==game||!['relaxed','steady'].includes(save.level)||!/^[a-zA-Z0-9-]{1,80}$/.test(save.id))return null;const restored=replayPractice(game,save.actions,save.options);return restored.result?null:{...save,restored};}catch{return null;}
 }
 summary(){return this.read().results;}
 milestones(){return this.read().milestones;}
 discard(game){const d=this.read();delete d.saves[game];return this.write(d);}
 clear(){return this.write(empty());}
}
