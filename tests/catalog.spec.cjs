const {test,expect}=require('@playwright/test');
const catalog=require('../projects/defaults/catalog.json');
for(const entry of catalog)test('embedded project runs and unloads: '+entry.title,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/firebasejs/**',r=>r.abort());await page.goto('/index.html');
  const article=page.locator('[data-project-id="'+entry.id+'"]');
  await article.scrollIntoViewIfNeeded();
  await expect.poll(()=>article.evaluate(el=>{const box=el.getBoundingClientRect(),root=document.getElementById('feed').getBoundingClientRect();return Math.max(0,Math.min(box.bottom,root.bottom)-Math.max(box.top,root.top))/box.height;})).toBeGreaterThan(0.9);
  await article.locator('[data-play]').click();
  const frame=article.frameLocator('iframe');
  if(entry.sourceType==='flash'){
    await expect(frame.locator('body')).toHaveAttribute('data-ready','true',{timeout:30000});
    await expect(frame.locator('ruffle-player')).toBeVisible();await expect(frame.locator('canvas')).toBeVisible();
  }else if(entry.id==='default-2048')await expect(frame.locator('.tile')).toHaveCount(2);
  else if(entry.id==='default-0hh1'){
    await expect(frame.locator('#title')).toBeVisible();
    const gamePage=page.frames().find(f=>f.url().endsWith('/0hh1/index.html'));
    await expect.poll(()=>gamePage.evaluate(()=>app.started)).toBe(true);
    await expect(frame.locator('#title')).not.toHaveClass(/show01/);
    await frame.locator('[data-action="close-titleScreen"]').click();await expect(frame.locator('#game')).toBeVisible();
  }else {
    // Hosted Chromium compiles WebGL shaders in software; cold startup can take 10–20 seconds.
    await expect(frame.locator('canvas').first()).toBeVisible({timeout:30000});
  }
  await article.screenshot({path:'test-results/catalog-'+entry.id+'.png'});
  await article.locator('[data-stop-play]').click();await expect(article.locator('iframe')).toHaveAttribute('src','about:blank');expect(errors).toEqual([]);
});
