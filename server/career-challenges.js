// One catalog drives challenge claims, achievement unlocks and mastery emblems.
// IDs and reward amounts are permanent; old receipts must never be reissued.
export const careerTiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
const categoryLabels = { kaspa:'Kaspa', 'video-games':'Video Games', 'science-fiction':'Science Fiction', technology:'Technology', movies:'Movies', history:'History', comics:'Comics', 'pop-culture':'Pop Culture' };
const category = (p, id, key) => count(p.categoryStats?.[id]?.[key]);
const rounds = p => Object.keys(categoryLabels).reduce((sum,id) => Math.min(Number.MAX_SAFE_INTEGER, sum + category(p,id,'rounds')),0);
const worlds = p => Object.keys(categoryLabels).filter(id => category(p,id,'rounds') > 0).length;
const play = '/play/';
const series = (id,name,group,targets,xp,metric,detail,emblem,extra={}) => ({id,name,group,targets,xp,metric,detail,emblem,href:play,...extra});
export const careerSeries = [
  series('rounds','Keep the signal going','Core',[1,10,50,250,1000],[50,75,100,150,250],rounds,n=>`Complete ${n} scored rounds.`, 'Grid Vanguard', { firstId:'first-scored-round', firstName:'Make your first move' }),
  series('correct','Knowledge collector','Core',[10,100,500,2500,10000],[25,50,100,150,250],p=>count(p.totalCorrect),n=>`Answer ${n} scored questions correctly.`, 'Knowledge Architect'),
  series('streak','Stay in the flow','Skill',[3,5,10,15,25],[25,50,75,100,150],p=>count(p.longestStreak),n=>`Build a ${n}-answer correct streak in scored play.`, 'Unbroken Signal'),
  series('gauntlet-depth','Climb the Gauntlet','Gauntlet',[2,4,6,8,10],[25,50,75,100,150],p=>count(p.bestRound),n=>`Complete Gauntlet round ${n}.`, 'Apex Pathfinder', {href:'/play/?mode=gauntlet#timed-games'}),
  series('gauntlet-clears','Return to the summit','Gauntlet',[1,5,10,25,100],[75,100,150,200,300],p=>count(p.gauntletsCompleted),n=>`Complete all ten Gauntlet rounds ${n} ${n===1?'time':'times'}.`, 'Apex Veteran', {href:'/play/?mode=gauntlet#timed-games'}),
  series('worlds','Explore the Grid','Core',[1,2,4,6,8],[25,50,75,100,150],worlds,n=>`Complete a scored round in ${n} different ${n===1?'category':'categories'}.`, 'Omniscient Explorer'),
  ...Object.entries(categoryLabels).map(([id,label])=>series(`world-${id}`,`${label} specialist`,'Categories',[25,100,250,500,1000],[75,100,150,200,300],p=>category(p,id,'correct'),n=>`Answer ${n} ${label} questions correctly in scored rounds.`,`${label} Sage`,{href:`/play/?category=${id}#timed-games`,...(id==='kaspa'?{firstId:'kaspa-25-correct',firstName:'Build your Kaspa knowledge'}:{})})),
  series('daily','Daily signal collector','Modes',[1,5,25,100,365],[25,50,75,100,200],p=>count(p.careerCounters?.dailyRounds),n=>`Complete ${n} Daily Signal rounds.`, 'Daily Constellation',{sinceUpdate:true,href:'/play/?mode=daily&category=kaspa#timed-games'}),
  series('speed','Speed circuit','Modes',[1,10,50,250,1000],[25,50,75,100,200],p=>count(p.careerCounters?.speedRounds),n=>`Complete ${n} Speed Signal rounds.`, 'Velocity Vanguard',{sinceUpdate:true,href:'/play/?mode=speed#timed-games'}),
  series('perfect','Clean sweep','Skill',[1,5,25,100,500],[50,75,100,150,250],p=>count(p.careerCounters?.perfectRounds),n=>`Answer every question correctly in ${n} full scored ${n===1?'round':'rounds'}.`, 'Flawless Circuit',{sinceUpdate:true}),
  series('prestige-path','Prestige legacy','Prestige',[1,5,10,15,25],[50,75,100,150,250],p=>count(p.prestigeState?.prestige),n=>`Choose prestige ${n} times after reaching level 50.`, 'Genesis Legend',{href:'/profile/#prestige'})
];
export const careerCatalog = careerSeries.flatMap(track=>track.targets.map((target,index)=>({
  id:index===0&&track.firstId?track.firstId:`career-${track.id}-${target}`,
  seriesId:track.id, seriesName:track.name, group:track.group, tier:index+1, tierName:careerTiers[index],
  name:index===0&&track.firstName?track.firstName:`${track.name} · ${careerTiers[index]}`,
  detail:track.detail(target), href:track.href, xp:track.xp[index], target, sinceUpdate:Boolean(track.sinceUpdate),
  metric:track.metric, prerequisite:index===0?null:index===1&&track.firstId?track.firstId:`career-${track.id}-${track.targets[index-1]}`
})));

export const careerChallengeState = profile => {
  const claims=profile.challengeClaims || {}, tracked=profile.challengeTracks || [];
  const tasks=careerCatalog.map(({metric,...task})=>{
    const progress=Math.min(task.target,metric(profile)), complete=progress>=task.target;
    const claimed=Object.hasOwn(claims,task.id), locked=Boolean(task.prerequisite&&!Object.hasOwn(claims,task.prerequisite));
    return {...task,progress,complete,claimed,locked,eligible:complete&&!claimed&&!locked,tracked:tracked.includes(task.seriesId)};
  });
  const next=careerSeries.map(s=>tasks.find(t=>t.seriesId===s.id&&!t.claimed)).filter(Boolean);
  const recommended=[...next].sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.progress/b.target)-(a.progress/a.target)).slice(0,3);
  const masteries=careerSeries.map(s=>({id:s.id,name:s.emblem,trackName:s.name,unlocked:tasks.filter(t=>t.seriesId===s.id).every(t=>t.complete),tiersComplete:tasks.filter(t=>t.seriesId===s.id&&t.complete).length,totalTiers:5}));
  return { tasks, total:tasks.length, completed:tasks.filter(t=>t.complete).length, claimed:tasks.filter(t=>t.claimed).length,
    ready:tasks.filter(t=>t.eligible).length, recommended, tracked:tracked.map(id=>next.find(t=>t.seriesId===id)||tasks.filter(t=>t.seriesId===id).at(-1)).filter(Boolean), trackedSeries:tracked,
    masteries, mastered:masteries.filter(m=>m.unlocked).length, maxTracked:3 };
};

export const careerAchievements = profile => careerChallengeState(profile).tasks.map(t=>({
  id:t.id,name:t.name,detail:t.detail,progress:t.progress,target:t.target,unlocked:t.complete,
  xp:t.xp,claimed:t.claimed,tierName:t.tierName,group:t.group,seriesId:t.seriesId,href:'/challenges/#career-challenges'
}));
