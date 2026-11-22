const {test,expect}=require('@playwright/test');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const htmlSource=readFileSync(resolve('index.html'),'utf8');

test('Search shows personalized suggestions, prewarms project sources and opens correct preview',async({page})=>{
  const errors=[],assetRequests=new Set();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(/^\/projects\/.*\.html?$/.test(path))assetRequests.add(path);});
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#searchContent .section-label').first()).toHaveText('For you');
  await expect(page.locator('#searchContent .result-card')).toHaveCount(10);
  await expect.poll(()=>assetRequests.size,{timeout:10000}).toBeGreaterThan(0);
  expect(await page.locator('#feed .project[data-play-state="playing"]').count()).toBe(0);
  await page.locator('#searchInput').fill('2048');
  await expect(page.locator('#searchContent .result-card').first()).toHaveAttribute('data-project-id','default-2048');
  await page.locator('#searchContent .result-card').first().click();
  await expect(page.locator('#homeScreen')).toHaveClass(/active/);
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate.recommendations.state().history.find(h=>h.id==='default-2048')?.searchOpens||0)).toBe(1);
  await expect(page.locator('#feed [data-project-id="default-2048"]')).toHaveAttribute('data-play-state','gated');
  expect(errors).toEqual([]);
});

test('Search opens by stable project ID instead of confusing identically titled projects',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  await page.evaluate(()=>{
    for(const id of ['duplicate-project-one','duplicate-project-two'])
      window.RapidFireTemplate.addProject({id,title:'Duplicate Sample',creator:id,category:'Tool',tags:['sample'],desc:'Test identity',type:'rizz'});
  });
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.locator('#searchInput').fill('Duplicate Sample');
  await expect(page.locator('#searchContent .result-card')).toHaveCount(2);
  const target=page.locator('#searchContent [data-project-id="duplicate-project-two"]');
  await target.click();
  await expect(page.locator('#homeScreen')).toHaveClass(/active/);
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate.recommendations.state().history.find(h=>h.id==='duplicate-project-two')?.searchOpens||0)).toBe(1);
  expect(errors).toEqual([]);
});

test('different signed-in users get different personalized Search ordering from the same engine',async({browser})=>{
  for(const [seed,expected] of [['color','search-art'],['dash','search-game']]){
    const context=await browser.newContext();
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const history={version:1,history:[{
      id:seed,views:2,seconds:150,swipes:0,likes:1,saves:1,comments:1,shares:0,at:Date.now(),
      metadata:seed==='color'?{category:'Art',tags:['color','design']}:{category:'Game',tags:['arcade','rhythm']}
    }]};
    const shim='async function createFirebaseService(){'+
      'const empty=cb=>{cb([]);return ()=>{};};'+
      'return {onAuth:cb=>{queueMicrotask(()=>cb({uid:"'+expected+'",displayName:"Tester"}));return ()=>{};},'+
      'getProfile:async()=>null,upsertProfile:async p=>p,subscribeProfiles:empty,subscribeProjects:empty,'+
      'subscribeFollowing:(id,cb)=>empty(cb),setPresence:async()=>()=>{},'+
      'subscribeProjectSocial:(id,me,cb)=>{cb({likes:0,saves:0,shares:0,comments:0,liked:false,saved:false});return ()=>{};},'+
      'loadRecommendationState:async()=>('+JSON.stringify(history)+'),'+
      'saveRecommendationState:async()=>{},saveRecommendationSignals:async()=>{}};}\n';
    const start=htmlSource.indexOf('async function createFirebaseService'),end=htmlSource.indexOf('(() => {',start);
    expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
    await page.route('**/index.html',route=>route.fulfill({
      status:200,contentType:'text/html; charset=utf-8',
      body:htmlSource.slice(0,start)+shim+htmlSource.slice(end)
    }));
    await page.goto('/index.html');
    await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate?.recommendations.state().history.some(h=>h.likes===1))).toBe(true);
    await page.evaluate(()=>{
      window.RapidFireTemplate.addProject({id:'search-art',title:'Canvas Dreams',creator:'Artist',category:'Art',tags:['color','design'],desc:'Creative',type:'rizz'});
      window.RapidFireTemplate.addProject({id:'search-game',title:'Canvas Arcade',creator:'Player',category:'Game',tags:['arcade','rhythm'],desc:'Play arcade',type:'rizz'});
    });
    await page.getByRole('button',{name:'Search',exact:true}).click();
    await page.locator('#searchInput').fill('Canvas');
    await expect.poll(()=>page.locator('#searchContent .result-card').first().getAttribute('data-project-id')).toBe(expected);
    expect(errors).toEqual([]);
    await context.close();
  }
});
