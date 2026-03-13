import{E as d,i,T as m}from"./index-683dab14.js";const a=`
  <h2>Track change playground</h2>
  <p>这是一段普通文本，你可以直接在这里输入、删除、替换内容。</p>
  <p>试试先开启修订，再删除“普通文本”四个字，或者把这句改成你自己的版本。</p>
  <ul>
    <li>支持插入修订</li>
    <li>支持删除修订</li>
    <li>支持接受和拒绝</li>
  </ul>
`,p=document.querySelector("#editor"),c=document.querySelector("#track-status"),S=document.querySelector("#selection-status"),g=document.querySelector("#html-output"),r=document.querySelector("#user-id"),l=document.querySelector("#user-name"),n=e=>{g.textContent=e.getHTML()},o=e=>{const{from:s,to:u}=e.state.selection;S.textContent=`光标: ${s} - ${u}`},k=e=>{c.textContent=e?"已开启":"已关闭",c.dataset.enabled=String(e)},t=new d({element:p,extensions:[i,m.configure({enabled:!0,dataOpUserId:r.value,dataOpUserNickname:l.value,onStatusChange:k})],content:a,onCreate:({editor:e})=>{o(e),n(e)},onSelectionUpdate:({editor:e})=>{o(e)},onUpdate:({editor:e})=>{n(e)}});document.querySelector("#toggle-track").addEventListener("click",()=>{t.commands.toggleTrackChangeStatus()});document.querySelector("#accept-change").addEventListener("click",()=>{t.commands.acceptChange(),n(t)});document.querySelector("#reject-change").addEventListener("click",()=>{t.commands.rejectChange(),n(t)});document.querySelector("#accept-all").addEventListener("click",()=>{t.commands.acceptAllChanges(),n(t)});document.querySelector("#reject-all").addEventListener("click",()=>{t.commands.rejectAllChanges(),n(t)});document.querySelector("#reset-doc").addEventListener("click",()=>{t.commands.setContent(a,{emitUpdate:!0})});document.querySelector("#apply-user").addEventListener("click",()=>{t.commands.updateOpUserOption(r.value,l.value)});window.editor=t;
