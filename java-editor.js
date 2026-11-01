import {formatMember,suggestJava,javaNameHint} from './java-assist.js';
export function installJavaEditor(getNames,notify){
  const dialog=document.querySelector('#editorDialog'),popup=document.createElement('div');popup.id='javaCompletion';popup.className='java-completion';popup.hidden=true;popup.setAttribute('role','listbox');popup.setAttribute('aria-label','Java 补全建议');dialog.append(popup);
  const hint=document.querySelector('#javaNameHint');let active=null,choices=[],selected=0,composing=false;
  const fields=[['#elementName','name'],['#nodeAttrs','attrs'],['#nodeMethods','methods']];
  const hide=()=>{popup.hidden=true;active?.setAttribute('aria-expanded','false');};
  function accept(index=selected){const choice=choices[index];if(!active||!choice)return;active.setRangeText(choice.insert,choice.start,choice.end,'end');active.focus();hide();hint.textContent=javaNameHint(document.querySelector('#elementName').value);}
  function paint(){popup.replaceChildren();choices.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='completion-item'+(i===selected?' active':'');b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===selected));const name=document.createElement('b'),detail=document.createElement('small');name.textContent=c.label;detail.textContent=c.detail;b.append(name,detail);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>accept(i);popup.append(b);});const help=document.createElement('div');help.className='completion-help';help.textContent='↑↓ 选择 · Tab / Enter 接受 · Esc 关闭';popup.append(help);}
  function show(field,kind,force=false){
    if(composing||!dialog.open||(kind==='name'&&document.querySelector('#classOptions').hidden)){hide();return;}
    active=field;const pos=field.selectionStart;if(!force&&(!field.value||field.value.slice(0,pos).endsWith('\n'))){hide();return;}
    choices=suggestJava(field.value,pos,kind,getNames());if(!choices.length){hide();return;}selected=0;paint();popup.hidden=false;field.setAttribute('aria-expanded','true');
    const rect=field.getBoundingClientRect(),width=Math.min(350,window.innerWidth-32);popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px';const top=rect.bottom+4;popup.style.top=Math.max(12,Math.min(top,window.innerHeight-popup.offsetHeight-12))+'px';
  }
  function format(){for(const selector of ['#nodeAttrs','#nodeMethods']){const field=document.querySelector(selector);field.value=field.value.split('\n').map(formatMember).join('\n');}hide();notify('已整理为 UML 格式 · 每个属性、方法独占一行');}
  for(const [selector,kind]of fields){const field=document.querySelector(selector);field.setAttribute('autocomplete','off');field.setAttribute('spellcheck','false');field.setAttribute('aria-controls','javaCompletion');field.setAttribute('aria-autocomplete','list');
    field.addEventListener('compositionstart',()=>{composing=true;hide();});field.addEventListener('compositionend',()=>{composing=false;show(field,kind);});
    field.addEventListener('input',()=>{if(kind==='name')hint.textContent=javaNameHint(field.value);show(field,kind);});
    field.addEventListener('blur',()=>{hide();if(kind!=='name')field.value=field.value.split('\n').map(formatMember).join('\n');});
    field.addEventListener('keydown',e=>{
      if(e.isComposing)return;
      if((e.ctrlKey||e.metaKey)&&e.code==='Space'){e.preventDefault();show(field,kind,true);return;}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();format();return;}
      if(popup.hidden||active!==field)return;
      if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;paint();}
      else if(e.key==='Tab'||(e.key==='Enter'&&!e.shiftKey)){e.preventDefault();accept();}
      else if(e.key==='Escape'){e.preventDefault();hide();}
    });
  }
  document.querySelector('#formatMembers').onclick=format;dialog.addEventListener('close',()=>{hide();hint.textContent='';});dialog.addEventListener('scroll',hide);return {format,hide};
}
