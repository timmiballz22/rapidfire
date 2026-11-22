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
