// 用 headless Chrome 截圖檢查：node tools/shot.js
const {chromium}=require('/workspace/pw/node_modules/playwright-core');
const path=require('path'); const root=path.resolve(__dirname,'..');
const shots=[
  ['desktop-monalisa-all',{width:1440,height:900},'#monalisa'],
  ['desktop-monalisa-step5',{width:1440,height:900},'#monalisa/5'],
  ['desktop-monalisa-step12',{width:1440,height:900},'#monalisa/12'],
  ['desktop-monalisa-step17',{width:1440,height:900},'#monalisa/17'],
  ['desktop-cam-oled-all',{width:1440,height:900},'#cam-oled'],
  ['desktop-cam-oled-step5',{width:1440,height:900},'#cam-oled/5'],
  ['phone-monalisa-all',{width:390,height:844,mobile:true},'#monalisa'],
  ['phone-monalisa-step5',{width:390,height:844,mobile:true},'#monalisa/5'],
  ['phone-cam-oled-step5',{width:390,height:844,mobile:true},'#cam-oled/5'],
  ['desktop-s3-climate-all',{width:1440,height:900},'#s3-climate'],
  ['desktop-s3-climate-step5',{width:1440,height:900},'#s3-climate/5'],
  ['desktop-s3-climate-step15',{width:1440,height:900},'#s3-climate/15'],
  ['phone-s3-climate-all',{width:390,height:844,mobile:true},'#s3-climate'],
  ['phone-s3-climate-step5',{width:390,height:844,mobile:true},'#s3-climate/5'],
];
const only=process.argv[2];
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  for(const [name,vp,hash] of shots){
    if(only && !name.includes(only)) continue;
    const ctx=await b.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:vp.mobile?2:1,isMobile:!!vp.mobile,hasTouch:!!vp.mobile,offline:true});
    const pg=await ctx.newPage(); const errs=[];
    pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});
    pg.on('requestfailed',r=>errs.push('FAIL '+r.url()));
    await pg.goto('file://'+root+'/index.html'+hash);
    await pg.waitForFunction('window.__ready===true',null,{timeout:30000});
    await pg.waitForTimeout(3500);
    await pg.screenshot({path:root+'/screenshots/'+name+'.png'});
    if(name==='phone-monalisa-step5') await pg.screenshot({path:root+'/screenshots/phone-monalisa-step5-full.png',fullPage:true});
    if(name==='desktop-monalisa-all'){ await pg.click('.tabs button[data-t=table]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-monalisa-table.png'});
      await pg.click('.tabs button[data-t=code]'); await pg.click('#simbtn'); await pg.waitForTimeout(4200); await pg.screenshot({path:root+'/screenshots/desktop-monalisa-sim.png'});
      await pg.click('.tabs button[data-t=safety]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-monalisa-safety.png'});
      await pg.click('.tabs button[data-t=pins]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-monalisa-pins.png'}); }
    if(name==='desktop-s3-climate-all'){ await pg.click('.tabs button[data-t=table]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-s3-climate-table.png'});
      await pg.click('.tabs button[data-t=code]'); await pg.click('#simbtn'); await pg.waitForTimeout(4200); await pg.screenshot({path:root+'/screenshots/desktop-s3-climate-sim.png'});
      await pg.click('.tabs button[data-t=safety]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-s3-climate-safety.png'});
      await pg.click('.tabs button[data-t=pins]'); await pg.waitForTimeout(300); await pg.screenshot({path:root+'/screenshots/desktop-s3-climate-pins.png'}); }
    const warn=await pg.evaluate(()=>{const C=WD.compile(WD.projects.find(p=>location.hash.slice(1).startsWith(p.id))); return C.warn;});
    console.log(name,'errors:',JSON.stringify(errs.filter(e=>!/GPU stall|WebGL/.test(e))),'pinwarn:',JSON.stringify(warn));
    await ctx.close();
  }
  await b.close();
})();
