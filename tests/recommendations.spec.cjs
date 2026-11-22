const {test,expect}=require('@playwright/test');

test('feed exposes five upcoming projects without auto-running embedded games',async({page})=>{
  const errors=[],warmedStaticAssets=new Set();
  page.on('request',request=>{const pathname=new URL(request.url()).pathname;if(/^\/projects\/.*\.html?$/.test(pathname))warmedStaticAssets.add(pathname);});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate?.recommendations?.upcoming()?.length||0)).toBe(5);
  const before=await page.evaluate(()=>window.RapidFireTemplate.recommendations.upcoming());
  expect(new Set(before).size).toBe(5);
  await expect.poll(()=>warmedStaticAssets.size,{timeout:10000}).toBeGreaterThan(0);
  const gated=await page.locator('#feed .project').evaluateAll(elements=>elements.every(el=>el.dataset.playState==='gated'));
  expect(gated).toBe(true);
  const current=await page.evaluate(()=>window.RapidFireTemplate.recommendations.ranking()[0]);
  expect(current).toBeTruthy();
  const target=page.locator('#feed .project').nth(1);
  await target.scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>{
    const feed=document.getElementById('feed'),r=feed.getBoundingClientRect(),center=(r.top+r.bottom)/2;
    const articles=[...feed.querySelectorAll('.project')];
    return articles.reduce((best,el)=>Math.abs((el.getBoundingClientRect().top+el.getBoundingClientRect().bottom)/2-center)<best.dist?
      {id:el.dataset.projectId,dist:Math.abs((el.getBoundingClientRect().top+el.getBoundingClientRect().bottom)/2-center)}:best,{id:'',dist:Infinity}).id;
  })).toBe(await target.getAttribute('data-project-id'));
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate.recommendations.upcoming().length)).toBe(5);
  expect(errors).toEqual([]);
});


test('existing Firebase adapters remain compatible without new optional recommendation methods',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/index.html',async route=>{
    const response=await route.fetch(),html=await response.text();
    const start=html.indexOf('async function createFirebaseService'),end=html.indexOf('(() => {',start);
    const mock=String.raw;
    const shim="async function createFirebaseService(){"+
      "const empty=cb=>{cb([]);return ()=>{};};"+
      "return {onAuth:cb=>cb({uid:'legacy',displayName:'Legacy'}),"+
      "getProfile:async()=>null,upsertProfile:async p=>p,subscribeProfiles:empty,subscribeProjects:empty,"+
      "subscribeFollowing:(id,cb)=>empty(cb),setPresence:async()=>()=>{},"+
      "subscribeProjectSocial:(id,me,cb)=>{cb({likes:0,saves:0,shares:0,comments:0,likesReady:true,savesReady:true,liked:false,saved:false});return ()=>{};},"+
      "toggleProjectSocial:async()=>true};}\n";
    await route.fulfill({response,body:html.slice(0,start)+shim+html.slice(end)});
  });
  await page.goto('/index.html');
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate?.users.current()?.id)).toBe('legacy');
  await page.locator('#feed .project').first().locator('[data-like]').click();
  await page.waitForTimeout(2100);
  expect(errors).toEqual([]);
});
