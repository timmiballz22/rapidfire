import {readFile, writeFile} from 'node:fs/promises';
const path='index.html';
const html=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
const service=(await readFile('js/firebase-service.js','utf8')).replace(/\r\n/g,'\n').replace('export async function createFirebaseService','async function createFirebaseService');
const originalApp=(await readFile('js/app.js','utf8')).replace(/\r\n/g,'\n');
const catalog=JSON.parse(await readFile('projects/defaults/catalog.json','utf8'));
const app=originalApp.replace(/\/\* DEFAULT_CATALOG_START \*\/[\s\S]*?\/\* DEFAULT_CATALOG_END \*\//,`/* DEFAULT_CATALOG_START */${JSON.stringify(catalog)}/* DEFAULT_CATALOG_END */`);
if(process.argv.includes('--check')&&app!==originalApp)throw new Error('Embedded starter catalog differs. Run node scripts/sync-inline.mjs.');
if(!process.argv.includes('--check'))await writeFile('js/app.js',app);
const result=html.slice(0,html.indexOf('<script>\n'))+'<script>\n'+service+app+'</script>'+html.slice(html.lastIndexOf('</script>')+9);
if(process.argv.includes('--check')){if(result!==html)throw new Error('Embedded JavaScript differs from js/. Run node scripts/sync-inline.mjs.');}
else await writeFile(path,result);
