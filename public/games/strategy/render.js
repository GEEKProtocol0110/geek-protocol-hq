import { reversiLegal } from './engine.js';
const coord=(i,n)=>`${String.fromCharCode(65+i%n)}${Math.floor(i/n)+1}`;
export function renderStrategy(document,container,s,{side=0,enabled=true,onMove,draftFleet=[],onShuffle=()=>{}}){
 container.replaceChildren();container.className=`strategy-surface strategy-${s.game}`;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=(text,label,fn,disabled=false)=>{const b=node('button','strategy-cell',text);b.type='button';b.setAttribute('aria-label',label);b.disabled=!enabled||disabled;b.addEventListener('click',fn);return b;};
 const sideName=n=>n===0?'Gold':'Cyan';
 if(s.game==='battle-geek'){
  const own=s.ready[side]?s.ownFleet:draftFleet;
  if(s.phase==='deploy'){
   const p=node('p','strategy-hint',s.ready[side]?'Fleet deployed. Waiting for your opponent.':'Your fleet preview: 3 ships. Shuffle until you like the layout, then deploy.');container.append(p);
   if(!s.ready[side]){const controls=node('div','strategy-actions');controls.append(button('Shuffle fleet','Shuffle your fleet',onShuffle),button('Deploy fleet','Deploy your three ships',()=>onMove({kind:'deploy',fleet:draftFleet})));container.append(controls);}
  }
  const panes=node('div','fleet-panes');
  for(const target of [false,true]){
   const section=node('section','fleet-pane'),title=node('h3','',target?'Enemy scan grid':'Your fleet');section.append(title);const grid=node('div','strategy-grid fleet-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label',target?'Enemy scan grid':'Your fleet board');
   for(let i=0;i<36;i++){
    const occupied=own.some(ship=>ship.includes(i)),shot=target?s.target[i]:s.incoming[i]?occupied?'hit':'miss':'unknown';
    const b=button(shot==='hit'?'×':shot==='miss'?'·':!target&&occupied?'◆':'',`${coord(i,6)}: ${target?shot:shot==='unknown'?(occupied?'your ship':'water'):shot}`,()=>onMove({kind:'scan',cell:i}),!target||s.phase!=='play'||shot!=='unknown');b.className+=` fleet-${shot}${!target&&occupied?' fleet-ship':''}`;grid.append(b);
   }section.append(grid);panes.append(section);
  }container.append(panes);container.append(node('p','strategy-hint',`Enemy ships sunk: ${s.sunk.length}/3 · × hit · · miss. Each scan ends your turn.`));return;
 }
 if(s.game==='dots'){
  const grid=node('div','dots-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Dots and boxes board');
  for(let r=0;r<7;r++)for(let c=0;c<7;c++){
   if(r%2===0&&c%2===0){const dot=node('span','dots-point','•');dot.setAttribute('aria-hidden','true');grid.append(dot);}
   else if(r%2&&c%2){const owner=s.boxes[Math.floor(r/2)*3+Math.floor(c/2)];grid.append(node('span',`dots-box ${owner===null?'':owner===0?'token-gold':'token-cyan'}`,owner===null?'':owner===0?'G':'C'));}
   else{const horizontal=r%2===0,i=horizontal?r/2*3+(c-1)/2:12+(r-1)/2*4+c/2,owner=s.edges[i];const b=button(owner===null?'':horizontal?'━':'┃',`${horizontal?'Horizontal':'Vertical'} edge ${i+1}${owner===null?' unclaimed':` claimed by ${sideName(owner)}`}`,()=>onMove({cell:i}),owner!==null);b.dataset.edge=String(i);b.className+=` dots-edge ${horizontal?'horizontal':'vertical'} ${owner===null?'':owner===0?'token-gold':'token-cyan'}`;grid.append(b);}
  }container.append(node('p','strategy-hint',`Boxes · Gold ${s.scores[0]} : ${s.scores[1]} Cyan`),grid);return;
 }
 const n=s.game==='tic-tac-toe'?3:s.game==='connect-four'?7:8,rows=s.game==='connect-four'?6:n,grid=node('div',`strategy-grid grid-${n}`);
 grid.setAttribute('role','group');grid.setAttribute('aria-label',`${s.game} board`);
 if(s.game==='connect-four')for(let col=0;col<7;col++){const b=button('↓',`Drop in column ${col+1}`,()=>onMove({cell:col}),s.board[col]!==null);b.dataset.column=String(col);grid.append(b);}
 const legal=s.game==='reversi'?reversiLegal(s.board,side):[];
 for(let i=0;i<rows*n;i++){
  const value=s.board[i],text=value===null?(legal.includes(i)?'·':''):s.game==='tic-tac-toe'?(value===0?'×':'○'):'●';
  const label=`${coord(i,n)}: ${value===null?(legal.includes(i)?'legal destination':'empty'):sideName(value)}`;
  const cell=s.game==='connect-four'?node('span','strategy-cell',text):button(text,label,()=>onMove({cell:i}),value!==null||s.game==='reversi'&&!legal.includes(i));
  cell.setAttribute('aria-label',label);cell.dataset.cell=String(i);cell.className+=value===null?(legal.includes(i)?' strategy-legal':''):(value===0?' token-gold':' token-cyan');grid.append(cell);
 }container.append(grid);
 if(s.game==='reversi')container.append(node('p','strategy-hint',`Discs · Gold ${s.board.filter(x=>x===0).length} : ${s.board.filter(x=>x===1).length} Cyan. Turns pass automatically if no legal move exists.`));
}
