// Decorative local feedback only. Never intercept navigation, input or game actions.
export const initCosmicGlitch = () => {
 const routes=new Set(['/','/start/','/games/','/news/','/kaspa/','/kaspa/directory/','/thanks/','/tools/','/whitepaper/','/litepaper/']);
 if(!routes.has(location.pathname)||document.body.dataset.cosmicReady)return;
 document.body.dataset.cosmicReady='1';
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),colors=window.matchMedia('(forced-colors: active)');
 const accents=['KAS :: curiosity.connect()','GEEK // knowledge > noise','01001011 · 01000001 · 01010011'];
 const headings=[...document.querySelectorAll('.home-launchpad h2,.game-section-head h2,.news-hero h1,.directory-hero h1,.tools-hero h1')].slice(0,3);
 headings.forEach((heading,i)=>{const code=document.createElement('span');code.className='cosmic-code-accent';code.setAttribute('aria-hidden','true');code.textContent=accents[i];code.style.setProperty('--cosmic-delay',`${i*1.5}s`);heading.append(code);});
 let cooling=false;
 document.addEventListener('click',event=>{
  if(document.hidden||motion.matches||colors.matches||document.body.classList.contains('is-playing')||cooling||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
  const target=event.target?.closest?.('.hero-actions .button,.home-launchpad>a,.home-document-buttons a,.games-jumps a,.game-open,.welcome-panel>summary,.grid-terminal-shortcuts button');
  if(!target||target.disabled||target.getAttribute('aria-disabled')==='true')return;
  cooling=true;target.classList.add('cosmic-active');
  setTimeout(()=>{target.classList.remove('cosmic-active');cooling=false;},360);
 },{passive:true});
};
initCosmicGlitch();
