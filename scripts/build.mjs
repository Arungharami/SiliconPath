import {mkdir,copyFile,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dest=new URL('dist/',root);
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
for(const f of ['index.html','styles.css','app.js','lab.js','guides.js','operations.js','resources.json','favicon.svg'])await copyFile(new URL(f,root),new URL(f,dest));
console.log('Built dist/: dependency-free static application.');
