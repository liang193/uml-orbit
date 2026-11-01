export function installJavaImport(onGenerate,notify){
  const $=s=>document.querySelector(s),dialog=$('#javaImportDialog'),worker=new Worker(new URL('./java-import-worker.js',import.meta.url),{type:'module'});
  let files=[],result=null,revision=0;
  const invalidate=()=>{revision++;result=null;$('#generateJava').disabled=true;$('#javaAnalysis').textContent='分析后会显示类型、成员和关系数量。';$('#analyzeJava').disabled=false;};
  $('#javaImportBtn').onclick=()=>dialog.showModal();
  $('#chooseJavaFiles').onclick=()=>$('#javaFiles').click();
  $('#javaFiles').onchange=async event=>{
    const selected=[...event.target.files];if(!selected.length)return;
    if(selected.length>100||selected.reduce((sum,f)=>sum+f.size,0)>1000000){notify('一次最多导入 100 个 Java 文件，总大小不超过 1MB。');return;}
    files=await Promise.all(selected.map(async file=>({name:file.webkitRelativePath||file.name,content:await file.text()})));$('#javaSource').value=files.map(f=>`// ${f.name}\n${f.content}`).join('\n\n');$('#javaFileStatus').textContent=`已选择 ${files.length} 个文件 · 保留各自 package / import 信息`;invalidate();event.target.value='';
  };
  $('#javaSource').oninput=()=>{files=[];$('#javaFileStatus').textContent='使用编辑区源码';invalidate();};for(const selector of ['#javaFieldRelations','#javaDependencyRelations','#javaOwnershipRelations'])$(selector).onchange=invalidate;
  $('#javaExample').onclick=()=>{files=[];$('#javaSource').value=`public interface PaymentGateway {\n    boolean pay(java.math.BigDecimal amount);\n}\n\npublic abstract class BaseOrder {\n    protected Long id;\n    public abstract void cancel();\n}\n\npublic class Order extends BaseOrder {\n    private String orderNumber;\n    private java.util.List<OrderItem> items;\n    private PaymentGateway paymentGateway;\n\n    public java.math.BigDecimal calculateTotal() { return null; }\n    public void cancel() { }\n}\n\npublic class OrderItem {\n    private String productName;\n    private int quantity;\n    private java.math.BigDecimal unitPrice;\n}`;$('#javaFileStatus').textContent='示例源码 · 仅用于生成结构图';invalidate();};
  $('#analyzeJava').onclick=()=>{
    const selected=files.length?files:[{name:'Editor.java',content:$('#javaSource').value}];if(!selected.some(f=>f.content.trim()))return notify('请粘贴 Java 代码，或选择 .java 文件。');if(selected.reduce((sum,f)=>sum+f.content.length,0)>1000000)return notify('源码总大小不能超过 1MB。');
    invalidate();$('#analyzeJava').disabled=true;$('#javaAnalysis').textContent='正在后台分析源码…';worker.postMessage({revision,files:selected,options:{fieldRelations:$('#javaFieldRelations').checked,dependencyRelations:$('#javaDependencyRelations').checked,inferOwnership:$('#javaOwnershipRelations').checked}});
  };
  worker.onmessage=({data})=>{
    if(data.revision!==revision)return;$('#analyzeJava').disabled=false;
    if(data.error){$('#javaAnalysis').textContent='分析失败：'+data.error;return;}result=data.result;
    const members=result.nodes.reduce((sum,n)=>sum+n.attrs.length+n.methods.length,0),parts=[`识别 ${result.nodes.length} 个类型 · ${members} 个成员 · ${result.edges.length} 条关系`,...result.warnings];
    $('#javaAnalysis').textContent=parts.join('\n');$('#generateJava').disabled=!result.nodes.length||result.nodes.length>150||result.edges.length>300;
    if(result.nodes.length>150||result.edges.length>300)$('#javaAnalysis').textContent+='\n超出单个图纸的容量，请分批导入。';
  };
  worker.onerror=()=>{$('#analyzeJava').disabled=false;$('#javaAnalysis').textContent='后台分析失败，请检查源码后重试。';};
  $('#generateJava').onclick=()=>{if(result&&onGenerate(result,$('#javaImportMode').value))dialog.close();};
}
