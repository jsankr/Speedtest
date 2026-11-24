import { memo } from "react";

export const ToolsView = memo(function ToolsView() {
  return (
    <div className="stack">
      <section className="glass pad" id="toolkit" aria-label="Network toolkit">
        <div className="srvhead"><h3>Pick a tool</h3><span className="tag">10 tools, no sign-up</span></div>
        <div className="toolgrid" id="toolGrid"></div>
        <div id="toolBody" hidden>

          <div className="tool" data-tool="ping" hidden>
            <h3>Ping &amp; outage monitor</h3>
            <p className="note">Checks your connection once a second and logs every drop. Leave it running while you game, work or stream to catch dropouts. Keep this page open and in front: phones pause background pages.</p>
            <div className="tctl"><div className="ctl"><label htmlFor="pmTarget">Target</label><select id="pmTarget" defaultValue="cf"><option value="cf">Cloudflare (1.1.1.1)</option><option value="google">Google</option><option value="server">Selected test server</option></select></div>
              <button className="go2" id="pmStart">Start monitoring</button><button className="ghost" id="pmReset">Reset</button></div>
            <div className="stats">
              <div className="stat"><small>Now</small><b id="pmNow">—</b></div><div className="stat"><small>Average</small><b id="pmAvg">—</b></div>
              <div className="stat"><small>Min / max</small><b id="pmMinMax">—</b></div><div className="stat"><small>Jitter</small><b id="pmJit">—</b></div>
              <div className="stat"><small>Packet loss</small><b id="pmLoss">—</b></div><div className="stat"><small>Outages</small><b id="pmOut">0</b></div>
            </div>
            <canvas className="tchart" id="pmChart" width="1000" height="300" role="img" aria-label="Latency over time"></canvas>
            <div id="pmLog" className="note"></div>
            <p className="cant">Times a small web request, so values run a little higher than a command-line ping. A drop is logged after 3 missed checks in a row.</p>
          </div>

          <div className="tool" data-tool="dns" hidden>
            <h3>DNS speed benchmark</h3>
            <p className="note">DNS turns names like google.com into addresses before every page loads. This compares five public DNS services from your connection, then tells you exactly what to enter in your router.</p>
            <div className="tctl"><button className="go2" id="dnsRun">Run DNS benchmark</button><span className="note" id="dnsMsg" role="status"></span></div>
            <div className="tablewrap"><table><thead><tr><th>Service</th><th>Cached</th><th>Fresh lookup</th><th>Router settings</th></tr></thead><tbody id="dnsRows"></tbody></table></div>
            <div id="dnsRec"></div>
            <p className="cant">Contacts each DNS service directly over encrypted DNS (DNS-over-HTTPS). "Cached" is a popular name the service already knows; "fresh" is a random name it must look up from scratch.</p>
          </div>

          <div className="tool" data-tool="ip" hidden>
            <h3>My IP &amp; ISP</h3>
            <p className="note">Shows your public address, provider and whether IPv6 works. Also checks for iCloud Private Relay or a VPN, which change speed-test results.</p>
            <div className="tctl"><button className="go2" id="ipRun">Look up my connection</button><span className="note" id="ipMsg" role="status"></span></div>
            <dl className="kv" id="ipOut"></dl>
            <div id="ipNotes" style={{ display: "grid", gap: 8 }}></div>
            <p className="cant">Asks ipinfo.io and ipify.org, which see your IP address as any website does. Nothing else is sent.</p>
          </div>

          <div className="tool" data-tool="calc" hidden>
            <h3>Download time &amp; data calculator</h3>
            <div className="tctl">
              <div className="ctl"><label htmlFor="clSpeed">Your speed</label><div className="row"><input type="number" id="clSpeed" min="0" step="any" style={{ width: 120 }} /><span className="unit" data-unit=""></span></div></div>
              <div className="ctl"><label htmlFor="clSize">File size</label><div className="row"><input type="number" id="clSize" min="0" step="any" defaultValue="15" style={{ width: 100 }} /><select id="clSizeU" aria-label="File size unit" defaultValue="1e9"><option value="1e6">MB</option><option value="1e9">GB</option></select></div></div>
            </div>
            <div className="chips" id="clPresets"><button data-sz="5e6">Photo · 5 MB</button><button data-sz="8e6">Song · 8 MB</button><button data-sz="4e9">HD movie · 4 GB</button><button data-sz="7e9">Phone update · 7 GB</button><button data-sz="15e9">4K movie · 15 GB</button><button data-sz="80e9">Game · 80 GB</button></div>
            <div className="callout" id="clOut"></div>
            <div className="tctl"><div className="ctl"><label htmlFor="clPlan">Data allowance</label><div className="row"><input type="number" id="clPlan" min="0" step="any" defaultValue="1.5" style={{ width: 100 }} /><span className="unit">GB</span></div></div></div>
            <div className="tablewrap"><table><thead><tr><th>Activity</th><th>Typical bitrate</th><th>Data per hour</th><th>Hours on your allowance</th></tr></thead><tbody id="clRows"></tbody></table></div>
            <p className="cant">Uses decimal units (1 GB = 1,000 MB), like phone plans. Real usage varies by service and quality setting.</p>
          </div>

          <div className="tool" data-tool="pw" hidden>
            <h3>Wi-Fi password generator &amp; strength check</h3>
            <p className="note">Everything here runs on this device. Passwords are never sent anywhere or saved.</p>
            <div className="tctl"><div className="ctl"><label htmlFor="pwLen">Length</label><input type="number" id="pwLen" min="12" max="63" defaultValue="20" style={{ width: 90 }} /></div>
              <label className="consent" style={{ alignItems: "center" }}><input type="checkbox" id="pwSym" defaultChecked /> Include symbols</label>
              <button className="go2" id="pwGen">Generate</button><button className="ghost" id="pwCopy">Copy</button></div>
            <div className="pwout" id="pwOut" aria-live="polite"></div>
            <div className="ctl"><label htmlFor="pwTest">Check a password</label><input type="text" id="pwTest" autoComplete="off" autoCapitalize="off" spellCheck="false" placeholder="Type or paste your current Wi-Fi password" /></div>
            <div className="meter"><i id="pwBar" style={{ width: 0 }}></i></div>
            <div className="note" id="pwVerdict">Type a password to see how long it would take to crack.</div>
            <p className="cant">Crack times assume an attacker captured your Wi-Fi handshake and guesses offline: about 1 million guesses per second for one gaming graphics card, 1 billion for a large cracking rig.</p>
          </div>

          <div className="tool" data-tool="mac" hidden>
            <h3>Device maker lookup</h3>
            <p className="note">Paste MAC addresses from your router's connected-devices list to see who made each device. Unknown makers are worth blocking.</p>
            <textarea className="tin" id="macIn" aria-label="MAC addresses, one per line" placeholder="One per line, e.g. 3C:84:6A:12:34:56" spellCheck="false"></textarea>
            <div className="tctl"><button className="go2" id="macRun">Identify devices</button><span className="note" id="macMsg" role="status"></span></div>
            <div id="macRows" className="macrows"></div>
            <p className="cant" id="macSrc">Looked up on this device from the IEEE maker registry built into CleanSpeed; addresses are never sent anywhere. Registry data: oui-data by silverwind (BSD-2-Clause), from IEEE.</p>
          </div>

          <div className="tool" data-tool="subnet" hidden>
            <h3>Subnet &amp; IP calculator</h3>
            <div className="tctl"><div className="ctl"><label htmlFor="snIn">IP address / prefix or mask</label><input type="text" id="snIn" defaultValue="192.168.1.1/24" spellCheck="false" style={{ minWidth: 230 }} /></div></div>
            <dl className="kv" id="snOut"></dl>
            <div id="snNote"></div>
            <p className="cant">Tip: enter your router's WAN or Internet IP from its Status page. An address from 100.64.0.0 to 100.127.255.255 means your provider uses carrier-grade NAT.</p>
          </div>

        </div>
        <p className="cant">Not possible in any web page, so not included: traceroute, port scanning, Wi-Fi signal and channel scanning, and finding devices on your network. Browsers block these for security; use your router's own app or a desktop tool such as nmap.</p>
      </section>
    </div>
  );
});
