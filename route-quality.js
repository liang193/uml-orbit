// Shared quality measure for routing and regression benchmarks. Shared node ports
// are allowed; coincident line runs away from those ports are still congestion.
const epsilon=.001;
export const BEND_COST=110;
export const CROSSING_COST=800;
export const OVERLAP_COST=32;
export function routeSegments(points){return (points||[]).slice(1).map((b,i)=>({a:points[i],b})).filter(s=>s.a.x!==s.b.x||s.a.y!==s.b.y);}
export function segmentConflict(a,b,c,d){
  const horizontal=a.y===b.y,otherHorizontal=c.y===d.y;
  if(horizontal===otherHorizontal){
    if(Math.abs((horizontal?a.y:a.x)-(horizontal?c.y:c.x))>epsilon)return {crossings:0,overlap:0};
    const lo=Math.max(Math.min(horizontal?a.x:a.y,horizontal?b.x:b.y),Math.min(horizontal?c.x:c.y,horizontal?d.x:d.y));
    const hi=Math.min(Math.max(horizontal?a.x:a.y,horizontal?b.x:b.y),Math.max(horizontal?c.x:c.y,horizontal?d.x:d.y));
    return {crossings:0,overlap:Math.max(0,hi-lo)};
  }
  const h=horizontal?[a,b]:[c,d],v=horizontal?[c,d]:[a,b],x=v[0].x,y=h[0].y;
  // Half-open intervals count a crossing at a grid subdivision exactly once.
  const hit=x>Math.min(h[0].x,h[1].x)+epsilon&&x<=Math.max(h[0].x,h[1].x)+epsilon&&y>Math.min(v[0].y,v[1].y)+epsilon&&y<=Math.max(v[0].y,v[1].y)+epsilon;
  return {crossings:hit?1:0,overlap:0};
}
export function routePenalty(a,b,segments){if(segments.penalty)return segments.penalty(a,b);let cost=0;for(const s of segments){const c=segmentConflict(a,b,s.a,s.b);cost+=c.crossings*CROSSING_COST+c.overlap*OVERLAP_COST;}return cost;}
export function indexSegments(segments,{avoidOverlap=false}={}){
  const rows=new Map(),columns=new Map();
  function conflict(a,b){
    const h=a.y===b.y,key=h?a.y:a.x,map=h?rows:columns;
    if(!map.has(key))map.set(key,segments.filter(s=>{
      const same=(s.a.y===s.b.y)===h;
      return same?Math.abs((h?s.a.y:s.a.x)-key)<epsilon:key>Math.min(h?s.a.y:s.a.x,h?s.b.y:s.b.x)+epsilon&&key<=Math.max(h?s.a.y:s.a.x,h?s.b.y:s.b.x)+epsilon;
    }));
    let crossings=0,overlap=0;for(const s of map.get(key)){const c=segmentConflict(a,b,s.a,s.b);crossings+=c.crossings;overlap+=c.overlap;}return {crossings,overlap};
  }
  return {length:segments.length,segments,avoidOverlap,conflict,penalty(a,b){const c=conflict(a,b);return avoidOverlap&&c.overlap>epsilon?Infinity:c.crossings*CROSSING_COST+c.overlap*OVERLAP_COST;}};
}
export function pathMetrics(points,occupied=[]){
  const segments=routeSegments(points);let crossings=0,overlap=0,length=0;
  for(const {a,b}of segments){length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);for(const s of occupied.segments||occupied){const c=segmentConflict(a,b,s.a,s.b);crossings+=c.crossings;overlap+=c.overlap;}}
  const bends=Math.max(0,segments.length-1);
  return {crossings,overlap,length,bends,cost:crossings*CROSSING_COST+overlap*OVERLAP_COST+length+bends*BEND_COST};
}
export function measureRoutes(routes){
  const lines=routes.filter(r=>r.points).map(r=>({...r,segments:routeSegments(r.points)}));
  let crossings=0,overlap=0,bends=0,length=0;const conflicts=new Map(lines.map(r=>[r.id,0]));
  for(const r of lines){bends+=Math.max(0,r.segments.length-1);for(const {a,b}of r.segments)length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j];let cost=0;
    for(const s of a.segments)for(const t of b.segments){const c=segmentConflict(s.a,s.b,t.a,t.b);crossings+=c.crossings;overlap+=c.overlap;cost+=c.crossings*CROSSING_COST+c.overlap*OVERLAP_COST;}
    conflicts.set(a.id,conflicts.get(a.id)+cost);conflicts.set(b.id,conflicts.get(b.id)+cost);
  }
  return {crossings,overlap,bends,length,cost:crossings*CROSSING_COST+overlap*OVERLAP_COST+bends*BEND_COST+length,conflicts};
}
