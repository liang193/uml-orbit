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
function ports(n) {
  const {w,h}=nodeSize(n),x=n.x,y=n.y;
  if(n.type==='initial'||n.type==='final')return [{x:x+w/2,y,dx:0,dy:-1},{x:x+w,y:y+h/2,dx:1,dy:0},{x:x+w/2,y:y+h,dx:0,dy:1},{x,y:y+h/2,dx:-1,dy:0}];
  // Side midpoints are on the actual boundaries of diamonds/ellipses as well.
  return [{x:x+w/2,y,dx:0,dy:-1},{x:x+w,y:y+h/2,dx:1,dy:0},{x:x+w/2,y:y+h,dx:0,dy:1},{x,y:y+h/2,dx:-1,dy:0}];
}
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
class Heap {a=[];push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=v.f)break;a[i]=a[j];i=j;}a[i]=v;}return r;}get length(){return this.a.length;}}
function search(a,b,boxes) {
  const xs=[...new Set([a.x,b.x,...boxes.flatMap(r=>[r.x,r.x+r.w])])].sort((a,b)=>a-b);
  const ys=[...new Set([a.y,b.y,...boxes.flatMap(r=>[r.y,r.y+r.h])])].sort((a,b)=>a-b);
  const nx=xs.length,ny=ys.length, start=ys.indexOf(a.y)*nx+xs.indexOf(a.x),end=ys.indexOf(b.y)*nx+xs.indexOf(b.x);
  const point=id=>({x:xs[id%nx],y:ys[Math.floor(id/nx)]});
  const heap=new Heap(),scores=new Map(),parents=new Map(),blocked=new Map();
  const initial=start*3; scores.set(initial,0); heap.push({key:initial,id:start,dir:0,g:0,f:dist(a,b)});
  let count=0;
  while(heap.length && count++<nx*ny*4){
    const u=heap.pop(); if(u.g!==scores.get(u.key))continue;
    if(u.id===end){const path=[];let k=u.key;while(k!==undefined){path.push(point(Math.floor(k/3)));k=parents.get(k);}return path.reverse();}
    const cx=u.id%nx,cy=Math.floor(u.id/nx),p=point(u.id);
    for(const [dx,dy,dir] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){
      const x=cx+dx,y=cy+dy;if(x<0||x>=nx||y<0||y>=ny)continue;
      const id=y*nx+x,q=point(id),key=id*3+dir;
      const bk=Math.min(id,u.id)*nx*ny+Math.max(id,u.id);
      if(!blocked.has(bk))blocked.set(bk,segmentBlocked(p,q,boxes));
      if(blocked.get(bk))continue;
      const g=u.g+dist(p,q)+(u.dir&&u.dir!==dir?25:0);
      if(g>=(scores.get(key)??Infinity))continue;
      scores.set(key,g);parents.set(key,u.key);heap.push({key,id,dir,g,f:g+dist(q,b)});
    }
  }
  return null;
}
export function simplify(points){return points.filter((p,i,a)=>!i||i===a.length-1||!(((a[i-1].x===p.x&&p.x===a[i+1].x)||(a[i-1].y===p.y&&p.y===a[i+1].y))&&((p.x-a[i-1].x)*(a[i+1].x-p.x)+(p.y-a[i-1].y)*(a[i+1].y-p.y)>=0)));}
export function routeEdge(source,target,nodes){
  if(source.id!==target.id){const a=rectangle(source),b=rectangle(target);if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)return null;}
  const boxes=nodes.map(n=>rectangle(n,16));const others=nodes.filter(n=>n.id!==source.id&&n.id!==target.id).map(n=>rectangle(n,3));
  const pairs=[];
  for(const a of ports(source))for(const b of ports(target)){
    if(source.id===target.id&&a.x===b.x&&a.y===b.y)continue;
    const p={x:a.x+a.dx*26,y:a.y+a.dy*26},q={x:b.x+b.dx*26,y:b.y+b.dy*26};
    if(boxes.some(r=>inside(p,r)||inside(q,r))||segmentBlocked(a,p,others)||segmentBlocked(b,q,others))continue;
    pairs.push({a,b,p,q,cost:dist(p,q)+52});
  }
  pairs.sort((a,b)=>a.cost-b.cost);let best=null,score=Infinity;
  for(const pair of pairs){
    if(pair.cost>score)break;
    const path=search(pair.p,pair.q,boxes);if(!path)continue;
    const pts=simplify([pair.a,...path,pair.b]);
    const length=pts.slice(1).reduce((s,p,i)=>s+dist(p,pts[i]),0)+(pts.length-2)*25;
    if(length<score){best=pts;score=length;}
  }
  // Never draw a misleading line through an overlapping node.
  return best;
}
export function pathData(points){return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');}
export function pathMiddle(points){let total=0;for(let i=1;i<points.length;i++)total+=dist(points[i-1],points[i]);let half=total/2;for(let i=1;i<points.length;i++){const d=dist(points[i-1],points[i]);if(half<=d){const t=d?half/d:0;return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,y:points[i-1].y+(points[i].y-points[i-1].y)*t};}half-=d;}return points[0];}
