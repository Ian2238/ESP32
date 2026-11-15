// 自己組的點擊測試：node tools/ui-test.js
const {chromium}=require('/workspace/pw/node_modules/playwright-core');
const path=require('path'); const root=path.resolve(__dirname,'..');
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const ctx=await b.newContext({viewport:{width:1280,height:860}}); const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  pg.on('dialog',d=>d.accept());
  await pg.goto('file://'+root+'/index.html'); await pg.waitForFunction('window.__ready===true');
  const t=async s=>console.log(s, await pg.evaluate(()=>({hash:location.hash,title:document.querySelector('#ptitle').textContent,tab:document.querySelector('.tabs button.on').dataset.t,wires:WD.debug().C.wires.length,steps:WD.debug().C.steps.length})));
  await t('首頁');
  const dis=await pg.$eval('.padd',e=>e.disabled); console.log('沒選板子時零件按鈕 disabled =',dis);
  await pg.click('.bopt[data-b=s3_44]'); await t('選板子');
  for(const ty of ['dht11','oled_spi','soil_mh','led220','dht11']) await pg.click(`.padd[data-t=${ty}]`);
  await t('加 5 個');
  await pg.click('.prm[data-k="4"]'); await t('移除第 5 個');
  await pg.reload(); await pg.waitForFunction('window.__ready===true'); await pg.waitForTimeout(300); await t('重新整理後（localStorage）');
  await pg.click('.tabs button[data-t=table]'); await pg.click('tr[data-w]:nth-child(6)'); await t('點接線表一列');
  await pg.click('.pj:nth-of-type(2)'); await pg.waitForTimeout(500); await t('切到範例 1');
  await pg.click('.pj.bld'); await pg.waitForTimeout(500); await t('切回自己組');
  await pg.click('.tabs button[data-t=build]'); await pg.click('#b-clear'); await t('清空');
  console.log('errors:',JSON.stringify(errs)); await b.close();
})();
