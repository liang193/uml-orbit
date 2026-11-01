import {nodeSize,rectangle,pathData,pathMiddle,classifierHeader,memberDisplay,segmentBlocked} from './router.js';
import {formatMember} from './java-assist.js';
import {installJavaEditor} from './java-editor.js';
import {installJavaImport} from './java-import-ui.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NS='http://www.w3.org/2000/svg', STORAGE='uml-orbit-v1';
const COLORS=['#b4f4d0','#ac9df2','#91b8f7','#f1c88c','#f19db7','#8ad6dd'];
const TYPES={
  class:{name:'类',symbol:'▤',group:'结构 · STRUCTURE'},interface:{name:'接口',symbol:'◈',group:'结构 · STRUCTURE'},abstract:{name:'抽象类',symbol:'𝘈',group:'结构 · STRUCTURE'},enum:{name:'枚举',symbol:'☷',group:'结构 · STRUCTURE'},object:{name:'对象',symbol:': □',group:'结构 · STRUCTURE'},package:{name:'包 / 分组',symbol:'▱',group:'结构 · STRUCTURE'},
  actor:{name:'参与者',symbol:'♙',group:'用例与部署 · CONTEXT'},usecase:{name:'用例',symbol:'⬭',group:'用例与部署 · CONTEXT'},component:{name:'组件',symbol:'⊞',group:'用例与部署 · CONTEXT'},node:{name:'部署节点',symbol:'⬡',group:'用例与部署 · CONTEXT'},
  state:{name:'状态',symbol:'▢',group:'行为 · BEHAVIOR'},activity:{name:'活动',symbol:'▰',group:'行为 · BEHAVIOR'},decision:{name:'判断 / 合并',symbol:'◇',group:'行为 · BEHAVIOR'},initial:{name:'初始节点',symbol:'●',group:'行为 · BEHAVIOR'},final:{name:'终止节点',symbol:'◉',group:'行为 · BEHAVIOR'},fork:{name:'分叉 / 汇合',symbol:'━',group:'行为 · BEHAVIOR'},lifeline:{name:'生命线',symbol:'┬',group:'行为 · BEHAVIOR'},note:{name:'注释',symbol:'▧',group:'辅助 · ANNOTATION'}
};
const RELATIONS={
  association:{name:'关联',symbol:'―',start:'none',end:'none',line:'solid',desc:'元素之间的结构联系。可添加两端多重性。'},
  directed:{name:'有向关联',symbol:'→',start:'none',end:'arrow',line:'solid',desc:'从起点导航到终点。'},
  inheritance:{name:'泛化 / 继承',symbol:'—▷',start:'none',end:'triangle',line:'solid',desc:'起点是子类，空心三角指向父类。接口之间也可使用泛化。'},
  realization:{name:'实现',symbol:'┄▷',start:'none',end:'triangle',line:'dashed',desc:'起点是实现类，虚线空心三角指向终点接口。'},
  dependency:{name:'依赖',symbol:'⇢',start:'none',end:'arrow',line:'dashed',desc:'起点使用或依赖终点，箭头指向被依赖元素。'},
  aggregation:{name:'聚合',symbol:'◇—',start:'diamond',end:'none',line:'solid',desc:'空心菱形位于整体端（起点），终点是可独立存在的部分。'},
  composition:{name:'组合',symbol:'◆—',start:'filledDiamond',end:'none',line:'solid',desc:'实心菱形位于整体端（起点），终点是生命周期依赖整体的部分。'},
  include:{name:'包含 «include»',symbol:'⇢',start:'none',end:'arrow',line:'dashed',desc:'基础用例指向被包含用例。'},
  extend:{name:'扩展 «extend»',symbol:'⇢',start:'none',end:'arrow',line:'dashed',desc:'扩展用例指向被扩展的基础用例。'},
  flow:{name:'控制流 / 消息',symbol:'→',start:'none',end:'filledArrow',line:'solid',desc:'从起点流向终点，可在名称中填写条件或消息。'},
  return:{name:'返回消息',symbol:'⇢',start:'none',end:'arrow',line:'dashed',desc:'虚线表示返回消息。'},
  custom:{name:'自定义连接',symbol:'↗',start:'none',end:'arrow',line:'solid',desc:'自由选择两端箭头、线型、名称和多重性。'}
};
const MARKERS={none:'无箭头',arrow:'开放箭头 →',triangle:'空心三角 ▷',filledArrow:'实心三角 ▶',diamond:'空心菱形 ◇',filledDiamond:'实心菱形 ◆',circle:'空心圆 ○'};
const memberType=t=>['class','abstract','interface','enum','object'].includes(t);
const id=()=>crypto.randomUUID();
function sample(){return {version:1,name:'订单系统 · 类图',nodes:[
  {id:'repo',type:'interface',name:'Repository',x:400,y:100,color:COLORS[1],attrs:[],methods:['+ findById(id: String): T','+ save(entity: T): void']},
  {id:'order',type:'class',name:'Order',x:60,y:420,color:COLORS[0],attrs:['- id: String','- status: OrderStatus','- createdAt: DateTime'],methods:['+ calculateTotal(): Money','+ cancel(): void']},
  {id:'service',type:'class',name:'OrderService',stereo:'service',x:400,y:420,color:COLORS[2],attrs:['- repository: Repository'],methods:['+ createOrder(): Order','+ findOrder(id: String): Order']},
  {id:'item',type:'class',name:'OrderItem',x:65,y:790,color:COLORS[0],attrs:['- quantity: int','- unitPrice: Money'],methods:['+ subtotal(): Money']},
  {id:'db',type:'class',name:'OrderRepository',x:820,y:420,color:COLORS[1],attrs:['- connection: Database'],methods:['+ findById(id: String): Order','+ save(order: Order): void']},
  {id:'note',type:'note',name:'建模备忘',x:820,y:100,color:COLORS[3],body:'让每一个关系，都清晰可见。\n\n点击 C，连接两个元素；\n单击节点，编辑你的想法。'}
],edges:[
 {id:'e1',source:'db',target:'repo',type:'realization',...RELATIONS.realization,label:'implements'},
 {id:'e2',source:'service',target:'repo',type:'dependency',...RELATIONS.dependency,label:'依赖'},
 {id:'e3',source:'service',target:'order',type:'directed',...RELATIONS.directed,label:'创建',targetCardinality:'0..*'},
 {id:'e4',source:'order',target:'item',type:'composition',...RELATIONS.composition,label:'包含',sourceCardinality:'1',targetCardinality:'1..*'},
 {id:'e5',source:'service',target:'db',type:'association',...RELATIONS.association,label:'持久化'}
]};}
let model=sample(),selection=null,mode='select',pending=null,view={x:0,y:0,zoom:1},undoStack=[],redoStack=[],drag=null,space=false;
let editingNode=null,creatingType='class',nodeColor=COLORS[0],editingEdge=null,pair=null,renderFrame=0,toastTimer,routeWarnings=0;
let routeRevision=0,routeBusy=false,routeQueued=null,pickerEdge=null,pressTimer=0;
let dragFrameCosts=[];
const routeCache=new Map(),nodeElements=new Map(),edgeElements=new Map();
const routingWaiters=[];
const routingWorker=new Worker(new URL('./routing-worker.js',import.meta.url),{type:'module'});
routingWorker.onmessage=({data})=>{
  routeBusy=false;
  if(data.revision===routeRevision&&!data.error){
    routeCache.clear();for(const r of data.routes)routeCache.set(r.id,r.points);
    renderEdges();
    document.querySelector('.routing-status').title=`后台寻路 ${data.duration.toFixed(1)}ms · 复用 ${data.reused} 条路径`;
    if(!drag)renderInspector();
  }
  if(routeQueued)dispatchRoutes();
  else if(!routeBusy){for(const resolve of routingWaiters.splice(0))resolve();}
};
routingWorker.onerror=()=>{routeBusy=false;for(const resolve of routingWaiters.splice(0))resolve();toast('后台寻路发生错误，请刷新页面重试。');};
function scheduleRoutes(){routeQueued={revision:++routeRevision,nodes:model.nodes,edges:model.edges.map(({id,source,target})=>({id,source,target}))};if(!routeBusy)dispatchRoutes();}
function dispatchRoutes(){routeBusy=true;routingWorker.postMessage(routeQueued);routeQueued=null;}
function validModel(m){
  if(!m||m.version!==1||typeof m.name!=='string'||m.name.length>100||!Array.isArray(m.nodes)||!Array.isArray(m.edges)||m.nodes.length>150||m.edges.length>300)throw Error('项目格式无效，或超过 150 个元素 / 300 个关系的限制。');
  const ids=new Set();
  const str=(v,max=5000)=>v===undefined||(typeof v==='string'&&v.length<=max);
  for(const n of m.nodes){if(!n||typeof n.id!=='string'||ids.has(n.id)||!TYPES[n.type]||!str(n.name,100)||!n.name||!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>100000||Math.abs(n.y)>100000||!/^#[0-9a-f]{6}$/i.test(n.color)||!str(n.body)||!str(n.stereo,80))throw Error('元素数据无效。');for(const k of ['attrs','methods'])if(n[k]!==undefined&&(!Array.isArray(n[k])||n[k].length>100||!n[k].every(s=>typeof s==='string'&&s.length<=2000)))throw Error('属性或方法格式无效。');ids.add(n.id);}
  const eids=new Set();
  for(const e of m.edges){if(!e||typeof e.id!=='string'||eids.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||!RELATIONS[e.type]||!MARKERS[e.start]||!MARKERS[e.end]||!['solid','dashed','dotted'].includes(e.line)||!str(e.label,100)||!str(e.sourceCardinality,20)||!str(e.targetCardinality,20))throw Error('关系数据无效。');eids.add(e.id);}
  return structuredClone(m);
}
try{const saved=localStorage.getItem(STORAGE);if(saved)model=validModel(JSON.parse(saved));}catch{setTimeout(()=>toast('上次的本地数据无法读取，已载入示例图。'),500);}
function svg(tag,attrs={},content){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))if(v!==undefined)el.setAttribute(k,String(v));if(content!==undefined)el.textContent=content;return el;}
function html(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3300);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(model));$('#saveStatus').textContent='✓ 已自动保存';}catch{$('#saveStatus').textContent='! 保存失败，请导出项目';}$('#projectName').value=model.name;$('#canvasTitle').textContent=model.name;}
function snapshot(){undoStack.push(JSON.stringify(model));if(undoStack.length>60)undoStack.shift();redoStack=[];}
function changed(){hideRelationPicker();save();render();}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify(model));model=JSON.parse(undoStack.pop());selection=null;pending=null;changed();}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify(model));model=JSON.parse(redoStack.pop());selection=null;pending=null;changed();}
function renderPalette(query=''){
  const p=$('#palette');p.replaceChildren();const groups=new Map();
  for(const [type,info] of Object.entries(TYPES)){if(query&&!`${info.name} ${type}`.toLowerCase().includes(query.toLowerCase()))continue;if(!groups.has(info.group))groups.set(info.group,[]);groups.get(info.group).push([type,info]);}
  for(const [group,items]of groups){p.append(html('div','palette-heading',group));const grid=html('div','element-grid');for(const [type,info]of items){const b=html('button','element');b.title=`创建${info.name}`;b.append(html('span','element-symbol',info.symbol),html('span','',info.name));b.onclick=()=>openNode(type);grid.append(b);}p.append(grid);}
  if(!groups.size)p.append(html('p','quick-note','没有匹配的元素'));
}
function makeDefs(){
  const defs=$('#svgDefs');defs.replaceChildren();
  for(const [kind]of Object.entries(MARKERS))if(kind!=='none'){
    const m=svg('marker',{id:`marker-${kind}`,viewBox:'-1 -9 20 18',refX:kind.includes('iamond')?17:14,refY:0,markerWidth:kind.includes('iamond')?19:16,markerHeight:16,orient:'auto-start-reverse',markerUnits:'userSpaceOnUse'});
    const fill='#101319',stroke='#a7bac8';
    if(kind==='arrow')m.append(svg('path',{d:'M 2 -6 L 14 0 L 2 6',fill:'none',stroke,'stroke-width':1.5}));
    else if(kind==='triangle'||kind==='filledArrow')m.append(svg('path',{d:'M 1 -7 L 14 0 L 1 7 Z',fill:kind==='triangle'?fill:stroke,stroke,'stroke-width':1.5}));
    else if(kind.includes('iamond'))m.append(svg('path',{d:'M 1 0 L 9 -6 L 17 0 L 9 6 Z',fill:kind==='diamond'?fill:stroke,stroke,'stroke-width':1.5}));
    else m.append(svg('circle',{cx:8,cy:0,r:6,fill,stroke,'stroke-width':1.5}));
    defs.append(m);
  }
  const filter=svg('filter',{id:'node-shadow',x:'-30%',y:'-30%',width:'160%',height:'180%'});filter.append(svg('feDropShadow',{dx:0,dy:8,stdDeviation:10,'flood-color':'#000','flood-opacity':'.23'}));defs.append(filter);
}
function fittedText(value,width,size){let used=0,result='';for(const ch of value){used+=ch.charCodeAt(0)>255?size:size*.62;if(used>width-size)return result+'…';result+=ch;}return result;}
function linesText(g,lines,x,y,color,size=12){lines.forEach((line,i)=>{const stat=line.includes('{static}'),abstract=line.includes('{abstract}'),plain=memberDisplay(line);const el=svg('text',{x,y:y+i*23,fill:color,'font-size':size,'font-family':"Consolas, 'Microsoft YaHei', monospace",'text-decoration':stat?'underline':undefined,'font-style':abstract?'italic':undefined},plain);g.append(el);});}
function drawNode(n){
  const {w,h}=nodeSize(n),g=svg('g',{'data-node':n.id,transform:`translate(${n.x} ${n.y})`,class:`uml-node${selection?.id===n.id?' selected':''}${pending===n.id?' pending':''}`,role:'button','aria-label':`${TYPES[n.type].name} ${n.name}`,tabindex:0});
  const c=n.color,body='#1c222e',outline={fill:body,stroke:c+'99','stroke-width':1.2,class:'node-outline'};
  const text=(s,x,y,attrs={})=>{const el=svg('text',{x,y,fill:'#e0e7f3','font-size':14,'font-family':"Inter, 'Segoe UI', 'Microsoft YaHei', sans-serif",...attrs},fittedText(s,w-30,attrs['font-size']||14));el.append(svg('title',{},s));g.append(el);};
  if(memberType(n.type)){
    const {stereotype,height:header}=classifierHeader(n);
    g.append(svg('rect',{width:w,height:h,rx:8,...outline}));g.append(svg('path',{d:`M 8 0 H ${w-8} Q ${w} 0 ${w} 8 V ${header} H 0 V 8 Q 0 0 8 0`,fill:c+'0c'}));
    if(stereotype)text(`«${stereotype}»`,w/2,23,{'text-anchor':'middle','font-size':10,fill:c});
    const nameText=svg('text',{x:w/2,y:stereotype?48:30,'text-anchor':'middle',fill:'#e0e7f3','font-family':"Inter, 'Segoe UI', 'Microsoft YaHei', sans-serif",'font-size':15,'font-weight':600,'font-style':n.type==='abstract'?'italic':undefined,'text-decoration':n.type==='object'?'underline':undefined},n.name);g.append(nameText);
    const divider=header+11+Math.max(1,(n.attrs||[]).length)*23;
    g.append(svg('path',{d:`M 0 ${header} H ${w} M 0 ${divider} H ${w}`,stroke:c+'3c',fill:'none'}));
    linesText(g,n.attrs?.length?n.attrs:[''],16,header+23,'#abb8cd');linesText(g,n.methods?.length?n.methods:[''],16,divider+16,'#c5d0e1');
    g.append(svg('circle',{cx:w-15,cy:20,r:3,fill:c,opacity:.7}));
  }else if(n.type==='actor'){
    g.append(svg('rect',{x:0,y:0,width:w,height:h,rx:6,fill:'transparent',stroke:'transparent',class:'node-outline'}));
    g.append(svg('circle',{cx:w/2,cy:19,r:13,fill:body,stroke:c,'stroke-width':2}));g.append(svg('path',{d:`M 50 32 V 76 M 20 48 H 80 M 50 76 L 29 103 M 50 76 L 71 103`,stroke:c,'stroke-width':2,fill:'none'}));text(n.name,w/2,123,{'text-anchor':'middle','font-size':12});
  }else if(['initial','final'].includes(n.type)){
    g.append(svg('circle',{cx:w/2,cy:h/2,r:17,...outline,fill:n.type==='initial'?c:body}));if(n.type==='final')g.append(svg('circle',{cx:w/2,cy:h/2,r:11,fill:c}));
  }else if(n.type==='decision'){
    g.append(svg('path',{d:`M ${w/2} 0 L ${w} ${h/2} L ${w/2} ${h} L 0 ${h/2} Z`,...outline}));text(n.name,w/2,h/2+4,{'text-anchor':'middle','font-size':11});
  }else if(n.type==='fork'){
    g.append(svg('rect',{width:w,height:h,rx:4,...outline,fill:c}));
  }else if(n.type==='usecase'){
    g.append(svg('ellipse',{cx:w/2,cy:h/2,rx:w/2,ry:h/2,...outline}));text(n.name,w/2,h/2+5,{'text-anchor':'middle','font-size':14});
  }else if(n.type==='note'){
    g.append(svg('path',{d:`M 0 0 H ${w-22} L ${w} 22 V ${h} H 0 Z`,...outline,fill:'#29271f'}));g.append(svg('path',{d:`M ${w-22} 0 V 22 H ${w}`,fill:'#423b2a',stroke:c+'88'}));text(n.name,16,29,{fill:c,'font-size':12,'font-weight':600});(n.body||'').split('\n').forEach((l,i)=>text(l,16,55+i*20,{'font-size':11,fill:'#c4bb9f'}));
  }else if(n.type==='package'){
    g.append(svg('path',{d:`M 0 22 V 0 H 90 L 104 22 H ${w} V ${h} H 0 Z`,...outline,fill:'#242132'}));text(n.name,16,49,{fill:c,'font-weight':600});(n.body||'').split('\n').forEach((l,i)=>text(l,16,75+i*20,{'font-size':11,fill:'#a5b0c7'}));
  }else if(n.type==='lifeline'){
    g.append(svg('rect',{width:w,height:55,rx:5,...outline}));text(n.name,w/2,32,{'text-anchor':'middle','font-size':12});g.append(svg('path',{d:`M ${w/2} 55 V ${h}`,stroke:c,'stroke-dasharray':'6 5'}));g.append(svg('rect',{x:w/2-6,y:100,width:12,height:90,fill:'#293d40',stroke:c}));
  }else{
    const rx=['state','activity'].includes(n.type)?18:6;
    g.append(svg('rect',{x:n.type==='node'?8:0,y:0,width:n.type==='node'?w-8:w,height:h,rx,...outline}));
    if(n.type==='node')g.append(svg('path',{d:`M 0 12 L 8 0 M 0 12 H ${w-8} L ${w} 0 M ${w-8} 12 V ${h} M 0 12 V ${h} H ${w}`,stroke:c+'88',fill:'none'}));
    if(n.type==='component'){g.append(svg('rect',{x:w-33,y:14,width:19,height:23,fill:body,stroke:c}));g.append(svg('path',{d:`M ${w-37} 18 h 9 v 5 h -9 Z M ${w-37} 28 h 9 v 5 h -9 Z`,stroke:c,fill:body}));}
    text(n.name,16,34,{fill:c,'font-size':14,'font-weight':600});if(n.body)g.append(svg('path',{d:`M 0 47 H ${w}`,stroke:c+'33'}));(n.body||'').split('\n').forEach((l,i)=>text(l,16,69+i*20,{'font-size':11,fill:'#aab7c8'}));
  }
  if(selection?.id===n.id)g.append(svg('rect',{x:-7,y:-7,width:w+14,height:h+14,rx:9,class:'selection-bounds'}));
  const connect=svg('g',{class:'node-connect',role:'button','aria-label':`从 ${n.name} 连接`,tabindex:0,transform:`translate(${w-3} ${h/2})`});connect.append(svg('circle',{r:10,fill:'#b4f4d0',stroke:'#101319','stroke-width':2}),svg('path',{d:'M -4 0 H 4 M 0 -4 V 4',stroke:'#173829','stroke-width':1.5}));connect.addEventListener('pointerdown',e=>e.stopPropagation());connect.addEventListener('click',e=>{e.stopPropagation();setMode('smart');connectClick(n);});connect.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();setMode('smart');connectClick(n);}});g.append(connect);
  g.addEventListener('pointerdown',e=>nodePointer(e,n));g.addEventListener('contextmenu',e=>e.preventDefault());g.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();if(['smart','manual'].includes(mode))connectClick(n);else openNode(n.type,n);}});
  return g;
}
function render(){
  $('#counts').textContent=`${model.nodes.length} 个元素 · ${model.edges.length} 个关系`;
  $('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length;
  const nl=$('#nodeLayer');
  for(const [id,entry]of nodeElements)if(!model.nodes.some(n=>n.id===id)){entry.el.remove();nodeElements.delete(id);}
  for(const n of model.nodes){const signature=JSON.stringify({...n,x:0,y:0});let entry=nodeElements.get(n.id);if(!entry||entry.signature!==signature){const el=drawNode(n);if(entry)entry.el.replaceWith(el);else nl.append(el);entry={el,signature};nodeElements.set(n.id,entry);}entry.el.setAttribute('transform',`translate(${n.x} ${n.y})`);}
  refreshSelection();renderEdges();scheduleRoutes();applyView();
}
function renderEdges(){
  const el=$('#edgeLayer');routeWarnings=0;
  for(const [id,entry]of edgeElements)if(!model.edges.some(e=>e.id===id)){entry.el.remove();edgeElements.delete(id);routeCache.delete(id);}
  for(const e of model.edges){
    const a=model.nodes.find(n=>n.id===e.source),b=model.nodes.find(n=>n.id===e.target);if(!a||!b)continue;
    const pts=routeCache.get(e.id);if(!pts){if(routeCache.has(e.id))routeWarnings++;const old=edgeElements.get(e.id);if(old)old.el.setAttribute('visibility','hidden');continue;}
    const label=e.label||(['include','extend'].includes(e.type)?`«${e.type}»`:''),labelPoint=label?labelPosition(pts,label):null;
    const signature=JSON.stringify([e,pts,labelPoint]);const old=edgeElements.get(e.id);if(old?.signature===signature){old.el.removeAttribute('visibility');continue;}
    const g=svg('g',{'data-edge':e.id,class:`uml-edge${selection?.id===e.id?' selected':''}`,role:'button','aria-label':`${RELATIONS[e.type].name} ${a.name} → ${b.name}`,tabindex:0});
    const d=pathData(pts);g.append(svg('path',{d,class:'edge-hit'}));g.append(svg('path',{d,class:'edge-visible',stroke:'#92a7b8','stroke-width':1.5,'stroke-linejoin':'round','stroke-dasharray':e.line==='dashed'?'7 5':e.line==='dotted'?'2 5':undefined,'marker-start':e.start!=='none'?`url(#marker-${e.start})`:undefined,'marker-end':e.end!=='none'?`url(#marker-${e.end})`:undefined}));
    if(label)g.append(svg('text',{x:labelPoint.x,y:labelPoint.y,'text-anchor':'middle',class:'edge-label'},label));
    for(const [txt,p,q]of [[e.sourceCardinality,pts[0],pts[1]],[e.targetCardinality,pts.at(-1),pts.at(-2)]])if(txt){const vertical=p.x===q.x;g.append(svg('text',{x:p.x+(vertical?12:Math.sign(q.x-p.x)*32),y:p.y+(vertical?Math.sign(q.y-p.y)*33:-12),'text-anchor':'middle',class:'edge-label'},txt));}
    let clickTimer;
    g.addEventListener('pointerdown',event=>{if(mode==='pan'||space)return;event.stopPropagation();selection={kind:'edge',id:e.id};refreshSelection();});
    g.addEventListener('click',event=>{event.stopPropagation();clearTimeout(clickTimer);clickTimer=setTimeout(()=>{if(selection?.id===e.id&&!$('dialog[open]'))showRelationPicker(e,{x:event.clientX,y:event.clientY});},220);});
    g.addEventListener('dblclick',event=>{event.stopPropagation();clearTimeout(clickTimer);hideRelationPicker();openRelation(e);});g.addEventListener('keydown',event=>{if(event.key==='Enter'){event.stopPropagation();openRelation(e);}});
    if(old)old.el.replaceWith(g);else el.append(g);edgeElements.set(e.id,{el:g,signature});
  }
}
function applyView(){ $('#viewport').setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);$('#zoomLabel').textContent=Math.round(view.zoom*100)+'%';$('#canvas').style.backgroundSize=`${22*view.zoom}px ${22*view.zoom}px`;$('#canvas').style.backgroundPosition=`${view.x}px ${view.y}px`; }
function labelPosition(pts,label){const width=[...label].reduce((s,c)=>s+(c.charCodeAt(0)>255?12:7),0),boxes=model.nodes.map(n=>rectangle(n,5));const segments=pts.slice(1).map((p,i)=>({a:pts[i],b:p,length:Math.abs(p.x-pts[i].x)+Math.abs(p.y-pts[i].y)})).sort((a,b)=>b.length-a.length);for(const {a,b}of segments){const x=(a.x+b.x)/2,y=(a.y+b.y)/2;const candidates=a.x===b.x?[{x:x-width/2-12,y:y+4},{x:x+width/2+12,y:y+4}]:[{x,y:y-11},{x,y:y+22}];for(const p of candidates){if(!boxes.some(r=>p.x+width/2>r.x&&p.x-width/2<r.x+r.w&&p.y+4>r.y&&p.y-13<r.y+r.h))return p;}}const p=pathMiddle(pts);return {x:p.x,y:p.y-12};}
function queueRender(){if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;if(drag?.kind!=='node')return;const n=model.nodes.find(n=>n.id===drag.id);if(!n)return;const started=performance.now();nodeElements.get(n.id)?.el.setAttribute('transform',`translate(${n.x} ${n.y})`);hideUnsafeRoutes(n);scheduleRoutes();dragFrameCosts.push(performance.now()-started);});}
function hideUnsafeRoutes(moving){for(const e of model.edges){const pts=routeCache.get(e.id),el=edgeElements.get(e.id)?.el;if(!pts||!el)continue;const boxes=[rectangle(moving,3)];if(e.source===moving.id||e.target===moving.id||pts.slice(1).some((p,i)=>segmentBlocked(pts[i],p,boxes)))el.setAttribute('visibility','hidden');}}
function fit(){if(!model.nodes.length){view={x:70,y:120,zoom:1};applyView();return;}const bounds=model.nodes.map(n=>rectangle(n)),minX=Math.min(...bounds.map(b=>b.x)),minY=Math.min(...bounds.map(b=>b.y)),maxX=Math.max(...bounds.map(b=>b.x+b.w)),maxY=Math.max(...bounds.map(b=>b.y+b.h));const {width,height}=$('#canvas').getBoundingClientRect();const z=Math.max(.15,Math.min(1.15,(width-100)/(maxX-minX),(height-195)/(maxY-minY)));view={zoom:z,x:(width-(maxX-minX)*z)/2-minX*z,y:120+(height-195-(maxY-minY)*z)/2-minY*z};applyView();}
function zoom(factor,client){const box=$('#canvas').getBoundingClientRect(),p=client?{x:client.x-box.left,y:client.y-box.top}:{x:box.width/2,y:box.height/2},z=Math.max(.15,Math.min(2.5,view.zoom*factor));view.x=p.x-(p.x-view.x)/view.zoom*z;view.y=p.y-(p.y-view.y)/view.zoom*z;view.zoom=z;applyView();}
function worldPoint(e){const b=$('#canvas').getBoundingClientRect();return {x:(e.clientX-b.left-view.x)/view.zoom,y:(e.clientY-b.top-view.y)/view.zoom};}
function setMode(next){hideRelationPicker();mode=next;pending=null;$('#canvas').dataset.mode=mode;$$('[data-mode]').forEach(b=>b.classList.toggle('active',['smart','manual'].includes(mode)));$('#modeHint').textContent={select:'单击编辑 · 长按拖动 · 空白处拖动画布',pan:'拖动平移 · 点击节点仍可编辑',smart:'点击两个元素，选择关系即可连接 · Esc 取消',manual:'点击两个元素，选择关系即可连接 · 双击连线自定义'}[mode];refreshSelection();}
function refreshSelection(){ $$('[data-node]').forEach(el=>{el.classList.toggle('selected',selection?.id===el.dataset.node);el.classList.toggle('pending',pending===el.dataset.node);});$$('[data-edge]').forEach(el=>el.classList.toggle('selected',selection?.id===el.dataset.edge));$$('.selection-bounds').forEach(el=>el.remove());renderInspector(); }
function nodePointer(e,n){
  n=model.nodes.find(value=>value.id===n.id);if(!n||e.button!==0||space)return;
  e.stopPropagation();hideRelationPicker();if(['smart','manual'].includes(mode)){connectClick(n);return;}
  selection={kind:'node',id:n.id};dragFrameCosts=[];const p=worldPoint(e);drag={kind:'node',id:n.id,start:p,x:n.x,y:n.y,moved:false,ready:false,travelled:false};
  $('#diagram').setPointerCapture(e.pointerId);refreshSelection();
  pressTimer=setTimeout(()=>{if(drag?.id!==n.id)return;drag.ready=true;$('#canvas').classList.add('is-dragging');},180);
}
function connectClick(n){n=model.nodes.find(value=>value.id===n.id);if(!n)return;if(!pending){pending=n.id;$('#modeHint').textContent=`起点 ${n.name} · 点击终点（可点击自身）`;refreshSelection();}else{pair={source:pending,target:n.id};pending=null;const box=nodeElements.get(n.id).el.getBoundingClientRect();showRelationPicker(null,{x:box.right,y:box.top+box.height/2});refreshSelection();}}
$('#diagram').addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;if(e.target.closest('[data-node]')&&!space)return;hideRelationPicker();selection=null;pending=null;setMode('select');drag={kind:'pan',x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};$('#diagram').setPointerCapture(e.pointerId);refreshSelection();});
$('#diagram').addEventListener('pointermove',e=>{
  if(!drag)return;if(drag.kind==='pan'){view.x=drag.vx+e.clientX-drag.x;view.y=drag.vy+e.clientY-drag.y;applyView();return;}
  const p=worldPoint(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)>4/view.zoom)drag.travelled=true;
  if(!drag.ready||!drag.travelled)return;if(!drag.moved){snapshot();drag.moved=true;}
  const n=model.nodes.find(n=>n.id===drag.id);n.x=Math.round(drag.x+dx);n.y=Math.round(drag.y+dy);queueRender();
});
function endDrag(event){
  clearTimeout(pressTimer);$('#canvas').classList.remove('is-dragging');const was=drag;drag=null;
  if(was?.kind!=='node')return;
  const n=model.nodes.find(n=>n.id===was.id);if(!n)return;
  if(was.moved){if(renderFrame){cancelAnimationFrame(renderFrame);renderFrame=0;}nodeElements.get(n.id)?.el.setAttribute('transform',`translate(${n.x} ${n.y})`);hideUnsafeRoutes(n);scheduleRoutes();save();renderInspector();if(dragFrameCosts.length){const sorted=[...dragFrameCosts].sort((a,b)=>a-b);$('#canvas').dataset.dragFrameStats=JSON.stringify({samples:sorted.length,meanMs:+(sorted.reduce((a,b)=>a+b)/sorted.length).toFixed(3),p95Ms:+sorted[Math.floor((sorted.length-1)*.95)].toFixed(3)});}}
  else if(event?.type==='pointerup'&&!was.ready&&!was.travelled)openNode(n.type,n);
}
$('#diagram').addEventListener('pointerup',endDrag);$('#diagram').addEventListener('pointercancel',endDrag);window.addEventListener('blur',()=>{endDrag();space=false;});
$('#canvas').addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.002),{x:e.clientX,y:e.clientY});else{view.x-=e.deltaX;view.y-=e.deltaY;applyView();}},{passive:false});
function openNode(type,n=null){
  if(n)n=model.nodes.find(value=>value.id===n.id)||n;
  if(!n&&model.nodes.length>=150)return toast('当前图纸最多支持 150 个元素。');
  editingNode=n?.id||null;creatingType=type;nodeColor=n?.color||COLORS[Object.keys(TYPES).indexOf(type)%COLORS.length];
  $('#editorTitle').textContent=`${n?'编辑':'创建'}${TYPES[type].name}`;$('#elementName').value=n?.name||'';$('#nodeAttrs').value=(n?.attrs||[]).join('\n');$('#nodeMethods').value=(n?.methods||[]).join('\n');$('#nodeBody').value=n?.body||'';$('#nodeStereo').value=n?.stereo||'';
  const isClass=['class','abstract','interface'].includes(type);$('#classOptions').hidden=!isClass;$('#memberFields').hidden=!memberType(type);$('#bodyField').hidden=memberType(type)||['initial','final','fork','actor','decision','usecase','lifeline'].includes(type);$('#stereotypeField').hidden=!memberType(type);
  $$('[name=classKind]').forEach(r=>r.checked=r.value===(isClass?type:'class'));renderColors();$('#editorDialog').showModal();$('#elementName').focus();
}
function renderColors(){const wrap=$('#colorChoices');wrap.replaceChildren();for(const c of COLORS){const b=html('button','color-swatch'+(c===nodeColor?' selected':''));b.type='button';b.style.background=c;b.title=c;b.setAttribute('aria-label',`强调色 ${c}`);b.onclick=()=>{nodeColor=c;renderColors();};wrap.append(b);}}
$('#editorForm').onsubmit=e=>{
  e.preventDefault();const name=$('#elementName').value.trim();if(!name){$('#elementName').setCustomValidity('请输入元素名称');$('#elementName').reportValidity();return;}
  const parse=selector=>$(selector).value.split('\n').map(formatMember).filter(Boolean);const attrs=parse('#nodeAttrs'),methods=parse('#nodeMethods');
  if(attrs.length>100||methods.length>100||[...attrs,...methods].some(s=>s.length>2000)||$('#nodeBody').value.length>5000)return toast('每个区段最多 100 行、每行 2000 字，描述最多 5000 字。');
  snapshot();const existing=model.nodes.find(n=>n.id===editingNode);let type=creatingType;if(['class','abstract','interface'].includes(type))type=$('[name=classKind]:checked').value;
  const box=$('#canvas').getBoundingClientRect(),pos={x:Math.round((box.width/2-view.x)/view.zoom-110),y:Math.round((box.height/2-view.y)/view.zoom-70)};
  if(!existing){let attempts=0;while(model.nodes.some(n=>{const r=rectangle(n);return pos.x<r.x+r.w+20&&pos.x+220>r.x-20&&pos.y<r.y+r.h+20&&pos.y+150>r.y-20;})&&attempts++<40){pos.x+=45;pos.y+=40;}}
  const value={id:existing?.id||id(),type,name,attrs,methods,body:$('#nodeBody').value,stereo:$('#nodeStereo').value.trim(),color:nodeColor,x:existing?.x??pos.x,y:existing?.y??pos.y};if(existing)Object.assign(existing,value);else model.nodes.push(value);selection={kind:'node',id:value.id};$('#editorDialog').close();changed();if(!existing)toast('元素已创建 · 单击编辑，长按拖动');
};
$('#elementName').oninput=()=>$('#elementName').setCustomValidity('');
function recommended(a,b){
  if(a.type==='interface'&&b.type==='interface')return ['inheritance','dependency','association'];
  if(['class','abstract'].includes(a.type)&&b.type==='interface')return ['realization','dependency','association'];
  if(a.type==='usecase'&&b.type==='usecase')return ['include','extend','inheritance'];
  if(a.type==='actor'||b.type==='actor')return ['association','directed'];
  if(['state','activity','initial','final','decision','fork','lifeline'].includes(a.type))return ['flow','return','dependency'];
  if(memberType(a.type)&&memberType(b.type))return ['association','inheritance','aggregation','composition','dependency'];
  return ['dependency','association','directed'];
}
function hideRelationPicker(){const p=$('#relationPicker');if(p)p.hidden=true;pickerEdge=null;}
function showRelationPicker(edge=null,anchor){
  if(!edge&&model.edges.length>=300)return toast('当前图纸最多支持 300 个关系。');
  pickerEdge=edge?.id||null;if(edge)pair={source:edge.source,target:edge.target};if(!pair)return;
  const a=model.nodes.find(n=>n.id===pair.source),b=model.nodes.find(n=>n.id===pair.target);if(!a||!b)return;
  const picker=$('#relationPicker');picker.replaceChildren();
  const heading=html('div','picker-heading');heading.append(html('span','',`${a.name} → ${b.name}`));const close=html('button','', '×');close.title='取消连接';close.onclick=()=>{hideRelationPicker();setMode('select');};heading.append(close);picker.append(heading);
  const rec=recommended(a,b),grid=html('div','relation-choices');picker.append(grid);
  const addChoice=key=>{const info=RELATIONS[key],button=html('button','relation-choice'+(edge?.type===key?' current':''));button.title=info.desc;button.dataset.relation=key;button.append(html('span','relation-glyph',info.symbol),html('span','',info.name));if(rec[0]===key)button.append(html('small','','推荐'));button.onclick=()=>{
    const existing=model.edges.find(e=>e.id===pickerEdge);snapshot();const value={...(existing||{}),id:existing?.id||id(),...pair,type:key,start:info.start,end:info.end,line:info.line};
    if(key==='custom'&&existing){value.start=existing.start;value.end=existing.end;value.line=existing.line;}
    if(existing){Object.assign(existing,value);delete existing.inferred;delete existing.evidence;}else model.edges.push(value);selection={kind:'edge',id:value.id};hideRelationPicker();setMode('select');changed();
  };grid.append(button);};
  const initial=[...new Set([...rec.slice(0,4),'custom'])];initial.forEach(addChoice);
  const more=html('button','picker-more','更多关系 ▾');more.onclick=()=>{Object.keys(RELATIONS).filter(k=>!initial.includes(k)).forEach(addChoice);more.remove();positionPicker(anchor);};picker.append(more,html('div','picker-footnote','点选即生效 · 双击连线修改名称、箭头与多重性'));
  picker.hidden=false;positionPicker(anchor);$('#modeHint').textContent='点选关系立即生效 · 双击连线详细编辑';
}
function positionPicker(anchor){const p=$('#relationPicker'),box=$('#canvas').getBoundingClientRect();const x=(anchor?.x??box.left+box.width/2)-box.left+12,y=(anchor?.y??box.top+box.height/2)-box.top;const width=p.offsetWidth,height=p.offsetHeight;p.style.left=`${Math.max(8,Math.min(x,box.width-width-8))}px`;p.style.top=`${Math.max(8,Math.min(y,box.height-height-8))}px`;}
function openRelation(edge=null){
  hideRelationPicker();
  if(!edge&&model.edges.length>=300)return toast('当前图纸最多支持 300 个关系。');editingEdge=edge?.id||null;if(edge)pair={source:edge.source,target:edge.target};if(!pair)return;
  const a=model.nodes.find(n=>n.id===pair.source),b=model.nodes.find(n=>n.id===pair.target);if(!a||!b)return;
  $('#relationTitle').textContent=edge?'编辑关系':mode==='smart'?'智能关系建议':'自定义关系';$('#connectionPair').replaceChildren(html('b','',a.name),html('span','','→'),html('b','',b.name));
  const rec=recommended(a,b),select=$('#relationType');select.replaceChildren();for(const key of [...rec,...Object.keys(RELATIONS).filter(k=>!rec.includes(k))]){const option=html('option','',`${RELATIONS[key].symbol}  ${RELATIONS[key].name}${rec.includes(key)?' · 推荐':''}`);option.value=key;select.append(option);}select.value=edge?.type||(mode==='manual'?'custom':rec[0]);
  $('#relationAdvice').textContent=`${TYPES[a.type].name} → ${TYPES[b.type].name}：已优先列出适用关系，请结合业务语义选择。${pair.source===pair.target?' 当前为自连接。':''}`;
  $('#relationLabel').value=edge?.label||'';$('#sourceCardinality').value=edge?.sourceCardinality||'';$('#targetCardinality').value=edge?.targetCardinality||'';
  applyRelationPreset();if(edge){$('#startMarker').value=edge.start;$('#endMarker').value=edge.end;$('#lineStyle').value=edge.line;}
  $('#customDetails').open=select.value==='custom';if(!$('#relationDialog').open)$('#relationDialog').showModal();
}
function applyRelationPreset(){const r=RELATIONS[$('#relationType').value];$('#startMarker').value=r.start;$('#endMarker').value=r.end;$('#lineStyle').value=r.line;$('#relationDescription').textContent=r.desc;}
$('#relationType').onchange=()=>{applyRelationPreset();$('#customDetails').open=$('#relationType').value==='custom';};
for(const selector of ['#startMarker','#endMarker','#lineStyle'])$(selector).onchange=()=>{$('#relationType').value='custom';$('#relationDescription').textContent=RELATIONS.custom.desc;};
$('#reverseRelation').onclick=()=>{const source=pair.source;pair.source=pair.target;pair.target=source;const a=model.nodes.find(n=>n.id===pair.source),b=model.nodes.find(n=>n.id===pair.target);$('#connectionPair').replaceChildren(html('b','',a.name),html('span','','→'),html('b','',b.name));$('#relationAdvice').textContent='已交换起点与终点。请检查箭头方向和两端多重性。';const s=$('#sourceCardinality').value;$('#sourceCardinality').value=$('#targetCardinality').value;$('#targetCardinality').value=s;};
$('#relationForm').onsubmit=e=>{e.preventDefault();snapshot();const val={id:editingEdge||id(),...pair,type:$('#relationType').value,start:$('#startMarker').value,end:$('#endMarker').value,line:$('#lineStyle').value,label:$('#relationLabel').value.trim(),sourceCardinality:$('#sourceCardinality').value.trim(),targetCardinality:$('#targetCardinality').value.trim()};const existing=model.edges.find(e=>e.id===editingEdge);if(existing){Object.assign(existing,val);delete existing.inferred;delete existing.evidence;}else model.edges.push(val);selection={kind:'edge',id:val.id};$('#relationDialog').close();changed();if(routeWarnings)toast('关系已保存。部分端口被遮挡，请拉开重叠节点。');else toast('关系已保存 · 路径将随节点位置自动调整');};
function deleteSelection(){if(!selection)return;snapshot();if(selection.kind==='node'){model.nodes=model.nodes.filter(n=>n.id!==selection.id);model.edges=model.edges.filter(e=>e.source!==selection.id&&e.target!==selection.id);}else model.edges=model.edges.filter(e=>e.id!==selection.id);selection=null;pending=null;changed();}
function duplicate(){const n=model.nodes.find(n=>n.id===selection?.id);if(!n)return;if(model.nodes.length>=150)return toast('元素数量已达上限。');snapshot();const clone={...structuredClone(n),id:id(),x:n.x+45,y:n.y+45,name:(n.name+'Copy').slice(0,100)};model.nodes.push(clone);selection={kind:'node',id:clone.id};changed();}
function renderInspector(){
  const p=$('#inspectorBody');p.replaceChildren();
  const button=(title,action,cls='ghost')=>{const b=html('button',`button ${cls}`,title);b.onclick=action;return b;};
  const row=(a,b)=>{const r=html('div','detail-row');r.append(html('span','',a),html('b','',b));p.append(r);};
  if(!selection){
    const card=html('div','overview-card');card.append(html('span','overview-symbol','✦'),html('h3','','让结构，清晰可见。'),html('p','','从一个类开始，构建下一套系统。自由表达，连接每一个想法。'));p.append(card);
    const stats=html('div','stats-grid');for(const [v,l]of [[model.nodes.length,'画布元素'],[model.edges.length,'连接关系']]){const st=html('div','stat');st.append(html('b','',String(v).padStart(2,'0')),html('span','',l));stats.append(st);}p.append(stats,html('div','section-caption','RELATION GUIDE / 关系速查'));
    for(const k of ['association','inheritance','realization','aggregation','composition','dependency']){const r=html('div','legend-row');r.append(html('span','legend-line',RELATIONS[k].symbol),html('span','',RELATIONS[k].name));p.append(r);}p.append(html('div','quick-note','选择任意元素，查看详细属性。按 C 开启智能连接，或按 L 自定义箭头。'));
  }else if(selection.kind==='node'){
    const n=model.nodes.find(n=>n.id===selection.id);if(!n){selection=null;return renderInspector();}p.append(html('div','selection-tag',`ELEMENT / ${TYPES[n.type].name}`),html('h3','selection-name',n.name));row('类型',TYPES[n.type].name);row('位置',`${Math.round(n.x)}, ${Math.round(n.y)}`);row('关联关系',String(model.edges.filter(e=>e.source===n.id||e.target===n.id).length));if(memberType(n.type)){row('属性',String(n.attrs?.length||0));row('方法',String(n.methods?.length||0));}
    const actions=html('div','inspector-actions');actions.append(button('✎ 编辑元素',()=>openNode(n.type,n),'primary'),button('⤳ 从此元素智能连接',()=>{setMode('smart');connectClick(n);}),button('⧉ 复制元素',duplicate),button('删除元素',deleteSelection,'danger'));p.append(actions,html('p','quick-note','长按约 180ms 后拖动，连线会自动重新寻路。重叠元素可能遮挡连接端口，请保留适当间距。'));
  }else{
    const e=model.edges.find(e=>e.id===selection.id);if(!e){selection=null;return renderInspector();}p.append(html('div','selection-tag','RELATION / 连接关系'),html('h3','selection-name',RELATIONS[e.type].name));row('起点',model.nodes.find(n=>n.id===e.source)?.name||'');row('终点',model.nodes.find(n=>n.id===e.target)?.name||'');row('名称',e.label||'未命名');if(e.inferred){row('来源','代码推断候选');p.append(html('p','quick-note',e.evidence+'；请确认生命周期语义。'));}row('起点多重性',e.sourceCardinality||'—');row('终点多重性',e.targetCardinality||'—');const actions=html('div','inspector-actions');actions.append(button('✎ 编辑关系 / 箭头',()=>openRelation(e),'primary'),button('⇄ 反转方向',()=>{snapshot();[e.source,e.target]=[e.target,e.source];[e.sourceCardinality,e.targetCardinality]=[e.targetCardinality,e.sourceCardinality];changed();}),button('删除关系',deleteSelection,'danger'));p.append(actions,html('p','quick-note',RELATIONS[e.type].desc));
  }
  if(routeWarnings)p.append(html('div','route-warning',`有 ${routeWarnings} 条关系无法避障，暂未绘制。请拉开重叠或过于靠近的节点。关系数据仍保留，可从下方列表编辑。`));
  if(routeWarnings){for(const e of model.edges){const b=button(`${model.nodes.find(n=>n.id===e.source)?.name} → ${model.nodes.find(n=>n.id===e.target)?.name}`,()=>{selection={kind:'edge',id:e.id};openRelation(e);});b.style.cssText='font-size:9px;white-space:normal;width:100%;margin-top:5px';p.append(b);}}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=html('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportSvg(){
  const root=svg('svg',{xmlns:NS});const bounds=model.nodes.map(n=>rectangle(n));const x=bounds.length?Math.min(...bounds.map(b=>b.x))-65:0,y=bounds.length?Math.min(...bounds.map(b=>b.y))-65:0,w=bounds.length?Math.max(...bounds.map(b=>b.x+b.w))-x+65:800,h=bounds.length?Math.max(...bounds.map(b=>b.y+b.h))-y+65:600;
  // Include detours outside the node bounds in exported images.
  let minX=x,minY=y,maxX=x+w,maxY=y+h;
  for(const e of model.edges){for(const p of routeCache.get(e.id)||[]){minX=Math.min(minX,p.x-40);minY=Math.min(minY,p.y-40);maxX=Math.max(maxX,p.x+40);maxY=Math.max(maxY,p.y+40);}}
  const width=maxX-minX,height=maxY-minY;root.setAttribute('viewBox',`${minX} ${minY} ${width} ${height}`);root.setAttribute('width',width);root.setAttribute('height',height);
  root.append($('#svgDefs').cloneNode(true),svg('rect',{x:minX,y:minY,width,height,fill:'#101319'}));const style=svg('style',{},'.edge-visible{fill:none}.edge-hit,.selection-bounds,.node-connect{display:none}.edge-label{paint-order:stroke;stroke:#101319;stroke-width:5px;stroke-linejoin:round;fill:#aebbcf;font-size:11px}');root.append(style,$('#edgeLayer').cloneNode(true),$('#nodeLayer').cloneNode(true));return {text:new XMLSerializer().serializeToString(root),width,height};
}
async function exportAs(format){
  const name=model.name.replace(/[<>:"/\\|?*]/g,'_')||'UML-Orbit';
  if(format==='json'){download(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}),name+'.json');$('#exportDialog').close();return;}
  if(routeBusy||routeQueued)await new Promise(resolve=>routingWaiters.push(resolve));
  try{if(routeWarnings)toast('部分关系无法绘制，导出图中将不包含这些关系。');const {text,width,height}=exportSvg();if(format==='svg')download(new Blob([text],{type:'image/svg+xml;charset=utf-8'}),name+'.svg');else{const img=new Image(),url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const scale=Math.min(2,8192/Math.max(width,height),Math.sqrt(32000000/(width*height)));const c=document.createElement('canvas');c.width=Math.round(width*scale);c.height=Math.round(height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,name+'.png');}finally{URL.revokeObjectURL(url);}}$('#exportDialog').close();}catch{toast('图片导出失败，请尝试导出 SVG 或项目文件。');}
}
$('#fileInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3e6)throw Error('文件不能超过 3MB。');const data=validModel(JSON.parse(await file.text()));snapshot();model=data;selection=null;pending=null;changed();fit();toast('项目已导入');}catch(error){toast('导入失败：'+(error instanceof SyntaxError?'不是有效的 JSON 文件。':error.message));}e.target.value='';};
for(const [key,label]of Object.entries(MARKERS))for(const s of ['#startMarker','#endMarker']){const o=html('option','',label);o.value=key;$(s).append(o);}
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#relationDialog').addEventListener('close',()=>{pending=null;$('#modeHint').textContent=mode==='smart'?'✦ 智能连接 · 请选择起点元素':mode==='manual'?'↗ 自定义连接 · 请选择起点元素':'单击编辑 · 长按拖动 · 空白处拖动画布';});
$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(mode==='smart'?'select':b.dataset.mode));$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;$('#zoomOut').onclick=()=>zoom(1/1.2);$('#zoomIn').onclick=()=>zoom(1.2);$('#fitBtn').onclick=fit;$('#helpBtn').onclick=()=>$('#helpDialog').showModal();$('#exportBtn').onclick=()=>$('#exportDialog').showModal();$$('[data-export]').forEach(b=>b.onclick=()=>exportAs(b.dataset.export));$('#importBtn').onclick=()=>$('#fileInput').click();$('#newBtn').onclick=()=>$('#confirmDialog').showModal();$('#confirmNew').onclick=()=>{snapshot();model={version:1,name:'未命名图纸',nodes:[],edges:[]};selection=null;pending=null;changed();fit();$('#confirmDialog').close();};
$('#elementSearch').oninput=e=>renderPalette(e.target.value);$('#projectName').onchange=e=>{const name=e.target.value.trim().slice(0,100);if(name&&name!==model.name){snapshot();model.name=name;changed();}else e.target.value=model.name;};
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||$('dialog[open]'))return;
  const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if(mod&&k==='y'){e.preventDefault();redo();return;}if(mod&&k==='d'){e.preventDefault();duplicate();return;}
  if(e.code==='Space'){e.preventDefault();space=true;$('#canvas').style.cursor='grab';return;}
  if(k==='delete'||k==='backspace'){e.preventDefault();deleteSelection();return;}if(k==='escape'){selection=null;setMode('select');return;}if(k==='f'){fit();return;}if(k==='/'){e.preventDefault();$('#elementSearch').focus();return;}if({v:1,h:1,c:1,l:1}[k])setMode({v:'select',h:'pan',c:'smart',l:'manual'}[k]);
  if(k==='enter'&&selection){const n=model.nodes.find(n=>n.id===selection.id);if(n)openNode(n.type,n);else openRelation(model.edges.find(e=>e.id===selection.id));}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;$('#canvas').style.cursor='';}});
