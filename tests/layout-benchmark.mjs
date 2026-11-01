import {performance} from 'node:perf_hooks';
import {writeFile,mkdir} from 'node:fs/promises';
import {layoutGraph,countLayoutCrossings} from '../graph-layout.js';
import {routeEdge} from '../router.js';
import {RoutingEngine} from '../routing-engine.js';
import {measureRoutes} from '../route-quality.js';
import {complexGraph,legacyLayout} from './layout-fixture.mjs';

const model=complexGraph(),old=legacyLayout(structuredClone(model.nodes),model.edges),oldById=new Map(old.map(n=>[n.id,n]));
let start=performance.now();
const before=measureRoutes(model.edges.map(e=>({id:e.id,points:routeEdge(oldById.get(e.source),oldById.get(e.target),old)}))),baselineMs=performance.now()-start;
start=performance.now();const layout=layoutGraph(model.nodes,model.edges),layoutMs=performance.now()-start;
const positions=new Map(layout.positions.map(p=>[p.id,p]));for(const n of model.nodes)Object.assign(n,positions.get(n.id));
start=performance.now();const result=new RoutingEngine().compute(model.nodes,model.edges),routeMs=performance.now()-start,after=measureRoutes(result.routes);
console.log(JSON.stringify({nodes:model.nodes.length,edges:model.edges.length,before:{crossings:before.crossings,overlapPixels:Math.round(before.overlap),straightCrossings:countLayoutCrossings(old,model.edges),routeMs:Math.round(baselineMs)},after:{crossings:after.crossings,overlapPixels:Math.round(after.overlap),straightCrossings:countLayoutCrossings(model.nodes,model.edges),layoutMs:Math.round(layoutMs),routeMs:Math.round(routeMs),missingRoutes:result.routes.filter(r=>!r.points).length}},null,2));
await mkdir(new URL('../release/',import.meta.url),{recursive:true});
await writeFile(new URL('../release/complex-layout.json',import.meta.url),JSON.stringify(model,null,2));
