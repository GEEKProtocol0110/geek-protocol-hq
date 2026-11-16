import {chessMove,checkersMove,strategyMove} from './ace-moves.js';
self.onmessage=event=>{
 const {id,game,state,level}=event.data;
 try {const move=game==='chess'?chessMove(state,level):game==='checkers'?checkersMove(state,level):strategyMove(state,level);self.postMessage({id,move});}
 catch {self.postMessage({id,error:'ACE_MOVE_UNAVAILABLE'});}
};
