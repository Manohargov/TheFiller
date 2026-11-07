const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); let toggle;
 await page.route('http://localhost:45678/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/')){
   if(path==='/api/toggle') toggle=route.request().postDataJSON();
   const data=path==='/api/status'?{running:false,logs:[]}:path==='/api/profile'?{personal:{first_name:'Alex'}}:{ok:true};
   return route.fulfill({json:data});
  }
  const file='app/webui/'+(path==='/'?'index.html':path.slice(1));
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
 });
 await page.goto('http://localhost:45678/');
 await page.locator('[name=mode][value=connect]').check();
 await page.locator('#toggleBtn').click();
 assert.equal(toggle.mode,'connect'); assert.equal(toggle.cdp_url,'http://127.0.0.1:9222');
 assert.deepEqual(errors,[]);
 assert.equal(await page.title(),'The Filler');
 console.log('PASS Windows dashboard loads without script errors and sends connect mode.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
