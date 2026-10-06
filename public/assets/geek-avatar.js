// Shared, fixed cosmetic vocabulary. No collection edition or ownership claims.
export const customGeekId = 'giga-builder';
export const geekParts = Object.freeze({
  kind: { label: 'Character style', section: 'style', choices: [['human', 'Personal Geek'], ['robot', 'GIGA robot']] },
  skin: { label: 'Skin tone', section: 'face', modes: ['human'], choices: [['porcelain', 'Porcelain'], ['fair', 'Fair'], ['sand', 'Sand'], ['honey', 'Honey'], ['amber', 'Amber'], ['brown', 'Brown'], ['deep', 'Deep brown'], ['ebony', 'Ebony']] },
  hair: { label: 'Hairstyle', section: 'face', modes: ['human'], choices: [['crop', 'Short crop'], ['sweep', 'Side sweep'], ['curls', 'Curls'], ['locs', 'Locs'], ['long', 'Long hair'], ['bun', 'High bun'], ['bald', 'Bald'], ['fade', 'Fade'], ['bob', 'Bob'], ['braids', 'Braids']] },
  hairColor: { label: 'Hair color', section: 'face', modes: ['human'], choices: [['black', 'Black'], ['brown', 'Brown'], ['auburn', 'Auburn'], ['blond', 'Blond'], ['silver', 'Silver'], ['violet', 'Violet'], ['cyan', 'Cyan']] },
  eyeColor: { label: 'Eye color', section: 'face', modes: ['human'], choices: [['brown', 'Brown'], ['blue', 'Blue'], ['green', 'Green'], ['hazel', 'Hazel'], ['gray', 'Gray']] },
  facialHair: { label: 'Facial hair', section: 'face', modes: ['human'], choices: [['none', 'None'], ['stubble', 'Stubble'], ['beard', 'Full beard'], ['moustache', 'Moustache']] },
  eyewear: { label: 'Glasses', section: 'face', modes: ['human'], choices: [['none', 'None'], ['round', 'Round frames'], ['square', 'Square frames']] },
  outfit: { label: 'Top', section: 'outfit', modes: ['human'], choices: [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['jacket', 'Explorer jacket'], ['vest', 'Utility vest']] },
  pants: { label: 'Bottoms', section: 'outfit', modes: ['human'], choices: [['denim', 'Dark jeans'], ['cargo', 'Cargo trousers'], ['shorts', 'Shorts']] },
  palette: { label: 'Character color', section: 'outfit', choices: [['gold', 'GIGA gold'], ['cyan', 'Kaspa cyan'], ['violet', 'Violet signal'], ['ocean', 'Ocean blue'], ['forest', 'Forest green'], ['rose', 'Rose red']] },
  head: { label: 'Headgear', section: 'extras', choices: [['antenna', 'Signal antenna'], ['headphones', 'Headphones'], ['plain', 'Clean dome'], ['cap', 'Signal cap'], ['beanie', 'Knit beanie']] },
  face: { label: 'Expression', section: 'face', choices: [['friendly', 'Friendly eyes'], ['visor', 'Signal visor'], ['focus', 'Focused eyes']] },
  torso: { label: 'Chest emblem', section: 'outfit', choices: [['core', 'GIGA core'], ['dag', 'DAG chest'], ['star', 'Star core']] },
  arms: { label: 'Arms', section: 'outfit', modes: ['robot'], choices: [['classic', 'Classic hands'], ['guard', 'Guard gauntlets']] },
  legs: { label: 'Footwear', section: 'outfit', choices: [['boots', 'Explorer boots'], ['runner', 'Runner feet']] },
  back: { label: 'Back accessory', section: 'extras', choices: [['none', 'None'], ['pack', 'Explorer pack'], ['wings', 'Signal fins']] },
  fx: { label: 'Effect', section: 'extras', choices: [['none', 'None'], ['halo', 'Signal halo'], ['spark', 'Signal sparks'], ['stars', 'Star particles'], ['orbit', 'Orbital particles'], ['pulse', 'Explorer pulse · level 5'], ['crown', 'Prestige crown · Prestige 1']] }
});
export const careerEffects = Object.freeze([{ id: 'pulse', name: 'Explorer pulse', requirement: 'Reach level 5', level: 5, prestige: 0 }, { id: 'crown', name: 'Prestige crown', requirement: 'Reach Prestige 1', level: 1, prestige: 1 }]);
export const unlockedGeekEffects = progression => careerEffects.filter(effect => effect.prestige ? progression?.prestige >= effect.prestige : progression?.level >= effect.level || progression?.prestige > 0).map(effect => effect.id);
const legacyKeys = ['palette', 'head', 'face', 'torso', 'arms', 'legs', 'back', 'fx'];
export const defaultGeek = Object.freeze({ version: 2, kind: 'robot', skin: 'honey', hair: 'crop', hairColor: 'brown', eyeColor: 'brown', facialHair: 'none', eyewear: 'none', outfit: 'hoodie', pants: 'denim', palette: 'gold', head: 'antenna', face: 'friendly', torso: 'core', arms: 'classic', legs: 'boots', back: 'none', fx: 'none' });
export const personalGeek = Object.freeze({ ...defaultGeek, kind: 'human', palette: 'cyan', head: 'plain', outfit: 'hoodie' });
export const visibleGeekParts = value => {
  const g = normalizeGeek(value);
  return Object.entries(geekParts).filter(([, part]) => !part.modes || part.modes.includes(g.kind));
};
export const normalizeGeek = (value, strict = false) => {
  const object = value && typeof value === 'object' && !Array.isArray(value);
  const legacy = object && value.version === 1;
  const valid = object && (legacy || value.version === 2);
  const keys = legacy ? ['version', ...legacyKeys] : Object.keys(defaultGeek);
  if (strict && (!valid || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key)))) throw new Error('INVALID_AVATAR_CUSTOMIZATION');
  const result = { version: 2 };
  for (const [key, part] of Object.entries(geekParts)) {
    const inherited = legacy && !legacyKeys.includes(key);
    const choices = legacy && key === 'palette' ? part.choices.slice(0, 3) : part.choices;
    const known = valid && !inherited && choices.some(([id]) => id === value[key]);
    if (strict && !inherited && !known) throw new Error('INVALID_AVATAR_CUSTOMIZATION');
    result[key] = known ? value[key] : defaultGeek[key];
  }
  if (result.kind === 'human' && result.head === 'antenna') {
    if (strict) throw new Error('INVALID_AVATAR_CUSTOMIZATION');
    result.head = 'plain';
  }
  return result;
};
export const geekDescription = value => {
  const geek = normalizeGeek(value);
  return 'Custom Geek: ' + visibleGeekParts(geek).map(([key, part]) => (key === 'head' && geek.kind === 'human' && geek[key] === 'plain' ? 'No headgear' : part.choices.find(([id]) => id === geek[key])[1])).join(', ');
};
const skinColors = Object.freeze({ porcelain: '#f5ddce', fair: '#ebbea0', sand: '#d6a17e', honey: '#bc835c', amber: '#a66a42', brown: '#885235', deep: '#643d2e', ebony: '#412b26' });
const hairColors = Object.freeze({ black: '#20212b', brown: '#593d32', auburn: '#a04e31', blond: '#e6bd68', silver: '#c4ced7', violet: '#ac79df', cyan: '#66c8c8' });
const eyeColors = Object.freeze({ brown: '#704b2d', blue: '#4b90bf', green: '#478967', hazel: '#9b843e', gray: '#6c8494' });
const personalSvg = (g, back, fx) => {
  const skin = skinColors[g.skin], hairColor = hairColors[g.hairColor], eyes = eyeColors[g.eyeColor];
  const hair = {
    crop: '<path d="M95 67h108v27h-16V83h-29v8h-38V83h-25z"/>',
    sweep: '<path d="M95 68h108v20h-38v8h-28v8h-27v-8H95z"/>',
    curls: '<path d="M91 73h11V61h17v-7h21v7h19v-7h21v7h18v12h12v29h-16V88h-20V80h-21v8h-21V80h-21v22H91z"/>',
    locs: '<path d="M94 65h112v27h-10v38h-10V83h-12v26h-10V83h-12v22h-10V83h-12v28h-10V83h-12v50H94z"/>',
    long: '<path d="M91 66h118v95h-20V85h-27v10h-47v66H91z"/>',
    bun: '<path d="M122 47h52v26h-52zM95 70h108v26h-15V85h-75v11H95z"/>',
    fade: '<path d="M95 70h108v18h-17V80h-70v8H95z"/><path d="M96 88h10v14H96m99-14h9v14h-9" opacity=".5"/>',
    bob: '<path d="M90 65h120v88h-21V87h-26v10h-45v56H90z"/><path d="M91 144h25v14H91m100-14h19v14h-19"/>',
    braids: '<path d="M96 65h108v23H96zM98 88h12v11h-12zm-3 12h12v11H95zm3 12h12v11H98zm-3 12h12v11H95zm3 12h12v14H98zM190 88h12v11h-12zm3 12h12v11h-12zm-3 12h12v11h-12zm3 12h12v11h-12zm-3 12h12v14h-12z"/>',
    bald: ''
  }[g.hair];
  const beard = g.facialHair === 'beard' ? '<path d="M112 128h14v10h46v-10h14v29h-13v9h-47v-9h-14z"/>' : g.facialHair === 'moustache' ? '<path d="M132 130h34v7h-14v-3h-6v3h-14z"/>' : g.facialHair === 'stubble' ? '<path d="M114 137v11h11v9h49v-9h11v-11h-7v9h-57v-9z" opacity=".6"/>' : '';
  const glasses = g.eyewear === 'round' ? '<g class="human-glasses"><circle cx="128" cy="110" r="13"/><circle cx="172" cy="110" r="13"/><path d="M141 110h18m-44 0H99m86 0h16"/></g>' : g.eyewear === 'square' ? '<g class="human-glasses"><rect x="114" y="99" width="28" height="23" rx="2"/><rect x="158" y="99" width="28" height="23" rx="2"/><path d="M142 110h16m-44 0H99m87 0h14"/></g>' : '';
  const face = g.face === 'visor' ? '<rect x="111" y="97" width="78" height="25" rx="4" fill="#182f37"/><path d="M120 106h60" stroke="#70e6dc" stroke-width="3"/>' : `<g fill="#f9f3e8"><rect x="119" y="103" width="17" height="13"/><rect x="164" y="103" width="17" height="13"/></g><g fill="${eyes}"><rect x="125" y="105" width="9" height="11"/><rect x="164" y="105" width="9" height="11"/></g><path d="${g.face === 'focus' ? 'M119 96l18 5m26 0 18-5' : 'M119 96h17m28 0h17'}" stroke="${hairColor}" stroke-width="4"/>${glasses}`;
  const neck = `<rect x="137" y="148" width="26" height="23" fill="${skin}"/>`;
  const sleeves = g.outfit === 'tee' ? '<path class="human-cloth" d="M81 165h28v34H76v-26zM191 165h28l5 8v26h-33z"/>' : '<path class="human-cloth" d="M81 165h27v69H73v-58zM192 165h27l8 11v58h-35z"/>';
  const shirt = g.outfit === 'vest' ? '<path class="human-cloth" d="M112 157h76l14 14v70H98v-70z"/><path class="human-cloth-shadow" d="M126 157h48v83h-48z"/><path class="human-seam" d="M112 186h16v17h-16m61-17h16v17h-16M150 166v74"/>' : g.outfit === 'hoodie' ? '<path class="human-cloth" d="M114 156h72l16 15v70H98v-70z"/><path class="human-cloth-shadow" d="M114 156l36 18 36-18-11-9h-50z"/><path class="human-seam" d="M138 173v25m24-25v25M122 224h56l-5-13h-46z"/>' : g.outfit === 'jacket' ? '<path class="human-cloth" d="M115 157h70l17 13v71H98v-71z"/><path class="human-cloth-shadow" d="M132 163h36v78h-36z"/><path class="human-seam" d="M150 168v72m-32-36h13v17h-13m50-17h13v17h-13"/>' : '<path class="human-cloth" d="M113 160h74l15 11v70H98v-70z"/><path d="M132 160q18 14 36 0" fill="none" stroke="#172c31" stroke-width="4"/>';
  const emblem = g.torso === 'dag' ? '<path d="M139 189l11-8 11 8-11 8zM139 189v12l11 8 11-8v-12m-11 8v12"/>' : g.torso === 'star' ? '<path d="M150 183l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>' : '<path d="M158 186h-15v23h15v-11h-8"/>';
  const bottoms = g.pants === 'shorts' ? `<path class="human-pants" d="M102 235h96v24h-40v-5h-16v5h-40z"/><g fill="${skin}"><rect x="107" y="258" width="32" height="26"/><rect x="161" y="258" width="32" height="26"/></g>` : `<path class="human-pants ${g.pants === 'cargo' ? 'human-cargo' : ''}" d="M102 235h96v49h-39v-35h-17v35h-40z"/>${g.pants === 'cargo' ? '<path class="human-seam" d="M109 250h23v15h-23zm59 0h23v15h-23z"/>' : '<path class="human-seam" d="M107 243l18 7m68-7-18 7"/>'}`;
  const shoes = g.legs === 'runner' ? '<path class="human-shoe" d="M101 280h39v16H91v-10zM160 280h39l10 6v10h-49z"/><path class="human-sole" d="M91 293h49m20 0h49"/>' : '<path class="human-shoe" d="M101 276h39v20H95v-9h6zM160 276h39v11h6v9h-45z"/>';
  const headwear = g.head === 'cap' ? '<path class="human-cloth" d="M93 67h111v25H93zM100 86h117v9H100z"/><path class="human-seam" d="M148 69v16"/>' : g.head === 'beanie' ? '<path class="human-cloth" d="M95 64h108v33H95z"/><path class="human-cloth-shadow" d="M92 85h114v15H92z"/><path class="human-seam" d="M118 68v17m17-17v17m27-17v17m17-17v17"/>' : g.head === 'headphones' ? '<path d="M91 112V83a59 59 0 01118 0v29" class="human-headband"/><rect x="83" y="101" width="16" height="30" rx="3" class="human-shoe"/><rect x="201" y="101" width="16" height="30" rx="3" class="human-shoe"/>' : '';
  return `<svg class="geek-robot geek-personal palette-${g.palette}" viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><ellipse class="robot-shadow" cx="150" cy="306" rx="78" ry="10"/>${fx}${back}${bottoms}${shoes}<g fill="${skin}" stroke="#322d31" stroke-width="2"><rect x="76" y="190" width="28" height="51" rx="2"/><rect x="196" y="190" width="28" height="51" rx="2"/></g>${sleeves}${neck}${shirt}<g class="human-emblem">${emblem}</g><path d="M189 73h20v74h-20z" fill="${skin}" stroke="#322d31" stroke-width="2"/><path d="M98 73h94v76l-13 13h-67l-14-13z" fill="${skin}" stroke="#322d31" stroke-width="2"/><path d="M189 76v70l-10 15h13l17-14V76z" fill="#322d31" opacity=".16"/><g fill="${skin}" stroke="#322d31" stroke-width="2"><rect x="89" y="106" width="10" height="22"/><rect x="200" y="106" width="10" height="22"/></g><g fill="${hairColor}">${hair}</g>${face}<path d="M144 118v10h10" fill="none" stroke="#322d31" stroke-opacity=".35" stroke-width="3"/><g fill="${hairColor}">${beard}</g><path d="${g.face === 'focus' ? 'M142 140h16' : 'M138 138v4h24v-4'}" fill="none" stroke="#563e37" stroke-width="3"/>${headwear}</svg>`;
};
const rearSvg = (g, fx) => {
  const human = g.kind === 'human';
  const hair = human && g.hair !== 'bald' ? `<path d="M96 66h108v${['long','bob','locs','braids'].includes(g.hair) ? 96 : 39}H96z" fill="${hairColors[g.hairColor]}"/>${g.hair === 'bun' ? `<rect x="127" y="47" width="46" height="27" fill="${hairColors[g.hairColor]}"/>` : ''}` : '';
  const bottoms = human ? g.pants === 'shorts' ? `<path class="human-pants" d="M104 235h92v23h-36v-4h-20v4h-36z"/><g fill="${skinColors[g.skin]}"><rect x="107" y="257" width="32" height="27"/><rect x="161" y="257" width="32" height="27"/></g>` : `<path class="human-pants ${g.pants === 'cargo' ? 'human-cargo' : ''}" d="M104 234h39v50h-39zm53 0h39v50h-39z"/><path class="human-seam" d="M111 243h20v14h-20zm58 0h20v14h-20z"/>` : '<path class="robot-joint" d="M120 233v43m60-43v43"/>';
  const feet = g.legs === 'runner' ? '<path class="human-shoe" d="M99 279h43v17H89v-9l10-8zm58 0h43l11 8v9h-54z"/><path class="human-sole" d="M89 293h53m15 0h54"/>' : '<path class="human-shoe" d="M99 279h43v17H94v-9zm58 0h43l6 8v9h-49z"/>';
  const arms = human ? `<g fill="${skinColors[g.skin]}" stroke="#322d31" stroke-width="2"><rect x="76" y="190" width="28" height="51"/><rect x="196" y="190" width="28" height="51"/></g><rect class="human-cloth" x="73" y="162" width="32" height="${g.outfit === 'tee' ? 35 : 69}"/><rect class="human-cloth" x="195" y="162" width="32" height="${g.outfit === 'tee' ? 35 : 69}"/>` : g.arms === 'guard' ? '<rect class="robot-metal" x="55" y="175" width="40" height="58" rx="12"/><rect class="robot-metal" x="205" y="175" width="40" height="58" rx="12"/><path class="robot-trim" d="M62 190h24m128 0h24"/>' : '<path class="robot-joint" d="M90 163l-11 43m131-43 11 43"/><rect class="robot-metal" x="65" y="186" width="28" height="42" rx="12"/><rect class="robot-metal" x="207" y="186" width="28" height="42" rx="12"/>';
  const seams = human && g.outfit === 'vest' ? '<path class="human-cloth-shadow" d="M124 155h52v81h-52z"/><path class="human-seam" d="M110 175h80m-80 30h80"/>' : human && g.outfit === 'jacket' ? '<path class="human-seam" d="M110 168h80m-40 0v70m-35-17h70"/>' : '';
  const pack = g.back === 'pack' ? '<rect class="robot-dark" x="113" y="161" width="74" height="79" rx="8"/><path class="robot-trim" d="M124 174h52m-44 22h36v29h-36z"/>' : g.back === 'wings' ? '<path class="robot-metal" d="M126 169l-80-53 18 97 62 25m48-69 80-53-18 97-62 25"/><path class="robot-trim" d="M64 137l34 71m138-71-34 71"/>' : '<path class="robot-trim" d="M134 188h32m-16-12v24"/>';
  const headwear = g.head === 'cap' || g.head === 'beanie' ? `<path class="robot-metal" d="M93 65h114v${g.head === 'cap' ? 27 : 35}H93z"/><path class="robot-trim" d="M120 86h60"/>` : g.head === 'headphones' ? '<path class="human-headband" d="M91 113V83a59 59 0 01118 0v30"/><rect class="robot-dark" x="83" y="101" width="16" height="30"/><rect class="robot-dark" x="201" y="101" width="16" height="30"/>' : g.head === 'antenna' ? '<path class="robot-trim" d="M150 64V39"/><circle class="robot-light" cx="150" cy="33" r="9"/>' : '';
  return `<svg class="geek-robot ${human ? 'geek-personal' : ''} palette-${g.palette}" viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><ellipse class="robot-shadow" cx="150" cy="306" rx="78" ry="10"/>${fx}${bottoms}${feet}${arms}<rect class="robot-metal" x="99" y="150" width="102" height="90" rx="${human ? 3 : 24}"/>${seams}${g.outfit === 'hoodie' && human ? '<path class="human-cloth-shadow" d="M117 151h66l-8 28h-50z"/>' : ''}<rect x="98" y="72" width="104" height="80" rx="${human ? 2 : 25}" ${human ? `fill="${skinColors[g.skin]}" stroke="#322d31"` : 'class="robot-metal"'}/>${hair}${headwear}${pack}</svg>`;
};
export const geekSvg = (value, view = 'front') => {
  const g = normalizeGeek(value);
  const back = g.back === 'pack' ? '<rect class="robot-dark" x="77" y="130" width="146" height="114" rx="24"/><path class="robot-trim" d="M80 150h-9v61h9m140-61h9v61h-9"/>' : g.back === 'wings' ? '<path class="robot-metal" d="M100 142L45 112l11 86 47 30m97-86 55-30-11 86-47 30"/><path class="robot-trim" d="M57 132l17 57m169-57-17 57"/>' : '';
  const fx = g.fx === 'pulse' ? '<g class="robot-pulse"><ellipse class="robot-effect" cx="150" cy="292" rx="98" ry="17"/><ellipse class="robot-effect" cx="150" cy="292" rx="113" ry="24" opacity=".5"/></g>' : g.fx === 'crown' ? '<path class="robot-crown" d="M110 53l-6-27 26 12 20-22 20 22 26-12-6 27z"/>' : g.fx === 'halo' ? '<ellipse class="robot-effect" cx="150" cy="49" rx="64" ry="13"/>' : g.fx === 'spark' ? '<path class="robot-effect" d="M38 65v20m-10-10h20m208 142v24m-12-12h24M241 53v14m-7-7h14"/>' : g.fx === 'stars' ? '<g class="robot-particles"><path class="robot-star" d="M49 72l3-8 3 8 8 3-8 3-3 8-3-8-8-3z"/><path class="robot-star robot-star-alt" d="M244 126l3-7 3 7 7 3-7 3-3 7-3-7-7-3z"/><path class="robot-star robot-star-last" d="M56 248l2-6 2 6 6 2-6 2-2 6-2-6-6-2z"/><circle class="robot-star" cx="234" cy="58" r="2"/><circle class="robot-star robot-star-alt" cx="38" cy="173" r="2"/><circle class="robot-star robot-star-last" cx="244" cy="265" r="3"/></g>' : g.fx === 'orbit' ? '<g class="robot-orbit"><ellipse class="robot-effect" cx="150" cy="166" rx="112" ry="41"/><circle class="robot-orbit-particle" cx="38" cy="166" r="5"/><circle class="robot-orbit-particle" cx="257" cy="177" r="3"/><circle class="robot-orbit-particle" cx="150" cy="125" r="4"/></g>' : '';
  if (view === 'back') return rearSvg(g, fx);
  if (g.kind === 'human') return personalSvg(g, back, fx);
  const head = g.head === 'cap' ? '<path class="robot-metal" d="M92 60h116v25H92zM99 79h120v10H99z"/>' : g.head === 'beanie' ? '<path class="robot-metal" d="M94 59h112v34H94z"/><path class="robot-trim" d="M95 86h110"/>' : g.head === 'antenna' ? '<path class="robot-trim" d="M150 64V39"/><circle class="robot-light" cx="150" cy="33" r="9"/>' : g.head === 'headphones' ? '<path class="robot-trim robot-headband" d="M92 110V89a58 58 0 01116 0v21"/><rect class="robot-metal" x="82" y="93" width="20" height="39" rx="8"/><rect class="robot-metal" x="198" y="93" width="20" height="39" rx="8"/>' : '';
  const face = g.face === 'visor' ? '<rect class="robot-light" x="111" y="93" width="78" height="13" rx="6"/><path class="robot-dark-line" d="M130 93l-8 13m26-13-8 13m26-13-8 13m26-13-8 13"/>' : g.face === 'focus' ? '<path class="robot-eye" d="M113 97l20 5m34 0 20-5"/>' : '<path class="robot-eye" d="M115 104q8-16 16 0m38 0q8-16 16 0"/>';
  const torso = g.torso === 'dag' ? '<path class="robot-trim" d="M128 179l22-16 22 16-22 19zM128 179v22l22 16 22-16v-22m-22 19v19"/><circle class="robot-light" cx="150" cy="163" r="4"/>' : g.torso === 'star' ? '<path class="robot-light" d="M150 163l8 17 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z"/>' : '<circle class="robot-dark" cx="150" cy="189" r="29"/><circle class="robot-core" cx="150" cy="189" r="20"/><path class="robot-symbol" d="M158 179h-13v20h13v-9h-7"/>';
  const arms = g.arms === 'guard' ? '<rect class="robot-metal" x="54" y="173" width="40" height="59" rx="13"/><rect class="robot-metal" x="206" y="173" width="40" height="59" rx="13"/><path class="robot-trim" d="M62 190h24m128 0h24"/>' : '<rect class="robot-metal" x="65" y="186" width="28" height="42" rx="12"/><rect class="robot-metal" x="207" y="186" width="28" height="42" rx="12"/>';
  const legs = g.legs === 'runner' ? '<path class="robot-metal" d="M111 268h31v23h-45v-11zM158 268h31l14 12v11h-45z"/><path class="robot-trim" d="M103 283h27m40 0h27"/>' : '<rect class="robot-metal" x="103" y="265" width="40" height="31" rx="10"/><rect class="robot-metal" x="157" y="265" width="40" height="31" rx="10"/>';
  return `<svg class="geek-robot palette-${g.palette}" viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><ellipse class="robot-shadow" cx="150" cy="306" rx="83" ry="11"/>${fx}${back}<path class="robot-joint" d="M117 228v47m66-47v47M89 157l-10 48m132-48 10 48"/>${legs}${arms}<rect class="robot-metal" x="97" y="137" width="106" height="101" rx="28"/><path class="robot-trim" d="M108 224h84"/>${torso}<rect class="robot-dark" x="134" y="125" width="32" height="20" rx="6"/><rect class="robot-metal" x="93" y="64" width="114" height="72" rx="28"/><rect class="robot-dark" x="105" y="82" width="90" height="40" rx="16"/>${face}<path class="robot-mouth" d="M140 114q10 6 20 0"/>${head}<circle class="robot-light" cx="99" cy="158" r="6"/><circle class="robot-light" cx="201" cy="158" r="6"/></svg>`;
};
