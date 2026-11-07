const {chromium,webkit}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await(process.env.TEST_ENGINE==='webkit'?webkit:chromium).launch(process.env.TEST_ENGINE==='webkit'?{headless:true}:{headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
 const page=await browser.newPage();
 // Observed Scovai structure: hidden unnamed file input nested under 'browse';
 // contact fields remain disabled until upload processing completes.
 await page.setContent(`<form onsubmit="window.submitted=true;return false">
 <div><label>Upload your CV <span>*</span></label><div><p>Drop your file here or <label>browse<input accept=".pdf,.docx,application/pdf" style="display:none" type="file"></label></p><p>Accepted: PDF, DOCX (max 10MB)</p></div></div>
 <div><label for="firstName">First Name *</label><input id="firstName" disabled></div>
 <div><label for="lastName">Last Name *</label><input id="lastName" disabled></div>
 <div><label for="email">Email *</label><div><input id="email" type="email" disabled></div></div>
 <div><label for="phone">Phone (optional)</label><div><button type="button" aria-label="Selected country: India (+91)">+91</button><input id="phone" type="tel" disabled></div></div>
 <div><label for="coverLetter">Cover Letter (optional)</label><textarea id="coverLetter"></textarea></div>
 <div><label>How did you find this position? *</label><div><button type="button" aria-pressed="false" onclick="this.setAttribute('aria-pressed','true')">LinkedIn</button><button type="button">Indeed</button><button type="button">Other</button></div></div>
 <label><input type="checkbox">I consent to data processing</label><button type="submit">Submit Application</button></form>`);
 await page.evaluate(()=>{window.uploads=0;document.querySelector('input[type=file]').addEventListener('change',()=>{window.uploads++;setTimeout(()=>{document.querySelectorAll('input[disabled]').forEach(el=>el.disabled=false);document.querySelector('#lastName').value='Existing name';},700);});});
 await page.addScriptTag({content:fs.readFileSync('native/fill.js','utf8')});
 const profile=JSON.parse(fs.readFileSync('tests/fixtures/profile.json'));profile.application_source='LinkedIn';
 const resume={name:'resume.pdf',base64:Buffer.from('%PDF-1.4\n% synthetic test resume\n%%EOF').toString('base64')};
 await page.evaluate(({profile,resume})=>jobfillerStart(profile,resume,'test-token'),{profile,resume});
 await page.waitForFunction(()=>window.__theFillerTask.done);
 assert.equal(await page.locator('#firstName').inputValue(),'Alex');
 assert.equal(await page.locator('#lastName').inputValue(),'Existing name');
 assert.equal(await page.locator('#email').inputValue(),profile.personal.email);
 assert.equal(await page.locator('#phone').inputValue(),'9000000000');
 assert.match(await page.locator('#coverLetter').inputValue(),/23\+/);
 assert.equal(await page.locator('button[aria-pressed=true]').innerText(),'LinkedIn');
 assert.equal(await page.evaluate(()=>window.uploads),1);
 assert.equal(await page.locator('input[type=checkbox]').isChecked(),false);
 assert.equal(await page.evaluate(()=>!!window.submitted),false);
 assert.equal(await page.evaluate(()=>window.__theFillerTask.result.disabled),0);
 console.log('PASS Scovai reproduction: hidden CV upload, delayed unlock, contact fields, country-code phone, cover letter, saved source, no repeated uploads, preserves answers and consent.',await page.evaluate(()=>window.__theFillerTask.result));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
