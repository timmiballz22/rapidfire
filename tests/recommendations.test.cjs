const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
let engine;
test('recommendation engine can be imported as an independent ES module',async()=>{
  engine=await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  assert.equal(engine.blankRecommendationState().history.length,0);
});
test('view, dwell, swipe, like, save, comment and share are bounded and reversible',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const state=m.blankRecommendationState();
  for(const [kind,value] of [['view',0],['dwell',8.5],['swipe',0],['like',true],['save',true],['comment',0],['share',0]])
    m.applyRecommendationEvent(state,'one',kind,value,1000);
  assert.deepEqual({views:state.history[0].views,seconds:state.history[0].seconds,swipes:state.history[0].swipes,
    likes:state.history[0].likes,saves:state.history[0].saves,comments:state.history[0].comments,
    shares:state.history[0].shares},{views:1,seconds:8.5,swipes:1,likes:1,saves:1,comments:1,shares:1});
  m.applyRecommendationEvent(state,'one','like',false,1100);
  assert.equal(state.history[0].likes,0);
  for(let i=0;i<145;i++)m.applyRecommendationEvent(state,'p'+i,'view',0,2000+i);
  assert.equal(state.history.length,120);
  assert.ok(!state.history.some(x=>x.id==='one'));
});
test('public collaborative signal excludes every view, swipe and watch-time field',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const state=m.blankRecommendationState();
  const projects=[{id:'art',category:'Art',tags:['drawing']},{id:'game',category:'Game',tags:['pixel']}];
  m.applyRecommendationEvent(state,'game','view');
  m.applyRecommendationEvent(state,'game','dwell',40);
  m.applyRecommendationEvent(state,'game','swipe');
  m.applyRecommendationEvent(state,'art','like',true);
  const signals=m.publicRecommendationSignals(state,projects);
  assert.deepEqual(signals.positiveProjectIds,['art']);
  assert.ok(signals.interests.art>0);
  assert.ok(!JSON.stringify(signals).includes('game'));
  assert.ok(!JSON.stringify(signals).includes('seconds'));
});
test('tag interest ranks unseen similar content above unrelated content and preserves input',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const catalog=[
    {id:'liked',category:'Art',tags:['pixel'],views:'0'},
    {id:'unrelated',category:'Math',tags:['algebra'],views:'0'},
    {id:'similar',category:'Art',tags:['pixel'],views:'0'}
  ];
  const state=m.blankRecommendationState();
  m.applyRecommendationEvent(state,'liked','view',0,10000);
  m.applyRecommendationEvent(state,'liked','dwell',60,10000);
  m.applyRecommendationEvent(state,'liked','like',true,10000);
  const candidates=catalog.slice(1);
  const ordered=m.rankRecommendedProjects(candidates,state,[],'viewer',10000,catalog);
  assert.equal(ordered[0].id,'similar');
  assert.deepEqual(candidates.map(p=>p.id),['unrelated','similar']);
});
test('similar users positively boost unseen projects without exposing their private watch history',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const catalog=[
    {id:'liked',category:'Art',tags:['design']},
    {id:'peer-choice',category:'Tool',tags:['design']},
    {id:'unrelated',category:'Science',tags:['physics']}
  ];
  const state=m.blankRecommendationState();
  m.applyRecommendationEvent(state,'liked','like',true,10000);
  const peers=[{id:'peer',recommendationSignals:{interests:{design:8,art:4},positiveProjectIds:['peer-choice']}}];
  const ranked=m.rankRecommendedProjects(catalog.slice(1),state,peers,'viewer',10000,catalog);
  assert.equal(ranked[0].id,'peer-choice');
});


