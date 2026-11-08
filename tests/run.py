#!/usr/bin/env python3
"""CleanSpeed test suite: end-to-end behaviour + WCAG 2.2 AA checks, in Chromium, Firefox or WebKit.

Hermetic: the app and the speed-test server both run from server/server.py on 127.0.0.1, and every
other network request is either answered by a fictional fixture below or blocked. No real person's
router, MAC or IP address appears anywhere in this file.

  pip install playwright && python -m playwright install chromium firefox webkit
  python tests/run.py                      # all browsers that are installed
  python tests/run.py --browser firefox    # one engine
  AXE_PATH=node_modules/axe-core/axe.min.js python tests/run.py   # adds the axe-core WCAG scan
"""
import argparse, json, os, re, socket, subprocess, sys, time, traceback
from contextlib import closing

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = []

# ------------------------------------------------------------------ fixtures (all fictional)
NVD = {"totalResults": 3, "vulnerabilities": []}
def _cve(i, desc, match, score, sev, kev=False):
    c = {"id": f"CVE-2099-01{i:02d}", "published": "2099-01-15T00:00:00",
         "descriptions": [{"lang": "en", "value": "FICTIONAL TEST RECORD: " + desc}],
         "metrics": {"cvssMetricV31": [{"cvssData": {"baseScore": score, "baseSeverity": sev, "attackVector": "NETWORK"}}]},
         "weaknesses": [{"description": [{"lang": "en", "value": "CWE-787"}]}],
         "references": [{"url": f"https://www.examplenet.example/security/cve-2099-01{i:02d}", "tags": ["Vendor Advisory"]},
                        {"url": "https://thirdparty-blog.example/beta-firmware-fix", "tags": ["Exploit"]}],
         "configurations": [{"nodes": [{"operator": "OR", "cpeMatch": [dict(vulnerable=True, criteria="cpe:2.3:o:examplenet:xr-1000_firmware:*:*:*:*:*:*:*:*", **match)]}]}]}
    if kev: c["cisaExploitAdd"] = "2099-02-01"
    return {"cve": c}
NVD["vulnerabilities"] = [
    _cve(1, "command injection in ExampleNet XR-1000 before 2.1.0_1100.", {"versionEndExcluding": "2.1.0_1100"}, 8.8, "HIGH", kev=True),
    _cve(2, "auth bypass in ExampleNet XR-1000 before 2.0.5_900.", {"versionEndExcluding": "2.0.5_900"}, 7.5, "HIGH"),
    _cve(3, "issue on the 9.x line of ExampleNet XR-1000 before 9.1.0_200.", {"versionEndExcluding": "9.1.0_200"}, 6.5, "MEDIUM"),
]
IPINFO = {"ip": "203.0.113.42", "city": "Exampleville", "region": "Test Region", "country": "GB", "loc": "51.50,-0.12",
          "org": "AS64500 Example Broadband Ltd", "timezone": "Europe/London"}
MACS = ["88:12:AC:53:D9:8C", "6C:2F:A0:73:25:73", "36:41:92:FF:30:55", "zz:12"]   # random sample + private + invalid

def install_mocks(page, port):
    local = (f"http://127.0.0.1:{port}", f"http://localhost:{port}")
    def handler(route):
        u = route.request.url
        cors = {"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"}
        if u.startswith(local):
            return route.continue_()
        if "services.nvd.nist.gov" in u:
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(NVD))
        if "ipinfo.io" in u:
            return route.fulfill(status=200, headers=cors, content_type="application/json", body=json.dumps(IPINFO))
        if "api6.ipify.org" in u:
            return route.fulfill(status=200, headers=cors, content_type="application/json", body='{"ip":"2001:db8::42"}')
        if "ipify.org" in u:
            return route.fulfill(status=200, headers=cors, content_type="application/json", body='{"ip":"203.0.113.42"}')
        if any(h in u for h in ("cloudflare-dns.com", "dns.google", "dns.quad9.net", "dns.adguard-dns.com", "doh.opendns.com")):
            return route.fulfill(status=200, headers=cors, body=b"\x00")
        if "/cdn-cgi/trace" in u:
            return route.fulfill(status=200, headers=cors, body="colo=LHR\nloc=GB\n")
        if "speed.cloudflare.com/meta" in u:
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body=json.dumps({"colo": {"iata": "LHR", "lat": 51.47, "lon": -0.45, "city": "London"}}))
        return route.abort()   # everything else (LibreSpeed list, real speed servers, fonts, …) stays offline
    page.route("**/*", handler)

# ------------------------------------------------------------------ harness
def free_port():
    with closing(socket.socket()) as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]

