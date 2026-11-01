import {rectangle,routeEdge,segmentBlocked,ports,nodeSize} from './router.js';
import {routeSegments,measureRoutes} from './route-quality.js';

// Separate, ordered attachment points on every side. The router remains free
// to choose another side when the shortest approach is blocked or congested.
function allocatePorts(nodes,edges,lookup){
  const slots=new Map(nodes.map(n=>[n.id,Array.from({length:4},()=>[])])),result=new Map();
  for(const e of edges){
    if(!lookup.has(e.source)||!lookup.has(e.target))continue;
    for(const end of ['source','target']){
      const n=lookup.get(e[end]),other=lookup.get(e[end==='source'?'target':'source']),size=nodeSize(other);
      const key=e.id+':'+end;result.set(key,[]);
      for(let side=0;side<4;side++)slots.get(n.id)[side].push({key,coordinate:side%2?other.y+size.h/2:other.x+size.w/2,other:other.id});
    }
  }
  for(const n of nodes){const size=nodeSize(n),base=ports(n);
    slots.get(n.id).forEach((items,side)=>{
      items.sort((a,b)=>a.coordinate-b.coordinate||a.other.localeCompare(b.other)||a.key.localeCompare(b.key));
      items.forEach((item,i)=>{
        const p={...base[side]},span=side%2?size.h:size.w;
        if(['class','abstract','interface','enum','object','component','node','state','activity','note','package'].includes(n.type)){
          const offset=items.length===1?span/2:18+(span-36)*(i+1)/(items.length+1);
          if(side%2)p.y=n.y+offset;else p.x=n.x+offset;
        }
        result.get(item.key).push(p);
      });
    });
  }
  return result;
}

export class RoutingEngine {
  previous=new Map();
  cache=new Map();
  compute(nodes,edges) {
    const geometry=new Map(nodes.map(n=>[n.id,rectangle(n)])),lookup=new Map(nodes.map(n=>[n.id,n]));
    const changed=nodes.filter(n=>JSON.stringify(geometry.get(n.id))!==JSON.stringify(this.previous.get(n.id)));
    const portsByEdge=allocatePorts(nodes,edges,lookup),next=new Map(),routes=[],pending=[];
    let computed=0,reused=0;
    for(const e of edges){
      const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)continue;
      const options={sourcePorts:portsByEdge.get(e.id+':source'),targetPorts:portsByEdge.get(e.id+':target')};
      const signature=JSON.stringify([e.source,e.target,options]),old=this.cache.get(e.id);
      const invalid=!old?.points||old.signature!==signature||changed.some(n=>n.id===e.source||n.id===e.target||old.points.slice(1).some((p,i)=>segmentBlocked(old.points[i],p,[rectangle(n,16)])));
      const entry={id:e.id,points:invalid?null:old.points};routes.push(entry);next.set(e.id,{...entry,signature});
      if(invalid)pending.push({e,a,b,options,entry});else reused++;
    }
    const occupied=routes.flatMap(r=>routeSegments(r.points));
    pending.sort((a,b)=>Number(['inheritance','realization'].includes(b.e.type))-Number(['inheritance','realization'].includes(a.e.type))||
      (Math.abs(a.a.x-a.b.x)+Math.abs(a.a.y-a.b.y))-(Math.abs(b.a.x-b.b.x)+Math.abs(b.a.y-b.b.y))||a.e.id.localeCompare(b.e.id));
    for(const {e,a,b,options,entry}of pending){
      entry.points=routeEdge(a,b,nodes,{...options,occupied});next.get(e.id).points=entry.points;occupied.push(...routeSegments(entry.points));computed++;
    }
    // A bounded rip-up pass for full layouts only. Incremental dragging never
    // triggers global optimization on every pointer move.
    if(pending.length>1&&pending.length===routes.length){
      let quality=measureRoutes(routes);
      const worst=pending.slice().sort((a,b)=>quality.conflicts.get(b.e.id)-quality.conflicts.get(a.e.id)).slice(0,16);
      for(const {e,a,b,options,entry}of worst){
        if(!quality.conflicts.get(e.id))continue;
        const candidate=routeEdge(a,b,nodes,{...options,occupied:routes.filter(r=>r.id!==e.id).flatMap(r=>routeSegments(r.points))});
        if(!candidate)continue;
        const previous=entry.points;entry.points=candidate;const updated=measureRoutes(routes);
        if(updated.crossings<quality.crossings||updated.crossings===quality.crossings&&updated.overlap<quality.overlap){quality=updated;next.get(e.id).points=candidate;}else entry.points=previous;
      }
    }
    this.previous=geometry;this.cache=next;
    return {routes,computed,reused};
  }
}
