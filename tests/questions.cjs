const {chromium,webkit}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await(process.env.TEST_ENGINE==='webkit'?webkit:chromium).launch(process.env.TEST_ENGINE==='webkit'?{headless:true}:{headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
 const page=await browser.newPage();
 await page.setContent(`<form onsubmit="window.submitted=true;return false">
 <fieldset><legend>Do you have the right to work in The Netherlands without visa sponsorship? We are not offering sponsorship for this role *</legend><label>Yes<input type="radio" name="nl" value="yes"></label><label>No<input type="radio" name="nl" value="no"></label></fieldset>
 <div><p>What makes you excited about this role at SnappCar? What's your motivation to apply? *</p><textarea id="motivation"></textarea></div>
 <div><p>What is your salary indication? *</p><input id="salary"></div>
 <fieldset><legend>Are you willing to travel?</legend><button type="button" aria-pressed="false" onclick="this.setAttribute('aria-pressed','true')">Yes</button><button type="button" aria-pressed="false" onclick="this.setAttribute('aria-pressed','true')">No</button></fieldset>
 <fieldset><legend>May we submit now?</legend><button>Yes</button><button>No</button></fieldset>
 <fieldset><legend>Do you have the right to work in Canada?</legend><label>Yes<input type="radio" name="ca"></label><label>No<input type="radio" name="ca"></label></fieldset>
 <fieldset><legend>Keep my choice?</legend><label>Yes<input type="radio" name="keep"></label><label>No<input type="radio" name="keep" checked></label></fieldset>
 <div role="radiogroup" aria-label="Can you attend an interview?"><span role="radio" aria-checked="false" onclick="this.setAttribute('aria-checked','true')">Yes</span><span role="radio" aria-checked="false" onclick="this.setAttribute('aria-checked','true')">No</span></div>
 <div><p>Describe an achievement with an exact metric we have not supplied</p><textarea id="unknown"></textarea></div>
 </form>`);
 await page.addScriptTag({content:fs.readFileSync('native/fill.js','utf8')});
 const profile=JSON.parse(fs.readFileSync('tests/fixtures/profile.json'));
 profile.saved_answers=[
 {question:'Do you have the right to work in The Netherlands without visa sponsorship? We are not offering sponsorship for this role',answer:'No'},
 {question:'What is your salary indication?',answer:'EUR 90,000 gross per year'},
 {question:'Are you willing to travel?',answer:'Yes'},
 {question:'May we submit now?',answer:'Yes'},
 {question:'Keep my choice?',answer:'Yes'},
 {question:'Can you attend an interview?',answer:'Yes'}];
 const result=JSON.parse(await page.evaluate(p=>jobfiller(p),profile));
 assert.equal(await page.locator('[name=nl][value=no]').isChecked(),true);
 assert.equal(await page.locator('#salary').inputValue(),'EUR 90,000 gross per year');
 assert.match(await page.locator('#motivation').inputValue(),/SnappCar/);
 assert.match(await page.locator('#motivation').inputValue(),/23\+/);
 assert.equal(await page.locator('button[aria-pressed=true]').count(),1);
 assert.equal(await page.locator('[name=ca]:checked').count(),0);
 assert.equal(await page.locator('[name=keep]').nth(1).isChecked(),true);
 assert.equal(await page.locator('[role=radio][aria-checked=true]').count(),1);
 assert.equal(await page.locator('#unknown').inputValue(),'');
 assert.equal(await page.evaluate(()=>!!window.submitted),false);
 assert.equal(result.drafted,1);
 const repeat=JSON.parse(await page.evaluate(p=>jobfiller(p),profile)); assert.equal(repeat.filled,0);assert.equal(repeat.drafted,0);
 console.log('PASS questionnaire: exact saved authorization, salary, button/radio choices, motivation draft, unknown country, preserved answers, no submit.',result);
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