new ResizeObserver(()=>applyView()).observe($('#canvas'));
installJavaEditor(()=>model.nodes.filter(n=>memberType(n.type)).map(n=>n.name),toast);
installJavaImport((result,mode)=>{
  if(mode==='append'&&(model.nodes.length+result.nodes.length>150||model.edges.length+result.edges.length>300)){toast('合并后超出图纸容量，请新建图纸或减少导入文件。');return false;}
  const imported=structuredClone(result),ids=new Map(imported.nodes.map(n=>[n.id,id()]));
  const offset=mode==='append'&&model.nodes.length?Math.max(...model.nodes.map(n=>n.x+nodeSize(n).w))+150:0;
  imported.nodes.forEach(n=>{n.id=ids.get(n.id);n.x+=offset;});imported.edges.forEach(e=>{e.id=id();e.source=ids.get(e.source);e.target=ids.get(e.target);});
  let data;try{data=validModel({version:1,name:mode==='replace'?imported.name:model.name,nodes:mode==='replace'?imported.nodes:[...model.nodes,...imported.nodes],edges:mode==='replace'?imported.edges:[...model.edges,...imported.edges]});}catch(error){toast('生成失败：'+error.message);return false;}
  snapshot();model=data;selection=null;pending=null;setMode('select');changed();fit();toast(`已生成 ${imported.nodes.length} 个类型，可单击编辑、长按移动`);return true;
},toast);
makeDefs();renderPalette();save();render();requestAnimationFrame(fit);
