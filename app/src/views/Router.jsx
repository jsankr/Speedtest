import { memo } from "react";

const BRANDS = "TP-Link|Netgear|ASUS|D-Link|Linksys|Tenda|Mercusys|Xiaomi|Huawei|ZTE|Nokia|Ubiquiti|MikroTik|Zyxel|DrayTek|Totolink|Netis|Cisco|Sagemcom|Technicolor|Arris|Syrotech|Digisol|iBall|Synology|eero|Google".split("|");

export const RouterView = memo(function RouterView() {
  return (
    <div className="stack">
      <section className="glass pad" id="rtPanel" aria-label="Router security check">
        <div className="srvhead"><h3>Check your router</h3><button className="ghost" id="rtClose">Back to speed test</button></div>
        <p className="note">This checks your router's model and firmware against the U.S. National Vulnerability Database (NVD), flags issues being actively exploited, and grades your settings. Web browsers don't let any website log into your router or scan your home network, so you enter the details once; they stay on this device.</p>
        <div className="rtgrid">
          <div className="fields">
            <div className="lbl">Step 1: your router</div>
            <div className="ctl"><label htmlFor="rtBrand">Brand</label><input type="text" id="rtBrand" list="rtBrands" placeholder="e.g. TP-Link" autoComplete="off" /></div>
            <div className="ctl"><label htmlFor="rtModel">Model</label><input type="text" id="rtModel" placeholder="e.g. Archer C6" autoComplete="off" /></div>
            <div className="ctl"><label htmlFor="rtHw">Hardware version (optional)</label><input type="text" id="rtHw" placeholder="e.g. V3" autoComplete="off" /></div>
            <div className="ctl"><label htmlFor="rtFw">Firmware version</label><input type="text" id="rtFw" placeholder="e.g. 1.1.4 Build 20230216" autoComplete="off" /></div>
            <datalist id="rtBrands">{BRANDS.map((b) => <option key={b}>{b}</option>)}</datalist>
            <details className="how"><summary>Where do I find these?</summary><ul>
              <li><b>Label under the router:</b> brand, model and hardware version (often "Ver 3.0" or "V3").</li>
              <li><b>Firmware version:</b> log in to the router's admin page, then look under Status, System or Firmware Upgrade.</li>
              <li><b>Admin page address:</b> usually printed on the label. Common ones: <a href="http://192.168.0.1" target="_blank" rel="noopener">192.168.0.1</a>, <a href="http://192.168.1.1" target="_blank" rel="noopener">192.168.1.1</a>, <a href="http://192.168.29.1" target="_blank" rel="noopener">192.168.29.1</a> (JioFiber), <a href="http://192.168.1.254" target="_blank" rel="noopener">192.168.1.254</a>.</li>
            </ul></details>
          </div>
          <div className="qs">
            <div className="lbl">Step 2: your settings</div>
            <div className="q"><span>Wi-Fi security type</span>
              <select id="rtEnc" aria-label="Wi-Fi security type" defaultValue=""><option value="">Not sure</option><option value="wpa3">WPA3</option><option value="mixed">WPA2/WPA3 mixed</option><option value="wpa2">WPA2 (AES)</option><option value="tkip">WPA2-TKIP or WPA</option><option value="open">WEP or no password</option></select></div>
            <div id="rtQs" className="qs"></div>
          </div>
        </div>
        <div className="row"><button className="go2" id="rtRun">Run security check</button><span className="note" id="rtMsg" role="status" aria-live="polite"></span></div>
        <div id="rtReport" hidden className="pad" style={{ padding: 0 }}>
          <div className="rtsum">
            <svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="12" />
              <circle id="rtArc" cx="66" cy="66" r="54" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" strokeDasharray="0 340" transform="rotate(-90 66 66)" />
              <text id="rtGrade" x="66" y="76" textAnchor="middle" className="letter" fill="var(--ink)" style={{ font: "600 36px var(--mono)" }}>–</text>
              <text id="rtScore" x="66" y="98" textAnchor="middle" fill="var(--muted)" style={{ font: "500 12px var(--mono)" }}></text></svg>
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}><p className="verdict" id="rtVerdict"></p><div className="counts" id="rtCounts"></div></div>
          </div>
          <div className="lbl">Fix these first</div>
          <ol className="fixes" id="rtFixes"></ol>
          <div className="srvhead"><div className="lbl">Known vulnerabilities</div><button className="ghost" id="rtCopy">Copy report</button></div>
          <div className="cves" id="rtCves"></div>
          <p className="src" id="rtSrc"></p>
        </div>
      </section>
    </div>
  );
});
