const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const http=require('node:http');
// Pass PLAYWRIGHT_MODULE when using the bundled desktop runtime.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const allowed=new Set(['/index.html','/style.css','/extras.css','/startup.js','/roster.js','/app.js']);
 const server=http.createServer((req,res)=>{const file=req.url==='/'?'/index.html':req.url;if(!allowed.has(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(__dirname,file)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const profiles=[{name:'iphone-size',width:390,height:844},{name:'android-small',width:360,height:800},{name:'android-large',width:412,height:915},{name:'android-landscape',width:800,height:360}];
  for(const profile of profiles){
  const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{
   localStorage.setItem('attendance-settings-v2','{"company":"세보 전용 설정"}');
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared=data;}});
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  assert.equal(await page.locator('.person').count(),16);
  await page.locator('#date').fill('2026-09-21');
  await page.getByRole('button',{name:'ACCOMPANY TECH BULK 이호동, 출근',exact:true}).click();
  await page.locator('#generate').click();
  let text=await page.locator('#output').inputValue();assert.match(text,/총원 : 15\/16/);assert.match(text,/BULK : 5\/6/);assert.match(text,/반차 : 0/);
  await page.getByLabel('이호동 사유',{exact:true}).selectOption('반차');
  await page.locator('#generate').click();
  assert.match(await page.locator('#output').inputValue(),/총원 : 16\/16/);
  assert.match(await page.locator('#output').inputValue(),/반차 : 1 \(이호동\)/);
  await page.getByLabel('이호동 사유',{exact:true}).selectOption('연차');
  await page.locator('#generate').click();
  await page.locator('#output').fill(text+'\n검토 완료');await page.locator('#copy').click();assert.equal(await page.evaluate(()=>window.copied),text+'\n검토 완료');
  await page.locator('#share').click();assert.deepEqual(await page.evaluate(()=>window.shared),{text:text+'\n검토 완료'});
  await page.getByLabel('이호동 사유',{exact:true}).selectOption('결근');assert(await page.locator('#copy').isDisabled());
  await page.getByLabel('이호동 기타 결근 사유',{exact:true}).fill('개인 사정');await page.locator('#generate').click();assert.match(await page.locator('#output').inputValue(),/이호동 - 개인 사정/);
  await page.getByText('빠진 인원 추가',{exact:true}).click();await page.locator('#add-name').fill('추가인원');await page.locator('#add-new').check();await page.getByRole('button',{name:'오늘 명단에 추가',exact:true}).click();
  await page.locator('#generate').click();assert.match(await page.locator('#output').inputValue(),/총원 : 16\/17/);
  await page.locator('#date').fill('2026-09-22');assert.equal(await page.locator('.person').count(),16);assert(await page.locator('#result').isHidden());
  await page.locator('#generate').click();assert.match(await page.locator('#output').inputValue(),/총원 : 16\/16/);
  await page.getByRole('button',{name:'ACCOMPANY TECH BULK 이호동, 출근',exact:true}).click();
  await page.getByLabel('이호동 사유',{exact:true}).selectOption('퇴사');
  await page.getByRole('button',{name:'퇴사 처리 · 기본 명단에서 제거',exact:true}).click();
  await page.locator('#generate').click();
  assert.match(await page.locator('#output').inputValue(),/퇴사 : 1 \(이호동\)/);
  assert.equal(await page.locator('#partner').inputValue().then(v=>v.includes('이호동')),false);
  await page.reload();
  assert.equal(await page.evaluate(()=>localStorage.getItem('attendance-settings-v2')),'{"company":"세보 전용 설정"}');
  assert.equal(await page.getByRole('button',{name:/이호동/}).count(),0);
  await page.getByText('기본 명단 · 업체 설정',{exact:true}).click();await page.locator('#company').fill('테스트 업체');await page.locator('#generate').click();assert(await page.locator('#copy').isDisabled());await page.locator('#save').click();await page.reload();assert.equal(await page.locator('#company').inputValue(),'테스트 업체');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});await page.screenshot({path:path.join(__dirname,'dist',profile.name+'-preview.png'),fullPage:true});
  await page.locator('#generate').click();
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError');}});});await page.locator('#share').click();assert.match(await page.locator('#status').textContent(),/취소/);
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});await page.locator('#share').click();assert.match(await page.locator('#status').textContent(),/텍스트 공유를 지원하지/);
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});});await page.locator('#share').click();assert.match(await page.locator('#status').textContent(),/열 수 없습니다/);
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=()=>false;});await page.locator('#copy').click();assert.match(await page.locator('#status').textContent(),/길게 눌러/);
  await page.locator('#select-text').click();assert(await page.evaluate(()=>{const o=document.querySelector('#output');return o.selectionStart===0&&o.selectionEnd===o.value.length;}));
  assert.deepEqual(errors,[]);console.log(profile.name+': full attendance flow, copy/share fallback and layout checks passed (Chromium touch emulation, not a physical device).');
  await page.close();
  }
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
