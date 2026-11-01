import {rectangle,routeEdge,segmentBlocked,ports,nodeSize} from './router.js';
import {routeSegments,measureRoutes} from './route-quality.js';

// Separate, ordered attachment points on every side. The router remains free
// to choose another side when the shortest approach is blocked or congested.
function allocatePorts(nodes,edges,lookup,mode='aligned'){
  const slots=new Map(nodes.map(n=>[n.id,Array.from({length:4},()=>[])])),used=new Map(nodes.map(n=>[n.id,Array.from({length:4},()=>[])])),result=new Map(),aligned=[];
  const rectangular=n=>['class','abstract','interface','enum','object','component','node','state','activity','note','package'].includes(n.type);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const reserve=(n,side,value)=>used.get(n.id)[side].push(value);
  const available=(n,side,value)=>used.get(n.id)[side].every(v=>Math.abs(v-value)>=12-.001);
  function choose(lo,hi,ideal,free){
    const center=clamp(ideal,lo,hi);if(free(center))return center;
    const candidates=[lo,hi];
    for(let d=12;d<=hi-lo+12;d+=12)candidates.push(clamp(center-d,lo,hi),clamp(center+d,lo,hi));
    return candidates.sort((a,b)=>Math.abs(a-center)-Math.abs(b-center)||a-b).find(free);
  }
  function setPort(e,end,n,side,value){
    const p={...ports(n)[side]};if(side%2)p.y=value;else p.x=value;
    result.get(e.id+':'+end)[side]=p;reserve(n,side,value);
  }
  for(const e of edges){
    if(!lookup.has(e.source)||!lookup.has(e.target))continue;
    for(const end of ['source','target']){
      const n=lookup.get(e[end]),other=lookup.get(e[end==='source'?'target':'source']),size=nodeSize(other);
      const key=e.id+':'+end;result.set(key,Array(4));
      for(let side=0;side<4;side++)slots.get(n.id)[side].push({key,coordinate:side%2?other.y+size.h/2:other.x+size.w/2,other:other.id});
    }
    const a=lookup.get(e.source),b=lookup.get(e.target);if(a===b||!rectangular(a)||!rectangular(b))continue;
    const sa=nodeSize(a),sb=nodeSize(b);
    const horizontal=a.x+sa.w<=b.x||b.x+sb.w<=a.x,vertical=a.y+sa.h<=b.y||b.y+sb.h<=a.y;
    for(const h of [true,false]){
      if(h?!horizontal:!vertical)continue;
      const lo=Math.max(h?a.y+18:a.x+18,h?b.y+18:b.x+18),hi=Math.min(h?a.y+sa.h-18:a.x+sa.w-18,h?b.y+sb.h-18:b.x+sb.w-18);
      if(lo>hi)continue;
      const side=h?(a.x<b.x?1:3):(a.y<b.y?2:0),opposite=(side+2)%4;
      aligned.push({e,a,b,side,opposite,lo,hi,ideal:h?(a.y+sa.h/2+b.y+sb.h/2)/2:(a.x+sa.w/2+b.x+sb.w/2)/2});
    }
  }
  // Reserve a common coordinate at both ends before filling alternate sides.
  // Different degrees must not force a tiny dogleg between aligned classes.
  if(mode==='balanced')aligned.length=0;
  aligned.sort((a,b)=>(a.hi-a.lo)-(b.hi-b.lo)||a.e.id.localeCompare(b.e.id));
  for(const {e,a,b,side,opposite,lo,hi,ideal}of aligned){
    const value=choose(lo,hi,ideal,v=>available(a,side,v)&&available(b,opposite,v));
    if(value!==undefined){setPort(e,'source',a,side,value);setPort(e,'target',b,opposite,value);}
  }
  for(const n of nodes){const size=nodeSize(n),base=ports(n);
    slots.get(n.id).forEach((items,side)=>{
      items.sort((a,b)=>a.coordinate-b.coordinate||a.other.localeCompare(b.other)||a.key.localeCompare(b.key));
      items.forEach((item,i)=>{
        if(result.get(item.key)[side])return;
        const p={...base[side]},span=side%2?size.h:size.w;
        if(rectangular(n)){
          const origin=side%2?n.y:n.x,lo=origin+18,hi=origin+span-18;
          const coordinate=mode==='balanced'?(items.length===1?origin+span/2:origin+18+(span-36)*(i+1)/(items.length+1)):choose(lo,hi,item.coordinate,v=>available(n,side,v))??origin+18+(span-36)*(i+1)/(items.length+1);
          if(side%2)p.y=coordinate;else p.x=coordinate;reserve(n,side,coordinate);
        }
        result.get(item.key)[side]=p;
      });
    });
  }
  return result;
}

