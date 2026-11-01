export function splitJava(text,separator=','){
  const result=[];let depth=0,start=0;
  for(let i=0;i<text.length;i++){if('<([{'.includes(text[i]))depth++;else if('>)]}'.includes(text[i]))depth=Math.max(0,depth-1);else if(text[i]===separator&&!depth){result.push(text.slice(start,i).trim());start=i+1;}}
  result.push(text.slice(start).trim());return result.filter(Boolean);
}
const modifier=/^(?:(?:public|private|protected|static|final|abstract|synchronized|native|transient|volatile|default|strictfp)\s+)*/;
const visibility=s=>/\bprivate\b/.test(s)?'-':/\bprotected\b/.test(s)?'#':/\bpublic\b/.test(s)?'+':'~';
function param(text){text=text.replace(/@[\w.]+(?:\([^)]*\))?\s*/g,'').replace(/\bfinal\s+/g,'').trim();if(text.includes(':'))return text.replace(/\s*:\s*/g,': ');const m=text.match(/^(.+?)\s+([\w$]+)$/);return m?`${m[2]}: ${m[1].trim()}`:text;}
export function formatMember(value){
  let text=value.trim();if(!text)return '';
  if(/^[+\-#~]/.test(text)){
    text=text[0]+' '+text.slice(1).trim();
    const start=text.indexOf('('),end=text.lastIndexOf(')');
    if(start>=0&&end>start)text=text.slice(0,start).trimEnd()+'('+splitJava(text.slice(start+1,end)).map(param).join(', ')+')'+text.slice(end+1).replace(/\s*:\s*/g,': ');
    else text=text.replace(/\s*:\s*/g,': ');
    return text.replace(/;\s*$/,'').replace(/\s+\{(static|abstract)\}/g,' {$1}');
  }
  const clean=text.replace(/@[\w.]+(?:\([^)]*\))?\s*/g,'').replace(/\s*\{\s*}\s*$/,'').replace(/;\s*$/,'').trim();
  const mods=clean.match(modifier)[0],rest=clean.slice(mods.length).trim(),sign=visibility(mods),tags=(/\bstatic\b/.test(mods)?' {static}':'')+(/\babstract\b/.test(mods)?' {abstract}':'');
  const field=rest.split('=')[0].trim();
  if(!field.includes('(')){
    const match=field.match(/^(.+?)\s+([\w$]+)(\[\])?$/);if(match)return `${sign} ${match[2]}: ${match[1].trim()}${match[3]||''}${tags}`;
  }
  const open=rest.indexOf('('),close=rest.lastIndexOf(')');
  if(open>=0&&close>open){const head=rest.slice(0,open).trim(),name=head.match(/[\w$]+$/)?.[0];if(name){const result=head.slice(0,-name.length).trim();return `${sign} ${name}(${splitJava(rest.slice(open+1,close)).map(param).join(', ')})${result?': '+result:''}${tags}`;}}
  return text;
}
const javaTypes=['String','int','long','double','float','boolean','char','byte','short','void','Integer','Long','Double','Boolean','BigDecimal','LocalDate','LocalDateTime','Instant','UUID','Object','List','Set','Map','Optional','Collection','ArrayList','HashMap','HashSet'];
const lowerFirst=s=>s? s[0].toLowerCase()+s.slice(1):s;
export function javaNameHint(name){if(!name)return '';if(!/^[A-Za-z_$][\w$]*(?:<[^<>]+>)?$/.test(name))return 'Java 类名通常使用字母、数字、_ 或 $；泛型写在尖括号中。';if(/^[a-z]/.test(name))return `建议使用 UpperCamelCase：${name[0].toUpperCase()+name.slice(1)}`;return '';}
export function suggestJava(text,caret,kind,projectNames=[]){
  const before=text.slice(0,caret),line=before.slice(before.lastIndexOf('\n')+1),word=line.match(/[\w$]*$/)?.[0]||'',start=caret-word.length;
  const candidates=[];const add=(label,insert,detail)=>{if(!candidates.some(c=>c.label===label))candidates.push({label,insert:insert||label,detail,start,end:caret});};
  if(kind==='name'){
    const base=word.replace(/(?:Service|Repository|Controller|Factory|DTO|Impl)$/,'')||'User';
    for(const suffix of ['', 'Service','Repository','Controller','Factory','DTO','Impl'])add(base+suffix,base+suffix,suffix?'常用 Java 类命名':'类名');
  }else{
    const typeMatch=line.match(/(?:^|\s)([A-Z][\w$]*(?:<[^;]+>)?|String|int|long|boolean|double)\s+([\w$]*)$/);
    if(typeMatch&&!line.includes(':')){
      const type=typeMatch[1],simple=type.replace(/<.*>/,'').split('.').at(-1),generic=type.match(/<([\w$]+)/)?.[1];
      const names=simple==='String'?['name','title','description']:['int','long','Integer','Long'].includes(simple)?['id','count','size']:['boolean','Boolean'].includes(simple)?['enabled','active','valid']:[lowerFirst(generic||simple)+(['List','Set','Collection'].includes(simple)?'s':'')];
      names.forEach(n=>add(n,n,'根据字段类型建议名称'));
    }else{
      for(const name of [...new Set([...projectNames,...javaTypes])])add(name,name,projectNames.includes(name)?'当前图纸中的类型':'Java 类型');
      for(const kw of ['private','public','protected','static','final','abstract'])add(kw,kw+' ','Java 修饰符');
      if(!line.trim()||/^[+\-#~]\s*$/.test(line)){
        candidates.length=0;const entity=projectNames[0]||'User';
        if(kind==='attrs'){add('id: Long','- id: Long','字段模板');add('name: String','- name: String','字段模板');add('createdAt: LocalDateTime','- createdAt: LocalDateTime','字段模板');}
        else{add('getId(): Long','+ getId(): Long','方法模板');add('findById(id: Long)',`+ findById(id: Long): Optional<${entity}>`,'方法模板');add('save(entity)',`+ save(entity: ${entity}): void`,'方法模板');}
        candidates.forEach(c=>c.start=caret-line.length);
      }
    }
  }
  return candidates.filter(c=>!word||c.label.toLowerCase().startsWith(word.toLowerCase())).filter(c=>c.insert!==word).slice(0,9);
}
