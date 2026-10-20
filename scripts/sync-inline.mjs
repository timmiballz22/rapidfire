import {readFile, writeFile} from 'node:fs/promises';
const path='index.html';
const html=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
const service=(await readFile('js/firebase-service.js','utf8')).replace(/\r\n/g,'\n').replace('export async function createFirebaseService','async function createFirebaseService');
const app=(await readFile('js/app.js','utf8')).replace(/\r\n/g,'\n');
const result=html.slice(0,html.indexOf('<script>\n'))+'<script>\n'+service+app+'</script>'+html.slice(html.lastIndexOf('</script>')+9);
if(process.argv.includes('--check')){if(result!==html)throw new Error('Embedded JavaScript differs from js/. Run node scripts/sync-inline.mjs.');}
else await writeFile(path,result);
