import test from 'node:test';
import assert from 'node:assert/strict';
import {routeEdge,rectangle,segmentBlocked,nodeSize} from '../router.js';
const node=(id,x,y,type='class')=>({id,x,y,type,name:id,attrs:[],methods:[]});
function verifyRoute(a,b,nodes){
  const pts=routeEdge(a,b,nodes);assert.ok(pts,'an unobstructed route must exist');assert.ok(pts.length>=2);
  for(let i=1;i<pts.length;i++){
    assert.ok(pts[i].x===pts[i-1].x||pts[i].y===pts[i-1].y,'segments must be orthogonal');
    assert.equal(segmentBlocked(pts[i-1],pts[i],nodes.map(n=>rectangle(n))),false,'no segment may enter any node');
  }
  const onBoundary=(p,n)=>{const {w,h}=nodeSize(n);return (p.x===n.x||p.x===n.x+w)&&p.y>=n.y&&p.y<=n.y+h||(p.y===n.y||p.y===n.y+h)&&p.x>=n.x&&p.x<=n.x+w;};
  assert.ok(onBoundary(pts[0],a));assert.ok(onBoundary(pts.at(-1),b));return pts;
}
test('routes around an unrelated class between endpoints',()=>{const a=node('a',0,0),b=node('b',700,0),o=node('obstacle',340,-40);verifyRoute(a,b,[a,b,o]);});
test('recomputes safely while a blocker is dragged across the direct path',()=>{const a=node('a',0,0),b=node('b',700,0);for(let y=-220;y<=220;y+=20){verifyRoute(a,b,[a,b,node('moving',340,y)]);}});
test('supports self relationships outside its own rectangle',()=>{const a=node('self',-200,-100);verifyRoute(a,a,[a]);});
test('self relationships can choose another side when the top port is blocked',()=>{const a=node('self',0,0);verifyRoute(a,a,[a,node('above',0,-110)]);});
test('routes through a corridor surrounded by several elements',()=>{const a=node('a',0,220),b=node('b',950,220),obstacles=[node('o1',320,80),node('o2',320,380),node('o3',640,220)];verifyRoute(a,b,[a,b,...obstacles]);});
test('overlapping elements never produce a line through a class',()=>{const a=node('a',0,0),b=node('b',0,0);assert.equal(routeEdge(a,b,[a,b]),null);});
test('works with negative coordinates and long member lists',()=>{const a=node('a',-800,-600),b=node('b',50,-100);a.methods=Array.from({length:20},(_,i)=>`+ method${i}(): String`);verifyRoute(a,b,[a,b,node('c',-300,-450)]);});
test('supports all palette shape dimensions and ports',()=>{for(const type of ['actor','initial','final','decision','fork','package','note','usecase','component','node','state','activity','lifeline','interface','abstract','enum','object']){const a=node('a',0,0,type),b=node('b',500,400,type);verifyRoute(a,b,[a,b]);}});
