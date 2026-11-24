#!/usr/bin/env python3
"""Regenerate the README screenshots (docs/screenshots/*.png) from the built app.

Uses the same hermetic set-up as tests/run.py: the app and a local speed-test server on 127.0.0.1, every other
request answered by the fictional fixtures there (ExampleNet router, documentation IP ranges, random MACs).
Chromium only, because download/upload are paced with Chromium's network emulation (about 35 MB/s down, 12 MB/s up).

  python tests/screens.py [--chrome /path/to/chromium]
"""
import argparse, os, socket, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run  # noqa: E402

OUT = os.path.join(run.ROOT, "docs", "screenshots")


def phone(browser, port, scheme="dark", w=390, h=844):
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, color_scheme=scheme, accept_downloads=True)
    page = ctx.new_page(); page.errors = []
    run.install_mocks(page, port)
    page.goto(f"http://127.0.0.1:{port}/")
    page.evaluate("localStorage.clear(); localStorage.setItem('netPick', JSON.stringify('Wi-Fi')); localStorage.setItem('livePing','false')")
    page.reload(); page.wait_for_timeout(500)
    return ctx, page


def pace(page):
    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 9, "downloadThroughput": 35e6, "uploadThroughput": 12e6})


def shot(page, name, el=None, top=True):
    if el:
        page.evaluate(f"document.querySelector({el!r}).scrollIntoView({{block:'start'}}); scrollBy(0,-12)")
    elif top:
        page.evaluate("scrollTo(0,0)")
    page.wait_for_timeout(350)
    page.screenshot(path=os.path.join(OUT, name + ".png"))
    print("  ", name)


def seed_history(page):
    # a few older fictional results so the history and trend have something to show
    page.evaluate("""()=>{ const h=JSON.parse(localStorage.getItem('history')||'[]'); if(!h[0]) return; const base=h[0], out=[base];
      [[31.8e6,10.9e6,11.2,3.4,31.5,'Wi-Fi'],[12.4e6,3.1e6,38.0,9.5,96.0,'Mobile data'],[36.9e6,12.6e6,8.7,2.2,24.9,'Wi-Fi'],[94.1e6,39.7e6,4.1,0.6,9.8,'Ethernet'],[28.2e6,9.8e6,14.5,4.8,44.0,'Wi-Fi']]
        .forEach(([d,u,p,j,l,n],i)=>out.push(Object.assign({},base,{down:d,up:u,ping:p,jitter:j,lping:l,net:n,t:base.t-(i+1)*86400000*1.7})));
      localStorage.setItem('history',JSON.stringify(out)) }""")