test('search exact project title stays above related personalized titles',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const catalog=[
    {id:'exact',title:'2048',category:'Game',tags:['numbers'],views:'0'},
    {id:'similar',title:'2048 Puzzle Collection',category:'Game',tags:['numbers'],views:'0'},
    {id:'unrelated',title:'Space Flight',category:'Game',tags:['space'],views:'0'}
  ];
  const state=m.blankRecommendationState();
  m.applyRecommendationEvent(state,'similar','view',0,10000);
  m.applyRecommendationEvent(state,'similar','dwell',200,10000);
  m.applyRecommendationEvent(state,'similar','like',true,10000);
  const ranked=m.rankSearchProjects('2048',catalog,state,[],'test',10000,catalog);
  assert.deepEqual(ranked.map(p=>p.id),['exact','similar']);
  assert.equal(m.searchProjectMatchStrength(catalog[2],'2048'),-1);
});
test('search uses per-user engagement and collaborative interests for equally relevant matches',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const catalog=[
    {id:'seed-art',title:'Color Forge',category:'Art',tags:['paint','canvas']},
    {id:'seed-game',title:'Arcade Starter',category:'Game',tags:['arcade','reflex']},
    {id:'pixel-art',title:'Pixel Canvas',category:'Art',tags:['paint','canvas']},
    {id:'pixel-game',title:'Pixel Arcade',category:'Game',tags:['arcade','reflex']}
  ];
  const art=m.blankRecommendationState(),game=m.blankRecommendationState();
  for(const [state,id] of [[art,'seed-art'],[game,'seed-game']]){
    m.applyRecommendationEvent(state,id,'view',0,5000);
    m.applyRecommendationEvent(state,id,'dwell',110,5000);
    m.applyRecommendationEvent(state,id,'like',true,5000);
    m.applyRecommendationEvent(state,id,'save',true,5000);
  }
  const candidates=catalog.slice(2);
  assert.equal(m.rankSearchProjects('pixel',candidates,art,[],'art-user',5000,catalog)[0].id,'pixel-art');
  assert.equal(m.rankSearchProjects('pixel',candidates,game,[],'game-user',5000,catalog)[0].id,'pixel-game');
  assert.deepEqual(candidates.map(x=>x.id),['pixel-art','pixel-game']);
  const peerSignals=[{id:'friend',recommendationSignals:{interests:{art:9,canvas:9},positiveProjectIds:['pixel-art']}}];
  assert.equal(m.rankSearchProjects('pixel',candidates,art,peerSignals,'art-user',5000,catalog)[0].id,'pixel-art');
});
test('search supports category, creator, tags, description and case insensitive text',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const projects=[
    {id:'one',title:'Sun',creator:'Nova Studio',category:'Art',desc:'Painting tools',tags:['canvas']},
    {id:'two',title:'Moon',creator:'Star Lab',category:'Game',desc:'Rocket simulator',tags:['space']},
    {id:'three',title:'Pixel',creator:'Beta',category:'Education',desc:'Orbit illustration',tags:['planet']}
  ];
  assert.deepEqual(m.rankSearchProjects('@Nova',projects,m.blankRecommendationState()).map(p=>p.id),['one']);
  assert.deepEqual(m.rankSearchProjects('SIMULATOR',projects,m.blankRecommendationState()).map(p=>p.id),['two']);
  assert.deepEqual(m.rankSearchProjects('canvas',projects,m.blankRecommendationState()).map(p=>p.id),['one']);
  assert.equal(m.rankSearchProjects('zz-no-such-project',projects,m.blankRecommendationState()).length,0);
});
test('search-open is stored in private project history but not shared to peers',async()=>{
  const m=engine||await import(pathToFileURL(path.resolve('js/recommendations.js')).href);
  const state=m.blankRecommendationState(),projects=[{id:'p',category:'Game',tags:['arcade']}];
  m.applyRecommendationEvent(state,'p','searchOpen',0,5000,{category:'Game',tags:['arcade']});
  m.applyRecommendationEvent(state,'p','searchOpen',0,5100,{category:'Game',tags:['arcade']});
  assert.equal(state.history[0].searchOpens,2);
  assert.equal(m.normalizeRecommendationState(state).history[0].searchOpens,2);
  assert.deepEqual(m.publicRecommendationSignals(state,projects).positiveProjectIds,[]);
  assert.ok(!JSON.stringify(m.publicRecommendationSignals(state,projects)).includes('searchOpens'));
});
