import {rectangle,routeEdge,segmentBlocked} from './router.js';

// A moved obstacle only invalidates paths it actually blocks. Moving either
// endpoint always invalidates its route. Keep the cache outside the UI thread.
export class RoutingEngine {
  previous=new Map();
  cache=new Map();
  compute(nodes,edges) {
    const geometry=new Map(nodes.map(n=>[n.id,rectangle(n)]));
    const changed=nodes.filter(n=>JSON.stringify(geometry.get(n.id))!==JSON.stringify(this.previous.get(n.id)));
    const lookup=new Map(nodes.map(n=>[n.id,n]));
    const next=new Map(),routes=[];let computed=0,reused=0;
    for(const e of edges){
      const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)continue;
      const key=e.source+'>'+e.target,old=this.cache.get(key);
      let points=old?.points;
      const endpointsChanged=changed.some(n=>n.id===e.source||n.id===e.target);
      if(!points||endpointsChanged||changed.some(n=>{const box=rectangle(n,16);return points.slice(1).some((p,i)=>segmentBlocked(points[i],p,[box]));})){
        points=routeEdge(a,b,nodes);computed++;
      }else reused++;
      next.set(key,{points});routes.push({id:e.id,points});
    }
    this.previous=geometry;this.cache=next;
    return {routes,computed,reused};
  }
}