function improvesQuality(candidate,current){
  if(candidate.crossings>current.crossings||candidate.overlap>current.overlap+.001)return false;
  return candidate.crossings<current.crossings||candidate.overlap<current.overlap-.001||candidate.bends<current.bends||candidate.bends===current.bends&&candidate.length<current.length;
}

export class RoutingEngine {
  previous=new Map();
  cache=new Map();
  portMode='aligned';
  portKey='';
  cachedPorts=null;
  compute(nodes,edges) {
    const geometry=new Map(nodes.map(n=>[n.id,rectangle(n)])),lookup=new Map(nodes.map(n=>[n.id,n]));
    const changed=nodes.filter(n=>JSON.stringify(geometry.get(n.id))!==JSON.stringify(this.previous.get(n.id)));
    const allocationKey=mode=>JSON.stringify([mode,[...geometry],edges.map(e=>[e.id,e.source,e.target])]);
    const portsByEdge=this.cachedPorts&&this.portKey===allocationKey(this.portMode)?this.cachedPorts:allocatePorts(nodes,edges,lookup,this.portMode),portModes=new Map([[this.portMode,portsByEdge]]),next=new Map(),routes=[],pending=[];
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
    if(pending.length>1&&pending.length===routes.length&&(!this.cache.size||changed.length>1)){
      let quality=measureRoutes(routes);
      // Congestion depends on insertion order. Compare a bounded alternative
      // for normal homework-sized graphs before refining individual routes.
      if(routes.length<=80&&(quality.crossings||quality.overlap>.001)){
        const alternateMode=this.portMode==='aligned'?'balanced':'aligned',alternatePorts=allocatePorts(nodes,edges,lookup,alternateMode);
        portModes.set(alternateMode,alternatePorts);
        const alternatePending=pending.map(p=>({...p,options:{sourcePorts:alternatePorts.get(p.e.id+':source'),targetPorts:alternatePorts.get(p.e.id+':target')}}));
        const orders=[{order:pending.slice().reverse(),mode:this.portMode},{order:alternatePending,mode:alternateMode},{order:alternatePending.slice().reverse(),mode:alternateMode}];
        for(const {order,mode}of orders){
          const alternate=[],taken=[];
          for(const {e,a,b,options}of order){
            const points=routeEdge(a,b,nodes,{...options,occupied:taken});alternate.push({id:e.id,points});taken.push(...routeSegments(points));
          }
          const candidate=measureRoutes(alternate);
          if(alternate.every(r=>r.points)&&improvesQuality(candidate,quality)){
            const byId=new Map(alternate.map(r=>[r.id,r.points]));for(const r of routes){r.points=byId.get(r.id);next.get(r.id).points=r.points;}
            const optionsById=new Map(order.map(p=>[p.e.id,p.options]));for(const p of pending){p.options=optionsById.get(p.e.id);next.get(p.e.id).signature=JSON.stringify([p.e.source,p.e.target,p.options]);}
            this.portMode=mode;quality=candidate;
          }
        }
      }
      const worst=pending.slice().sort((a,b)=>quality.conflicts.get(b.e.id)-quality.conflicts.get(a.e.id)).slice(0,24);
      for(const {e,a,b,options,entry}of worst){
        if(!quality.conflicts.get(e.id))continue;
        const candidate=routeEdge(a,b,nodes,{...options,occupied:routes.filter(r=>r.id!==e.id).flatMap(r=>routeSegments(r.points))});
        if(!candidate)continue;
        const previous=entry.points;entry.points=candidate;const updated=measureRoutes(routes);
        if(improvesQuality(updated,quality)){quality=updated;next.get(e.id).points=candidate;}else entry.points=previous;
      }
    }
    this.previous=geometry;this.cache=next;this.portKey=allocationKey(this.portMode);this.cachedPorts=portModes.get(this.portMode);
    return {routes,computed,reused};
  }
}
