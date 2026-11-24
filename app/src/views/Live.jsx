import { memo } from "react";

export const LiveView = memo(function LiveView() {
  return (
    <div className="stack">
      <section className="glass pad" id="livePanel" aria-label="Live network map">
        <div className="srvhead"><h3>Route &amp; telemetry</h3>
          <div className="row"><button className="ghost" id="lvLocate">Use precise location</button>
            <label className="consent" style={{ alignItems: "center" }}><input type="checkbox" id="lvAnim" defaultChecked /> Animate</label>
            <label className="consent" style={{ alignItems: "center" }} title="While the map is on screen, ping the last test server every 2 seconds"><input type="checkbox" id="lvLive" /> Live ping</label></div></div>
        <div className="mapwrap"><canvas id="map" width="1200" height="560" role="img" aria-label="Map of the route between you and the test server"></canvas>
          <div className="lvbadge" id="lvBadge"><i></i><span id="lvState">Idle</span></div></div>
        <p className="note" id="lvKey" aria-live="off"></p>
        <div className="stats">
          <div className="stat"><small>Download now</small><b id="lvDown">—</b></div>
          <div className="stat"><small>Upload now</small><b id="lvUp">—</b></div>
          <div className="stat"><small>Ping now</small><b id="lvPing">—</b></div>
          <div className="stat"><small>Data down</small><b id="lvBD">0 MB</b></div>
          <div className="stat"><small>Data up</small><b id="lvBU">0 MB</b></div>
          <div className="stat"><small>Elapsed</small><b id="lvTime">0 s</b></div>
        </div>
        <div className="legend"><span><i style={{ background: "var(--down)" }}></i>Download</span><span><i style={{ background: "var(--up)" }}></i>Upload</span><span><i style={{ background: "var(--ok)" }}></i>Ping (right axis)</span></div>
        <canvas id="tele" width="1000" height="360" role="img" aria-label="Live timeline of download, upload and ping"></canvas>
        <p className="note" id="lvRoute">Run a test to trace the route to the server.</p>
        <p className="cant" id="lvWhere">Stylised map. Your position comes from your time zone (or, during a Cloudflare test, Cloudflare's rough estimate from your IP) unless you allow precise location or run My IP &amp; ISP; it stays on this device. Server cities are known for LibreSpeed and M-Lab; for Cloudflare the app asks Cloudflare which data centre answered. Each moving dot is real data counted as it arrives or leaves; dots travel slower than real so the eye can follow them.</p>
      </section>
    </div>
  );
});

export const ColliderView = memo(function ColliderView() {
  return (
    <div className="stack">
      <section className="glass pad" id="colPanel" aria-label="Packet collider">
        <div className="srvhead"><h3>Detector view</h3><label className="consent"><input type="checkbox" id="colAnim" defaultChecked /> Animate</label></div>
        <div className="mapwrap colwrap"><canvas id="collider" role="img" aria-label="Packet collider"></canvas></div>
        <p className="note" id="colKey"></p>
        <div className="legend"><span><i style={{ background: "var(--down)" }}></i>Download packet</span><span><i style={{ background: "var(--up)" }}></i>Upload packet</span><span><i style={{ background: "var(--good)" }}></i>Ping probe</span></div>
        <p className="note">The same test as a particle collider, modelled on CERN's CMS detector on the LHC ring: tracker, crystal and brass calorimeters, the solenoid magnet and the red iron yoke with muon chambers. Your device is the collision point; the ring of blue magnets is the route to the server. A collision or bunch is launched only when that much data has really moved; the paths are a picture, not a map. After each test the detector opens up like CMS does for maintenance, one part per result.</p>
      </section>
    </div>
  );
});
