const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {webkit,chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.join(__dirname,'out','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');res.setHeader('Content-Type','text/html; charset=utf-8');
  if(url.pathname==='/failure')return res.end(html.replace(app,'throw new Error("Simulated startup failure");'));
  if(url.pathname==='/timeout')return res.end(html.replace(app,'/* Simulated missing initialization */'));
  if(url.pathname==='/away')return res.end('<html><body>Navigation test</body></html>');
  if(url.pathname!=='/'){res.writeHead(404).end();return;}res.end(html);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const [name,engine,options] of [['webkit',webkit,{}],['chromium',chromium,{channel:'msedge'}]]){
   const browser=await engine.launch({headless:true,...options});
   try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
    const page=await context.newPage(),errors=[],subrequests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
    // Even if every non-document request fails, the actual deployed build must work.
    await page.route('**/*',route=>{if(!route.request().isNavigationRequest()){subrequests.push(route.request().url());return route.abort();}return route.continue();});
    await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.appState==='ready');
    assert.equal(await page.locator('.person').count(),16);assert.deepEqual(subrequests.filter(url=>url.startsWith(base+'/')),[]);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(243, 245, 241)');
    assert.equal(await page.locator('#startup').isHidden(),true);
    await page.getByRole('button',{name:'ACCOMPANY TECH BULK 이호동, 출근',exact:true}).click();
    await page.locator('#generate').click();
    const text=await page.locator('#output').inputValue();assert.match(text,/15\/16/);
    await page.locator('#output').fill(text+'\n직접 수정');
    const selectedDate=await page.locator('#date').inputValue();
    await page.evaluate(()=>{
     document.querySelector('#roster').replaceChildren();document.querySelector('#totals').replaceChildren();
     window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
     document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('.person').count(),16);
    assert.equal(await page.locator('#output').inputValue(),text+'\n직접 수정');
    assert.equal(await page.locator('#date').inputValue(),selectedDate);
    assert.equal(await page.getByLabel('이호동 사유',{exact:true}).inputValue(),'연차');
    const before=await page.evaluate(()=>localStorage.getItem('accompany-attendance-settings-v1'));
    await page.evaluate(()=>{window.AttendanceStartup.failed('테스트');});
    await page.locator('#startup-retry').click(); // dismissed: edits must not be lost
    assert.equal(await page.locator('#output').inputValue(),text+'\n직접 수정');
    assert.equal(await page.evaluate(()=>localStorage.getItem('accompany-attendance-settings-v1')),before);
    for(let i=0;i<3;i++){
     await page.goto(base+'/away');await page.goBack();
     await page.waitForFunction(()=>document.querySelectorAll('.person').length===16);
     assert.equal(await page.locator('h1').isVisible(),true);
    }
    assert.deepEqual(errors,[]);await context.close();
    // Storage denial must not prevent startup or clear the saved roster.
    const blocked=await browser.newContext({viewport:{width:390,height:844}});
    await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}});});
    const denied=await blocked.newPage();await denied.goto(base);await denied.waitForFunction(()=>document.documentElement.dataset.appState==='ready');assert.equal(await denied.locator('.person').count(),16);await blocked.close();
    const malformed=await browser.newContext();await malformed.addInitScript(()=>localStorage.setItem('accompany-attendance-settings-v1','{invalid'));
    const bad=await malformed.newPage();await bad.goto(base);await bad.waitForFunction(()=>document.documentElement.dataset.appState==='ready');assert.equal(await bad.locator('.person').count(),16);assert.equal(await bad.evaluate(()=>localStorage.getItem('accompany-attendance-settings-v1')),'{invalid');await malformed.close();
    const failure=await browser.newPage();await failure.goto(base+'/failure');await failure.waitForFunction(()=>document.documentElement.dataset.appState==='failed');assert.match(await failure.locator('#startup-message').innerText(),/실행 오류/);assert.equal(await failure.locator('#startup-retry').isVisible(),true);await failure.close();
    const timeout=await browser.newPage();await timeout.goto(base+'/timeout');await timeout.waitForFunction(()=>document.documentElement.dataset.appState==='failed',null,{timeout:12000});assert.match(await timeout.locator('#startup-message').innerText(),/시작 지연/);await timeout.close();
    console.log(name+': no external startup requests, dark appearance, restore without data loss, back/forward, storage failure, startup error and timeout recovery passed.');
   }finally{await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
