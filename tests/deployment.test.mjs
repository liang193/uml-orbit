import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite,PROJECT_ROOT} from '../scripts/build.mjs';
import {SITE_FILES} from '../scripts/site-files.mjs';
import {createStaticServer} from '../server.mjs';

test('deployment includes every browser dependency, works under a repository subpath and excludes source-only files',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'uml-orbit-deploy-'));
  let server;
  try{
    await Promise.all(SITE_FILES.map(name=>copyFile(path.join(PROJECT_ROOT,name),path.join(temporary,name))));
    const output=await buildSite(temporary);
    await writeFile(path.join(output,'stale.txt'),'must not be deployed');await buildSite(temporary);
    assert.deepEqual((await readdir(output)).sort(),[...SITE_FILES,'.nojekyll'].sort());
    for(const name of SITE_FILES.filter(n=>n.endsWith('.js'))){
      const source=await readFile(path.join(output,name),'utf8');
      const refs=[...source.matchAll(/(?:from\s*|new URL\(\s*)['"](\.\/[^'"]+)['"]/g)].map(m=>m[1].slice(2));
      for(const ref of refs)assert.ok(SITE_FILES.includes(ref),`${name} is missing dependency ${ref}`);
    }
    server=createStaticServer({directory:output,basePath:'/uml-orbit/'});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
    for(const asset of SITE_FILES){const response=await fetch(`${origin}/uml-orbit/${asset}`);assert.equal(response.status,200,asset);if(asset.endsWith('.js'))assert.match(response.headers.get('content-type'),/javascript/);}
    const index=await fetch(`${origin}/uml-orbit/`);assert.equal(index.status,200);assert.match(await index.text(),/UML Orbit/);
    const redirect=await fetch(`${origin}/uml-orbit`,{redirect:'manual'});assert.equal(redirect.headers.get('location'),'/uml-orbit/');
    for(const name of ['package.json','server.mjs','.git/config','.env','tests/java.test.mjs'])assert.equal((await fetch(`${origin}/uml-orbit/${name}`)).status,404);
  }finally{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(path.dirname(temporary)!==path.resolve(os.tmpdir())||!path.basename(temporary).startsWith('uml-orbit-deploy-'))throw Error('Unexpected test cleanup path');
    await rm(temporary,{recursive:true,force:true});
  }
});
