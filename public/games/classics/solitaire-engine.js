export const SUITS=['spades','hearts','clubs','diamonds'];
export const red=c=>c.suit==='hearts'||c.suit==='diamonds';
export function newSolitaire(random=Math.random) {
  const deck=SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({suit,rank:i+1,up:false})));
  for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const tableau=Array.from({length:7},(_,i)=>{const pile=deck.splice(0,i+1);pile.at(-1).up=true;return pile;});
  return {tableau,stock:deck,waste:[],foundations:[[],[],[],[]],moves:0};
}
export const solitaireWon=s=>s.foundations.every(p=>p.length===13);
function pile(s,ref){if(ref.kind==='waste')return s.waste;if(['tableau','foundations'].includes(ref.kind)&&Number.isInteger(ref.pile))return s[ref.kind][ref.pile];return null;}
export function drawSolitaire(s) {
  if(solitaireWon(s)||(!s.stock.length&&!s.waste.length))return null;
  const n=structuredClone(s);
  if(n.stock.length){const c=n.stock.pop();c.up=true;n.waste.push(c);}
  else {n.stock=n.waste.reverse().map(c=>({...c,up:false}));n.waste=[];}
  n.moves++;return n;
}
export function moveSolitaire(s,source,target) {
  if(solitaireWon(s))return null;
  const from=pile(s,source),to=pile(s,target);
  if(!from||!to||from===to||!['tableau','foundations'].includes(target.kind))return null;
  const i=source.index;
  if(!Number.isInteger(i)||i<0||i>=from.length||!from[i].up)return null;
  const cards=from.slice(i),c=cards[0],top=to.at(-1);
  if(source.kind!=='tableau'&&cards.length!==1)return null;
  for(let j=1;j<cards.length;j++)if(!cards[j].up||cards[j-1].rank!==cards[j].rank+1||red(cards[j-1])===red(cards[j]))return null;
  if(target.kind==='foundations') {
    if(cards.length!==1||(!top?c.rank!==1:top.suit!==c.suit||c.rank!==top.rank+1))return null;
  } else if(!top?c.rank!==13:!top.up||c.rank!==top.rank-1||red(c)===red(top))return null;
  const n=structuredClone(s),nf=pile(n,source),nt=pile(n,target);
  nt.push(...nf.splice(i));if(source.kind==='tableau'&&nf.length)nf.at(-1).up=true;
  n.moves++;return n;
}
