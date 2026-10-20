const {test,expect}=require('@playwright/test');
const catalog=require('../projects/defaults/catalog.json');
test('starter projects have credits without impersonating accounts, and stay gated',async({page})=>{
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  for(const entry of catalog){
    const article=page.locator(`[data-project-id="${entry.id}"]`);
    await expect(article.locator('.creator-name')).toHaveText('Project Embedded');
    await expect(article.locator('[data-open-profile],[data-follow]')).toHaveCount(0);
    await expect(article.locator('iframe')).toHaveAttribute('src','about:blank');
  }
  const flash=page.locator('[data-project-id="default-flxinvaders"]');
  await flash.locator('[data-info]').click();
  await expect(page.locator('#infoCreator')).toContainText('Adam Saltsman');
  await expect(page.locator('#infoExtra a').first()).toHaveAttribute('href','https://github.com/AdamAtomic/Flx-Invaders');
  await expect(page.locator('#infoExtra')).toContainText('MIT');
  await page.locator('#closeInfo').click();
  await page.route('**/projects/defaults/flxinvaders.html',r=>r.fulfill({contentType:'text/html',body:'<h1>Flash runner</h1>'}));
  await flash.locator('[data-play]').click();
  await expect(flash.locator('iframe')).toHaveAttribute('src','projects/defaults/flxinvaders.html');
  expect(await flash.locator('iframe').getAttribute('sandbox')).not.toContain('allow-same-origin');
  await flash.locator('[data-stop-play]').click();
  await expect(flash.locator('iframe')).toHaveAttribute('src','about:blank');
  await page.locator('[data-nav="search"]').first().click();
  await page.locator('#searchInput').fill('Adam Saltsman');
  await expect(page.locator('.result-card')).toHaveCount(3);
  await expect(page.locator('.user-result-card')).toHaveCount(0);
});
test('local 2048 is playable in its isolated frame and Escape unloads it',async({page})=>{
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  const article=page.locator('[data-project-id="default-2048"]');
  await article.scrollIntoViewIfNeeded();await article.locator('[data-play]').click();
  const game=page.frameLocator('iframe[title="2048"]');
  await expect(game.locator('.tile')).toHaveCount(2);
  await game.locator('body').click({position:{x:10,y:10}});
  for(const key of ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'])await page.keyboard.press(key);
  await expect.poll(()=>game.locator('.tile').count()).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  await expect(article.locator('iframe')).toHaveAttribute('src','about:blank');
});
test('local Hextris starts, responds to rotation, and unloads with Escape',async({page})=>{
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.goto('/index.html');
  const article=page.locator('[data-project-id="default-hextris"]');
  await article.scrollIntoViewIfNeeded();await article.locator('[data-play]').click();
  await page.frameLocator('iframe[title="Hextris"]').locator('#startBtn').click();
  const frame=page.frames().find(f=>f.url().endsWith('/hextris/index.html'));
  await expect.poll(()=>frame.evaluate(()=>gameState)).toBe(1);
  // The game intentionally ignores input during its initial rotation cooldown.
  await expect.poll(()=>frame.evaluate(()=>Date.now()-MainHex.lastRotate)).toBeGreaterThan(80);
  const prior=await frame.evaluate(()=>MainHex.position);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(()=>frame.evaluate(()=>MainHex.position)).not.toBe(prior);
  await page.keyboard.press('Escape');
  await expect(article.locator('iframe')).toHaveAttribute('src','about:blank');
});
