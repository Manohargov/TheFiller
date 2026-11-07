/* Runs only after a circle click, in the selected browser tab. No network calls. */
function jobfiller(profile, resume) {
  const result = {filled: 0, attached: 0, preserved: 0, unmatched: 0, failed: 0, blockedFrames: 0, drafted: 0, needsAnswer: 0, disabled: 0};
  const norm = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rules = [
    ['personal.first_name', /\b(first name|firstname|given name)\b/],
    ['personal.last_name', /\b(last name|lastname|surname|family name)\b/],
    ['personal.email', /\b(e mail|email|email address)\b/],
    ['personal.phone', /\b(phone|telephone|mobile|contact number)\b/],
    ['personal.linkedin', /\blinked\s*in\b/], ['personal.github', /\bgithub\b/],
    ['personal.portfolio', /\b(portfolio|personal website|website)\b/],
    ['personal.city', /^(city|town|current city)$/],
    ['personal.country', /^(country|country of residence)$/],
    ['personal.address_line2', /^(address line 2|address 2|apartment|suite|unit)$/],
    ['personal.state', /^(state|province|region|state province)$/],
    ['personal.postal_code', /^(postal code|postcode|zip|zip code|zip postal code|pin code|pincode)$/],
    ['personal.country_code', /^country code$/],
    ['personal.address', /^(address|street address|address line 1|address 1|mailing address|street|street address line 1)$/],
    ['personal.location', /^(location|current location)$/],
    ['professional.current_title', /^(current title|current job title|job title)$/],
    ['professional.current_company', /^(current company|current employer|employer)$/],
    ['professional.years_experience', /^(years of experience|total experience|years experience)$/],
    ['professional.skills', /^(skills|technical skills)$/],
    ['professional.summary', /^(professional summary|summary|about you)$/],
    ['personal.full_name', /^(full name|your name|name|applicant name)$/]
  ];
  const autocomplete = {'given-name':'personal.first_name','family-name':'personal.last_name',name:'personal.full_name',email:'personal.email',tel:'personal.phone','address-level2':'personal.city','country-name':'personal.country','street-address':'personal.address','address-line1':'personal.address','address-line2':'personal.address_line2','address-level1':'personal.state','postal-code':'personal.postal_code',country:'personal.country_code','organization-title':'professional.current_title',organization:'professional.current_company'};
  const get = key => key && key.split('.').reduce((o,k) => o && o[k], profile);
  const textOf = el => el?.textContent?.trim() || '';
  const labelledBy = el => (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => textOf(el.ownerDocument.getElementById(id))).join(' ').trim();
  function question(el) {
    const direct = labelledBy(el) || el.getAttribute('aria-label') || Array.from(el.labels || []).map(textOf).join(' ');
    if (direct && !/^(yes|no)$/i.test(direct.trim())) return direct;
    for (let parent = el.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
      if (['FORM','BODY','HTML'].includes(parent.tagName)) break;
      // Never borrow a question from a neighboring response field.
      const fields = [...parent.querySelectorAll('input:not([type=hidden]),textarea,select,[role=radio],button')];
      if (fields.some(f => f !== el && !['radio','button'].includes(f.type) && f.getAttribute('role') !== 'radio')) break;
      const groupLabel = labelledBy(parent) || parent.getAttribute('aria-label');
      if (groupLabel) return groupLabel;
      const heading = parent.querySelector('legend,[data-question],h2,h3,h4,p,label');
      if (heading && !heading.contains(el) && !/^(yes|no)$/i.test(textOf(heading))) return textOf(heading);
      const clone = parent.cloneNode(true);
      clone.querySelectorAll('input,textarea,select,button,[role=radio],script,style').forEach(n => n.remove());
      const text = textOf(clone);
      if (text && !/^(yes|no)$/i.test(text) && text.length < 1200) return text;
    }
    return direct || el.placeholder || el.name || el.id || '';
  }
  const isSourceQuestion = prompt => /^(?:(?:how|where) did you (?:find|hear about|learn about) (?:us|this(?: position| job| role| opportunity)?|the (?:position|job|role|opportunity))|where did you hear of us)/.test(norm(prompt));
  function answer(prompt, allowDraft = false) {
    const q = norm(prompt);
    const saved = (profile.saved_answers || []).slice().reverse().find(a => norm(a.question) === q);
    if (saved && String(saved.answer ?? '').trim()) return {value:String(saved.answer), draft:false};
    // Legal eligibility and preferences always require an explicit answer to this question.
    if (/\b(salary|compensation|pay|visa|sponsorship|right to work|authorized|authorised|eligible|relocat|notice period)\b/.test(q)) return {needsAnswer:true};
    if (isSourceQuestion(prompt) && profile.application_source) return {value:profile.application_source};
    if (!allowDraft) return {};
    const summary = String(profile.professional?.summary || '').trim();
    if (!summary) return {};
    if (/\b(cover letter|motivation|motivates|excited|why.*(?:apply|applying|role|company|work|join)|interest.*(?:role|position|company))\b/.test(q)) {
      const company = prompt.match(/\b(?:role|position|work|working|join)\s+(?:at|with|for)\s+([A-Z][\w& .-]{1,60}?)(?=[?!.]|$)/)?.[1]?.trim();
      const target = company ? `this opportunity at ${company}` : 'this opportunity';
      return {value:`I am interested in ${target} because it would allow me to apply my experience to practical business challenges. My background includes ${summary.charAt(0).toLowerCase() + summary.slice(1)} I would welcome the opportunity to discuss how that experience aligns with the team's priorities and the responsibilities of this role.`, draft:true};
    }
    if (/\b(tell us about yourself|tell me about yourself|professional background|summari[sz]e.*experience|what.*bring.*role|why.*good fit)\b/.test(q)) return {value:summary,draft:true};
    return {};
  }
  const selected = el => el.checked || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('data-state') === 'checked' || /(?:^|\s)(?:selected|active|checked|bg-primary-500|bg-primary-600)(?:\s|$)/.test(el.className || '');
  function fillChoices(root) {
    const done = new Set();
    for (const el of root.querySelectorAll('input[type=radio],[role=radio],button')) {
      if (done.has(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      let group;
      if (el.type === 'radio' && el.name) group = [...root.querySelectorAll('input[type=radio]')].filter(e => e.name === el.name && e.form === el.form);
      else {
        const parent = el.closest('[role=radiogroup],fieldset') || el.parentElement;
        group = [...parent.querySelectorAll('[role=radio],button')];
      }
      const optionText = e => norm(Array.from(e.labels || []).map(textOf).join(' ') || e.getAttribute('aria-label') || textOf(e) || e.value);
      const isYesNo = group.length === 2 && group.some(e => optionText(e) === 'yes') && group.some(e => optionText(e) === 'no');
      const isSource = isSourceQuestion(question(el));
      if (!isYesNo && !isSource) continue;
      group.forEach(e => done.add(e));
      if (group.some(selected)) {result.preserved++; continue;}
      const prompt = question(el);
      const resolved = answer(prompt);
      if (!resolved.value) {result.needsAnswer++; continue;}
      const target = group.find(e => optionText(e) === norm(resolved.value));
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') continue;
      // A button without type=button can submit the form. Never click it.
      if (target.tagName === 'BUTTON' && target.type !== 'button') {result.unmatched++; continue;}
      const visible = target.getClientRects().length || Array.from(target.labels || []).some(l => l.getClientRects().length);
      if (!visible) continue;
      try {
        target.click();
        if (selected(target)) result.filled++; else result.failed++;
      } catch (_) {result.failed++;}
    }
  }
  const visited = new Set();
  function scan(root) {
    if (visited.has(root)) return;
    visited.add(root);
    fillChoices(root);
    for (const el of root.querySelectorAll('input,textarea,select')) {
      const win = el.ownerDocument.defaultView;
      const type = (el.type || '').toLowerCase();
      if (el.disabled && !['hidden','checkbox','radio','submit','button'].includes(type)) result.disabled++;
      if (el.disabled || el.readOnly || ['hidden','password','checkbox','radio','submit','button','reset','image'].includes(type)) continue;
      const visible = el.getClientRects().length && win.getComputedStyle(el).visibility !== 'hidden';
      if (!visible && type !== 'file') continue;
      const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => el.ownerDocument.getElementById(id)?.textContent || '').join(' ');
      const labels = Array.from(el.labels || []).map(l => l.textContent).join(' ');
      // Use nearby text only for upload controls, which are commonly hidden inside buttons.
      const prompt = question(el);
      const sources = [prompt, labels, labelled, el.getAttribute('aria-label'), el.placeholder, el.name, el.id].map(norm).filter(Boolean);
      try {
        if (type === 'file') {
          let context = norm(sources.join(' '));
          // Upload labels may be several wrappers above a hidden 'browse' input.
          for (let parent = el.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth++) {
            if (['FORM','BODY','HTML'].includes(parent.tagName) || parent.querySelectorAll('input[type=file]').length !== 1) break;
            if (parent.querySelector('input:not([type=file]):not([type=hidden]),textarea,select')) break;
            const nearby = norm(parent.textContent);
            if (nearby.length < 800) context += ' ' + nearby;
            if (/\b(cv|resume|curriculum vitae)\b/.test(context)) break;
          }
          if (!/\b(cv|resume|curriculum vitae)\b/.test(context) || /\b(cover|photo|picture|avatar)\b/.test(context)) continue;
          if (el.files.length) {result.preserved++; continue;}
          if (!resume) {result.unmatched++; continue;}
          const bytes = Uint8Array.from(atob(resume.base64), c => c.charCodeAt(0));
          const dt = new win.DataTransfer();
          dt.items.add(new win.File([bytes], resume.name, {type:'application/pdf'}));
          el.files = dt.files;
          el.dispatchEvent(new win.Event('input', {bubbles:true}));
          el.dispatchEvent(new win.Event('change', {bubbles:true}));
          if (el.files.length) result.attached++; else result.failed++;
          continue;
        }
        if (String(el.value || '').trim()) {result.preserved++; continue;}
        if (sources.some(s => /\b(search|password|gender|disability|race|ethnicity|nationality|birth)\b/.test(s))) continue;
        const resolved = answer(prompt, el.tagName === 'TEXTAREA' || type === 'text');
        let key;
        for (const source of sources) {
          const rule = rules.find(([,re]) => re.test(source));
          if (rule) {key = rule[0]; break;}
        }
        key ||= autocomplete[(el.autocomplete || '').split(' ').pop()];
        let value = resolved.value ?? get(key);
        if (resolved.needsAnswer && !resolved.value) {result.needsAnswer++; continue;}
        if (Array.isArray(value)) value = value.join(', ');
        if (value === undefined || value === null || value === '') {result.unmatched++; continue;}
        value = String(value);
        if (key === 'personal.phone') {
          const country = el.parentElement?.querySelector('button[aria-label^="Selected country:"]');
          const dial = country?.getAttribute('aria-label')?.match(/\(\+(\d+)\)/)?.[1];
          if (dial && value.replace(/[\s()-]/g, '').startsWith('+' + dial)) value = value.replace(/[^\d+]/g, '').slice(dial.length + 1);
        }
        if (el.maxLength > 0 && value.length > el.maxLength) {result.unmatched++; continue;}
        if (type === 'number' && !/^\d+(\.\d+)?$/.test(value)) {result.unmatched++; continue;}
        if (el.tagName === 'SELECT') {
          const option = Array.from(el.options).find(o => !o.disabled && (norm(o.text) === norm(value) || norm(o.value) === norm(value)));
          if (!option) {result.unmatched++; continue;}
          value = option.value;
        }
        const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new win.Event('input', {bubbles:true}));
        el.dispatchEvent(new win.Event('change', {bubbles:true}));
        el.dispatchEvent(new win.FocusEvent('blur', {bubbles:true}));
        if (el.value === value) {result.filled++; if (resolved.draft) result.drafted++;} else result.failed++;
      } catch (_) {result.failed++;}
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) scan(el.shadowRoot);
      if (el.tagName === 'IFRAME') {
        try {if (el.contentDocument) scan(el.contentDocument); else result.blockedFrames++;}
        catch (_) {result.blockedFrames++;}
      }
    }
  }
  scan(document);
  return JSON.stringify(result);
}
if (typeof module !== 'undefined') module.exports = jobfiller;

// Safari AppleScript does not await page promises. Keep the asynchronous pass on
// this document, and let the native app poll counters on the captured tab.
function jobfillerStart(profile, resume, token) {
  if (window.__theFillerTask) window.__theFillerTask.cancelled = true;
  const task = {token, done:false, cancelled:false, result:JSON.parse(jobfiller(profile,resume))};
  window.__theFillerTask = task;
  let attempts = 0, stable = 0;
  function retry() {
    if (task.cancelled || window.__theFillerTask !== task) return;
    try {
      const next = JSON.parse(jobfiller(profile,null));
      for (const key of ['filled','drafted','failed']) task.result[key] += next[key];
      for (const key of ['disabled','unmatched','needsAnswer','blockedFrames']) task.result[key] = next[key];
      task.result.preserved = Math.max(task.result.preserved,next.preserved);
      stable = next.disabled === 0 ? stable + 1 : 0;
      attempts++;
      if (stable >= 3 || attempts >= 50) { task.done = true; return; }
      setTimeout(retry,300);
    } catch (_) {task.result.failed++; task.done=true;}
  }
  if (task.result.attached > 0) setTimeout(retry,300); else task.done=true;
  return JSON.stringify(task);
}
