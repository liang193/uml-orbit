import {nodeSize} from '../router.js';

export function complexGraph(){
  const nodes=[],edges=[];
  const add=(id,type='class')=>nodes.push({id,name:id,type,color:type==='interface'?'#ac9df2':'#b4f4d0',attrs:['- id: Long'],methods:[`+ ${id.startsWith('Controller')?'handleRequest(request: Request): Response':'execute(): void'}`],x:0,y:0});
  const link=(a,b,type='directed')=>edges.push({id:`e${edges.length}`,source:a,target:b,type,label:'',line:type==='dependency'||type==='realization'?'dashed':'solid',start:type==='composition'?'filledDiamond':'none',end:['inheritance','realization'].includes(type)?'triangle':'arrow'});
  // Deliberately interleaved declaration order, as in a multi-file upload.
  for(let i=0;i<4;i++){add(`Controller${i}`);add(`Repository${3-i}`);add(`Entity${i}`);add(`Service${3-i}`);add(`Gateway${i}`,'interface');add(`Adapter${i}`);}
  add('BaseEntity','abstract');add('Request');add('Response');add('Event');
  for(let i=0;i<4;i++){
    link(`Entity${i}`,'BaseEntity','inheritance');link(`Adapter${i}`,`Gateway${i}`,'realization');
    link(`Controller${i}`,`Service${i}`);link(`Controller${i}`,'Request','dependency');link(`Controller${i}`,'Response','dependency');
    link(`Service${i}`,`Repository${i}`);link(`Repository${i}`,`Entity${i}`);link(`Service${i}`,`Gateway${i}`);link(`Service${i}`,'Event','dependency');
    if(i<3)link(`Service${i}`,`Service${i+1}`,'dependency');
  }
  return {version:1,name:'复杂 Java 项目 · 布局验证',nodes,edges};
}

// The previous production layout: inheritance levels, three declarations/row.
export function legacyLayout(nodes,edges){
  const levels=new Map(),byId=new Map(nodes.map(n=>[n.id,n]));
  function level(n,seen=new Set()){
    if(levels.has(n.id))return levels.get(n.id);if(seen.has(n.id))return 0;seen.add(n.id);
    const parents=edges.filter(e=>e.source===n.id&&['inheritance','realization'].includes(e.type)).map(e=>byId.get(e.target)).filter(Boolean);
    const value=parents.length?Math.min(6,1+Math.max(...parents.map(p=>level(p,new Set(seen))))):0;levels.set(n.id,value);return value;
  }
  const groups=new Map();for(const n of nodes){const l=level(n);if(!groups.has(l))groups.set(l,[]);groups.get(l).push(n);}
  let y=70;for(const [,group]of [...groups].sort((a,b)=>a[0]-b[0])){let x=60,rowHeight=0;for(let i=0;i<group.length;i++){const n=group[i],s=nodeSize(n);if(i&&i%3===0){y+=rowHeight+110;x=60;rowHeight=0;}n.x=x;n.y=y;x+=s.w+120;rowHeight=Math.max(rowHeight,s.h);}y+=rowHeight+150;}
  return nodes;
}
