import {routePenalty,indexSegments} from './route-quality.js';
// Orthogonal visibility-grid routing. All nodes, including the endpoints,
// are obstacles; only the short outward port segments enter their own margin.
export function classifierHeader(n) {
  const custom=(n.stereo||'').trim();
  const stereotype=n.type==='interface'?'interface':n.type==='enum'?'enumeration':custom&&custom!=='class'&&custom!=='abstract'?custom:'';
  return {stereotype,height:stereotype?69:48};
}
export function memberDisplay(value){return value.replace(/\{(static|abstract)\}/g,'').trim();}
export function textWidth(value,ascii=7.5,cjk=12.5){return [...value].reduce((width,ch)=>width+(ch.charCodeAt(0)>255?cjk:ascii),0);}
export function nodeSize(n) {
  if (['initial','final'].includes(n.type)) return {w:38,h:38};
  if (n.type === 'fork') return {w:210,h:18};
  if (n.type === 'decision') return {w:110,h:90};
  if (n.type === 'actor') return {w:100,h:125};
  if (n.type === 'lifeline') return {w:150,h:310};
  if (['class','interface','abstract','enum','object'].includes(n.type)) {
    const rows = [...(n.attrs||[]),...(n.methods||[])];
    const {stereotype,height}=classifierHeader(n);
    const longest = Math.max(textWidth(n.name,10,16),textWidth(stereotype,7,11), ...rows.map(s=>textWidth(memberDisplay(s))), 160);
    return {w:Math.ceil(Math.max(220,longest+40)),h:height+11+Math.max(1,(n.attrs||[]).length)*23+Math.max(1,(n.methods||[]).length)*23};
  }
  if (n.type === 'package') return {w:245,h:155};
  if (n.type === 'usecase') return {w:200,h:96};
  return {w:220,h:Math.max(100,70+(n.body||'').split('\n').length*20)};
}
export function rectangle(n, padding=0) {const {w,h}=nodeSize(n);return {x:n.x-padding,y:n.y-padding,w:w+2*padding,h:h+2*padding};}
export function inside(p,b) { return p.x>b.x+.01 && p.x<b.x+b.w-.01 && p.y>b.y+.01 && p.y<b.y+b.h-.01; }
export function segmentBlocked(a,b,boxes) {
  return boxes.some(r=> a.x===b.x ? (a.x>r.x+.01&&a.x<r.x+r.w-.01&&Math.max(a.y,b.y)>r.y+.01&&Math.min(a.y,b.y)<r.y+r.h-.01) : (a.y>r.y+.01&&a.y<r.y+r.h-.01&&Math.max(a.x,b.x)>r.x+.01&&Math.min(a.x,b.x)<r.x+r.w-.01));
}
export function ports(n) {
  const {w,h}=nodeSize(n),x=n.x,y=n.y;
  if(n.type==='initial'||n.type==='final')return [{x:x+w/2,y,dx:0,dy:-1},{x:x+w,y:y+h/2,dx:1,dy:0},{x:x+w/2,y:y+h,dx:0,dy:1},{x,y:y+h/2,dx:-1,dy:0}];
  // Side midpoints are on the actual boundaries of diamonds/ellipses as well.
  return [{x:x+w/2,y,dx:0,dy:-1},{x:x+w,y:y+h/2,dx:1,dy:0},{x:x+w/2,y:y+h,dx:0,dy:1},{x,y:y+h/2,dx:-1,dy:0}];
}
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
class Heap {a=[];push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=v.f)break;a[i]=a[j];i=j;}a[i]=v;}return r;}get length(){return this.a.length;}}
function searchPorts(pairs,boxes,occupied,best,score){
  const tracks=occupied.length?12:0;
  const xs=[...new Set([...pairs.flatMap(p=>[p.p.x,p.q.x]),...boxes.flatMap(r=>[r.x-tracks,r.x,r.x+r.w,r.x+r.w+tracks])])].sort((a,b)=>a-b);
  const ys=[...new Set([...pairs.flatMap(p=>[p.p.y,p.q.y]),...boxes.flatMap(r=>[r.y-tracks,r.y,r.y+r.h,r.y+r.h+tracks])])].sort((a,b)=>a-b);
  const nx=xs.length,ny=ys.length,idOf=p=>ys.indexOf(p.y)*nx+xs.indexOf(p.x),point=id=>({x:xs[id%nx],y:ys[Math.floor(id/nx)]});
  const heap=new Heap(),scores=new Map(),parents=new Map(),roots=new Map(),blocked=new Map(),penalties=new Map(),targets=new Map();
  for(const pair of pairs){const id=idOf(pair.q);if(!targets.has(id))targets.set(id,[]);if(!targets.get(id).some(p=>p.b===pair.b))targets.get(id).push(pair);}
  const ends=[...targets].flatMap(([id,ps])=>ps.map(p=>({id,p:p.q,cost:26+routePenalty(p.q,p.b,occupied)})));
  const heuristic=p=>Math.min(...ends.map(e=>dist(p,e.p)+e.cost));
  for(const pair of pairs){
    const id=idOf(pair.p),dir=pair.a.dx?1:2,key=id*3+dir,g=26+routePenalty(pair.a,pair.p,occupied);
    if(g>=(scores.get(key)??Infinity))continue;
    scores.set(key,g);roots.set(key,pair.a);heap.push({key,id,dir,g,f:g+heuristic(pair.p)});
  }
  // One multi-source A* compares all legal port pairs, rather than running up
  // to sixteen independent searches over almost identical visibility grids.
  while(heap.length){
    const u=heap.pop();if(u.f>=score)break;if(u.g!==scores.get(u.key))continue;
    for(const end of targets.get(u.id)||[]){
      const value=u.g+26+routePenalty(end.q,end.b,occupied)+(u.dir!==(end.b.dx?1:2)?25:0);
      if(value<score){const path=[];let k=u.key;while(k!==undefined){path.push(point(Math.floor(k/3)));k=parents.get(k);}best=simplify([roots.get(u.key),...path.reverse(),end.b]);score=value;}
    }
    const cx=u.id%nx,cy=Math.floor(u.id/nx),p=point(u.id);
    for(const [dx,dy,dir]of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){
      const x=cx+dx,y=cy+dy;if(x<0||x>=nx||y<0||y>=ny)continue;
      const id=y*nx+x,q=point(id),key=id*3+dir,bk=Math.min(id,u.id)*nx*ny+Math.max(id,u.id);
      if(!blocked.has(bk))blocked.set(bk,segmentBlocked(p,q,boxes));if(blocked.get(bk))continue;
      if(!penalties.has(bk))penalties.set(bk,routePenalty(p,q,occupied));
      const g=u.g+dist(p,q)+(u.dir!==dir?25:0)+penalties.get(bk),f=g+heuristic(q);
      if(g>=(scores.get(key)??Infinity)||f>=score)continue;
      scores.set(key,g);parents.set(key,u.key);roots.set(key,roots.get(u.key));heap.push({key,id,dir,g,f});
    }
  }
  return best;
}
export function simplify(points){return points.filter((p,i,a)=>!i||i===a.length-1||!(((a[i-1].x===p.x&&p.x===a[i+1].x)||(a[i-1].y===p.y&&p.y===a[i+1].y))&&((p.x-a[i-1].x)*(a[i+1].x-p.x)+(p.y-a[i-1].y)*(a[i+1].y-p.y)>=0)));}
export function routeEdge(source,target,nodes,{sourcePorts=ports(source),targetPorts=ports(target),occupied=[]}={}){
  if(source.id===target.id&&sourcePorts.length>1){
    let best=null,score=Infinity;
    for(const a of sourcePorts){const path=routeEdge(source,target,nodes,{sourcePorts:[a],targetPorts,occupied});if(!path)continue;const value=path.slice(1).reduce((s,p,i)=>s+dist(path[i],p)+routePenalty(path[i],p,occupied),0)+(path.length-2)*25;if(value<score){score=value;best=path;}}
    return best;
  }
  occupied=indexSegments(occupied);
  if(source.id!==target.id){const a=rectangle(source),b=rectangle(target);if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)return null;}
  const boxes=nodes.map(n=>rectangle(n,16));const others=nodes.filter(n=>n.id!==source.id&&n.id!==target.id).map(n=>rectangle(n,3));
  const pairs=[];
  for(const a of sourcePorts)for(const b of targetPorts){
    if(source.id===target.id&&a.x===b.x&&a.y===b.y)continue;
    const p={x:a.x+a.dx*26,y:a.y+a.dy*26},q={x:b.x+b.dx*26,y:b.y+b.dy*26};
    if(boxes.some(r=>inside(p,r)||inside(q,r))||segmentBlocked(a,p,others)||segmentBlocked(b,q,others))continue;
    pairs.push({a,b,p,q,cost:dist(p,q)+52+routePenalty(a,p,occupied)+routePenalty(q,b,occupied)});
  }
  pairs.sort((a,b)=>a.cost-b.cost);let best=null,score=Infinity;
  for(const pair of pairs){
    if(pair.cost>score)break;
    // Most local edges have a clear one-bend route. Try these before building
    // a visibility grid; a zero-penalty Manhattan route needs no A* search.
    const elbows=[[pair.p,{x:pair.q.x,y:pair.p.y},pair.q],[pair.p,{x:pair.p.x,y:pair.q.y},pair.q]];
    for(const candidate of elbows){const p=simplify(candidate);if(p.slice(1).some((v,i)=>segmentBlocked(p[i],v,boxes)))continue;const pts=simplify([pair.a,...p,pair.b]);const value=pts.slice(1).reduce((s,v,i)=>s+dist(v,pts[i])+routePenalty(pts[i],v,occupied),0)+(pts.length-2)*25;if(value<score){best=pts;score=value;}}
  }
  // Never draw a misleading line through an overlapping node.
  return !pairs.length||score<=pairs[0].cost?best:searchPorts(pairs,boxes,occupied,best,score);
}
export function pathData(points){return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');}
export function pathMiddle(points){let total=0;for(let i=1;i<points.length;i++)total+=dist(points[i-1],points[i]);let half=total/2;for(let i=1;i<points.length;i++){const d=dist(points[i-1],points[i]);if(half<=d){const t=d?half/d:0;return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,y:points[i-1].y+(points[i].y-points[i-1].y)*t};}half-=d;}return points[0];}
