import {copyFile,lstat,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {SITE_FILES} from './site-files.mjs';

export const PROJECT_ROOT=fileURLToPath(new URL('../',import.meta.url));

export async function buildSite(root=PROJECT_ROOT){
  const project=path.resolve(root),output=path.resolve(project,'dist');
  // Never allow cleanup to escape the explicitly generated directory.
  if(path.dirname(output)!==project||path.basename(output)!=='dist')throw Error('Invalid build output path');
  const existing=await lstat(output).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if(existing?.isSymbolicLink())throw Error('Refusing to replace a symlink at dist');
  for(const name of SITE_FILES){const source=await lstat(path.join(project,name));if(!source.isFile()||source.isSymbolicLink())throw Error(`Expected a regular source file: ${name}`);}
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  await Promise.all(SITE_FILES.map(name=>copyFile(path.join(project,name),path.join(output,name))));
  await writeFile(path.join(output,'.nojekyll'),'');
  return output;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(`Static site built: ${await buildSite()}`);
}
