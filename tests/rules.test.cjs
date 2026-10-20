const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,deleteDoc,writeBatch,collection,getDocs}=require('firebase/firestore');
const {ref,set,get,update,push}=require('firebase/database');
let env;
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-rapidfire',firestore:{rules:fs.readFileSync('firestore.rules','utf8')},database:{rules:fs.readFileSync('database.rules.json','utf8')},storage:{rules:fs.readFileSync('storage.rules','utf8')}});
});
after(async()=>env?.cleanup());
async function profile(id,claims={}){
  const db=env.authenticatedContext(id,claims).firestore(),batch=writeBatch(db);
  batch.set(doc(db,'users',id),{id,authUid:id,handle:id,handleLower:id,displayName:id});
  batch.set(doc(db,'handles',id),{profileId:id});await assertSucceeds(batch.commit());return db;
}
test('profile+handle transactions, edits and public reads work',async()=>{
  const db=await profile('alice');
  await assertSucceeds(updateDoc(doc(db,'users','alice'),{bio:'School project',avatarUrl:'data:image/webp;base64,AAA='}));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'users','alice')));
  const batch=writeBatch(db);batch.set(doc(db,'handles','alice-new'),{profileId:'alice'});batch.update(doc(db,'users','alice'),{handle:'alice-new',handleLower:'alice-new'});batch.delete(doc(db,'handles','alice'));await assertSucceeds(batch.commit());
});
test('forged account IDs, auth UID changes and handle claims fail',async()=>{
  const bob=await profile('bob'),alice=env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(alice,'users','bob'),{id:'bob',authUid:'alice',handle:'bob',handleLower:'bob'}));
  await assertFails(updateDoc(doc(alice,'users','alice'),{authUid:'bob'}));
  await assertFails(updateDoc(doc(alice,'users','alice'),{handle:'bob',handleLower:'bob'}));
  await assertFails(setDoc(doc(alice,'handles','bob'),{profileId:'alice'}));
  await assertFails(deleteDoc(doc(alice,'users','bob')));
  await assertFails(setDoc(doc(alice,'users','user-maxp'),{id:'user-maxp',authUid:'alice',handle:'MaxP',handleLower:'maxp'}));
  assert.equal((await getDoc(doc(bob,'handles','bob'))).data().profileId,'bob');
});
test('own projects, source chunks, posts and more than five writes work; other owners stay protected',async()=>{
  const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(alice,'projects','demo'),{id:'demo',ownerUserId:'alice',published:false}));
  await assertSucceeds(setDoc(doc(alice,'projects','demo','source','part'),{ownerUserId:'alice',version:'v1',index:0,source:'<h1>Hello</h1>'}));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'projects','demo','source','part')));
  await assertSucceeds(updateDoc(doc(alice,'projects','demo'),{published:true,sourceVersion:'v1',title:'Demo',thumbnailUrl:'data:image/webp;base64,AAA='}));
  for(let i=0;i<6;i++)await assertSucceeds(setDoc(doc(alice,'posts','post'+i),{id:'post'+i,ownerUserId:'alice',text:'Post '+i}));
  await assertFails(updateDoc(doc(bob,'projects','demo'),{ownerUserId:'bob'}));
  await assertFails(deleteDoc(doc(bob,'projects','demo')));
  await assertFails(setDoc(doc(bob,'projects','demo','source','attack'),{ownerUserId:'bob',source:'replacement'}));
  await assertFails(updateDoc(doc(bob,'posts','post0'),{text:'Forged'}));
  await assertFails(setDoc(doc(bob,'posts','fake'),{id:'fake',ownerUserId:'alice',text:'Forged'}));
  const {query,where}=require('firebase/firestore');
  await assertSucceeds(getDocs(query(collection(env.unauthenticatedContext().firestore(),'projects','demo','source'),where('version','==','v1'))));
  await assertSucceeds(setDoc(doc(alice,'projects','demo','source','draft'),{ownerUserId:'alice',version:'v2',index:0,source:'Unpublished revision'}));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'projects','demo','source','draft')));
  await assertFails(deleteDoc(doc(alice,'handles','alice-new')));
  await assertSucceeds(deleteDoc(doc(alice,'projects','demo','source','part')));await assertSucceeds(deleteDoc(doc(alice,'projects','demo')));
});
test('Realtime social writes, follow mirrors, comments and own saves work',async()=>{
  const alice=env.authenticatedContext('alice').database(),bob=env.authenticatedContext('bob').database();
  await assertSucceeds(update(ref(alice),{'social/projects/demo/likes/alice':{at:1},'social/projects/demo/saves/alice':{at:1},'social/users/alice/saved/demo':{at:1},'social/users/alice/following/bob':{at:1},'social/users/bob/followers/alice':{at:1}}));
  const comment=push(ref(alice,'social/projects/demo/comments'));await assertSucceeds(set(comment,{authorProfileId:'alice',text:'A comment',at:1}));
  await assertFails(set(ref(bob,'social/projects/demo/comments/'+comment.key),{authorProfileId:'bob',text:'Forged',at:1}));
  await assertFails(set(ref(bob,'social/projects/demo/likes/alice'),null));
  await assertFails(set(ref(bob,'social/users/alice/saved/demo'),null));
  await assertFails(get(ref(bob,'social/users/alice/saved')));
  await assertSucceeds(get(ref(alice,'social/users/alice/saved')));
  await assertFails(set(ref(alice,'social/projects/demo/comments/forged'),{authorProfileId:'bob',text:'Forged',at:1}));
  await assertFails(update(comment,{authorProfileId:'bob'}));
  await assertFails(set(ref(bob,'social/projects/demo/comments/'+comment.key),null));
  await assertSucceeds(set(comment,null));
  await assertSucceeds(set(ref(alice,'presence/alice'),{online:true,lastChanged:1}));
  await assertFails(set(ref(bob,'presence/alice'),{online:false}));
});
test('authenticated REST POSTs are accepted beyond five and cannot forge authors',async()=>{
  const signup=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  const {idToken,localId}=await signup.json();assert.ok(idToken);
  const url='http://127.0.0.1:9000/social/projects/rest/comments.json?ns=demo-rapidfire&auth='+idToken;
  for(let i=0;i<6;i++){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({authorProfileId:localId,text:'REST post',at:1})});assert.equal(response.status,200);}
  const forged=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({authorProfileId:'bob',text:'Forged',at:1})});assert.equal(forged.status,401);
});
test('MaxP identity requires the verified existing email',async()=>{
  const valid=env.authenticatedContext('maxp-auth',{email:'timmiballz22@gmail.com',email_verified:true}).firestore();
  const batch=writeBatch(valid);batch.set(doc(valid,'users','user-maxp'),{id:'user-maxp',authUid:'maxp-auth',handle:'MaxP',handleLower:'maxp'});batch.set(doc(valid,'handles','maxp'),{profileId:'user-maxp'});await assertSucceeds(batch.commit());
  const unverified=env.authenticatedContext('someone',{email:'timmiballz22@gmail.com',email_verified:false}).firestore();
  await assertFails(updateDoc(doc(unverified,'users','user-maxp'),{bio:'Forged'}));
});
test('optional Storage rules permit own files and deny cross-account overwrite/delete',async()=>{
  const {ref:storageRef,uploadBytes,deleteObject}=require('firebase/storage');
  const alice=env.authenticatedContext('alice').storage(),bob=env.authenticatedContext('bob').storage();
  await assertSucceeds(uploadBytes(storageRef(alice,'avatars/alice/photo'),new Uint8Array([1,2,3])));
  await assertFails(uploadBytes(storageRef(bob,'avatars/alice/photo'),new Uint8Array([4])));
  await assertFails(deleteObject(storageRef(bob,'avatars/alice/photo')));
  await assertSucceeds(deleteObject(storageRef(alice,'avatars/alice/photo')));
});
