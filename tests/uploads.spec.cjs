const {test,expect}=require('@playwright/test');
const png=Buffer.from(require('node:fs').readFileSync('js/app.js','utf8').match(/BRAND_LOGO_DATA_URL = 'data:image\/png;base64,([^']+)/)[1],'base64');
async function prepare(page){
  // Test the real application/UI with a deterministic service boundary; no live
  // account or production records are touched by these browser tests.
  await page.route('**/firebasejs/**',route=>route.abort());
  await page.route('**/index.html',async route=>{
    const response=await route.fetch();let html=await response.text();
    const start=html.indexOf('async function createFirebaseService'),end=html.indexOf('(() => {',start);
    const stub=`async function createFirebaseService(){
      const user={uid:'alice',email:'alice@example.test',emailVerified:true,displayName:'Alice'};
      const empty=(callback)=>{callback([]);return ()=>{};};
      return {checkBackendAccess:async()=>({firestore:true,realtime:true}),onAuth:cb=>cb(user),
        getProfile:async()=>null,upsertProfile:async p=>p,subscribeProfiles:empty,subscribeProjects:empty,
        subscribeFollowing:(id,cb)=>empty(cb),subscribeFollowers:(id,cb)=>empty(cb),subscribeSaved:(id,cb)=>empty(cb),subscribePosts:(id,cb)=>empty(cb),
        subscribePresence:(id,cb)=>{cb({online:false});return ()=>{}},setPresence:async()=>()=>{},
        subscribeProjectSocial:(id,me,cb)=>{cb({likes:0,saves:0,shares:0,comments:0});return ()=>{}},
        updateProfile:async(id,old,patch,avatarImage)=>{window.lastProfile={id,patch,avatarImage};if(window.failSave)throw new Error('Save failed. Try again.');return {id,...patch,avatarUrl:avatarImage||patch.avatarUrl};},
        upsertProject:async(project,extras)=>{window.lastProject={project,extras};return {...project,thumbnailUrl:extras.thumbnailImage||''};}
      };
    }\n`;
    await route.fulfill({response,body:html.slice(0,start)+stub+html.slice(end)});
  });
  await page.goto('/index.html');
  await expect.poll(()=>page.evaluate(()=>window.RapidFireTemplate?.users.current()?.id)).toBe('alice');
}
async function drop(page,id,mime='image/png',bytes=png){
  await page.locator('#'+id).evaluate((zone,{mime,base64})=>{
    const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'test-image.png',{type:mime});
    const dataTransfer=new DataTransfer();dataTransfer.items.add(file);
    zone.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer}));
    zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer}));
  },{mime,base64:bytes.toString('base64')});
}
test('thumbnail drag/drop previews, publishes, persists and hides during play',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'Publish',exact:true}).click();
  await drop(page,'thumbnailDrop');await expect(page.locator('#thumbnailStatus')).toContainText('Ready to save');
  await page.locator('#embedUrl').fill('https://example.com');await page.locator('#loadEmbedUrl').click();
  await page.locator('#projectName').fill('Upload regression');await page.locator('#publishBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.lastProject?.extras.thumbnailImage)).toMatch(/^data:image\/webp;base64,/);
  const published=page.locator('.project[data-project="Upload regression"]');
  const thumbnail=published.locator('.project-thumbnail');await expect(thumbnail).toBeVisible();
  await published.locator('[data-play]').click();
  await expect(thumbnail).toBeHidden();
});
test('profile photo uses drag/drop and survives a failed save',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByRole('button',{name:'Edit profile',exact:true}).click();
  await drop(page,'avatarDrop');await expect(page.locator('#avatarStatus')).toContainText('Ready to save');
  await page.locator('#editDisplayName').fill('Alice the Maker');
  await page.locator('#editHandle').fill('alice.unique');
  await page.evaluate(()=>{window.failSave=true;});await page.locator('#saveProfileEdit').click();
  await expect(page.locator('#profileEditModal')).toHaveClass(/open/);await expect(page.locator('#avatarPreview')).toBeVisible();
  await page.evaluate(()=>{window.failSave=false;});await page.locator('#saveProfileEdit').click();
  await expect(page.locator('#profileEditModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>window.lastProfile.avatarImage)).toMatch(/^data:image\/webp;base64,/);
  expect(await page.evaluate(()=>window.RapidFireTemplate.users.current().avatarUrl)).toBe(await page.evaluate(()=>window.lastProfile.avatarImage));
  await expect(page.locator('#profileCard h1')).toHaveText('Alice the Maker');
  await expect(page.locator('#profileCard .handle')).toHaveText('@alice.unique');
});
test('invalid files keep prior valid image; picker works with keyboard and remove',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'Publish',exact:true}).click();
  await page.locator('#thumbnailDrop').scrollIntoViewIfNeeded();
  await expect(page.locator('#thumbnailDrop')).toBeVisible();
  await page.locator('#thumbnailDrop').focus();await expect(page.locator('#thumbnailDrop')).toBeFocused();
  await page.evaluate(()=>{window.pickerEvents=[];for(const type of ['keydown','click','focusin'])document.addEventListener(type,event=>window.pickerEvents.push({type,key:event.key,target:event.target.id,active:document.activeElement?.id}),true);});
  const chooserPromise=page.waitForEvent('filechooser',{timeout:8000});
  // A keyboard action can reach Chromium before Playwright's asynchronous
  // file-chooser interception is enabled. Acknowledge it before sending Enter.
  const pickerSession=await page.context().newCDPSession(page);
  await pickerSession.send('Page.setInterceptFileChooserDialog',{enabled:true});
  await page.keyboard.press('Enter');
  let chooser;try{chooser=await chooserPromise;}catch(error){console.log('Picker diagnostics',await page.evaluate(()=>({events:window.pickerEvents,active:document.activeElement?.outerHTML,zone:document.getElementById('thumbnailDrop').outerHTML})));throw error;}
  await chooser.setFiles({name:'pixel.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('#thumbnailStatus')).toContainText('Ready to save');
  const src=await page.locator('#thumbnailPreview').getAttribute('src');
  await drop(page,'thumbnailDrop','text/plain',Buffer.from('not an image'));
  await expect(page.locator('#thumbnailStatus')).toContainText('Choose a PNG');
  await expect(page.locator('#thumbnailPreview')).toHaveAttribute('src',src);
  await page.locator('#thumbnailRemove').click();await expect(page.locator('#thumbnailPreview')).toBeHidden();
});
test('upload controls fit a narrow viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await prepare(page);
  await page.getByRole('button',{name:'Publish',exact:true}).click();await drop(page,'thumbnailDrop');
  await expect(page.locator('#thumbnailStatus')).toContainText('Ready to save');
  const box=await page.locator('#thumbnailDrop').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:'test-results/upload-mobile.png'});
});

test('invalid replacement during image preparation does not block publishing',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'Publish',exact:true}).click();
  await drop(page,'thumbnailDrop');await expect(page.locator('#thumbnailStatus')).toContainText('Ready to save');
  const original=await page.locator('#thumbnailPreview').getAttribute('src');
  await page.evaluate(()=>{const decode=window.createImageBitmap.bind(window);window.createImageBitmap=(...args)=>new Promise((resolve,reject)=>{window.finishDecode=()=>decode(...args).then(resolve,reject);});});
  await drop(page,'thumbnailDrop');await expect(page.locator('#thumbnailStatus')).toContainText('Preparing image');
  await drop(page,'thumbnailDrop','text/plain',Buffer.from('invalid'));
  await expect(page.locator('#thumbnailStatus')).toContainText('Choose a PNG');
  await page.locator('#embedUrl').fill('https://example.com');await page.locator('#loadEmbedUrl').click();
  await page.locator('#publishBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.lastProject?.extras.thumbnailImage)).toBe(original);
  await page.evaluate(()=>window.finishDecode());
});
