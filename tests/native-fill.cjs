const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const engine=process.env.TEST_ENGINE === 'webkit' ? webkit : chromium;
 const browser = await engine.launch(process.env.TEST_ENGINE === 'webkit' ? {headless:true} : {headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
 const page = await browser.newPage();
 await page.setContent(`<form onsubmit="window.submitted=true;return false">
 <label>First name *<input id="first"></label><label for="last">Last name *</label><input id="last">
 <label>Address *<input id="address"></label><label>Email *<input id="email" type="email"></label>
 <label>Phone number *<input id="phone" type="tel"></label>
 <label>CV *<input id="cv" type="file"></label><label>Cover Letter<input id="cover" type="file"></label>
 <label>Full name<input id="existing" value="Keep me"></label>
 <input id="confirmation" aria-label="Confirm email"><input id="auto" autocomplete="given-name">
 <input id="search" placeholder="Search by name"><label>Company name<input id="company"></label>
 <label>Agree to terms<input id="terms" type="checkbox"></label><button>Next</button>
 <select aria-label="Country" id="country"><option value="">Choose</option><option value="IN">India</option></select>
 <div id="shadow"></div><iframe id="frame" srcdoc='<label>First name<input></label>'></iframe>
 </form>`);
 await page.evaluate(() => {document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<input aria-label="Last name">'; window.changes=0;document.addEventListener('change',()=>window.changes++);});
 await page.addScriptTag({content:fs.readFileSync('native/fill.js','utf8')});
 const profile=JSON.parse(fs.readFileSync('tests/fixtures/profile.json','utf8'));
 const resume={name:'resume.pdf',base64:Buffer.from('%PDF-1.4\n% synthetic test resume\n%%EOF').toString('base64')};
 const result=JSON.parse(await page.evaluate(({profile,resume})=>jobfiller(profile,resume),{profile,resume}));
 assert.equal(await page.locator('#first').inputValue(),'Alex');
 assert.equal(await page.locator('#last').inputValue(),'E');
 assert.equal(await page.locator('#email').inputValue(),profile.personal.email);
 assert.equal(await page.locator('#confirmation').inputValue(),profile.personal.email);
 assert.equal(await page.locator('#phone').inputValue(),profile.personal.phone);
 assert.equal(await page.locator('#auto').inputValue(),'Alex');
 assert.equal(await page.locator('#address').inputValue(),profile.personal.address || '');
 for(const id of ['search','company']) assert.equal(await page.locator('#'+id).inputValue(),'');
 assert.equal(await page.locator('#existing').inputValue(),'Keep me');
 assert.equal(await page.locator('#country').inputValue(),'IN');
 assert.equal(await page.locator('#terms').isChecked(),false);
 assert.equal(await page.locator('#cv').evaluate(e=>e.files[0].size),Buffer.byteLength('%PDF-1.4\n% synthetic test resume\n%%EOF'));
 assert.equal(await page.locator('#cover').evaluate(e=>e.files.length),0);
 assert.equal(await page.locator('#shadow input').inputValue(),'E');
 assert.equal(await page.frameLocator('#frame').locator('input').inputValue(),'Alex');
 assert.equal(await page.evaluate(()=>!!window.submitted),false);
 assert.ok(await page.evaluate(()=>window.changes>=8));
 const repeat=JSON.parse(await page.evaluate(({profile,resume})=>jobfiller(profile,resume),{profile,resume}));
 assert.equal(repeat.filled,0); assert.equal(repeat.attached,0);
 console.log('PASS: contact fields, CV bytes, confirmation, autocomplete, selects, shadow DOM, iframe, existing values, unknown fields, consent, no submit, repeat click.',result);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
