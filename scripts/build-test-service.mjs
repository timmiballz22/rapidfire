// Test-only bundle: never copied into the production build.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
let source=await readFile('js/firebase-service.js','utf8');
for(const name of ['app','auth','firestore','database','storage'])source=source.replace("import(sdk('firebase-"+name+"'))","import('firebase/"+name+"')");
source=source.replace('  const auth = authMod.getAuth(app);',"  const auth = authMod.getAuth(app);\n  authMod.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});");
source=source.replace("  if (location.protocol","  fsMod.connectFirestoreEmulator(firestore,'127.0.0.1',8080);\n  dbMod.connectDatabaseEmulator(realtime,'127.0.0.1',9000);\n  if (location.protocol");
source+="\nimport {signInAnonymously} from 'firebase/auth';\nexport async function createTestService(){const api=await createFirebaseService({apiKey:'demo-key',projectId:'demo-rapidfire',authDomain:'localhost',databaseURL:'https://demo-rapidfire.firebaseio.com',storageBucket:'demo-rapidfire.appspot.com'});await signInAnonymously(api.auth);window.qaService=api;return api;}";
await mkdir('.qa',{recursive:true});
await writeFile('.qa/browser-service-source.mjs',source);
await build({entryPoints:['.qa/browser-service-source.mjs'],outfile:'.qa/browser-service.js',bundle:true,format:'esm',platform:'browser',logLevel:'warning'});
