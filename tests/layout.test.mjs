import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutGraph,countLayoutCrossings} from '../graph-layout.js';
import {nodeSize,rectangle,segmentBlocked,routeEdge} from '../router.js';
import {RoutingEngine} from '../routing-engine.js';
import {measureRoutes,segmentConflict,indexSegments,routePenalty} from '../route-quality.js';
import {complexGraph,legacyLayout} from './layout-fixture.mjs';

const node=id=>({id,name:id,type:'class',attrs:[],methods:[],x:0,y:0});
const apply=(nodes,edges)=>{const p=new Map(layoutGraph(nodes,edges).positions.map(n=>[n.id,n]));return nodes.map(n=>({...n,...p.get(n.id)}));};
const nonOverlapping=nodes=>{const r=nodes.map(n=>rectangle(n));for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)assert.ok(!(r[i].x<r[j].x+r[j].w&&r[i].x+r[i].w>r[j].x&&r[i].y<r[j].y+r[j].h&&r[i].y+r[i].h>r[j].y),'class boxes overlap');};
const safeRoutes=(nodes,result)=>{assert.equal(result.routes.filter(r=>!r.points).length,0);for(const r of result.routes)for(let i=1;i<r.points.length;i++){assert.ok(r.points[i].x===r.points[i-1].x||r.points[i].y===r.points[i-1].y);assert.equal(segmentBlocked(r.points[i-1],r.points[i],nodes.map(n=>rectangle(n))),false);}};

test('reorders crossed inheritance families, keeps parents above children and preserves input',()=>{
  const nodes=['A','B','C','X','Y','Z'].map(node),edges=[['X','C'],['Y','A'],['Z','B']].map(([source,target],i)=>({id:`e${i}`,source,target,type:'inheritance'}));
  const before=structuredClone(nodes),placed=apply(nodes,edges),lookup=new Map(placed.map(n=>[n.id,n]));
  assert.deepEqual(nodes,before);assert.equal(countLayoutCrossings(placed,edges),0);
  for(const e of edges)assert.ok(lookup.get(e.source).y>lookup.get(e.target).y);
  safeRoutes(placed,new RoutingEngine().compute(placed,edges));nonOverlapping(placed);
});

test('handles connected crossed layers, long edges, cycles, parallel edges, self edges and disconnected classes',()=>{
  const nodes=['Root','A','B','C','X','Y','Z','Alone'].map(node),edges=[['Root','A'],['Root','B'],['Root','C'],['A','Z'],['B','Y'],['C','X'],['Root','Y'],['Z','A'],['A','Z'],['Y','Y']].map(([source,target],i)=>({id:`e${i}`,source,target,type:'dependency'}));
  nodes[1].methods=['+ veryLongMethodName(argument: SomeLongProjectClassName): Map<String, List<SomeLongProjectClassName>>'];
  nodes[2].attrs=Array.from({length:20},(_,i)=>`- value${i}: String`);
  const input=structuredClone({nodes,edges}),placed=apply(nodes,edges);nonOverlapping(placed);safeRoutes(placed,new RoutingEngine().compute(placed,edges));
  assert.deepEqual({nodes,edges},input);assert.deepEqual(apply(nodes.slice().reverse(),edges.slice().reverse()).sort((a,b)=>a.id.localeCompare(b.id)),placed.slice().sort((a,b)=>a.id.localeCompare(b.id)));
  for(const n of placed){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.ok(nodeSize(n).w>0);}
  assert.deepEqual(layoutGraph([],[]).positions,[]);
});

test('places an otherwise independent parent close to a subtype deep in a dependency chain',()=>{
  const nodes=['A','B','C','Leaf','Base'].map(node),edges=[['A','B','dependency'],['B','C','dependency'],['C','Leaf','dependency'],['Leaf','Base','inheritance']].map(([source,target,type],i)=>({id:`e${i}`,source,target,type}));
  const placed=apply(nodes,edges),byId=new Map(placed.map(n=>[n.id,n]));
  assert.equal(byId.get('Base').y,byId.get('C').y);assert.ok(byId.get('Base').y<byId.get('Leaf').y);nonOverlapping(placed);
});

test('complex Java-style project reduces actual routed crossings and coincident lines without losing relations',()=>{
  const {nodes,edges}=complexGraph(),old=legacyLayout(structuredClone(nodes),edges),byId=new Map(old.map(n=>[n.id,n]));
  const baseline=measureRoutes(edges.map(e=>({id:e.id,points:routeEdge(byId.get(e.source),byId.get(e.target),old)})));
  const placed=apply(nodes,edges),engine=new RoutingEngine(),result=engine.compute(placed,edges),quality=measureRoutes(result.routes);
  assert.equal(result.routes.length,edges.length);safeRoutes(placed,result);nonOverlapping(placed);
  assert.ok(quality.crossings<baseline.crossings*.25,`${quality.crossings} versus ${baseline.crossings} crossings`);
  assert.ok(quality.overlap<baseline.overlap*.1,`${quality.overlap} versus ${baseline.overlap} overlapping pixels`);
  assert.ok(countLayoutCrossings(placed,edges)<countLayoutCrossings(old,edges));
  const warm=engine.compute(placed,edges);assert.equal(warm.computed,0);assert.deepEqual(warm.routes,result.routes);
});

test('separates multiple relations between the same classes and updates their ports after deletion',()=>{
  const nodes=[{...node('A'),x:0},{...node('B'),x:600}],edges=Array.from({length:3},(_,i)=>({id:`e${i}`,source:'A',target:'B',type:i?'dependency':'association'}));
  const engine=new RoutingEngine(),result=engine.compute(nodes,edges);safeRoutes(nodes,result);
  assert.equal(new Set(result.routes.map(r=>JSON.stringify(r.points))).size,3);
  const updated=engine.compute(nodes,edges.slice(0,1));safeRoutes(nodes,updated);assert.equal(updated.computed,1);assert.equal(updated.routes.length,1);
});

test('crossing and overlap costs count split segments once and the index matches direct scoring',()=>{
  const a={x:0,y:50},b={x:100,y:50},c={x:50,y:0},d={x:50,y:100},m={x:50,y:50};
  assert.equal(segmentConflict(a,b,c,d).crossings,1);assert.equal(segmentConflict(a,m,c,d).crossings+segmentConflict(m,b,c,d).crossings,1);
  assert.equal(segmentConflict(a,b,{x:20,y:50},{x:80,y:50}).overlap,60);
  const segments=[{a:c,b:d},{a:{x:20,y:50},b:{x:80,y:50}}],indexed=indexSegments(segments);
  for(const [start,end]of [[a,b],[c,d],[b,a],[d,c],[a,m]])assert.equal(routePenalty(start,end,indexed),routePenalty(start,end,segments));
});
