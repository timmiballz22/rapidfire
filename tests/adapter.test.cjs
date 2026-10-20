const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url');
const {signInAnonymously}=require('firebase/auth');
test('real Firebase adapter persists profile images and thumbnail/HTML projects on Spark',async()=>{
  await fs.mkdir('test-results',{recursive:true});
  let source=await fs.readFile('js/firebase-service.js','utf8');
  const names={app:'app',auth:'auth',firestore:'firestore',database:'database',storage:'storage'};
  for(const name of Object.keys(names))source=source.replace(`import(sdk('firebase-${name}'))`,`import('firebase/${name}')`);
  source=source.replace("  if (location.protocol",`  authMod.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  fsMod.connectFirestoreEmulator(firestore,'127.0.0.1',8080);
  dbMod.connectDatabaseEmulator(realtime,'127.0.0.1',9000);
  if (location.protocol`);
  const path='test-results/adapter-under-test.mjs';await fs.writeFile(path,source);
  global.location={protocol:'http:',hostname:'localhost'};
  const {createFirebaseService}=await import(pathToFileURL(require('node:path').resolve(path)).href);
  const api=await createFirebaseService({apiKey:'fake-key',projectId:'demo-rapidfire',databaseURL:'https://demo-rapidfire.firebaseio.com',storageBucket:'demo-rapidfire.appspot.com'});
  try{
    const {user}=await signInAnonymously(api.auth),id=user.uid;
    const saved=await api.upsertProfile({id,authUid:id,handle:id,displayName:'Adapter test'});
    assert.equal(saved.authUid,id);
    const image='data:image/webp;base64,'+'A'.repeat(10000);
    await api.updateProfile(id,saved.handle,{displayName:'Updated',handle:id,bio:'Hi',avatarUrl:''},image);
    assert.equal((await api.getProfile(id)).avatarUrl,image);
    const html='<html><body>'+('🧪'.repeat(160001))+'</body></html>';
    const project=await api.upsertProject({id:id+'-html',ownerUserId:id,title:'Source test',sourceType:'html'},{html,thumbnailImage:image});
    assert.match(project.contentUrl,/^firestore:/);assert.equal(project.thumbnailUrl,image);
    assert.equal(await api.getProjectHTML(project.contentUrl),html);
    const {getDoc,doc}=await import('firebase/firestore');
    const persisted=(await getDoc(doc(api.firestore,'projects',id+'-html'))).data();
    assert.ok(persisted.createdAt);assert.equal(persisted.thumbnailUrl,image);
    await api.createPost(id,'Adapter post');
    await api.toggleProjectSocial('saves',project.id,id);
    let unsubscribeSocial;
    try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Social subscription did not emit saved count.')),5000);unsubscribeSocial=api.subscribeProjectSocial(project.id,id,state=>{if(state.saves===1){clearTimeout(timeout);resolve();}},reject);});}
    finally{unsubscribeSocial?.();}
    const comment=await api.createComment(project.id,id,'Adapter comment');await api.deleteComment(project.id,comment);
    await api.deleteProject(project);assert.equal((await getDoc(doc(api.firestore,'projects',project.id))).exists(),false);
  }finally{
    await (await import('firebase/auth')).signOut(api.auth);
    await (await import('firebase/firestore')).terminate(api.firestore);
    (await import('firebase/database')).goOffline(api.realtime);
    await (await import('firebase/app')).deleteApp(api.app);
  }
});
