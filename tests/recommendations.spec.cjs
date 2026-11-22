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
