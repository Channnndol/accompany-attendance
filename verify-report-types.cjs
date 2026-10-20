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
    const page=await browser.newPage({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.addInitScript(()=>{
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied=text}});
     Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.shared=data});
    });
    await page.goto('http://127.0.0.1:'+server.address().port);
    const type=page.locator('#report-type'),generate=page.locator('#generate'),output=page.locator('#output');
    const person=name=>page.getByRole('button',{name:new RegExp('ACCOMPANY TECH .* '+name+',')});
    await page.locator('#date').fill('2026-10-19');
    await generate.click();assert.match(await output.inputValue(),/출근 보고[\s\S]*총원 : 16\/16/);
    await type.selectOption('연장 보고');
    assert(await page.locator('#copy').isDisabled());
    for(const name of ['변진석','노명성','방수희'])await person(name).click();
    await generate.click();
    const overtime=await output.inputValue();
    assert.match(overtime,/연장 보고[\s\S]*총원 : 13\/16/);
    assert.match(overtime,/연차 : 0\n공가 : 0/);
    assert.match(overtime,/BULK : 5\/6 \(이종섭 강경석 엄정태 안기석 이호동\)/);
    assert.match(overtime,/전기,진공 : 1\/2 \(김우진\)/);
    await type.selectOption('퇴근 보고');await generate.click();
    assert.match(await output.inputValue(),/퇴근 보고[\s\S]*총원 : 16\/16/);
    await page.locator('#copy-overtime').click();await generate.click();
    assert.equal(await output.inputValue(),overtime.replace('연장 보고','퇴근 보고'));
    await page.locator('#copy').click();assert.equal(await page.evaluate(()=>window.copied),await output.inputValue());
    await page.locator('#share').click();assert.deepEqual(await page.evaluate(()=>window.shared),{text:await output.inputValue()});
    await person('변진석').click();await generate.click();
    assert.match(await output.inputValue(),/총원 : 14\/16/);
    await type.selectOption('연장 보고');await generate.click();assert.equal(await output.inputValue(),overtime);
    await type.selectOption('출근 보고');await generate.click();assert.match(await output.inputValue(),/총원 : 16\/16/);
    await person('이호동').click();
    await type.selectOption('연장 보고');assert(await person('이호동').isDisabled());
    await generate.click();assert.match(await output.inputValue(),/총원 : 12\/16/);assert.match(await output.inputValue(),/연차 : 1 \(이호동\)/);
    await type.selectOption('출근 보고');await page.getByLabel('이호동 사유',{exact:true}).selectOption('오후반차');
    await type.selectOption('연장 보고');assert.equal(await person('이호동').isDisabled(),false);
    await generate.click();assert.match(await output.inputValue(),/총원 : 13\/16/);assert.match(await output.inputValue(),/반차 : 1 \(이호동 - 오후반차\)/);
    await page.locator('#reset').click();await generate.click();assert.match(await output.inputValue(),/총원 : 16\/16/);
    await type.selectOption('퇴근 보고');await generate.click();assert.match(await output.inputValue(),/총원 : 14\/16/);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    fs.mkdirSync(__dirname+'/dist',{recursive:true});
    await page.screenshot({path:__dirname+'/dist/'+name+'-report-types.png',fullPage:true});
    await page.locator('#date').fill('2026-10-20');await page.locator('#date').blur();
    await page.locator('#result').waitFor({state:'hidden'});await generate.click();
    assert.match(await output.inputValue(),/총원 : 16\/16/);assert.match(await output.inputValue(),/반차 : 0/);
    await type.selectOption('연장 보고');await generate.click();assert.match(await output.inputValue(),/총원 : 16\/16/);
    await page.reload();assert.equal(await type.inputValue(),'출근 보고');
    assert.deepEqual(errors,[]);
    console.log(name+': three report types, independent exclusions, import, shared leave/half-day counts, copy/share, reset and date change passed.');
   }finally{await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
