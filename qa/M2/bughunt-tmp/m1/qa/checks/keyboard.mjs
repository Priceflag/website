// keyboard: Tab through each page (Chromium, 1440 and 375), up to 200 presses.
// Records the focus order, whether each focused element shows a visible focus
// indicator, and whether every visible interactive element was reached.
// FAIL on unreached elements or invisible focus.
import { gotoSettled, pageUrl, worst, mdTable, mapLimit, truncate } from '../lib/util.mjs';

export const title = 'Keyboard: tab order, reachability, visible focus (1440 + 375)';
const WIDTHS = [1440, 375];
const MAX_TABS = 200;

/** In-page: tag every visible interactive element and snapshot its unfocused styles. */
function prepare() {
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"], audio[controls], video[controls]';
  const PROPS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderTopWidth', 'borderBottomWidth', 'backgroundColor', 'backgroundImage', 'color', 'textDecorationLine', 'textDecorationColor', 'textDecorationThickness', 'transform', 'opacity', 'filter'];
  const PSEUDO = ['content', 'opacity', 'transform', 'backgroundColor', 'boxShadow', 'borderTopColor', 'borderBottomColor', 'outlineStyle', 'width', 'height'];
  const snap = (el) => {
    const s = getComputedStyle(el);
    const o = {};
    for (const p of PROPS) o[p] = s[p];
    for (const ps of ['::before', '::after']) {
      const q = getComputedStyle(el, ps);
      for (const p of PSEUDO) o[ps + p] = q[p];
    }
    return o;
  };
  window.__qaKbSnap = snap;
  const visible = (el) => {
    if (el.closest('[inert]')) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    text: (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
    href: el.getAttribute('href'),
    id: el.id || null,
  });
  window.__qaKbDescribe = describe;
  const list = [];
  let i = 0;
  for (const el of document.querySelectorAll(SEL)) {
    if (el.disabled) continue;
    if (el.hasAttribute('tabindex') && Number(el.getAttribute('tabindex')) < 0) continue;
    if (el.tagName === 'SUMMARY' && el.parentElement?.tagName !== 'DETAILS') continue;
    if (!visible(el)) continue;
    // A focusable element nested in another focusable one (e.g. <a><button>) — browsers focus both; keep both.
    const id = String(i++);
    el.setAttribute('data-qa-kb', id);
    list.push({ qa: id, ...describe(el) });
  }
  window.__qaKbBase = {};
  for (const el of document.querySelectorAll('[data-qa-kb]')) window.__qaKbBase[el.getAttribute('data-qa-kb')] = snap(el);
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  return list;
}

/** In-page: describe the current focus and judge whether its indicator is visible. */
function probe() {
  let ae = document.activeElement;
  while (ae && ae.shadowRoot && ae.shadowRoot.activeElement) ae = ae.shadowRoot.activeElement;
  if (!ae || ae === document.body || ae === document.documentElement) return { body: true };
  const qa = ae.getAttribute('data-qa-kb');
  const now = window.__qaKbSnap(ae);
  const base = qa != null ? window.__qaKbBase[qa] : null;
  const transparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const outline = now.outlineStyle !== 'none' && parseFloat(now.outlineWidth) > 0 && !transparent(now.outlineColor);
  // Outline props are judged by the outline rule above (a colour change under outline-style:none is invisible).
  const changed = base ? Object.keys(now).filter((k) => !k.startsWith('outline') && now[k] !== base[k]) : [];
  const r = ae.getBoundingClientRect();
  return {
    qa, ...window.__qaKbDescribe(ae),
    indicator: outline ? 'outline' : changed.length ? 'style-change' : base ? 'none' : 'unknown',
    changed: changed.slice(0, 6),
    onScreen: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
  };
}

async function walk(browser, ctx, pg, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  try {
    await gotoSettled(page, pageUrl(ctx, pg));
    const candidates = await page.evaluate(prepare);
    const sequence = [];
    const seen = new Set();
    let cycled = false;
    let trappedAt = null;
    await page.evaluate(() => document.activeElement?.blur?.());
    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(40);
      const f = await page.evaluate(probe);
      if (f.body) { if (sequence.length) { cycled = true; break; } continue; }
      const key = f.qa ?? `${f.tag}|${f.text}|${f.href}`;
      if (seen.has(key)) {
        if (sequence.length && (sequence.at(-1).qa ?? `${sequence.at(-1).tag}|${sequence.at(-1).text}|${sequence.at(-1).href}`) === key) trappedAt = f;
        else cycled = true;
        break;
      }
      seen.add(key);
      sequence.push(f);
    }
    const reached = new Set(sequence.map((s) => s.qa).filter((x) => x != null));
    const unreached = candidates.filter((c) => !reached.has(c.qa));
    const invisible = sequence.filter((s) => s.indicator === 'none');
    const unknown = sequence.filter((s) => s.indicator === 'unknown');
    const status = unreached.length || invisible.length || trappedAt ? 'FAIL' : unknown.length || !cycled ? 'WARN' : 'PASS';
    return { width, status, candidates: candidates.length, focused: sequence.length, cycled, trappedAt, unreached, invisibleFocus: invisible, unknownIndicator: unknown, sequence };
  } catch (e) {
    return { width, status: 'ERROR', error: String(e.message || e) };
  } finally {
    await context.close();
  }
}

export default async function run(ctx) {
  const browser = await ctx.getBrowser('chromium');
  const jobs = ctx.pages.flatMap((pg) => WIDTHS.map((w) => ({ pg, w })));
  const res = await mapLimit(jobs, 3, ({ pg, w }) => walk(browser, ctx, pg, w));
  const pages = {};
  const rows = [];
  let detail = '';
  jobs.forEach(({ pg, w }, i) => {
    const r = res[i];
    const p = (pages[pg.name] ||= { status: 'SKIP', widths: {} });
    p.widths[w] = r;
    p.status = worst(p.status, r.status);
    rows.push([pg.name, w, r.status, r.candidates ?? '-', r.focused ?? '-', r.unreached?.length ?? '-', r.invisibleFocus?.length ?? '-', r.unknownIndicator?.length ?? '-', r.trappedAt ? `focus trapped at ${r.trappedAt.tag} "${truncate(r.trappedAt.text, 30)}"` : r.cycled === false ? `no wrap within ${MAX_TABS} tabs` : r.error || '']);
    const fmt = (e) => `${e.tag}${e.href ? `[${truncate(e.href, 40)}]` : ''} "${truncate(e.text, 40)}"`;
    if (r.unreached?.length) detail += `\n- ${pg.name}@${w} unreached: ${r.unreached.slice(0, 15).map(fmt).join('; ')}${r.unreached.length > 15 ? ` … +${r.unreached.length - 15}` : ''}`;
    if (r.invisibleFocus?.length) detail += `\n- ${pg.name}@${w} no visible focus: ${r.invisibleFocus.slice(0, 15).map(fmt).join('; ')}${r.invisibleFocus.length > 15 ? ` … +${r.invisibleFocus.length - 15}` : ''}`;
  });
  const md = `# keyboard\n\nTab up to ${MAX_TABS}×. "candidates" = visible interactive elements (a[href], button, input, select, textarea, summary, [tabindex>=0], …). ` +
    `Visible focus = non-transparent outline, or any change vs the unfocused computed style (box-shadow, border, background, color, text-decoration, transform, ::before/::after). FAIL on unreached or invisible focus.\n\n` +
    mdTable(['page', 'width', 'status', 'candidates', 'focused', 'unreached', 'invisible focus', 'unknown', 'note'], rows) + '\n' + detail + '\n';
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: pages, md };
}