def capture(browser, port):
    os.makedirs(OUT, exist_ok=True)

    # desktop overview, both themes
    for scheme, name in (("light", "00-desktop"), ("dark", "00-desktop-dark")):
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, color_scheme=scheme)
        page = ctx.new_page(); run.install_mocks(page, port); page.goto(f"http://127.0.0.1:{port}/")
        page.evaluate("localStorage.clear(); localStorage.setItem('netPick', JSON.stringify('Wi-Fi')); localStorage.setItem('livePing','false')")
        page.reload(); page.wait_for_timeout(400); pace(page); run.use_own_server(page, port, secs=5)
        page.click("#go"); page.wait_for_function("!" + run.RUNNING, timeout=90000); page.wait_for_timeout(600)
        page.evaluate("scrollTo(0,0)"); page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(OUT, name + ".png")); print("  ", name)
        ctx.close()

    ctx, page = phone(browser, port)
    pace(page)
    run.use_own_server(page, port, secs=6)
    shot(page, "01-home")
    page.click("#go"); page.wait_for_timeout(5200)
    shot(page, "02-test-running")
    page.wait_for_function("!" + run.RUNNING, timeout=90000); page.wait_for_timeout(700)
    shot(page, "03-results")
    seed_history(page)

    # a second run watched from the live map and the collider
    run.goto(page, "test"); page.click("#go"); run.goto(page, "live")
    page.wait_for_function("document.getElementById('phase').textContent.includes('download')", timeout=20000); page.wait_for_timeout(2500)
    shot(page, "04-live-map-download")
    page.wait_for_function("document.getElementById('phase').textContent.includes('upload')", timeout=30000); page.wait_for_timeout(2500)
    shot(page, "05-live-map-upload")
    page.wait_for_function("!" + run.RUNNING, timeout=90000)
    run.goto(page, "test"); page.click("#go"); run.goto(page, "collider")
    page.wait_for_function("document.getElementById('phase').textContent.includes('download')", timeout=20000); page.wait_for_timeout(2500)
    shot(page, "25-collider-download")
    page.wait_for_function("!" + run.RUNNING, timeout=90000); page.wait_for_timeout(4000)
    shot(page, "26-collider-teardown")

    run.goto(page, "insights"); shot(page, "06-insights")
    page.select_option("#cmpType", "fixed"); page.dispatch_event("#cmpType", "change")
    shot(page, "07-global-comparison", "section[aria-label='Global comparison']")
    run.goto(page, "history"); page.reload(); page.wait_for_timeout(500); run.goto(page, "history"); shot(page, "09-history")
    run.goto(page, "settings"); shot(page, "22-settings")
    run.goto(page, "test"); page.click("#srvOpen"); page.wait_for_timeout(300); shot(page, "08-server-picker", top=False); page.click("#srvClose")

    run.goto(page, "ask")
    page.fill("#hQ", "why is my upload slow?"); page.press("#hQ", "Enter"); page.click("#hDiag"); page.wait_for_timeout(300)
    shot(page, "27-help-assistant", "#helpPanel")

    # router check with the fictional ExampleNet XR-1000
    run.goto(page, "test"); page.click("#rtOpen")
    page.fill("#rtBrand", "ExampleNet"); page.fill("#rtModel", "XR-1000"); page.fill("#rtHw", "V2"); page.fill("#rtFw", "2.1.0_1043")
    page.select_option("#rtEnc", "wpa2")
    for q, v in [("pw", "yes"), ("remote", "yes"), ("wps", "no"), ("fw", "yes"), ("eol", "yes"), ("upnp", "no"), ("pf", "yes"), ("guest", "no"), ("devices", "unsure"), ("ssid", "yes")]:
        page.click(f"#rtQs .seg[data-q='{q}'] button[data-v='{v}']")
    shot(page, "10-router-form")
    page.click("#rtRun"); page.wait_for_function("!document.getElementById('rtReport').hidden", timeout=15000)
    shot(page, "11-router-score", "#rtReport")
    shot(page, "12-router-fixes", "#rtFixes")
    shot(page, "13-router-vulnerabilities", "#rtCves")

    run.goto(page, "tools"); shot(page, "14-toolkit")
    def tool(t): page.click(f".tile2[data-tool='{t}']"); page.wait_for_timeout(200)
    tool("ping"); page.click("#pmStart"); page.wait_for_timeout(6000); page.click("#pmStart"); shot(page, "15-ping-monitor", ".tool[data-tool='ping']")
    tool("dns"); page.click("#dnsRun"); page.wait_for_function("document.getElementById('dnsMsg').textContent==='Done.'", timeout=60000)
    shot(page, "16-dns-benchmark", ".tool[data-tool='dns']")
    tool("ip"); page.click("#ipRun"); page.wait_for_timeout(900); shot(page, "17-my-ip", ".tool[data-tool='ip']")
    tool("calc"); page.click("#clPresets button >> nth=4"); shot(page, "18-data-calculator", ".tool[data-tool='calc']")
    tool("pw"); page.click("#pwGen"); page.fill("#pwTest", "sunshine2024"); shot(page, "19-wifi-password", ".tool[data-tool='pw']")
    tool("mac"); page.fill("#macIn", "\n".join(run.MACS)); page.click("#macRun")
    page.wait_for_function("document.getElementById('macMsg').textContent.startsWith('Done')", timeout=15000)
    shot(page, "20-device-lookup", ".tool[data-tool='mac']")
    tool("subnet"); page.fill("#snIn", "100.72.10.5/10"); shot(page, "21-subnet-calculator", ".tool[data-tool='subnet']")
    if page.errors: print("  script errors:", page.errors)
    ctx.close()

    ctx, page = phone(browser, port, scheme="light")
    pace(page); run.use_own_server(page, port, secs=5)
    page.click("#go"); page.wait_for_function("!" + run.RUNNING, timeout=90000); page.wait_for_timeout(700)
    shot(page, "23-home-light")
    run.goto(page, "insights"); shot(page, "24-insights-light")
    ctx.close()


def main():
    from playwright.sync_api import sync_playwright
    ap = argparse.ArgumentParser(); ap.add_argument("--chrome"); a = ap.parse_args()
    port = run.free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(run.ROOT, "server", "server.py"), "--host", "127.0.0.1", "--port", str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try: socket.create_connection(("127.0.0.1", port), 0.2).close(); break
            except OSError: time.sleep(0.1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=a.chrome) if a.chrome else p.chromium.launch()
            capture(b, port); b.close()
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
