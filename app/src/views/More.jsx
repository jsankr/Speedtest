import { memo } from "react";

export const AskView = memo(function AskView() {
  return (
    <div className="stack">
      <section className="glass pad" id="helpPanel" aria-label="Help assistant">
        <div className="srvhead"><h3>Ask a question</h3><span className="tag">Answers stay on this device</span></div>
        <p className="note">A help assistant with a built-in knowledge base about this app: how tests work, what the numbers mean, fixes for slow results, privacy, the router check and the toolkit. It reads your last saved test to diagnose it, runs entirely in this page and sends nothing anywhere.</p>
        <div className="hlog well" id="hLog" role="log" aria-live="polite" aria-label="Conversation with the help assistant" tabIndex={0}></div>
        <div className="hrow" id="hChips" role="group" aria-label="Suggested questions"></div>
        <form id="hForm" autoComplete="off">
          <label htmlFor="hQ" className="sr">Your question</label>
          <input type="search" id="hQ" placeholder="Ask, for example: why is my upload slow?" maxLength={200} enterKeyHint="send" />
          <button className="go2" type="submit">Ask</button>
          <button className="ghost" type="button" id="hDiag">Diagnose my last test</button>
          <button className="ghost" type="button" id="hClear">Clear</button>
        </form>
      </section>
    </div>
  );
});

// Theme control lives in React (it is app chrome, not engine state).
export function SettingsView({ theme, setTheme }) {
  return (
    <div className="stack">
      <section className="glass pad" aria-label="Settings">
        <h3>Units &amp; test</h3>
        <div className="settings">
          <div className="ctl"><span className="cap">Bytes per second</span>
            <div className="seg" id="unitB"><button data-u="KB">KB/s</button><button data-u="MB">MB/s</button><button data-u="GB">GB/s</button></div></div>
          <div className="ctl"><span className="cap">Bits per second</span>
            <div className="seg" id="unitb"><button data-u="Kb">Kbps</button><button data-u="Mb">Mbps</button><button data-u="Gb">Gbps</button></div></div>
          <div className="ctl"><span className="cap">Prefix base</span>
            <div className="seg" id="baseSeg"><button data-b="1000">Decimal (10³)</button><button data-b="1024">Binary (2¹⁰)</button></div></div>
          <div className="ctl"><label htmlFor="streams">Parallel streams</label><input type="number" id="streams" min="1" max="16" defaultValue="6" /></div>
          <div className="ctl"><label htmlFor="dur">Seconds per phase</label><input type="number" id="dur" min="4" max="30" defaultValue="10" /></div>
        </div>
        <p className="note">1 byte = 8 bits, so 1 MB/s = 8 Mbps and 1 GB/s = 8 Gbps. Internet plans are sold in bits (Mbps/Gbps); file downloads show bytes (MB/s). Each test moves roughly your speed × twice the phase length, so lower the seconds per phase on mobile data.</p>
      </section>
      <section className="glass pad" aria-label="Appearance">
        <h3>Appearance</h3>
        <div className="ctl"><span className="cap" id="themeCap">Theme</span>
          <div className="seg" role="group" aria-labelledby="themeCap">
            {[["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)}>{l}</button>
            ))}
          </div></div>
      </section>
    </div>
  );
}

export const ServerSheet = memo(function ServerSheet() {
  return (
    <section className="glass pad sheet" id="srvPanel" hidden aria-label="Choose server" role="dialog" aria-modal="true" aria-labelledby="srvTitle">
      <div className="srvhead"><h2 id="srvTitle">Test server</h2>
        <div className="row"><button className="ghost" id="srvPing">Measure ping to all</button><button className="ghost" id="srvClose">Done</button></div></div>
      <p className="note">The closest server gives the truest result. Pick a distant one to see how far your connection reaches. Automatic picks the lowest-ping server each time.</p>
      <div className="srvlist" id="srvList" role="radiogroup" aria-label="Servers"></div>
      <div className="consent" id="mlabConsent" hidden>
        <input type="checkbox" id="mlabOk" /><label htmlFor="mlabOk">I understand M-Lab publishes every test as open data, <strong>including my IP address</strong>, date and time (<a href="https://www.measurementlab.net/privacy/" target="_blank" rel="noopener">M-Lab privacy policy</a>).</label>
      </div>
    </section>
  );
});
