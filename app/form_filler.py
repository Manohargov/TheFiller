"""Inspect and fill supported form fields using Playwright."""

import asyncio


async def inspect_form(page):
    fields = await page.evaluate(
        """() => {
        const fields = [];
        const seen = new Set();
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach((el) => {
            const id = el.id || el.name || '';
            if (!id || seen.has(id)) return;
            seen.add(id);
            let label = '';
            if (el.id) {
                const labelEl = document.querySelector('label[for="' + el.id + '"]');
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label) label = el.placeholder || el.name || '';
            fields.push({
                label: label,
                selector: el.id ? '#' + CSS.escape(el.id)
                               : (el.name ? '[name="' + el.name + '"]' : ''),
                type: el.type || el.tagName.toLowerCase(),
                required: !!el.required,
            });
        });
        return fields;
    }"""
    )
    return fields


async def fill_form(page, mapping):
    for entry in mapping:
        value = entry.get("value")
        if not value:
            continue
        try:
            await _fill_single(page, entry, str(value))
        except Exception:
            pass
        await asyncio.sleep(0.2)


async def _fill_single(page, entry, value):
    selector = entry["selector"]
    field_type = (entry.get("type") or "text").lower()
    await page.wait_for_selector(selector, state="visible", timeout=5000)
    if field_type in ("select-one", "select"):
        await page.select_option(selector, label=value, timeout=5000)
    elif field_type == "checkbox":
        if value.lower() in ("yes", "true", "1", "y"):
            await page.check(selector, timeout=5000)
        else:
            await page.uncheck(selector, timeout=5000)
    else:
        await page.fill(selector, value, timeout=5000)
