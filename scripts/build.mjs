import {mkdir, cp, rm} from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
for (const path of ['index.html', 'js', 'projects']) await cp(path, `dist/${path}`, {recursive:true});
console.log('Built RapidFire static site.');
