import {formatMember,splitJava} from './java-assist.js';
import {nodeSize} from './router.js';

// Structural source reader: comments/strings are masked at identical offsets.
// Bodies are skipped with balanced braces, never evaluated or executed.
function maskSource(source){
  const chars=source.split('');let i=0;
  while(i<source.length){
    if(source.startsWith('//',i)){while(i<source.length&&source[i]!=='\n')chars[i++]=' ';}
    else if(source.startsWith('/*',i)){chars[i++]=' ';chars[i++]=' ';while(i<source.length&&!source.startsWith('*/',i)){if(chars[i]!=='\n')chars[i]=' ';i++;}if(i<source.length){chars[i++]=' ';chars[i++]=' ';}}
    else if(source[i]==='"'||source[i]==="'"){
      const triple=source.startsWith('"""',i),quote=triple?'"""':source[i],length=quote.length;
      for(let j=0;j<length;j++)chars[i++]=' ';
      while(i<source.length&&!source.startsWith(quote,i)){if(source[i]==='\\'){chars[i++]=' ';if(i<source.length)chars[i++]=' ';}else{if(chars[i]!=='\n')chars[i]=' ';i++;}}
      for(let j=0;j<length&&i<source.length;j++)chars[i++]=' ';
    }else i++;
  }
  return chars.join('');
}
function closeBrace(mask,open){let depth=1;for(let i=open+1;i<mask.length;i++){if(mask[i]==='{')depth++;if(mask[i]==='}'&&!--depth)return i;}return -1;}
function stripAnnotations(s){return s.replace(/@[\w.]+(?:\([^)]*\))?\s*/g,'').trim();}
function topMembers(source,mask,open,close,kind){
  const attrs=[],methods=[],fieldInfo=[],methodInfo=[];let start=open+1;
  const declaration=(end,body='')=>{
    // Masked text has the same offsets, but contains neither comments nor string
    // contents. Using the raw source here previously leaked comments into UML.
    const visible=stripAnnotations(mask.slice(start,end)).replace(/\s+/g,' ').trim();
    if(!visible)return;
    const signature=visible.split('=')[0];
    if(signature.includes('(')){let value=formatMember(visible);if(kind==='interface'&&value.startsWith('~ '))value='+ '+value.slice(2);methods.push(value);methodInfo.push({signature:value,body,java:visible});}
    else if(kind==='enum'&&!/\s/.test(visible.replace(/\s*,\s*/g,',')))attrs.push(...splitJava(visible));
    else{
      const pieces=splitJava(visible);const match=pieces[0]?.split('=')[0].trim().match(/^(.+)\s+([\w$]+)(?:\[\])?$/);
      pieces.forEach((part,i)=>{const java=i&&match?match[1]+' '+part:part;const v=formatMember(java);attrs.push(kind==='interface'&&v.startsWith('~ ')?'+ '+v.slice(2):v);fieldInfo.push({signature:v,java});});
    }
  };
  for(let i=start;i<close;i++){
    if(mask[i]===';'){declaration(i);start=i+1;}
    else if(mask[i]==='{'){
      const end=closeBrace(mask,i);if(end<0)break;
      const prefix=mask.slice(start,i);
      if(!prefix.includes('=')&&!/\b(class|interface|enum|record)\b/.test(prefix)&&prefix.includes('('))declaration(i,mask.slice(i+1,end));
      if(!prefix.includes('='))start=end+1;
      i=end;
    }
  }
  return {attrs,methods,fieldInfo,methodInfo};
}
function baseNames(s){return splitJava(s).map(t=>t.replace(/<.*>/g,'').trim().split(/\s/)[0]).filter(Boolean);}
function relationshipHeader(header){let angles=0,parens=0;return header.split('').map(c=>{if(c==='<'){angles++;return ' ';}if(c==='>'){angles=Math.max(0,angles-1);return ' ';}if(c==='('){parens++;return ' ';}if(c===')'){parens=Math.max(0,parens-1);return ' ';}return angles||parens?' ':c;}).join('');}
export function parseJavaSources(files,{fieldRelations=true,dependencyRelations=true,inferOwnership=true}={}){
  const nodes=[],edges=[],warnings=[],declarations=[];
  for(const file of files){
    const source=file.content,mask=maskSource(source),pkg=mask.match(/\bpackage\s+([\w.]+)\s*;/)?.[1]||'';
    const pattern=/\b(class|interface|enum|record)\s+([\w$]+)([^{};]*)\{/g;let match;
    while((match=pattern.exec(mask))){
      const open=pattern.lastIndex-1,close=closeBrace(mask,open);if(close<0){warnings.push(`${file.name}：${match[2]} 的花括号未闭合，已跳过。`);continue;}
      const type=match[1]==='interface'?'interface':match[1]==='enum'?'enum':/\babstract\s*$/.test(mask.slice(Math.max(0,match.index-60),match.index))?'abstract':'class';
      const enclosing=declarations.filter(d=>d.file===file.name&&d.open<open&&d.close>close).at(-1);
      const qualified=[pkg,enclosing?.localName,match[2]].filter(Boolean).join('.'),localName=[enclosing?.localName,match[2]].filter(Boolean).join('.');
      if(nodes.some(n=>n.id===qualified)){warnings.push(`重复类型 ${qualified}，已跳过后一个声明。`);continue;}
      const members=topMembers(source,mask,open,close,match[1]);
      if(match[1]==='record'){const components=match[3].match(/^\s*(?:<[^>]+>)?\s*\((.*?)\)/s)?.[1];if(components)members.attrs.unshift(...splitJava(components).map(p=>formatMember('private final '+p)));}
      const node={id:qualified,type,name:match[2],stereo:match[1]==='record'?'record':'',color:type==='interface'?'#ac9df2':'#b4f4d0',attrs:members.attrs,methods:members.methods,x:0,y:0};nodes.push(node);
      declarations.push({node,fieldInfo:members.fieldInfo,methodInfo:members.methodInfo,header:match[3],pkg,localName,open,close,file:file.name,imports:[...mask.matchAll(/\bimport\s+(?!static\s)([\w.]+)\s*;/g)].map(m=>m[1])});
    }
  }
  function resolve(name,declaration){
    const clean=name.replace(/<.*>/g,'').trim();const exact=nodes.find(n=>n.id===clean||n.id===[declaration.pkg,clean].filter(Boolean).join('.'));if(exact)return exact;
    const imported=declaration.imports.find(i=>i.endsWith('.'+clean));if(imported)return nodes.find(n=>n.id===imported);
    const candidates=nodes.filter(n=>n.name===clean);return candidates.length===1?candidates[0]:null;
  }
  const add=(source,target,type,label='',extra={})=>{if(!target||edges.some(e=>e.source===source&&e.target===target.id&&e.type===type&&e.label===label))return;edges.push({id:`java-edge-${edges.length}`,source,target:target.id,type,label,start:type==='composition'?'filledDiamond':type==='aggregation'?'diamond':'none',end:type==='inheritance'||type==='realization'?'triangle':['aggregation','composition','association'].includes(type)?'none':'arrow',line:['realization','dependency'].includes(type)?'dashed':'solid',...extra});};
  const references=(text,d)=>[...new Map((text.match(/[\w$.]+/g)||[]).map(token=>resolve(token,d)).filter(Boolean).map(n=>[n.id,n])).values()];
  let unresolved=0;
  for(const d of declarations){
    const header=relationshipHeader(d.header);
    const ext=header.match(/\bextends\s+(.+?)(?=\bimplements\b|\bpermits\b|$)/s)?.[1];
    const impl=header.match(/\bimplements\s+(.+?)(?=\bpermits\b|$)/s)?.[1];
    for(const [clause,type]of [[ext,'inheritance'],[impl,'realization']])if(clause)for(const name of baseNames(clause)){const target=resolve(name,d);if(target)add(d.node.id,target,type);else unresolved++;}
    if(fieldRelations)for(const attr of d.node.attrs){const match=attr.match(/^[+\-#~]\s+([\w$]+):\s*(.*?)(?:\s*\{.*\})?$/);if(!match)continue;
      const [,field,typeText]=match,many=/\[\s*\]|\b(?:List|Set|Collection|Iterable|Map|Queue|Deque)\s*</.test(typeText);
      const info=d.fieldInfo.find(f=>f.signature===attr);
      const assignedFromOutside=d.methodInfo.some(m=>{const parameters=m.signature.slice(m.signature.indexOf('(')+1,m.signature.lastIndexOf(')'));return splitJava(parameters).some(p=>{const name=p.split(':')[0].trim();return /^[\w$]+$/.test(name)&&new RegExp(`(?:this\\.)?${field}\\s*=\\s*${name}\\b`).test(m.body);});});
      const exposed=!attr.startsWith('- ')||attr.includes('{static}')||d.methodInfo.some(m=>!m.signature.startsWith('- ')&&new RegExp(`\\breturn\\s+(?:this\\.)?${field}\\s*;`).test(m.body));
      for(const target of references(typeText,d)){
        const createdInside=(info?.java.includes('=')&&new RegExp(`=\\s*new\\s+(?:[\\w$]+\\.)*${target.name}\\b`).test(info.java))||d.methodInfo.some(m=>new RegExp(`(?:this\\.)?${field}\\s*=\\s*new\\s+(?:[\\w$]+\\.)*${target.name}\\b`).test(m.body));
        const type=inferOwnership&&!exposed&&!assignedFromOutside&&createdInside?'composition':inferOwnership&&many&&assignedFromOutside?'aggregation':'directed';
        add(d.node.id,target,type,field,{targetCardinality:many?'0..*':undefined,...(type==='directed'?{}:{inferred:true,evidence:type==='composition'?'私有字段在内部创建，未检测到外部注入或公开返回':'集合或数组字段由方法参数传入'})});
      }
    }
  }
  // A two-way association requires two actual fields, not a comment claiming it.
  for(const e of edges.filter(e=>e.type==='directed'))if(e.source!==e.target&&edges.some(other=>other.type==='directed'&&other.source===e.target&&other.target===e.source)){
    const reverse=edges.find(other=>other.type==='directed'&&other.source===e.target&&other.target===e.source);e.type='association';e.end='none';e.label=`${e.label} / ${reverse.label}`;edges.splice(edges.indexOf(reverse),1);
  }
  if(dependencyRelations)for(const d of declarations){
    for(const m of d.methodInfo){
      const open=m.signature.indexOf('('),close=m.signature.lastIndexOf(')');
      const params=splitJava(m.signature.slice(open+1,close)).map(p=>p.slice(p.indexOf(':')+1)).join(' ');
      const types=params+' '+m.signature.slice(close+1)+' '+(m.java.match(/\bthrows\s+(.+)$/)?.[1]||'');
      const local=[...m.body.matchAll(/\bnew\s+([\w$.]+)/g),...m.body.matchAll(/(?:^|[;{}])\s*(?:final\s+)?([A-Z][\w$.]*(?:<[^;{}=]+>)?(?:\[\])?)\s+[\w$]+\s*(?==|;|:)/g)].map(match=>match[1]).join(' ');
      for(const target of references(types+' '+local,d))if(target.id!==d.node.id&&!edges.some(e=>e.source===d.node.id&&e.target===target.id))add(d.node.id,target,'dependency');
    }
  }
  const inferred=edges.filter(e=>e.inferred).length;
  if(inferred)warnings.push(`${inferred} 条聚合/组合是基于字段创建、注入方式的候选推断，生命周期和独占所有权仍需人工确认；双击关系线可修改。`);
  if(unresolved)warnings.push(`${unresolved} 个父类或接口未在导入源码中找到，未创建占位节点。`);
  const nameCounts=new Map();nodes.forEach(n=>nameCounts.set(n.name,(nameCounts.get(n.name)||0)+1));nodes.forEach(n=>{if(nameCounts.get(n.name)>1)n.name=n.id;});
  // Parents first, then subtypes; row sizes follow actual member text widths.
  const levels=new Map();function level(n,visiting=new Set()){if(levels.has(n.id))return levels.get(n.id);if(visiting.has(n.id))return 0;visiting.add(n.id);const parents=edges.filter(e=>e.source===n.id&&['inheritance','realization'].includes(e.type)).map(e=>nodes.find(n=>n.id===e.target)).filter(Boolean);const value=parents.length?Math.min(6,1+Math.max(...parents.map(p=>level(p,new Set(visiting))))):0;levels.set(n.id,value);return value;}
  let y=70;const groups=new Map();for(const n of nodes){const l=level(n);if(!groups.has(l))groups.set(l,[]);groups.get(l).push(n);}
  for(const [,group]of [...groups].sort((a,b)=>a[0]-b[0])){let x=60,rowHeight=0;for(let i=0;i<group.length;i++){const n=group[i],size=nodeSize(n);if(i&&i%3===0){y+=rowHeight+110;x=60;rowHeight=0;}n.x=x;n.y=y;x+=size.w+120;rowHeight=Math.max(rowHeight,size.h);}y+=rowHeight+150;}
  if(!nodes.length)warnings.push('没有识别到 class / interface / enum / record 声明。');
  return {version:1,name:'Java 源码 · 类图',nodes,edges,warnings};
}