def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    print(("  PASS " if cond else "  FAIL ") + name + (f" — {detail}" if detail and not cond else ""))
    return cond

def new_page(browser, port, *, width=390, height=844, scheme="dark", mobile=False, reduced=False):
    kw = dict(viewport={"width": width, "height": height}, color_scheme=scheme, accept_downloads=True,
              reduced_motion="reduce" if reduced else "no-preference")
    if mobile and browser.browser_type.name != "firefox":
        kw.update(is_mobile=True, has_touch=True)
    ctx = browser.new_context(**kw)
    page = ctx.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    install_mocks(page, port)
    page.goto(f"http://127.0.0.1:{port}/")
    page.evaluate("localStorage.clear(); localStorage.setItem('netPick', JSON.stringify('Wi-Fi')); localStorage.setItem('livePing','false')")
    page.reload(); page.wait_for_timeout(500)
    return ctx, page

def use_own_server(page, port, secs=4):
    page.click("#srvOpen")
    page.fill("#custom", f"http://127.0.0.1:{port}")
    page.click("#customUse"); page.click("#srvClose")
    page.fill("#dur", str(secs)); page.fill("#streams", "2")
    page.dispatch_event("#dur", "change"); page.dispatch_event("#streams", "change")

# ------------------------------------------------------------------ end-to-end
def e2e(browser, port):
    print("\n[e2e]")
    ctx, page = new_page(browser, port, width=1280, height=900)
    check("loads without script errors", not page.errors, "; ".join(page.errors))
    check("title is CleanSpeed", page.title() == "CleanSpeed", page.title())

    use_own_server(page, port)
    check("own server selected", "Custom" in page.inner_text("#srvName"), page.inner_text("#srvName"))
    page.click("#go")
    page.wait_for_function("document.getElementById('stopTest') && !document.getElementById('stopTest').hidden", timeout=5000)
    check("Stop button shows while testing", page.is_visible("#stopTest"))
    page.wait_for_function("!running", timeout=60000)
    dl, ul = page.inner_text("#dl"), page.inner_text("#ul")
    num = lambda t: float(re.sub(r"[^\d.]", "", t) or 0)
    check("download measured", num(dl) > 0, dl)
    check("upload measured", num(ul) > 0, ul)
    check("RETEST offered after a test", "RETEST" in page.inner_text("#go").upper(), page.inner_text("#go"))
    check("result saved to history", page.locator("#rows tr").count() >= 1)
    check("Copy result enabled", page.is_enabled("#copyRes"))

    page.click("#unitb button[data-u='M']") if page.locator("#unitb button[data-u='M']").count() else page.click("#unitb button >> nth=1")
    check("unit switch updates labels", "bps" in page.inner_text(".tile.d .unit").lower(), page.inner_text(".tile.d .unit"))

    page.click("#go"); page.wait_for_timeout(1200); t0 = time.time(); page.click("#stopTest")
    page.wait_for_function("!running", timeout=5000)
    check("Stop ends a running test within 3 s", time.time() - t0 < 3, f"{time.time()-t0:.1f}s")

    with page.expect_download(timeout=5000) as dl_info:
        page.click("#exp")
    path = dl_info.value.path(); head = open(path, encoding="utf-8-sig").readline().strip()
    check("CSV export downloads with header", head.startswith("timestamp,network,download_Bps"), head)
    check("no script errors after test, stop and export", not page.errors, "; ".join(page.errors))
    ctx.close()

    # router check (fictional ExampleNet XR-1000)
    ctx, page = new_page(browser, port, width=1280, height=900)
    page.click("#rtOpen")
    page.fill("#rtBrand", "ExampleNet"); page.fill("#rtModel", "XR-1000"); page.fill("#rtHw", "V2"); page.fill("#rtFw", "2.1.0_1043")
    page.select_option("#rtEnc", "wpa2")
    for q, v in [("pw", "yes"), ("remote", "yes"), ("wps", "no"), ("fw", "yes"), ("eol", "yes"), ("upnp", "no"), ("pf", "yes"), ("guest", "no"), ("devices", "unsure"), ("ssid", "yes")]:
        page.click(f"#rtQs .seg[data-q='{q}'] button[data-v='{v}']")
    page.click("#rtRun")
    page.wait_for_function("!document.getElementById('rtReport').hidden", timeout=15000)
    text = page.inner_text("#rtReport")
    check("router report shows a score", re.search(r"\d+\s*/\s*100", text), text[:120])
    check("exploited record flagged", page.locator("#rtCves .sev.kev").count() >= 1)
    hosts = page.eval_on_selector_all("#rtReport .fixlinks a[href]", "as=>as.map(a=>new URL(a.href).hostname)")
    check("fix links only on the maker's domain", hosts and all("examplenet" in h for h in hosts), ", ".join(sorted(set(hosts))))
    allhosts = page.eval_on_selector_all("#rtReport a[href]", "as=>as.map(a=>new URL(a.href).hostname)")
    check("third-party exploit write-ups never linked", not any("thirdparty" in h for h in allhosts), ", ".join(sorted(set(allhosts))))
    check("no beta firmware suggested", "beta" not in page.inner_text("#rtFixes").lower())
    status = page.inner_text("#rtCves")
    check("record on another firmware line not marked as affecting", "9.x line" not in status or "affects your version" not in status.split("9.x line")[1][:200].lower())
    ctx.close()

    # toolkit
    ctx, page = new_page(browser, port, width=390, height=844)
    def tool(t): page.click(f".tile2[data-tool='{t}']")
    tool("subnet"); page.fill("#snIn", "100.72.10.5/10"); page.wait_for_timeout(150)
    check("subnet calculator spots carrier-grade NAT", "carrier-grade" in page.inner_text("#snOut").lower())
    tool("calc"); page.fill("#clSpeed", "35"); page.click("#clPresets button >> nth=0"); page.wait_for_timeout(150)
    check("data calculator answers", "takes about" in page.inner_text("#clOut"), page.inner_text("#clOut")[:80])
    tool("pw"); page.click("#pwGen"); pw = page.inner_text("#pwOut").strip()
    check("password generator makes a 16+ character password", len(pw) >= 16, pw)
    tool("mac"); page.fill("#macIn", "\n".join(MACS)); page.click("#macRun")
    page.wait_for_function("document.getElementById('macMsg').textContent.startsWith('Done')", timeout=15000)
    rows = page.inner_text("#macRows")
    check("device lookup names makers from the bundled registry", "Espressif" in rows and "HUNAN FN-LINK" in rows.upper(), rows[:160])
    check("device lookup flags private and invalid addresses", "Private" in rows and "Not a valid" in rows)
    tool("ip"); page.click("#ipRun"); page.wait_for_timeout(800)
    check("IP lookup shows provider", "Example Broadband" in page.inner_text("#ipOut"))
    tool("dns"); page.click("#dnsRun")
    page.wait_for_function("document.getElementById('dnsMsg').textContent==='Done.'", timeout=60000)
    check("DNS benchmark ranks 5 services", page.locator("#dnsRows tr").count() == 5)
    check("toolkit runs without script errors", not page.errors, "; ".join(page.errors))
    ctx.close()

    # layout at every common width, both themes
    for w, h in [(320, 640), (390, 844), (768, 1024), (1024, 768), (1440, 900)]:
        for scheme in ("dark", "light"):
            ctx, page = new_page(browser, port, width=w, height=h, scheme=scheme)
            over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
            check(f"no sideways scroll at {w}px ({scheme})", over <= 0, f"{over}px")
            ctx.close()

