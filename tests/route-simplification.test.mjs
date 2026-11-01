import test from 'node:test';
import assert from 'node:assert/strict';
import {routeEdge,compactRoute,rectangle,segmentBlocked,ports} from '../router.js';
import {routeSegments,measureRoutes,pathMetrics} from '../route-quality.js';
import {RoutingEngine} from '../routing-engine.js';

const node=(id,x,y)=>({id,name:id,type:'class',attrs:[],methods:[],x,y});
const detour=[{x:0,y:0},{x:26,y:0},{x:26,y:80},{x:174,y:80},{x:174,y:0},{x:200,y:0}];
const edges=(pairs)=>pairs.map(([source,target],i)=>({id:`e${i}`,source,target,type:'dependency'}));

test('aligned classes of different degrees connect directly without tiny doglegs',()=>{
  const nodes=[node('A',0,0),node('B',700,0),node('C',700,400)],result=new RoutingEngine().compute(nodes,edges([['A','B'],['A','C']]));
  const direct=result.routes.find(r=>r.id==='e0');assert.equal(direct.points.length,2);assert.equal(direct.points[0].y,direct.points[1].y);
  assert.equal(measureRoutes(result.routes).overlap,0);
});

test('parallel relations get separate straight lanes',()=>{
  const nodes=[node('A',0,0),node('B',700,0)],relations=edges([['A','B'],['A','B'],['B','A']]);
  const {routes}=new RoutingEngine().compute(nodes,relations),metrics=measureRoutes(routes);
  assert.equal(metrics.overlap,0);assert.equal(metrics.crossings,0);assert.equal(metrics.bends,0);
  assert.equal(new Set(routes.map(r=>r.points[0].y)).size,3);
});

test('compacts an unnecessary four-bend detour to a straight line',()=>{
  const clean=compactRoute(detour,[]);assert.deepEqual(clean,[detour[0],detour.at(-1)]);
});

test('refuses a shorter path if it creates a new crossing or overlaps a line',()=>{
  for(const occupied of [[{a:{x:100,y:-20},b:{x:100,y:50}}],[{a:{x:60,y:0},b:{x:140,y:0}}]]){
    const before=pathMetrics(detour,occupied),after=pathMetrics(compactRoute(detour,[],occupied),occupied);
    assert.equal(before.crossings,0);assert.equal(after.crossings,0);assert.equal(after.overlap,0);assert.equal(after.bends,4);
  }
});

test('compaction preserves class clearance and both attachment points',()=>{
  const boxes=[{x:80,y:-10,w:40,h:60}],clean=compactRoute(detour,boxes);
  assert.deepEqual(clean[0],detour[0]);assert.deepEqual(clean.at(-1),detour.at(-1));
  for(const {a,b}of routeSegments(clean))assert.equal(segmentBlocked(a,b,boxes),false);
});

test('routing goes around another line even when crossing it would save bends and length',()=>{
  const a=node('A',0,0),b=node('B',800,0),occupied=[{a:{x:500,y:-300},b:{x:500,y:400}}];
  const points=routeEdge(a,b,[a,b],{sourcePorts:[ports(a)[1]],targetPorts:[ports(b)[3]],occupied});
  assert.ok(points);const metrics=pathMetrics(points,occupied);assert.equal(metrics.crossings,0);assert.equal(metrics.overlap,0);assert.ok(metrics.bends>=4);
  for(const s of routeSegments(points))assert.equal(segmentBlocked(s.a,s.b,[rectangle(a),rectangle(b)]),false);
});

test('a blocked straight lane is offset without hiding any relation',()=>{
  const a=node('A',0,0),b=node('B',800,0),occupied=[{a:{x:300,y:52.5},b:{x:700,y:52.5}}];
  const points=routeEdge(a,b,[a,b],{sourcePorts:[ports(a)[1]],targetPorts:[ports(b)[3]],occupied});
  assert.ok(points);assert.equal(pathMetrics(points,occupied).overlap,0);assert.equal(pathMetrics(points,occupied).crossings,0);
});
