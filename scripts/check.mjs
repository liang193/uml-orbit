import {spawnSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const directory of ['.','scripts','tests']){
  for(const name of await readdir(path.join(root,directory))){
    if(!/\.(?:js|mjs)$/.test(name))continue;
    const result=spawnSync(process.execPath,['--check',path.join(root,directory,name)],{stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status||1);
  }
}
console.log('JavaScript syntax checks passed.');
