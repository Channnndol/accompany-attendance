(function(root){
'use strict';
const defaults={company:'ACCOMPANY TECH',
partner:`BULK : 이종섭 강경석 엄정태 안기석 변진석 이호동
UPW : 오세익
전기,진공 : 노명성 김우진
S-GAS :
CHEMICAL :
CAD : 이효정 이예원 조은정 장채연 강민주 방수희
설계지원 : 최강석`};
function parseRoster(text,org){
 const people=[],groups=[],seen=new Set();
 text.split(/\r?\n/).forEach((line,i)=>{
  if(!line.trim())return;
  const m=line.match(/^\s*([^:：]+)[:：]\s*(.*?)\s*$/);
  if(!m)throw new Error('명단 '+(i+1)+'행: 파트 : 이름 이름 형식으로 입력하세요.');
  const group=m[1].trim();
  if(groups.includes(group))throw new Error(group+' 파트가 중복되었습니다. 한 줄로 합쳐주세요.');
  groups.push(group);
  for(const name of m[2].split(/[\s,、]+/).filter(Boolean)){
   if(/[\d/()（）]/.test(name))throw new Error(group+': 숫자 대신 이름만 입력하세요. 동명이인은 이름 뒤에 구분 문자를 붙여주세요.');
   if(seen.has(name))throw new Error(name+' 이름이 중복되었습니다. 동명이인은 이름 뒤에 구분 문자를 붙여주세요.');
   seen.add(name);people.push({id:JSON.stringify([org,group,name]),org,group,name});
  }
 });
 if(!groups.length)throw new Error('최소 한 개 파트를 입력하세요.');
 return {people,groups};
}
function updateRoster(text,person,remove){
 const parsed=parseRoster(text,person.org),groups=[...parsed.groups];
 if(!groups.includes(person.group))groups.push(person.group);
 return groups.map(group=>{
  const names=parsed.people.filter(p=>p.group===group&&(!remove||p.id!==person.id)).map(p=>p.name);
  if(!remove&&group===person.group&&!names.includes(person.name))names.push(person.name);
  return group+' : '+names.join(' ');
 }).join('\n');
}
const removePerson=(text,person)=>updateRoster(text,person,true);
const addPerson=(text,person)=>updateRoster(text,person,false);
function summarize(people,states,org){
 const all=people.filter(p=>p.org===org),active=all.filter(p=>(states[p.id]?.status||'출근')!=='퇴사');
 const present=active.filter(p=>['출근','반차'].includes(states[p.id]?.status||'출근'));
 return {total:active.length,present:present.length,absent:active.length-present.length,newCount:active.filter(p=>p.isNew).length,quit:all.filter(p=>states[p.id]?.status==='퇴사').length};
}
function generate(people,states,settings,groupMap){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(settings.date||''))throw new Error('보고 날짜를 선택하세요.');
 const day=new Date(settings.date+'T12:00:00');
 if(Number.isNaN(day.getTime())||day.getFullYear()!==+settings.date.slice(0,4)||day.getMonth()+1!==+settings.date.slice(5,7)||day.getDate()!==+settings.date.slice(8,10))throw new Error('올바른 보고 날짜를 선택하세요.');
 const status=p=>states[p.id]?.status||'출근';
 for(const p of people)if(!['출근','반차','연차','공가','결근','퇴사'].includes(status(p)))throw new Error(p.name+'의 출근 상태를 확인하세요.');
 const org='partner',s=summarize(people,states,org),all=people.filter(p=>p.org===org);
 const lines=[settings.date.slice(2,4)+'년 '+settings.date.slice(5,7)+'월 '+settings.date.slice(8,10)+'일','출근 보고','외주 ('+settings.company+')','',`총원 : ${s.present}/${s.total}`];
 for(const group of [...new Set([...(groupMap[org]||[]),...all.map(p=>p.group)])]){
   const members=all.filter(p=>p.group===group&&status(p)!=='퇴사'),attended=members.filter(p=>['출근','반차'].includes(status(p)));
   lines.push(group+' : '+attended.length+'/'+members.length+(attended.length?' ('+attended.map(p=>p.name).join(' ')+')':''));
  }
  lines.push('');
  for(const key of ['연차','공가','퇴사','반차','신규','결근']){
   const members=all.filter(p=>key==='신규'?p.isNew&&status(p)!=='퇴사':status(p)===key);if(key==='결근'&&!members.length)continue;
   lines.push(key+' : '+members.length+(members.length?' ('+members.map(p=>p.name+(key==='결근'&&states[p.id]?.reason?' - '+states[p.id].reason.replace(/[\r\n]+/g,' '):'')).join(' ')+')':''));
  }
 return lines.join('\n');
}
const api={defaults,parseRoster,removePerson,addPerson,summarize,generate};if(typeof module!=='undefined')module.exports=api;else root.Roster=api;
})(typeof window!=='undefined'?window:globalThis);
