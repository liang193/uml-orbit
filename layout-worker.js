import {layoutGraph} from './graph-layout.js';
self.onmessage=({data})=>{
  try{self.postMessage({revision:data.revision,...layoutGraph(data.nodes,data.edges)});}
  catch(error){self.postMessage({revision:data.revision,error:String(error)});}
};
