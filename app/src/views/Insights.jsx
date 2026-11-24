import { memo } from "react";

export const InsightsView = memo(function InsightsView() {
  return (
    <div className="stack">
      <section className="bento insights-bento" aria-label="Result insights">
        <div className="glass card wide">
          <div className="lbl">What this connection handles</div>
          <div className="acts" id="acts"></div>
          <p className="src">Thresholds follow Netflix (HD 5 Mbps, 4K 15 Mbps) and Zoom (1080p video 3.8 Mbps down, 3 Mbps up) published requirements; gaming uses ping under 50 ms and jitter under 15 ms.</p>
        </div>
        <div className="card mint place">
          <div className="lbl">Your place in the world</div>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}><span className="bignum" id="pctNum">—</span><span className="note" id="pctNote">Run a test to place your download among 104 national medians.</span></div>
          <div className="ruler" id="ruler"><div className="bar"></div></div>
          <div className="ends"><span id="rulerMin"></span><span id="rulerMax"></span></div>
        </div>
      </section>

      <section className="glass pad" aria-label="Global comparison">
        <h3>How you compare</h3>
        <div className="cmpctl">
          <div className="ctl"><label htmlFor="cmpType">Compare as</label>
            <select id="cmpType" defaultValue="mobile"><option value="mobile">Mobile data</option><option value="fixed">Wi-Fi / broadband</option></select></div>
          <div className="ctl"><label htmlFor="cmpCountry">Country</label><select id="cmpCountry"></select></div>
          <div className="ctl"><label htmlFor="cmpWhich">Result</label><select id="cmpWhich"></select></div>
        </div>
        <p className="verdict" id="verdict">Run a test to see how your connection compares with your country and the world.</p>
        <div className="cmpgrid">
          <div className="bars" id="cmpBars" role="group" aria-label="Your result against medians"></div>
          <div><div className="lbl" style={{ marginBottom: 10 }}>Country medians, download</div><div className="rank" id="cmpRank" role="region" aria-label="Country medians, download" tabIndex={0}></div></div>
        </div>
        <p className="src" id="cmpSrc"></p>
      </section>
    </div>
  );
});

export const HistoryView = memo(function HistoryView() {
  return (
    <div className="stack">
      <section className="glass pad" aria-label="History">
        <div className="srvhead"><h3>Saved tests</h3>
          <div className="row">
            <select id="histFilter" aria-label="Filter by network"><option value="">All networks</option><option>Wi-Fi</option><option>Mobile data</option><option>Ethernet</option><option>Unknown</option></select>
            <button className="ghost" id="exp">Export CSV</button><button className="ghost" id="clr">Clear</button></div></div>
        <p className="note" id="expMsg" role="status" aria-live="polite"></p>
        <div className="lbl"><span className="dot" style={{ color: "var(--down)", background: "var(--down)" }}></span>Download <span className="dot" style={{ color: "var(--up)", background: "var(--up)", marginLeft: 10 }}></span>Upload · last 20 tests</div>
        <canvas id="trend" width="1000" height="340" role="img" aria-label="Speed trend across tests"></canvas>
        <div className="tablewrap"><table>
          <thead><tr><th>When</th><th>Network</th><th>Download</th><th>Upload</th><th>Ping</th><th>Jitter</th><th>Loaded</th><th>Server</th></tr></thead>
          <tbody id="rows"></tbody></table></div>
        <div id="clrConfirm" hidden className="consent"><span>Delete all saved results on this device?</span><button className="ghost" id="clrYes">Delete all</button><button className="ghost" id="clrNo">Keep</button></div>
        <textarea id="csv" hidden readOnly aria-label="CSV export"></textarea>
      </section>
    </div>
  );
});