# ------------------------------------------------------------------ WCAG 2.2 AA
CONTRAST_JS = r"""() => {
  const parse=c=>{const m=c.match(/[\d.]+/g)||[0,0,0,0];return {r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}};
  const over=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const bgOf=el=>{const stack=[];for(let e=el;e;e=e.parentElement){const c=parse(getComputedStyle(e).backgroundColor);if(c.a>0)stack.push(c);if(c.a>=1)break}
    let base=parse(getComputedStyle(document.body).backgroundColor); if(base.a<1) base={r:255,g:255,b:255,a:1};
    for(let i=stack.length-1;i>=0;i--) base=over(stack[i],base); return base};
  const out=[];
  for(const el of document.querySelectorAll('body *')){
    if(!el.offsetParent&&getComputedStyle(el).position!=='fixed') continue;
    const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()); if(!own) continue;
    const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity===0) continue;
    if(el.closest('button:disabled,[aria-disabled="true"],[hidden]')) continue;
    // gradient objects (GO sphere, primary buttons, selected segments, badges): test against every solid stop of the gradient
    let bgs=[bgOf(el)];
    for(let e=el;e&&e!==document.body;e=e.parentElement){ const bi=getComputedStyle(e).backgroundImage;
      if(bi&&bi.includes('gradient')){ const stops=(bi.match(/rgba?\([^)]+\)/g)||[]).map(parse).filter(c=>c.a>=0.6&&!(c.r>235&&c.g>235&&c.b>235)); /* white specular highlights sit off the text */ if(stops.length){ bgs=stops; } break } }
    const fg=parse(cs.color), size=parseFloat(cs.fontSize), bold=+cs.fontWeight>=700;
    const r=Math.min(...bgs.map(bg=>ratio(over(fg,bg),bg)));
    const need=(size>=24||(size>=18.66&&bold))?3:4.5;
    if(r<need-0.05) out.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:''} "${el.textContent.trim().slice(0,30)}" ${r.toFixed(2)}<${need}`);
  }
  return out;
}"""

