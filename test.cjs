const assert=require('node:assert/strict');
const R=require('./roster.js');
const base=R.parseRoster(R.defaults.partner,'partner');
const people=base.people,groups={partner:base.groups},settings={...R.defaults,date:'2026-10-20'};
const expected=`26년 10월 20일
출근 보고
외주 (ACCOMPANY TECH)

총원 : 16/16
BULK : 6/6 (이종섭 강경석 엄정태 안기석 변진석 이호동)
UPW : 1/1 (오세익)
전기,진공 : 2/2 (노명성 김우진)
S-GAS : 0/0
CHEMICAL : 0/0
CAD : 6/6 (이효정 이예원 조은정 장채연 강민주 방수희)
설계지원 : 1/1 (최강석)

연차 : 0
공가 : 0
퇴사 : 0
반차 : 0
신규 : 0`;
assert.equal(R.generate(people,{},settings,groups),expected);
const lee=people.find(p=>p.name==='이호동');
for(const status of ['연차','공가','결근']){
 const text=R.generate(people,{[lee.id]:{status}},settings,groups);
 assert.match(text,/총원 : 15\/16/);
 assert.match(text,/BULK : 5\/6 \(이종섭 강경석 엄정태 안기석 변진석\)/);
 assert(text.includes(status+' : 1 (이호동)'));
}
const half=R.generate(people,{[lee.id]:{status:'반차'}},settings,groups);
assert.match(half,/총원 : 16\/16/);
assert.match(half,/반차 : 1 \(이호동\)/);
const quit=R.generate(people,{[lee.id]:{status:'퇴사'}},settings,groups);
assert.match(quit,/총원 : 15\/15/);
assert.match(quit,/퇴사 : 1 \(이호동\)/);
const newPerson={id:'extra',org:'partner',group:'CAD',name:'신규인원',isNew:true};
const joined=R.generate([...people,newPerson],{},settings,groups);
assert.match(joined,/총원 : 17\/17/);
assert.match(joined,/신규 : 1 \(신규인원\)/);
const removed=R.removePerson(R.defaults.partner,lee);
assert.equal(R.parseRoster(removed,'partner').people.length,15);
assert.equal(R.parseRoster(R.addPerson(removed,lee),'partner').people.length,16);
assert.throws(()=>R.parseRoster('BULK : 홍길동 홍길동','partner'),/중복/);
assert.throws(()=>R.generate(people,{}, {...settings,date:'2026-02-31'},groups),/올바른/);
console.log('Exact requested format, 16 people, leave, half-day attendance, retirement, new joiners and validation passed.');
