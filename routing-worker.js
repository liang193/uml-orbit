import {RoutingEngine} from './routing-engine.js';
const engine=new RoutingEngine();
self.onmessage=({data})=>{
  try{const start=performance.now();const result=engine.compute(data.nodes,data.edges);self.postMessage({revision:data.revision,...result,duration:performance.now()-start});}
  catch(error){self.postMessage({revision:data.revision,error:String(error)});}
};
