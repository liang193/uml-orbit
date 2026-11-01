import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {SITE_FILES} from './scripts/site-files.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};

export function createStaticServer({directory=root,basePath='/'}={}){
  if(!/^\/(?:[\w-]+\/)*$/.test(basePath))throw Error('Base path must look like / or /uml-orbit/');
  const allowed=new Set([...SITE_FILES,'.nojekyll']);
  return http.createServer(async(req,res)=>{
    const finish=(status,body='')=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(body);};
    if(!['GET','HEAD'].includes(req.method))return finish(405,'Method not allowed');
    let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return finish(400,'Bad request');}
    if(basePath!=='/'&&(name==='/'||name===basePath.slice(0,-1))){res.writeHead(302,{Location:basePath});return res.end();}
    if(!name.startsWith(basePath))return finish(404,'Not found');
    const relative=name.slice(basePath.length)||'index.html';
    if(!allowed.has(relative))return finish(404,'Not found');
    try{
      const data=await readFile(path.join(directory,relative));
      res.writeHead(200,{'Content-Type':mime[path.extname(relative)]||'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{return finish(404,'Not found');}
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {values}=parseArgs({options:{dist:{type:'boolean',default:false},base:{type:'string',default:'/'},port:{type:'string'}}});
  const port=Number(values.port||process.env.PORT||(values.dist?4173:5173));
  const server=createStaticServer({directory:values.dist?path.join(root,'dist'):root,basePath:values.base});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Use --port to select another port.`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`UML Orbit is ready: http://127.0.0.1:${server.address().port}${values.base}`));
}
