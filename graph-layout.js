import {nodeSize} from './router.js';

// Deterministic layered layout. Long edges take part in ordering through virtual
// vertices; they are never added to the user's model or used to hide relations.
const hierarchy=e=>e.type==='inheritance'||e.type==='realization';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const median=values=>{const a=values.slice().sort((a,b)=>a-b),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;};

export function countLayoutCrossings(nodes,edges){
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const center=n=>{const s=nodeSize(n);return {x:n.x+s.w/2,y:n.y+s.h/2};};
  const lines=edges.filter(e=>e.source!==e.target&&byId.has(e.source)&&byId.has(e.target)).map(e=>({...e,a:center(byId.get(e.source)),b:center(byId.get(e.target))}));
  const side=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  let count=0;
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j];if(a.source===b.source||a.source===b.target||a.target===b.source||a.target===b.target)continue;
    if(side(a.a,a.b,b.a)*side(a.a,a.b,b.b)<0&&side(b.a,b.b,a.a)*side(b.a,b.b,a.b)<0)count++;
  }
  return count;
}

function components(nodes,edges){
  const neighbors=new Map(nodes.map(n=>[n.id,new Set()]));
  for(const e of edges)if(neighbors.has(e.source)&&neighbors.has(e.target)){neighbors.get(e.source).add(e.target);neighbors.get(e.target).add(e.source);}
  const seen=new Set(),result=[];
  for(const n of nodes.slice().sort((a,b)=>compare(a.id,b.id)))if(!seen.has(n.id)){
    const ids=[],queue=[n.id];seen.add(n.id);
    for(let i=0;i<queue.length;i++){const id=queue[i];ids.push(id);for(const next of neighbors.get(id))if(!seen.has(next)){seen.add(next);queue.push(next);}}
    const set=new Set(ids);result.push({nodes:nodes.filter(n=>set.has(n.id)),edges:edges.filter(e=>set.has(e.source)&&set.has(e.target))});
  }
  return result;
}

function layerGraph(nodes,edges,variant){
  const ids=nodes.map(n=>n.id).sort(compare),out=new Map(ids.map(id=>[id,new Set()])),rank=new Map(ids.map(id=>[id,0]));
  const degree=new Map(ids.map(id=>[id,0]));
  for(const e of edges){degree.set(e.source,degree.get(e.source)+1);degree.set(e.target,degree.get(e.target)+1);}
  const links=edges.filter(e=>e.source!==e.target).map(e=>({a:hierarchy(e)?e.target:e.source,b:hierarchy(e)?e.source:e.target,e}));
  links.sort((a,b)=>Number(hierarchy(b.e))-Number(hierarchy(a.e))||
    (variant%2?degree.get(b.a)-degree.get(a.a):0)||compare(a.a,b.a)||compare(a.b,b.b));
  const reaches=(a,b)=>{const seen=new Set([a]),queue=[a];for(let i=0;i<queue.length;i++){if(queue[i]===b)return true;for(const n of out.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}}return false;};
  // Break cycles for placement only. Every original edge and direction survives.
  for(const {a,b}of links)if(!reaches(b,a))out.get(a).add(b);
  const incoming=new Map(ids.map(id=>[id,0]));for(const targets of out.values())for(const id of targets)incoming.set(id,incoming.get(id)+1);
  const queue=ids.filter(id=>!incoming.get(id));
  for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i])){rank.set(id,Math.max(rank.get(id),rank.get(queue[i])+1));incoming.set(id,incoming.get(id)-1);if(!incoming.get(id))queue.push(id);}
  // Place a free-standing base/interface just above its nearest subtype,
  // instead of leaving every root at the very top with needlessly long edges.
  for(const id of queue.slice().reverse())if(out.get(id).size)rank.set(id,Math.min(...[...out.get(id)].map(next=>rank.get(next)-1)));
  const used=[...new Set(rank.values())].sort((a,b)=>a-b);for(const [id,value]of rank)rank.set(id,used.indexOf(value));
  const layers=Array.from({length:1+Math.max(0,...rank.values())},()=>[]),vertices=new Map(),segments=[];
  for(const n of nodes){const v={id:n.id,node:n,rank:rank.get(n.id),...nodeSize(n),up:[],down:[]};vertices.set(v.id,v);layers[v.rank].push(v);}
  let dummy=0;
  for(const {a,b}of links){
    let from=vertices.get(a),to=vertices.get(b);if(from.rank>to.rank)[from,to]=[to,from];
    if(from.rank===to.rank)continue;
    let previous=from;
    for(let r=from.rank+1;r<=to.rank;r++){
      const next=r===to.rank?to:{id:Symbol(dummy++),rank:r,w:20,h:0,up:[],down:[]};
      if(next!==to){vertices.set(next.id,next);layers[r].push(next);}
      previous.down.push(next);next.up.push(previous);segments.push([previous,next]);previous=next;
    }
  }
  layers.forEach(layer=>layer.sort((a,b)=>compare(String(a.id),String(b.id))*(variant>=2?-1:1)));
  return {layers,segments};
}

