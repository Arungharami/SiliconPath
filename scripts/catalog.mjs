#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
const resources=JSON.parse(await readFile(new URL('../resources.json',import.meta.url),'utf8'));
const [command='list',...terms]=process.argv.slice(2);
if(command==='check'){
 const ids=new Set();let issues=[];
 for(const r of resources){
  for(const key of ['id','title','provider','kind','topic','level','url','summary','use','access','review','checked'])if(typeof r[key]!=='string'||!r[key].trim())issues.push(`${r.id}: missing ${key}`);
  if(ids.has(r.id))issues.push(`Duplicate id ${r.id}`);ids.add(r.id);
  try{if(new URL(r.url).protocol!=='https:')issues.push(`${r.id}: HTTPS required`)}catch{issues.push(`${r.id}: invalid URL`)}
  if(!['Book','Paper','Report','Video','Course','Guide','Collection'].includes(r.kind))issues.push(`${r.id}: invalid format`);
  if(!['Beginner','Intermediate','Advanced'].includes(r.level))issues.push(`${r.id}: invalid level`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.checked))issues.push(`${r.id}: invalid check date`);
 }
 if(issues.length){console.error(issues.join('\n'));process.exitCode=1}else console.log(`Catalog valid: ${resources.length} resources. URL structure checked; remote availability not tested.`);
}else if(command==='export'){
 const target=new URL('../docs/RESOURCE_CATALOG.md',import.meta.url);
 const md='# SiliconPath resource catalog\n\nSource listing notes; full-content and faculty review pending.\n\n'+resources.map(r=>`## ${r.title}\n\n- Organization: ${r.provider}\n- Format / topic / level: ${r.kind} / ${r.topic} / ${r.level}\n- Access: ${r.access}\n- Source: ${r.url}\n- Listing checked: ${r.checked}\n- Review: ${r.review}\n\n${r.summary}\n\nSuggested use: ${r.use}\n`).join('\n');
 await writeFile(target,md);console.log('Exported docs/RESOURCE_CATALOG.md');
}else if(command==='list'){
 const query=terms.join(' ').toLowerCase();for(const r of resources.filter(r=>[r.title,r.topic,r.kind,r.provider].join(' ').toLowerCase().includes(query)))console.log(`${r.id.padEnd(21)} ${r.kind.padEnd(10)} ${r.title}\n  ${r.url}`);
}else{console.error('Usage: npm run catalog -- list [query] | check | export');process.exitCode=1}
