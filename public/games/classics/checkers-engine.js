export function newCheckers() {
  const board=Array(64).fill(null);
  for(let i=0;i<64;i++) if((Math.floor(i/8)+i%8)%2) {
    if(i<24)board[i]={side:'cyan',king:false};
    if(i>=40)board[i]={side:'gold',king:false};
  }
  return {board,turn:'gold',forced:null,winner:null};
}
const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
function options(s,from,jumpOnly=false) {
  const p=s.board[from];if(!p||p.side!==s.turn)return [];
  const r=Math.floor(from/8),c=from%8, moves=[];
  for(const dr of p.king?[-1,1]:[p.side==='gold'?-1:1])for(const dc of [-1,1]) {
    const nr=r+dr,nc=c+dc;if(!inside(nr,nc))continue;
    const to=nr*8+nc,mid=s.board[to];
    if(!mid&&!jumpOnly)moves.push({from,to,capture:null});
    if(mid&&mid.side!==p.side&&inside(r+2*dr,c+2*dc)) {
      const dest=(r+2*dr)*8+c+2*dc;if(!s.board[dest])moves.push({from,to:dest,capture:to});
    }
  }
  return moves;
}
export function legalCheckers(s) {
  if(s.winner)return [];
  if(s.forced!==null)return options(s,s.forced,true);
  const moves=s.board.flatMap((_,i)=>options(s,i));
  return moves.some(m=>m.capture!==null)?moves.filter(m=>m.capture!==null):moves;
}
export function moveCheckers(s,from,to) {
  const m=legalCheckers(s).find(m=>m.from===from&&m.to===to);if(!m)return null;
  const next=structuredClone(s), p=next.board[from];
  next.board[from]=null;next.board[to]=p;
  if(m.capture!==null)next.board[m.capture]=null;
  const crowned=!p.king&&(p.side==='gold'?to<8:to>=56);
  if(crowned)p.king=true;
  next.forced=null;
  if(m.capture!==null&&!crowned&&options(next,to,true).length){next.forced=to;return next;}
  next.turn=s.turn==='gold'?'cyan':'gold';
  if(!legalCheckers(next).length)next.winner=s.turn;
  return next;
}
