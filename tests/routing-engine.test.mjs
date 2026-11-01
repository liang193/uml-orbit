import test from 'node:test';
import assert from 'node:assert/strict';
import {RoutingEngine} from '../routing-engine.js';
import {rectangle,segmentBlocked} from '../router.js';
const node=(id,x,y)=>({id,x,y,type:'class',name:id,attrs:[],methods:[]});
test('reuses stable routes and invalidates routes blocked by a moving obstacle',()=>{
  const engine=new RoutingEngine(),nodes=[node('a',0,0),node('b',800,0),node('c',380,400)],edges=[{id:'e',source:'a',target:'b'}];
  assert.equal(engine.compute(nodes,edges).computed,1);assert.equal(engine.compute(nodes,edges).reused,1);
  nodes[2].x=400;assert.equal(engine.compute(nodes,edges).computed,0);
  nodes[2].y=-20;const result=engine.compute(nodes,edges);assert.equal(result.computed,1);
  for(const {points}of result.routes)for(let i=1;i<points.length;i++)assert.equal(segmentBlocked(points[i-1],points[i],nodes.map(n=>rectangle(n))),false);
  nodes[0].x=-50;assert.equal(engine.compute(nodes,edges).computed,1);
});
