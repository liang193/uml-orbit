import {parseJavaSources} from './java-import.js';
self.onmessage=({data})=>{try{self.postMessage({revision:data.revision,result:parseJavaSources(data.files,data.options)});}catch(error){self.postMessage({revision:data.revision,error:String(error)});}};
