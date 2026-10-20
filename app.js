(function(){
'use strict';
const $=id=>document.getElementById(id);
const storageKey='accompany-attendance-settings-v1';
let config={...Roster.defaults},base,states={},extras=[],stale=true,settingsDirty=false;
let exclusions={'연장 보고':[],'퇴근 보고':[]};
const reportType=()=>$('report-type').value;
const isAttendance=()=>reportType()==='출근 보고';
const excluded=()=>isAttendance()?[]:exclusions[reportType()];
const hasSelections=()=>Object.keys(states).length||extras.length||Object.values(exclusions).some(ids=>ids.length);
function clearSelections(){states={};extras=[];exclusions={'연장 보고':[],'퇴근 보고':[]};}
let sharePending=false,shareFeedbackVersion=0;
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function readBase(candidate){return {partner:Roster.parseRoster(candidate.partner,'partner')};}
try{
 const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
 if(saved){for(const key of Object.keys(config)){if(typeof saved[key]!=='string')throw new Error('invalid');}readBase(saved);config=Object.fromEntries(Object.keys(config).map(k=>[k,saved[k]]));}
}catch(e){notice('저장된 설정을 읽지 못해 기본 명단을 불러왔습니다. 기본 설정을 확인해 주세요.');}
base=readBase(config);
for(const key of Object.keys(config))$(key).value=config[key];
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
$('date').value=localDate();let previousDate=$('date').value;
const people=()=>[...base.partner.people,...extras];
const element=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function invalidate(){stale=true;shareFeedbackVersion++;$('stale').hidden=$('result').hidden;$('copy').disabled=true;$('share').disabled=true;$('share-feedback').hidden=true;$('status').textContent='';}
function saveConfig(message){
 try{localStorage.setItem(storageKey,JSON.stringify(config));notice(message);return true;}
 catch(e){notice('현재 화면에는 반영했지만 브라우저에 저장하지 못했습니다. 페이지를 닫기 전에 기본 명단을 확인해 주세요.');return false;}
}
function retire(person){
 if(!confirm(person.name+' 님을 기본 명단에서 제거할까요? 오늘 보고에는 퇴사자로 표시됩니다.'))return;
 const key='partner';
 config[key]=Roster.removePerson(config[key],person);$(key).value=config[key];
 base=readBase(config);if(!extras.some(p=>p.id===person.id))extras.push({...person,retired:true});
 states[person.id]={status:'퇴사',reason:''};settingsDirty=false;saveConfig(person.name+' 님을 퇴사 처리했습니다. 오늘 보고 확인 후 복사하세요.');invalidate();render();updateGroups();
}
function undoRetire(person){
 const key='partner';
 config[key]=Roster.addPerson(config[key],person);$(key).value=config[key];
 base=readBase(config);extras=extras.filter(p=>p.id!==person.id);delete states[person.id];settingsDirty=false;saveConfig(person.name+' 님의 퇴사 처리를 취소했습니다.');invalidate();render();updateGroups();
}
function render(){
 $('roster').replaceChildren();$('totals').replaceChildren();let absent=0,quit=0,omitted=0;
 $('reset').textContent=isAttendance()?'전체 초기화':'제외 초기화';
 $('roster-title').textContent=isAttendance()?'1. 변동 인원 선택':'1. '+reportType().replace(' 보고','')+' 제외 인원';
 $('roster-help').textContent=isAttendance()?'이름을 누르고 사유를 고르세요. 선택하지 않은 사람은 모두 출근입니다.':reportType()+'에 포함하지 않을 사람을 누르세요. 다시 누르면 포함됩니다. 연차·공가·반차·퇴사는 출근 보고에서 설정하며 모든 보고에 반영됩니다.';
 $('copy-overtime').hidden=reportType()!=='퇴근 보고';
 for(const org of ['partner']){
  const title=config.company,s=Roster.summarize(people(),states,org,excluded());absent+=s.absent;quit+=s.quit;omitted+=s.excluded;
  const card=element('div','total');card.append(element('span','',title+' · '+reportType()),element('strong','',`${s.present} / ${s.total}`),element('span','',`결근 ${s.absent}명`+(isAttendance()?'':` · 보고 제외 ${s.excluded}명`)));$('totals').append(card);$('roster').append(element('h3','',title));
  for(const group of [...new Set([...base[org].groups,...extras.filter(p=>p.org===org).map(p=>p.group)])]){
   const members=people().filter(p=>p.org===org&&p.group===group);if(!members.length)continue;
   $('roster').append(element('div','group-label',group));const names=element('div','names'),reasons=element('div');
   for(const person of members){
    const personStatus=states[person.id]?.status||'출근',omittedPerson=excluded().includes(person.id);
    const selected=!!states[person.id]||omittedPerson,button=element('button','person'+(person.retired?' retired':''),person.name);button.type='button';button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${title} ${group} ${person.name}, ${omittedPerson?reportType()+' 제외':personStatus}`);
    if(!isAttendance()&&!['출근','반차','오전반차','오후반차'].includes(personStatus))button.disabled=true;
    button.onclick=()=>{
     if(person.retired)return;
     if(!isAttendance())exclusions[reportType()]=omittedPerson?excluded().filter(id=>id!==person.id):[...excluded(),person.id];
     else if(states[person.id])delete states[person.id];else states[person.id]={status:'연차',reason:''};
     invalidate();render();
    };names.append(button);
    if(selected&&!isAttendance())reasons.append(element('p','hint',person.name+' · '+(omittedPerson?reportType()+' 제외'+(personStatus==='출근'?'':' · '+personStatus):personStatus)));
    if(selected&&isAttendance()){
     const box=element('div','absence'),label=element('label','',person.name+' · 사유'),select=element('select');
     select.setAttribute('aria-label',person.name+' 사유');for(const status of ['연차','공가','오전반차','오후반차','결근','퇴사']){const opt=element('option','',status==='결근'?'기타 결근':status);opt.value=status;select.append(opt);}select.value=states[person.id].status;
     select.disabled=!!person.retired;select.onchange=()=>{states[person.id].status=select.value;invalidate();render();};label.append(select);box.append(label);
     if(states[person.id].status==='결근'){const input=element('input');input.placeholder='사유 입력 (선택)';input.maxLength=60;input.value=states[person.id].reason;input.setAttribute('aria-label',person.name+' 기타 결근 사유');input.oninput=()=>{states[person.id].reason=input.value;invalidate();};box.append(input);}
     if(states[person.id].status==='퇴사'){
      const action=element('button',person.retired?'secondary':'danger',person.retired?'퇴사 처리 취소':'퇴사 처리 · 기본 명단에서 제거');action.type='button';action.onclick=()=>person.retired?undoRetire(person):retire(person);box.append(action);
     }
     reasons.append(box);
    }
   }
   $('roster').append(names,reasons);
  }
 }
 $('selection-count').textContent=isAttendance()?`결근 ${absent}명`+(quit?` · 퇴사 ${quit}명`:''):`${reportType()} · 제외 ${omitted}명`;
 $('extra-list').replaceChildren();for(const p of extras){const row=element('p','',`${p.name} · ${p.group}${p.isNew?' · 신규':''}`),remove=element('button','','삭제');remove.onclick=()=>{extras=extras.filter(x=>x.id!==p.id);delete states[p.id];for(const type of Object.keys(exclusions))exclusions[type]=exclusions[type].filter(id=>id!==p.id);invalidate();render();};row.append(remove);$('extra-list').append(row);}
}
$('report-type').onchange=()=>{invalidate();render();notice('');};
$('copy-overtime').onclick=()=>{
 if(exclusions['퇴근 보고'].length&&!confirm('퇴근 보고의 제외 인원을 연장 보고와 같게 바꿀까요?'))return;
 exclusions['퇴근 보고']=[...exclusions['연장 보고']];invalidate();render();notice('연장 보고 인원을 퇴근 보고에 적용했습니다. 확인 후 글을 만들어 주세요.');
};
function updateGroups(){const org=$('add-org').value;$('add-group').replaceChildren();for(const group of base[org].groups){const option=element('option','',group);option.value=group;$('add-group').append(option);}}
$('add-org').onchange=updateGroups;
$('add-form').onsubmit=e=>{
 e.preventDefault();const name=$('add-name').value.trim(),org=$('add-org').value,group=$('add-group').value;
 if(!name||/[\s,\d/()（）:：]/.test(name)){notice('이름 한 명만 입력하세요. 공백이나 숫자, 구분 기호는 사용할 수 없습니다.');return;}
 if(people().some(p=>p.org===org&&p.name===name)){notice('같은 소속에 이미 있는 이름입니다. 동명이인은 이름 뒤에 구분 문자를 붙여주세요.');return;}
 extras.push({id:JSON.stringify([org,group,name]),org,group,name,isNew:$('add-new').checked});$('add-name').value='';$('add-new').checked=false;notice('');invalidate();render();
};
for(const key of Object.keys(config))$(key).oninput=()=>{settingsDirty=true;invalidate();};
$('save').onclick=()=>{
 const candidate=Object.fromEntries(Object.keys(config).map(key=>[key,$(key).value.trim()]));
 try{if(!candidate.company)throw new Error('업체명을 입력하세요.');const parsed=readBase(candidate);
  if(hasSelections()&&!confirm('기본 명단을 저장하면 모든 보고의 오늘 선택과 추가 인원이 초기화됩니다. 저장할까요?'))return;
  config=candidate;base=parsed;clearSelections();settingsDirty=false;invalidate();render();updateGroups();
  saveConfig('기본 설정을 저장했습니다. 오늘 결근 인원을 선택해 주세요.');
 }catch(e){notice(e.message);}
};
$('date').onchange=()=>{
 if((hasSelections()||!$('result').hidden)&&!confirm('날짜를 변경하면 모든 보고의 선택 인원과 완성 글이 초기화됩니다. 변경할까요?')){$('date').value=previousDate;return;}
 previousDate=$('date').value;clearSelections();$('result').hidden=true;$('output').value='';invalidate();render();
};
$('reset').onclick=()=>{
 if(isAttendance()){
  if(hasSelections()&&!confirm('출근 상태, 연장·퇴근 보고의 제외 인원과 오늘 추가 인원을 모두 초기화할까요?'))return;
  clearSelections();
 }else{
  if(excluded().length&&!confirm(reportType()+'의 제외 인원을 초기화할까요?'))return;
  exclusions[reportType()]=[];
 }
 invalidate();render();
};
$('generate').onclick=()=>{
 if(settingsDirty){notice('수정한 기본 설정을 먼저 저장해 주세요.');$('settings').open=true;$('settings').scrollIntoView({behavior:'smooth'});return;}
 if(!$('result').hidden&&!stale&&$('output').value&&!confirm('완성 글을 새로 만들까요? 직접 수정한 내용은 덮어씁니다.'))return;
 try{$('output').value=Roster.generate(people(),states,{...config,date:$('date').value,reportType:reportType(),excluded:excluded()},{partner:base.partner.groups});stale=false;$('result').hidden=false;$('stale').hidden=true;$('copy').disabled=false;$('share').disabled=false;$('status').textContent='';notice('');$('result').scrollIntoView({behavior:'smooth'});}catch(e){notice(e.message);}
};
function ready(){if(stale){$('status').textContent='확인 · 글 만들기를 먼저 눌러주세요.';return false;}if(!$('output').value.trim()){$('status').textContent='복사·공유할 글이 없습니다.';return false;}return true;}
function selectText(){$('output').focus();$('output').select();$('output').setSelectionRange(0,$('output').value.length);}
const selectButton=element('button','secondary','글 전체 선택');selectButton.type='button';selectButton.id='select-text';selectButton.hidden=true;
$('status').before(selectButton);
selectButton.onclick=()=>{if(!ready())return;selectText();$('status').textContent='글을 선택했습니다. 선택한 글을 길게 눌러 복사하세요. PC에서는 Ctrl+C를 누르세요.';};
async function copyReport(){
 if(!ready())return;
 try{if(!navigator.clipboard?.writeText)throw new Error('unsupported');await navigator.clipboard.writeText($('output').value);$('status').textContent='복사했습니다. 카카오톡 대화방에 붙여넣으세요.';}
 catch(e){selectText();let copied=false;try{copied=document.execCommand('copy');}catch(e){}selectButton.hidden=copied;$('status').textContent=copied?'복사했습니다. 카카오톡 대화방에 붙여넣으세요.':'자동 복사를 사용할 수 없습니다. 글 전체 선택 버튼을 누르고 글을 길게 눌러 복사하세요. 카카오톡 안에서 열었다면 기본 브라우저에서 다시 열어보세요.';}
}
$('copy').onclick=copyReport;
$('share-copy').onclick=async()=>{
 if(!ready())return;
 shareFeedback('글을 복사하고 있습니다. 복사 안내를 확인한 뒤 카카오톡 대화방에 붙여넣으세요.');
 await copyReport();
 shareFeedback($('status').textContent);
};
function shareFeedback(message){
 shareFeedbackVersion++;
 $('share-feedback').hidden=false;$('share-message').textContent=message;
}
$('share').onclick=async()=>{
 if(!ready())return;
 if(sharePending){shareFeedback('이전 공유 요청의 응답을 기다리고 있습니다. 공유창이 보이지 않으면 아래 버튼으로 글을 복사해 카카오톡에 붙여넣으세요.');return;}
 if(typeof navigator.share!=='function'){
  shareFeedback('이 앱에서는 텍스트 공유창을 열 수 없습니다. 아래 버튼으로 글을 복사한 뒤 카카오톡 대화방에 붙여넣으세요.');
  $('share-feedback').scrollIntoView({block:'nearest'});
  return;
 }
 shareFeedback('휴대폰 공유 메뉴를 요청했습니다. 공유창이 보이지 않으면 아래 복사 버튼을 이용하세요.');
 const version=shareFeedbackVersion;
 const current=()=>version===shareFeedbackVersion&&!stale;
 sharePending=true;
 const timeout=setTimeout(()=>{
  if(current())$('share-message').textContent='공유 응답을 기다리고 있습니다. 공유창이 열려 있으면 앱을 선택하세요. 아무 창도 보이지 않으면 아래 버튼으로 글을 복사하세요.';
 },4000);
 try{
  // Call from the tap handler, before any await. A text-only request does not
  // need a canShare preflight; the actual share result determines support.
  const request=navigator.share({text:$('output').value});
  $('share-feedback').scrollIntoView({block:'nearest'});
  await request;
  if(current())$('share-message').textContent='공유 요청이 완료되었습니다. 실제 전송 여부는 선택한 앱에서 확인하세요.';
 }catch(e){
  if(current())$('share-message').textContent=e?.name==='AbortError'?'공유가 취소되었거나 공유할 앱을 찾지 못했습니다. 필요하면 아래 복사 버튼을 이용하세요.':'이 앱에서 공유창을 열지 못했습니다. 아래 버튼으로 글을 복사해 카카오톡에 붙여넣거나 Chrome에서 이 페이지를 열어주세요.';
 }finally{clearTimeout(timeout);sharePending=false;}
};
if(!navigator.share)$('share-help').textContent='현재 환경은 공유 메뉴를 지원하지 않습니다. 복사를 이용하세요. 휴대폰 공유 기능은 지원 브라우저의 HTTPS 주소에서 사용할 수 있습니다.';
render();updateGroups();invalidate();
// Safari may restore an already initialized page. Repair only missing generated
// elements; never reset the date, selections, edited output or stored settings.
function resumePage(){
 if(document.visibilityState==='hidden')return;
 try{
  if(!$('totals').childElementCount||(!$('roster').childElementCount&&people().length))render();
 }catch(e){if(window.AttendanceStartup)window.AttendanceStartup.failed('복원 오류');}
}
window.addEventListener('pageshow',resumePage);
document.addEventListener('visibilitychange',resumePage);
if(window.AttendanceStartup)window.AttendanceStartup.ready();
})();
