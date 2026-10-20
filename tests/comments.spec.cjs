const {test,expect}=require('@playwright/test');
async function prepare(page,{guest=false,error=false}={}){
 await page.route('**/firebasejs/**',r=>r.abort());
 await page.route('**/index.html',async route=>{
  const response=await route.fetch(),html=await response.text(),start=html.indexOf('async function createFirebaseService'),end=html.indexOf('(() => {',start);
  const service="async function createFirebaseService(){window.qaSubscriptions=[];window.qaWrites=[];window.qaFail="+error+";const empty=cb=>{cb([]);return ()=>{};};return {onAuth:cb=>cb("+(guest?'null':"{uid:'alice',displayName:'Alice'}")+"),getProfile:async()=>null,upsertProfile:async p=>p,subscribeProfiles:empty,subscribeProjects:empty,subscribeFollowing:(id,cb)=>empty(cb),subscribeFollowers:(id,cb)=>empty(cb),subscribeSaved:(id,cb)=>empty(cb),subscribePosts:(id,cb)=>empty(cb),subscribePresence:(id,cb)=>{cb({online:false});return ()=>{};},setPresence:async()=>()=>{},subscribeProjectSocial:(id,me,cb)=>{cb({likes:0,saves:0,shares:0,comments:0});return ()=>{};},subscribeProjectComments:(id,cb,onError)=>{const e={id,cb,onError,closed:false};window.qaSubscriptions.push(e);if(window.qaFail)onError({code:'permission-denied'});else cb([]);return ()=>{e.closed=true;};},createComment:(id,author,text)=>new Promise((resolve,reject)=>window.qaWrites.push({id,author,text,resolve,reject}))};}\n";
  await route.fulfill({response,body:html.slice(0,start)+service+html.slice(end)});
 });await page.goto('/index.html');if(!guest)await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate?.users.current()?.id)).toBe('alice');
}
test('sidebar error retries; guests read and close with keyboard',async({page})=>{
 await prepare(page,{guest:true,error:true});const button=page.locator('.project').first().locator('[data-comment]');await button.click();await expect(page.locator('#commentsList')).toContainText('blocked by Firebase rules');await expect(page.locator('#commentText')).toBeDisabled();
 await page.evaluate(()=>{window.qaFail=false;});await page.locator('#retryComments').click();await expect(page.locator('#commentsList')).toContainText('No comments yet');await page.keyboard.press('Escape');await expect(button).toBeFocused();expect(await page.locator('#app').evaluate(e=>e.inert)).toBe(false);
});
test('pending writes prevent duplicate comments; failures retain drafts; project switches reject stale responses',async({page})=>{
 await prepare(page);const first=page.locator('.project').first(),firstId=await first.getAttribute('data-project-id');
 await first.locator('[data-comment]').click();await page.locator('#commentText').fill('First draft');await page.locator('#commentText').press('Control+Enter');await page.locator('#commentText').press('Control+Enter');expect(await page.evaluate(()=>window.qaWrites.length)).toBe(1);
 await page.evaluate(()=>window.qaSubscriptions.at(-1).cb([{id:'other',authorProfileId:'bob',text:'Live comment',at:1}]));await expect(page.locator('#commentSubmit')).toBeDisabled();
 await page.evaluate(()=>window.qaWrites[0].reject(new Error('Disconnected')));await expect(page.locator('#commentSubmit')).toBeEnabled();await expect(page.locator('#commentText')).toHaveValue('First draft');
 await page.locator('#commentSubmit').click();await page.keyboard.press('Escape');const second=page.locator('.project').nth(1);await second.scrollIntoViewIfNeeded();await second.locator('[data-comment]').click();await page.locator('#commentText').fill('Second project draft');
 await page.evaluate(()=>{window.qaWrites[1].resolve();window.qaSubscriptions[0].cb([{id:'stale',authorProfileId:'bob',text:'Stale project content',at:1}]);});await expect(page.locator('#commentText')).toHaveValue('Second project draft');await expect(page.locator('#commentsList')).not.toContainText('Stale project content');expect(await page.evaluate(()=>window.qaWrites[1].id)).toBe(firstId);expect(await page.evaluate(()=>window.qaSubscriptions[0].closed)).toBe(true);
});
