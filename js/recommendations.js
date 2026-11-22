/* RapidFire personalized feed engine. Pure functions: no network, DOM or user secrets. */
export function blankRecommendationState(){ return {version:1,history:[]}; }

export function normalizeRecommendationState(value){
  const rows=Array.isArray(value?.history)?value.history:[];
  return {version:1,history:rows.filter(x=>x&&typeof x.id==='string').slice(-120).map(x=>({
    id:x.id.slice(0,180),views:Math.max(0,Number(x.views)||0),
    seconds:Math.max(0,Number(x.seconds)||0),swipes:Math.max(0,Number(x.swipes)||0),
    likes:x.likes?1:0,saves:x.saves?1:0,comments:Math.max(0,Number(x.comments)||0),
    shares:Math.max(0,Number(x.shares)||0),at:Math.max(0,Number(x.at)||0)
  }))};
}

export function applyRecommendationEvent(state,id,kind,value=0,now=Date.now()){
  if(typeof id!=='string'||!id)return state;
  let row=state.history.find(x=>x.id===id);
  if(!row){row={id,views:0,seconds:0,swipes:0,likes:0,saves:0,comments:0,shares:0,at:now};state.history.push(row);}
  if(kind==='view')row.views++;
  if(kind==='dwell')row.seconds+=Math.max(0,Math.min(3600,Number(value)||0));
  if(kind==='swipe')row.swipes++;
  if(kind==='like')row.likes=value?1:0;
  if(kind==='save')row.saves=value?1:0;
  if(kind==='comment')row.comments++;
  if(kind==='share')row.shares++;
  row.at=now;
  if(state.history.length>120)state.history.sort((a,b)=>a.at-b.at).splice(0,state.history.length-120);
  return state;
}

function terms(p){
  return [...new Set([String(p.category||'').toLowerCase(),...(p.tags||[]).map(t=>String(t).toLowerCase().replace(/^#/,''))].filter(Boolean))];
}
export function publicRecommendationSignals(state,projects){
  const byId=new Map(projects.map(p=>[p.id,p])),scores={},positive=[];
  for(const row of state.history){
    if(!(row.likes||row.saves||row.comments))continue;
    const p=byId.get(row.id);if(!p)continue;
    positive.push(row);
    for(const term of terms(p))scores[term]=(scores[term]||0)+row.likes*2+row.saves*3+Math.min(2,row.comments);
  }
  positive.sort((a,b)=>b.at-a.at);
  return {interests:Object.fromEntries(Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,16)),
    positiveProjectIds:positive.slice(0,24).map(x=>x.id)};
}
function similarity(a,b){
  const aa=a?.interests||{},bb=b?.interests||{};let dot=0,x=0,y=0;
  for(const [k,v] of Object.entries(aa)){x+=v*v;dot+=v*(Number(bb[k])||0);}
  for(const v of Object.values(bb))y+=(Number(v)||0)**2;
  return x&&y?dot/Math.sqrt(x*y):0;
}
export function rankRecommendedProjects(projects,state,profiles=[],viewerId='',now=Date.now()){
  const byId=new Map(projects.map(p=>[p.id,p])),seen=new Map(state.history.map(h=>[h.id,h])),weights={};
  for(const row of state.history){
    const p=byId.get(row.id);if(!p)continue;
    const age=Math.max(0,(now-row.at)/86400000),fresh=.3+.7*Math.exp(-age/45);
    const strength=(row.views*.22+Math.min(row.seconds,300)*.027+row.likes*3.5+row.saves*4.5
      +Math.min(row.comments,5)*2+row.shares*1.4-row.swipes*1.6)*fresh;
    for(const term of terms(p))weights[term]=(weights[term]||0)+strength;
  }
  const mine=publicRecommendationSignals(state,projects);
  const peers=profiles.filter(p=>p.id!==viewerId&&p.recommendationSignals)
    .map(p=>({signals:p.recommendationSignals,affinity:similarity(mine,p.recommendationSignals)}))
    .filter(p=>p.affinity>.04).sort((a,b)=>b.affinity-a.affinity).slice(0,24);
  const candidates=projects.map((p,index)=>{
    const row=seen.get(p.id),keywords=terms(p);
    const affinity=keywords.reduce((acc,k)=>acc+(weights[k]||0),0)/Math.sqrt(Math.max(1,keywords.length));
    const collaborative=peers.reduce((acc,peer)=>acc+
      ((peer.signals.positiveProjectIds||[]).includes(p.id)?peer.affinity*2.5:0),0);
    const popularity=Math.log1p(Math.max(0,(Number.parseFloat(p.likes)||0)+(Number.parseFloat(p.saves)||0)*1.4))*.09;
    const penalty=row?.views?Math.log1p(row.views)*.8+1.8*row.swipes/row.views:0;
    return {p,index,score:affinity*.26+collaborative+popularity+(p.trend?.18:0)+(row?.views?0:.6)-penalty};
  });
  const ordered=[],categoryCount=new Map();
  while(candidates.length){
    let pick=0,best=-Infinity;
    for(let i=0;i<candidates.length;i++){
      const row=candidates[i],candidate=row.score-.45*(categoryCount.get(row.p.category)||0);
      if(candidate>best){pick=i;best=candidate;}
    }
    const [chosen]=candidates.splice(pick,1);ordered.push(chosen.p);
    categoryCount.set(chosen.p.category,(categoryCount.get(chosen.p.category)||0)+1);
  }
  return ordered;
}
