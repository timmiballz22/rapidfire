/* RapidFire production core bundle: UI boots independently; Firebase connects asynchronously. */
const SDK_VERSION = '12.19.0';
const sdk = name => `https://www.gstatic.com/firebasejs/${SDK_VERSION}/${name}.js`;

function key(value){
  return String(value || '').replace(/[.#$\[\]/]/g, '_').slice(0, 180);
}
function normalizeHandle(value){
  return String(value || '').trim().replace(/^@+/, '').replace(/\s+/g, '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 28);
}

export async function createFirebaseService(firebaseConfig, options={}){
  const timeoutMs = Math.max(1500, Number(options.timeoutMs || 8000));
  const load = Promise.all([
    import(sdk('firebase-app')),
    import(sdk('firebase-auth')),
    import(sdk('firebase-firestore')),
    import(sdk('firebase-database')),
    import(sdk('firebase-storage'))
  ]);
  let timeoutId = 0;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Firebase SDK load timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  let modules;
  try { modules = await Promise.race([load, timeout]); }
  finally { clearTimeout(timeoutId); }
  const [appMod, authMod, fsMod, dbMod, storageMod] = modules;

  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(()=>{});
  const firestore = fsMod.getFirestore(app);
  const realtime = dbMod.getDatabase(app);
  const storage = storageMod.getStorage(app, `gs://${firebaseConfig.storageBucket}`);

  if (location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    import(sdk('firebase-analytics')).then(async analyticsMod => {
      try { if (await analyticsMod.isSupported()) analyticsMod.getAnalytics(app); } catch (_) {}
    }).catch(()=>{});
  }

  const googleProvider = new authMod.GoogleAuthProvider();
  googleProvider.setCustomParameters({prompt:'select_account'});

  const api = {
    app, auth, firestore, realtime, storage,
    onAuth(callback){ return authMod.onAuthStateChanged(auth, callback); },
    async signInGoogle(){
      try {
        return (await authMod.signInWithPopup(auth, googleProvider)).user;
      } catch (error) {
        const code=String(error?.code||'');
        if (['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(code)) {
          await authMod.signInWithRedirect(auth, googleProvider);
          return null;
        }
        throw error;
      }
    },
    async signOut(){ return authMod.signOut(auth); },
    async checkBackendAccess(){
      const result={firestore:false,realtime:false,errors:{}};
      try{await fsMod.getDocs(fsMod.query(fsMod.collection(firestore,'users'),fsMod.limit(1)));result.firestore=true;}catch(error){result.errors.firestore=error;}
      try{await dbMod.get(dbMod.ref(realtime,'social/projects/__health__/likes'));result.realtime=true;}catch(error){result.errors.realtime=error;}
      return result;
    },

    async upsertProfile(profile){
      const userRef=fsMod.doc(firestore,'users',profile.id);
      await fsMod.runTransaction(firestore,async tx=>{
        const existing=await tx.get(userRef);
        const current=existing.exists()?existing.data():null;
        const authUid=auth.currentUser?.uid||'';
        if(!authUid)throw new Error('Sign in to continue.');
        let handle=normalizeHandle(current?.handle||profile.handle)||`user-${String(authUid||'user').slice(0,6)}`;
        if(handle.toLowerCase()==='maxp'&&profile.id!=='user-maxp') handle=normalizeHandle(`${handle}-${String(authUid||'user').slice(0,6)}`);
        let handleRef=fsMod.doc(firestore,'handles',handle.toLowerCase());
        let handleSnap=await tx.get(handleRef);
        if(handleSnap.exists()&&handleSnap.data().profileId!==profile.id){
          handle=normalizeHandle(`${handle}-${String(authUid||'user').slice(0,6)}`);
          handleRef=fsMod.doc(firestore,'handles',handle.toLowerCase());
          handleSnap=await tx.get(handleRef);
          if(handleSnap.exists()&&handleSnap.data().profileId!==profile.id) throw new Error('Could not reserve a unique handle.');
        }
        const payload={
          id:profile.id,
          handle,
          handleLower:handle.toLowerCase(),
          displayName:String(current?.displayName||profile.displayName||handle).trim().slice(0,50),
          bio:String(current?.bio??profile.bio??'').trim().slice(0,180),
          avatarUrl:String(current?.avatarUrl??profile.avatarUrl??'').trim(),
          authUid,
          createdAt:current?.createdAt||fsMod.serverTimestamp(),
          updatedAt:fsMod.serverTimestamp()
        };
        // Full replacement deliberately strips legacy/unknown fields so old profile
        // documents cannot make the current strict schema fail during Google login.
        tx.set(handleRef,{profileId:profile.id,updatedAt:fsMod.serverTimestamp()});
        tx.set(userRef,payload);
      });
      const resolved=await fsMod.getDoc(userRef);
      return resolved.exists()?{id:resolved.id,...resolved.data()}:profile;
    },
    subscribeProfiles(callback, onError=()=>{}){
      const q = fsMod.query(fsMod.collection(firestore,'users'), fsMod.limit(250));
      return fsMod.onSnapshot(q, snap => callback(snap.docs.map(d=>({id:d.id,...d.data()}))), onError);
    },
    async getProfile(profileId){
      const snap = await fsMod.getDoc(fsMod.doc(firestore,'users',profileId));
      return snap.exists()?{id:snap.id,...snap.data()}:null;
    },
    async updateProfile(profileId, oldHandle, patch, avatarImage){
      const desired = normalizeHandle(patch.handle);
      if (!desired) throw new Error('Handle must contain letters or numbers.');
      if(desired.toLowerCase()==='maxp' && profileId!=='user-maxp') throw new Error('That handle is reserved.');
      const userRef = fsMod.doc(firestore,'users',profileId);
      const newHandleRef = fsMod.doc(firestore,'handles',desired.toLowerCase());
      const oldLower = normalizeHandle(oldHandle).toLowerCase();
      await fsMod.runTransaction(firestore, async tx => {
        const newSnap = await tx.get(newHandleRef);
        if (newSnap.exists() && newSnap.data().profileId !== profileId) throw new Error('That handle is already taken.');
        let oldRef=null, oldSnap=null;
        if(oldLower && oldLower !== desired.toLowerCase()){
          oldRef = fsMod.doc(firestore,'handles',oldLower);
          oldSnap = await tx.get(oldRef);
        }
        tx.set(newHandleRef,{profileId,updatedAt:fsMod.serverTimestamp()},{merge:true});
        if(oldRef && oldSnap?.exists() && oldSnap.data().profileId === profileId) tx.delete(oldRef);
        tx.set(userRef,{
          handle:desired,
          handleLower:desired.toLowerCase(),
          displayName:String(patch.displayName||desired).trim().slice(0,50),
          bio:String(patch.bio||'').trim().slice(0,180),
          avatarUrl:String(avatarImage||patch.avatarUrl||'').trim(),
          updatedAt:fsMod.serverTimestamp()
        },{merge:true});
      });
      return {...patch,id:profileId,handle:desired,avatarUrl:avatarImage||patch.avatarUrl||''};
    },

    subscribeProjects(callback, onError=()=>{}){
      const q = fsMod.query(fsMod.collection(firestore,'projects'), fsMod.where('published','==',true), fsMod.orderBy('createdAt','desc'), fsMod.limit(100));
      return fsMod.onSnapshot(q, snap => callback(snap.docs.map(d=>({id:d.id,...d.data()}))), onError);
    },
    async upsertProject(project,extras={}){
      if(extras.html){Object.assign(project,await api.publishHtml({ownerUserId:project.ownerUserId,projectId:project.id,html:extras.html}));}
      if(extras.thumbnailImage)project.thumbnailUrl=extras.thumbnailImage;
      const payload = {
        id:project.id,
        ownerUserId:project.ownerUserId,
        title:project.title,
        desc:project.desc||'',
        tags:Array.isArray(project.tags)?project.tags.slice(0,8):[],
        category:project.category||'Project',
        sourceType:project.sourceType||project.type||'embed',
        contentUrl:project.contentUrl||'',
        embedUrl:project.embedUrl||'',
        storagePath:project.storagePath||'',
        thumbnailUrl:project.thumbnailUrl||'',
        createdAt: project.createdAt instanceof Date ? project.createdAt : fsMod.serverTimestamp(),
        updatedAt:fsMod.serverTimestamp(),
        published:true
      };
      const projectRef=fsMod.doc(firestore,'projects',project.id);
      const existing=await fsMod.getDoc(projectRef);
      if(existing.exists()&&existing.data().createdAt) delete payload.createdAt;
      await fsMod.setDoc(projectRef,payload,{merge:true});
      return {...payload,createdAt:existing.data()?.createdAt?.toMillis?.()||Date.now()};
    },
    async publishHtml({ownerUserId, projectId, html}){
      // Spark-compatible hosting: source parts stay under Firestore's document
      // size limit. A parent owner reservation prevents cross-account uploads.
      const projectRef=fsMod.doc(firestore,'projects',projectId),version=crypto.randomUUID();
      await fsMod.runTransaction(firestore,async tx=>{
        const old=await tx.get(projectRef);
        if(old.exists()&&old.data().ownerUserId!==ownerUserId)throw new Error('This project belongs to another account.');
        if(!old.exists())tx.set(projectRef,{id:projectId,ownerUserId,published:false});
      });
      // Code points avoid splitting surrogate pairs. <= 150k characters is
      // <= 600k UTF-8 bytes, leaving room for document fields and indexes.
      const points=Array.from(html),parts=[];
      for(let offset=0;offset<points.length;offset+=150000)parts.push(points.slice(offset,offset+150000).join(''));
      for(let offset=0;offset<parts.length;offset+=10){
        const batch=fsMod.writeBatch(firestore);
        parts.slice(offset,offset+10).forEach((source,i)=>batch.set(fsMod.doc(firestore,'projects',projectId,'source',`${version}-${String(offset+i).padStart(6,'0')}`),{ownerUserId,version,index:offset+i,source}));
        await batch.commit();
      }
      return {contentUrl:`firestore:${projectId}:${version}`,storagePath:''};
    },
    async getProjectHTML(contentUrl){
      const [,projectId,version]=contentUrl.split(':');
      const rows=await fsMod.getDocs(fsMod.query(fsMod.collection(firestore,'projects',projectId,'source'),fsMod.where('version','==',version)));
      if(rows.empty)throw new Error('Project source is not available yet.');
      return rows.docs.map(d=>d.data()).sort((a,b)=>a.index-b.index).map(row=>row.source).join('');
    },
    async deleteProject(project){
      const source=await fsMod.getDocs(fsMod.collection(firestore,'projects',project.id,'source'));
      for(let offset=0;offset<source.docs.length;offset+=400){const batch=fsMod.writeBatch(firestore);source.docs.slice(offset,offset+400).forEach(doc=>batch.delete(doc.ref));await batch.commit();}
      await fsMod.deleteDoc(fsMod.doc(firestore,'projects',project.id));
      if(project.storagePath){
        try{ await storageMod.deleteObject(storageMod.ref(storage,project.storagePath)); }catch(_){}
      }
    },

    async syncBuiltins(projects){for(const project of projects)await api.upsertProject(project);},
    subscribePosts(profileId, callback, onError=()=>{}){
      const q=fsMod.query(fsMod.collection(firestore,'posts'),fsMod.where('ownerUserId','==',profileId),fsMod.orderBy('createdAt','desc'),fsMod.limit(50));
      return fsMod.onSnapshot(q,snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
    },
    async createPost(profileId,text){
      const ref=fsMod.doc(fsMod.collection(firestore,'posts'));
      await fsMod.setDoc(ref,{id:ref.id,ownerUserId:profileId,text:String(text||'').trim().slice(0,280),createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});
      return ref.id;
    },
    async deletePost(postId){ await fsMod.deleteDoc(fsMod.doc(firestore,'posts',postId)); },

    subscribeProjectSocial(projectId, currentProfileId, callback, onError=()=>{}){
      const p=key(projectId), u=key(currentProfileId||'');
      const state={likes:0,saves:0,shares:0,comments:0,liked:false,saved:false,shared:false};
      const emit=()=>callback({...state});
      const unsubs=[];
      for(const kind of ['likes','saves','shares','comments']){
        const r=dbMod.ref(realtime,`social/projects/${p}/${kind}`);
        unsubs.push(dbMod.onValue(r,snap=>{
          state[kind]=snap.size;
          if(kind!=='comments'){
            const singular=kind==='likes'?'liked':kind==='saves'?'saved':'shared';
            state[singular]=u? snap.hasChild(u):false;
          }
          emit();
        },onError));
      }
      return ()=>unsubs.forEach(fn=>{try{fn();}catch(_){} });
    },
    async toggleProjectSocial(kind,projectId,profileId){
      if(!['likes','saves','shares'].includes(kind)) throw new Error('Unsupported social action');
      const p=key(projectId),u=key(profileId);
      const target=dbMod.ref(realtime,`social/projects/${p}/${kind}/${u}`);
      const snap=await dbMod.get(target);
      const next=!snap.exists();
      const updates={};
      updates[`social/projects/${p}/${kind}/${u}`]=next?{at:dbMod.serverTimestamp()}:null;
      if(kind==='saves') updates[`social/users/${u}/saved/${p}`]=next?{at:dbMod.serverTimestamp()}:null;
      await dbMod.update(dbMod.ref(realtime),updates);
      return next;
    },
    async markShared(projectId,profileId){
      const p=key(projectId),u=key(profileId);
      await dbMod.set(dbMod.ref(realtime,`social/projects/${p}/shares/${u}`),{at:dbMod.serverTimestamp()});
    },
    subscribeProjectComments(projectId,callback,onError=()=>{}){
      const commentsRef=dbMod.ref(realtime,`social/projects/${key(projectId)}/comments`);
      return dbMod.onValue(commentsRef,snap=>{
        const value=snap.val()||{};
        const comments=Object.entries(value).map(([id,row])=>({id,...row})).sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0));
        callback(comments);
      },onError);
    },
    async createComment(projectId,profileId,text){
      const clean=String(text||'').trim().slice(0,500);
      if(!clean) throw new Error('Write a comment first.');
      const commentsRef=dbMod.ref(realtime,`social/projects/${key(projectId)}/comments`);
      const commentRef=dbMod.push(commentsRef);
      await dbMod.set(commentRef,{authorProfileId:String(profileId),text:clean,at:dbMod.serverTimestamp()});
      return commentRef.key;
    },
    async deleteComment(projectId,commentId){
      await dbMod.remove(dbMod.ref(realtime,`social/projects/${key(projectId)}/comments/${key(commentId)}`));
    },
    subscribeSaved(profileId,callback,onError=()=>{}){
      return dbMod.onValue(dbMod.ref(realtime,`social/users/${key(profileId)}/saved`),snap=>callback(Object.keys(snap.val()||{})),onError);
    },
    subscribeFollowing(profileId,callback,onError=()=>{}){
      return dbMod.onValue(dbMod.ref(realtime,`social/users/${key(profileId)}/following`),snap=>callback(Object.keys(snap.val()||{})),onError);
    },
    subscribeFollowers(profileId,callback,onError=()=>{}){
      return dbMod.onValue(dbMod.ref(realtime,`social/users/${key(profileId)}/followers`),snap=>callback(Object.keys(snap.val()||{})),onError);
    },
    async toggleFollow(viewerId,targetId){
      const v=key(viewerId),t=key(targetId);
      if(v===t) return false;
      const ownRef=dbMod.ref(realtime,`social/users/${v}/following/${t}`);
      const snap=await dbMod.get(ownRef),next=!snap.exists();
      const updates={};
      updates[`social/users/${v}/following/${t}`]=next?{at:dbMod.serverTimestamp()}:null;
      updates[`social/users/${t}/followers/${v}`]=next?{at:dbMod.serverTimestamp()}:null;
      await dbMod.update(dbMod.ref(realtime),updates);
      return next;
    },
    async setPresence(profileId,onError=()=>{}){
      const statusRef=dbMod.ref(realtime,`presence/${key(profileId)}`);
      const connectedRef=dbMod.ref(realtime,'.info/connected');
      const unsubscribe=dbMod.onValue(connectedRef,async snap=>{
        if(snap.val()!==true)return;
        try{
          await dbMod.onDisconnect(statusRef).set({online:false,lastChanged:dbMod.serverTimestamp()});
          await dbMod.set(statusRef,{online:true,lastChanged:dbMod.serverTimestamp()});
        }catch(error){onError(error);}
      },onError);
      return unsubscribe;
    },
    subscribePresence(profileId,callback,onError=()=>{}){
      return dbMod.onValue(dbMod.ref(realtime,`presence/${key(profileId)}`),snap=>callback(snap.val()||{online:false}),onError);
    }
  };
  return api;
}