function positions(layers){return new Map(layers.flatMap(layer=>layer.map((v,i)=>[v.id,i])));}
function orderCrossings(layers,segments){
  const order=positions(layers),bands=Array.from({length:layers.length},()=>[]);let count=0;
  for(const [a,b]of segments)bands[a.rank].push([order.get(a.id),order.get(b.id)]);
  for(const band of bands)for(let i=0;i<band.length;i++)for(let j=i+1;j<band.length;j++)if((band[i][0]-band[j][0])*(band[i][1]-band[j][1])<0)count++;
  return count;
}
function transpose(layers){
  const order=positions(layers);
  const cost=(a,b)=>{let score=0;for(const direction of ['up','down'])for(const x of a[direction])for(const y of b[direction])score+=Math.sign(order.get(x.id)-order.get(y.id));return score;};
  for(let pass=0;pass<4;pass++){
    let changed=false;
    for(const layer of layers)for(let i=0;i+1<layer.length;i++){const a=layer[i],b=layer[i+1];if(cost(a,b)>0){layer[i]=b;layer[i+1]=a;order.set(b.id,i);order.set(a.id,i+1);changed=true;}}
    if(!changed)break;
  }
}
function coordinates(layers){
  const widths=layers.map(layer=>layer.reduce((s,v)=>s+v.w,0)+Math.max(0,layer.length-1)*100),width=Math.max(...widths);
  layers.forEach((layer,r)=>{let x=(width-widths[r])/2;for(const v of layer){v.cx=x+v.w/2;x+=v.w+100;}});
  // Project neighbor medians back onto non-overlapping row intervals.
  for(let pass=0;pass<8;pass++){
    const down=pass%2===0,rows=down?layers:layers.slice().reverse();
    for(const layer of rows){
      const desired=layer.map(v=>{const ns=down?v.up:v.down;return ns.length?median(ns.map(n=>n.cx)):v.cx;});
      for(let i=0;i<layer.length;i++)layer[i].cx=Math.max(desired[i],i?layer[i-1].cx+(layer[i-1].w+layer[i].w)/2+100:-Infinity);
      // Center the constrained row without changing its order or spacing.
      const shift=median(layer.map((v,i)=>desired[i]-v.cx));for(const v of layer)v.cx+=shift;
    }
  }
  let y=0;const placed=[];
  for(const layer of layers){const height=Math.max(0,...layer.map(v=>v.h));for(const v of layer)if(v.node)placed.push({...v.node,x:Math.round(v.cx-v.w/2),y});y+=height+120+Math.min(180,layer.reduce((s,v)=>s+v.down.length,0)*6);}
  const minX=Math.min(0,...placed.map(n=>n.x));for(const n of placed)n.x-=minX;
  return placed;
}
function componentLayout(nodes,edges){
  let best=null;
  for(let variant=0;variant<4;variant++){
    const {layers,segments}=layerGraph(nodes,edges,variant);let bestOrder=layers.map(l=>l.slice()),bestCount=orderCrossings(layers,segments);
    for(let pass=0;pass<16;pass++){
      const down=pass%2===0,order=positions(layers),indices=Array.from({length:layers.length},(_,i)=>i);if(!down)indices.reverse();
      for(const r of indices)layers[r].sort((a,b)=>{
        const key=v=>{const ns=down?v.up:v.down;return ns.length?median(ns.map(n=>order.get(n.id))):order.get(v.id);};
        return key(a)-key(b)||order.get(a.id)-order.get(b.id);
      });
      transpose(layers);const count=orderCrossings(layers,segments);
      if(count<bestCount){bestCount=count;bestOrder=layers.map(l=>l.slice());}
      if(!bestCount)break;
    }
    const placed=coordinates(bestOrder),crossings=countLayoutCrossings(placed,edges),byId=new Map(placed.map(n=>[n.id,n]));
    const length=edges.reduce((s,e)=>{const a=byId.get(e.source),b=byId.get(e.target);return s+Math.abs(a.x-b.x)+Math.abs(a.y-b.y);},0);
    const candidate={nodes:placed,crossings,orderCrossings:bestCount,length};
    if(!best||crossings<best.crossings||crossings===best.crossings&&(bestCount<best.orderCrossings||bestCount===best.orderCrossings&&length<best.length))best=candidate;
  }
  return best.nodes;
}

export function layoutGraph(nodes,edges){
  if(!nodes.length)return {positions:[],components:0};
  const known=new Set(nodes.map(n=>n.id)),valid=edges.filter(e=>known.has(e.source)&&known.has(e.target));
  const parts=components(nodes,valid).map(c=>{
    const placed=componentLayout(c.nodes,c.edges);return {nodes:placed,w:Math.max(...placed.map(n=>n.x+nodeSize(n).w)),h:Math.max(...placed.map(n=>n.y+nodeSize(n).h))};
  }).sort((a,b)=>b.h-a.h||b.w-a.w||compare(a.nodes[0].id,b.nodes[0].id));
  const target=Math.max(Math.max(...parts.map(p=>p.w)),Math.sqrt(parts.reduce((s,p)=>s+(p.w+180)*(p.h+180),0))*1.5);
  let x=60,y=70,row=0;const result=[];
  for(const part of parts){if(x>60&&x+part.w>target){x=60;y+=row+180;row=0;}for(const n of part.nodes)result.push({id:n.id,x:n.x+x,y:n.y+y});x+=part.w+180;row=Math.max(row,part.h);}
  return {positions:result,components:parts.length};
}