NAME_JS = r"""() => {
  const name=el=>{ if(el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const lb=el.getAttribute('aria-labelledby'); if(lb) return lb.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');
    if(el.id){const l=document.querySelector(`label[for="${el.id}"]`); if(l) return l.textContent}
    const wrap=el.closest('label'); if(wrap) return wrap.textContent;
    if(el.title) return el.title; if(['BUTTON','A','SUMMARY'].includes(el.tagName)) return el.textContent; return '' };
  return [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=radio],[role=checkbox]')]
    .filter(el=>el.offsetParent||el.closest('details'))
    .filter(el=>!name(el).trim()).map(el=>el.outerHTML.slice(0,80));
}"""

def wcag(browser, port):
    print("\n[wcag 2.2 AA]")
    for scheme in ("dark", "light"):
        ctx, page = new_page(browser, port, width=1280, height=900, scheme=scheme)
        # open everything that can be opened so hidden panels are checked too
        page.click("#rtOpen"); page.click("#srvOpen")
        page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        bad = page.evaluate(CONTRAST_JS)
        check(f"1.4.3 text contrast ≥ 4.5:1 / 3:1 ({scheme})", not bad, "; ".join(bad[:8]))
        if scheme == "dark":
            check("3.1.1 page language set", page.get_attribute("html", "lang") == "en")
            check("2.4.2 page has a title", bool(page.title()))
            check("1.3.1 one h1", page.locator("h1").count() == 1)
            check("1.3.1 / 2.4.1 main landmark", page.locator("main").count() == 1)
            check("2.4.1 skip link to main content", page.locator("a.skip[href='#main']").count() == 1)
            levels = page.eval_on_selector_all("h1,h2,h3,h4", "hs=>hs.filter(h=>h.offsetParent).map(h=>+h.tagName[1])")
            skips = [f"h{a}→h{b}" for a, b in zip(levels, levels[1:]) if b > a + 1]
            check("1.3.1 headings don't skip levels", not skips, ", ".join(skips))
            unnamed = page.evaluate(NAME_JS)
            check("4.1.2 every control has an accessible name", not unnamed, "; ".join(unnamed[:5]))
            badroles = page.evaluate("""()=>[...document.querySelectorAll('[role=radio]')].filter(e=>!e.hasAttribute('aria-checked')).length
              + [...document.querySelectorAll('[aria-pressed]')].filter(e=>e.tagName!=='BUTTON'||e.getAttribute('role')).length""")
            check("4.1.2 ARIA states match roles", badroles == 0, f"{badroles} elements")
            gfx = page.evaluate("""()=>[...document.querySelectorAll('canvas,svg,img')].filter(e=>{
                if(e.closest('[aria-hidden=true]')||e.getAttribute('aria-hidden')==='true') return false;
                if(e.tagName==='IMG') return !e.hasAttribute('alt');
                return !(e.getAttribute('role')==='img'&&(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby'))) }).map(e=>e.outerHTML.slice(0,60))""")
            check("1.1.1 graphics are labelled or hidden", not gfx, "; ".join(gfx[:4]))
            live = page.evaluate("""()=>{const p=document.getElementById('phase'),e=document.getElementById('err');
                return (p.getAttribute('aria-live')||p.getAttribute('role'))&&e.getAttribute('role')==='alert'}""")
            check("4.1.3 test progress and errors are announced", bool(live))
            small = page.evaluate("""()=>[...document.querySelectorAll('button,a[href],input,select,summary')].filter(e=>e.offsetParent&&!e.closest('p,li,td,.note')).filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<24}).filter(e=>!['checkbox','radio'].includes(e.type)).map(e=>(e.id||e.textContent.trim().slice(0,20))+':'+Math.round(e.getBoundingClientRect().height))""")
            check("2.5.8 targets at least 24×24 px", not small, ", ".join(small[:6]))
        ctx.close()

    # keyboard: everything reachable, focus always visible, no trap
    ctx, page = new_page(browser, port, width=1280, height=900)
    page.keyboard.press("Tab")
    first = page.evaluate("document.activeElement.className")
    check("2.4.1 first Tab lands on the skip link", "skip" in (first or ""), first)
    seen, invisible = [], []
    for _ in range(80):
        info = page.evaluate("""()=>{const e=document.activeElement; if(!e||e===document.body) return null; const cs=getComputedStyle(e);
            const ring=(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none';
            return {id:e.id||e.textContent.trim().slice(0,24)||e.tagName, ring}}""")
        if info:
            seen.append(info["id"])
            if not info["ring"]: invisible.append(info["id"])
        page.keyboard.press("Tab")
    check("2.1.1 keyboard reaches the main controls", all(any(k in s for s in seen) for k in ("go", "rtOpen", "srvOpen")), ", ".join(seen[:12]))
    check("2.4.7 focus is visible on every stop", not invisible, ", ".join(invisible[:8]))
    check("2.1.2 no keyboard trap", len(set(seen)) > 15, f"{len(set(seen))} distinct stops")
    ctx.close()

    # touch targets on phones, reflow, text spacing, reduced motion
    ctx, page = new_page(browser, port, width=390, height=844, mobile=True)
    if browser.browser_type.name != "firefox":
        small = page.evaluate("""()=>[...document.querySelectorAll('button,a[href],input,select,summary')].filter(e=>e.offsetParent&&!e.closest('p,li,td,.note')).filter(e=>!['checkbox','radio'].includes(e.type)).filter(e=>e.getBoundingClientRect().height<44).map(e=>(e.id||e.textContent.trim().slice(0,16))+':'+Math.round(e.getBoundingClientRect().height))""")
        check("touch targets ≥ 44 px on phones", not small, ", ".join(small[:6]))
    page.add_style_tag(content="*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}")
    page.wait_for_timeout(200)
    over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    clipped = page.evaluate("""()=>[...document.querySelectorAll('button,.lbl,.tile2 b,h2')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow==='hidden').length""")
    check("1.4.12 text spacing doesn't break the layout", over <= 0 and clipped == 0, f"overflow {over}px, clipped {clipped}")
    ctx.close()
    ctx, page = new_page(browser, port, width=320, height=640)
    page.evaluate("document.documentElement.style.fontSize='200%'")
    over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("1.4.10 reflow at 320 px", over <= 0, f"{over}px")
    ctx.close()
    ctx, page = new_page(browser, port, width=1280, height=900, reduced=True)
    anim = page.evaluate("[document.getElementById('lvAnim').checked, getComputedStyle(document.getElementById('instrument')).animationDuration]")
    check("2.3.3 reduced motion: map animation off, entrance cut", (not anim[0]) and anim[1] in ("1e-05s", "0.00001s", "0s"), str(anim))
    ctx.close()

    # axe-core, when available (the CI workflow installs it)
    axe = os.environ.get("AXE_PATH")
    if axe and os.path.exists(axe):
        for scheme in ("dark", "light"):
            ctx, page = new_page(browser, port, width=1280, height=900, scheme=scheme)
            page.click("#rtOpen")
            page.add_script_tag(path=axe)
            res = page.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
                return r.violations.map(v=>`${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | ')}`)}""")
            check(f"axe-core WCAG 2.2 AA scan ({scheme})", not res, " ; ".join(res[:6]))
            ctx.close()
    else:
        print("  SKIP axe-core scan (set AXE_PATH to node_modules/axe-core/axe.min.js)")

# ------------------------------------------------------------------ main
def main():
    from playwright.sync_api import sync_playwright
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", action="append", choices=["chromium", "firefox", "webkit"])
    ap.add_argument("--chrome", help="path to a Chrome/Chromium binary (optional)")
    ap.add_argument("--only", choices=["e2e", "wcag"])
    a = ap.parse_args()
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "server", "server.py"), "--host", "127.0.0.1", "--port", str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try: socket.create_connection(("127.0.0.1", port), 0.2).close(); break
            except OSError: time.sleep(0.1)
        with sync_playwright() as p:
            for name in a.browser or ["chromium", "firefox", "webkit"]:
                bt = getattr(p, name)
                try:
                    browser = bt.launch(executable_path=a.chrome) if (name == "chromium" and a.chrome) else bt.launch()
                except Exception as e:
                    print(f"\n== {name}: not installed, skipped ({str(e).splitlines()[0]})"); continue
                print(f"\n== {name} {browser.version}")
                for suite in (e2e, wcag):
                    if a.only and suite.__name__ != a.only: continue
                    try: suite(browser, port)
                    except Exception as e:
                        lines = [l.strip() for l in str(e).strip().splitlines() if l.strip()]
                        check(f"{suite.__name__} suite ran to the end ({name})", False, " | ".join(lines[:2] + lines[-4:])[:700])
                browser.close()
    finally:
        srv.terminate()
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS)-len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed or not RESULTS else 0)

if __name__ == "__main__":
    main()
