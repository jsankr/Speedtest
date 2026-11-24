import { memo } from "react";
import { Icon } from "../icons.jsx";

// Home screen. Bento grid: the instrument (gauge + GO) and the result tiles around it.
// Element ids are the engine's contract; React renders them once and the engine fills them.
export const TestView = memo(function TestView() {
  return (
    <div className="bento test-bento">
      <section className="glass card instrument" id="instrument" aria-label="Speed test">
        <div className="steps" aria-label="Test progress">
          <span className="step" id="stPing"><i></i>Ping</span>
          <span className="step" id="stDown"><i></i>Download</span>
          <span className="step" id="stUp"><i></i>Upload</span>
        </div>
        <div className="gaugewrap">
          <canvas id="gauge" width="860" height="688" role="img" aria-label="Speed gauge"></canvas>
          <button className="orb" id="go" aria-label="Start speed test">Go</button>
        </div>
        <button className="stopbtn" id="stopTest" hidden>Stop test</button>
        <div className="phase" id="phase" role="status" aria-live="polite">Tap Go to start a test</div>
        <div className="netpick" id="netPick">
          <span>Network:</span>
          <div className="seg" id="netSeg" role="group" aria-label="Network type">
            <button data-n="Wi-Fi">Wi-Fi</button><button data-n="Mobile data">Mobile</button><button data-n="Ethernet">Ethernet</button>
          </div>
          <span className="auto" id="netAuto"></span>
        </div>
        <div className="serverchip"><span>Server: <b id="srvName">Automatic</b></span><button className="ghost" id="srvOpen">Change server</button></div>
        <div className="err" id="err" role="alert"></div>
        <div className="herofoot">
          <div className="conn" id="conn">Network: detecting…</div>
          <div className="row"><button className="ghost" id="copyRes" disabled>Copy result</button><span className="note" id="copied"></span></div>
        </div>
      </section>

      <div className="tile d card ink">
        <span className="blob" aria-hidden="true"></span>
        <div className="lbl"><span className="dot" style={{ color: "var(--down)", background: "var(--down)" }}></span>Download</div>
        <div><span className="val" id="dl">—</span><span className="unit" data-unit=""></span></div>
      </div>
      <div className="tile u card coral">
        <div className="lbl"><span className="dot"></span>Upload</div>
        <div><span className="val" id="ul">—</span><span className="unit" data-unit=""></span></div>
      </div>

      <div className="card sky latency" aria-label="Latency">
        <div className="lbl">Latency</div>
        <div className="small">
          <div className="tile"><div className="lbl">Ping</div><div><span className="val" id="ping">—</span><span className="unit">ms</span></div></div>
          <div className="tile"><div className="lbl">Jitter</div><div><span className="val" id="jit">—</span><span className="unit">ms</span></div></div>
          <div className="tile"><div className="lbl">Loaded</div><div><span className="val" id="lping">—</span><span className="unit">ms</span></div></div>
        </div>
      </div>

      <div className="glass card sparkcard">
        <div className="lbl"><span className="dot" style={{ color: "var(--down)", background: "var(--down)" }}></span>Download
          <span className="dot" style={{ color: "var(--up)", background: "var(--up)", marginLeft: 10 }}></span>Upload · live throughput</div>
        <div className="sparkbox"><canvas className="spark" id="spark" width="900" height="152" role="img" aria-label="Throughput over time"></canvas></div>
      </div>

      <div className="card lilac grade">
        <div className="lbl">Responsiveness under load</div>
        <svg viewBox="0 0 132 132" aria-hidden="true">
          <circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="12" />
          <circle id="gradeArc" cx="66" cy="66" r="54" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" strokeDasharray="0 340" transform="rotate(-90 66 66)" />
          <text id="gradeLetter" x="66" y="80" textAnchor="middle" className="letter" fill="var(--ink)">–</text>
        </svg>
        <div className="note" id="gradeNote">Shows how much your ping rises while the line is busy (bufferbloat).</div>
      </div>

      <div className="glass card rtcard">
        <div className="lbl">Router security</div>
        <p className="rtcard-t">Is your router safe?</p>
        <p className="note">Checks your model and firmware against the U.S. vulnerability database and grades your settings.</p>
        <button className="ghost shieldbtn" id="rtOpen" aria-controls="rtPanel"><Icon name="router" size={16} />Router security check</button>
      </div>
    </div>
  );
});
