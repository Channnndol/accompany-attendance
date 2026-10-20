const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const html=fs.readFileSync(__dirname+'/docs/index.html');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const [name,engine,options] of [['chromium',chromium,{channel:'msedge'}],['webkit',webkit,{}]]){
   const browser=await engine.launch({headless:true,...options});
   try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('#generate').click();
    const report=await page.locator('#output').inputValue();
    await page.evaluate(()=>{
     window.calls=0;window.copies=[];
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copies.push(text)}});
     Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>{throw new Error('Preflight must not block text sharing');}});
     Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
      window.calls++;window.shared=data;window.activated=navigator.userActivation.isActive;return Promise.resolve();
     }});
    });
    await page.locator('#share').click();
    assert.deepEqual(await page.evaluate(()=>window.shared),{text:report});
    assert.equal(await page.evaluate(()=>window.activated),true);
    assert.match(await page.locator('#share-message').textContent(),/요청이 완료/);
    // No native sharing in some embedded browsers: offer an explicit copy action.
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
    await page.locator('#share').click();
    assert.equal(await page.locator('#share-feedback').isVisible(),true);
    assert.match(await page.locator('#share-message').textContent(),/열 수 없습니다/);
    await page.locator('#share-copy').click();
    assert.deepEqual(await page.evaluate(()=>window.copies),[report]);
    // Permission errors and synchronous bridge errors are both recoverable.
    for(const synchronous of [false,true]){
     await page.evaluate(sync=>Object.defineProperty(navigator,'share',{configurable:true,value:()=>{
      const error=new DOMException('blocked','NotAllowedError');if(sync)throw error;return Promise.reject(error);
     }}),synchronous);
     await page.locator('#share').click();
     assert.match(await page.locator('#share-message').textContent(),/열지 못했습니다/);
    }
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('cancel','AbortError'))}));
    await page.locator('#share').click();
    assert.match(await page.locator('#share-message').textContent(),/취소/);
    assert.equal(await page.evaluate(()=>window.copies.length),1); // Never copy on cancel.
    // A browser bridge can remain pending: feedback and copying remain usable.
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:()=>{
     window.calls++;return new Promise(resolve=>{window.finishShare=resolve;});
    }}));
    await page.locator('#share').click();
    assert.match(await page.locator('#share-message').textContent(),/요청했습니다/);
    await page.waitForFunction(()=>document.querySelector('#share-message').textContent.includes('응답을 기다리고'),null,{timeout:7000});
    const calls=await page.evaluate(()=>window.calls);
    await page.locator('#share').click();
    assert.equal(await page.evaluate(()=>window.calls),calls);
    await page.locator('#share-copy').click();
    assert.match(await page.locator('#share-message').textContent(),/복사했습니다/);
    await page.evaluate(()=>window.finishShare());
    assert.match(await page.locator('#share-message').textContent(),/복사했습니다/);
    // Clipboard unavailable: a selectable text fallback remains available.
    await page.evaluate(()=>{
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
     document.execCommand=()=>false;
    });
    await page.locator('#share-copy').click();
    assert.equal(await page.locator('#select-text').isVisible(),true);
    await page.locator('#select-text').click();
    assert(await page.evaluate(()=>{const o=document.querySelector('#output');return o.selectionStart===0&&o.selectionEnd===o.value.length;}));
    assert.deepEqual(errors,[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(name+': activated native call, missing API, denied/sync errors, cancellation, pending bridge, duplicate prevention and copy/manual fallback passed.');
   }finally{await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
