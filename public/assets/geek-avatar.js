// Shared, fixed cosmetic vocabulary. No collection edition or ownership claims.
export const customGeekId = 'giga-builder';
export const geekParts = Object.freeze({
  palette: { label: 'Color', choices: [['gold', 'GIGA gold'], ['cyan', 'Kaspa cyan'], ['violet', 'Violet signal']] },
  head: { label: 'Headgear', choices: [['antenna', 'Signal antenna'], ['headphones', 'Headphones'], ['plain', 'Clean dome']] },
  face: { label: 'Face', choices: [['friendly', 'Friendly eyes'], ['visor', 'Signal visor'], ['focus', 'Focused eyes']] },
  torso: { label: 'Torso', choices: [['core', 'GIGA core'], ['dag', 'DAG chest'], ['star', 'Star core']] },
  arms: { label: 'Arms', choices: [['classic', 'Classic hands'], ['guard', 'Guard gauntlets']] },
  legs: { label: 'Legs', choices: [['boots', 'Explorer boots'], ['runner', 'Runner feet']] },
  back: { label: 'Back accessory', choices: [['none', 'None'], ['pack', 'Explorer pack'], ['wings', 'Signal fins']] },
  fx: { label: 'Effect', choices: [['none', 'None'], ['halo', 'Signal halo'], ['spark', 'Signal sparks']] }
});
export const defaultGeek = Object.freeze({ version: 1, palette: 'gold', head: 'antenna', face: 'friendly', torso: 'core', arms: 'classic', legs: 'boots', back: 'none', fx: 'none' });
export const normalizeGeek = (value, strict = false) => {
  const valid = value && typeof value === 'object' && !Array.isArray(value) && value.version === 1;
  if (strict && (!valid || Object.keys(value).length !== Object.keys(defaultGeek).length || Object.keys(value).some(key => !Object.hasOwn(defaultGeek, key)))) throw new Error('INVALID_AVATAR_CUSTOMIZATION');
  const result = { version: 1 };
  for (const [key, part] of Object.entries(geekParts)) {
    const known = valid && part.choices.some(([id]) => id === value[key]);
    if (strict && !known) throw new Error('INVALID_AVATAR_CUSTOMIZATION');
    result[key] = known ? value[key] : defaultGeek[key];
  }
  return result;
};
export const geekDescription = value => {
  const geek = normalizeGeek(value);
  return 'Custom Geek: ' + Object.entries(geekParts).map(([key, part]) => part.choices.find(([id]) => id === geek[key])[1]).join(', ');
};
export const geekSvg = value => {
  const g = normalizeGeek(value);
  const back = g.back === 'pack' ? '<rect class="robot-dark" x="77" y="130" width="146" height="114" rx="24"/><path class="robot-trim" d="M80 150h-9v61h9m140-61h9v61h-9"/>' : g.back === 'wings' ? '<path class="robot-metal" d="M100 142L45 112l11 86 47 30m97-86 55-30-11 86-47 30"/><path class="robot-trim" d="M57 132l17 57m169-57-17 57"/>' : '';
  const fx = g.fx === 'halo' ? '<ellipse class="robot-effect" cx="150" cy="49" rx="64" ry="13"/>' : g.fx === 'spark' ? '<path class="robot-effect" d="M38 65v20m-10-10h20m208 142v24m-12-12h24M241 53v14m-7-7h14"/>' : '';
  const head = g.head === 'antenna' ? '<path class="robot-trim" d="M150 64V39"/><circle class="robot-light" cx="150" cy="33" r="9"/>' : g.head === 'headphones' ? '<path class="robot-trim robot-headband" d="M92 110V89a58 58 0 01116 0v21"/><rect class="robot-metal" x="82" y="93" width="20" height="39" rx="8"/><rect class="robot-metal" x="198" y="93" width="20" height="39" rx="8"/>' : '';
  const face = g.face === 'visor' ? '<rect class="robot-light" x="111" y="93" width="78" height="13" rx="6"/><path class="robot-dark-line" d="M130 93l-8 13m26-13-8 13m26-13-8 13m26-13-8 13"/>' : g.face === 'focus' ? '<path class="robot-eye" d="M113 97l20 5m34 0 20-5"/>' : '<path class="robot-eye" d="M115 104q8-16 16 0m38 0q8-16 16 0"/>';
  const torso = g.torso === 'dag' ? '<path class="robot-trim" d="M128 179l22-16 22 16-22 19zM128 179v22l22 16 22-16v-22m-22 19v19"/><circle class="robot-light" cx="150" cy="163" r="4"/>' : g.torso === 'star' ? '<path class="robot-light" d="M150 163l8 17 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z"/>' : '<circle class="robot-dark" cx="150" cy="189" r="29"/><circle class="robot-core" cx="150" cy="189" r="20"/><path class="robot-symbol" d="M158 179h-13v20h13v-9h-7"/>';
  const arms = g.arms === 'guard' ? '<rect class="robot-metal" x="54" y="173" width="40" height="59" rx="13"/><rect class="robot-metal" x="206" y="173" width="40" height="59" rx="13"/><path class="robot-trim" d="M62 190h24m128 0h24"/>' : '<rect class="robot-metal" x="65" y="186" width="28" height="42" rx="12"/><rect class="robot-metal" x="207" y="186" width="28" height="42" rx="12"/>';
  const legs = g.legs === 'runner' ? '<path class="robot-metal" d="M111 268h31v23h-45v-11zM158 268h31l14 12v11h-45z"/><path class="robot-trim" d="M103 283h27m40 0h27"/>' : '<rect class="robot-metal" x="103" y="265" width="40" height="31" rx="10"/><rect class="robot-metal" x="157" y="265" width="40" height="31" rx="10"/>';
  return `<svg class="geek-robot palette-${g.palette}" viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><ellipse class="robot-shadow" cx="150" cy="306" rx="83" ry="11"/>${fx}${back}<path class="robot-joint" d="M117 228v47m66-47v47M89 157l-10 48m132-48 10 48"/>${legs}${arms}<rect class="robot-metal" x="97" y="137" width="106" height="101" rx="28"/><path class="robot-trim" d="M108 224h84"/>${torso}<rect class="robot-dark" x="134" y="125" width="32" height="20" rx="6"/><rect class="robot-metal" x="93" y="64" width="114" height="72" rx="28"/><rect class="robot-dark" x="105" y="82" width="90" height="40" rx="16"/>${face}<path class="robot-mouth" d="M140 114q10 6 20 0"/>${head}<circle class="robot-light" cx="99" cy="158" r="6"/><circle class="robot-light" cx="201" cy="158" r="6"/></svg>`;
};
