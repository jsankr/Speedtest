import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { boot, ARTIFACT, FULL_APP } from "./engine/engine.js";
import { TestView } from "./views/Test.jsx";
import { LiveView, ColliderView } from "./views/Live.jsx";
import { InsightsView, HistoryView } from "./views/Insights.jsx";
import { RouterView } from "./views/Router.jsx";
import { ToolsView } from "./views/Tools.jsx";
import { AskView, SettingsView, ServerSheet } from "./views/More.jsx";

export const VIEWS = [
  { id: "test", label: "Speed test", short: "Test", sub: "Download, upload, ping and loaded latency", C: TestView },
  { id: "live", label: "Live map", short: "Live", sub: "Every moving dot is real data on its way", C: LiveView },
  { id: "collider", label: "Packet collider", short: "Collider", sub: "Your test as a particle detector", C: ColliderView },
  { id: "insights", label: "Insights", short: "Insights", sub: "What your connection handles and how it compares", C: InsightsView },
  { id: "history", label: "History", short: "History", sub: "Saved on this device only", C: HistoryView },
  { id: "router", label: "Router check", short: "Router", sub: "Known flaws, settings score and the maker's fixes", C: RouterView },
  { id: "tools", label: "Toolkit", short: "Tools", sub: "Ten network tools, all in your browser", C: ToolsView },
  { id: "ask", label: "Ask CleanSpeed", short: "Ask", sub: "On-device help and a diagnosis of your last test", C: AskView },
  { id: "settings", label: "Settings", short: "Settings", sub: "Units, test length and appearance", C: SettingsView },
];
const TABS = ["test", "live", "history", "router"];
const ids = new Set(VIEWS.map((v) => v.id));
// Screen links: #/history on the full app. A Claude artifact passes only plain #names and reserves #settings,
// so the artifact edition uses #history and #units.
const ALIAS = { units: "settings" };
const hashFor = (v) => ARTIFACT ? "#" + (v === "settings" ? "units" : v) : "#/" + v;
const fromHash = () => { const h = location.hash.replace(/^#\/?/, ""); const v = ALIAS[h] || h; return ids.has(v) ? v : null; };
// The viewer (a Claude artifact) may set data-theme itself; "Match device" hands control back to it.
const hostTheme = document.documentElement.dataset.theme;
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export default function App() {
  const [view, setView] = useState(() => fromHash() || "test");
  const [theme, setThemeState] = useState(() => load("theme", "auto"));
  const [running, setRunning] = useState(false);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const viewRef = useRef(view);
  const watchers = useRef(new Set());
  const booted = useRef(false);
  const moved = useRef(false);

  const go = useCallback((v) => {
    if (!ids.has(v)) return;
    setMore(false);
    if (location.hash !== hashFor(v)) { if (ARTIFACT) location.hash = hashFor(v); else history.pushState(null, "", hashFor(v)); }
    setView(v);
  }, []);

  // Browser back/forward. Plain #fragments (the skip link) are not routes.
  useEffect(() => {
    const on = () => { const v = fromHash(); if (v) setView(v); };
    addEventListener("hashchange", on); addEventListener("popstate", on);
    return () => { removeEventListener("hashchange", on); removeEventListener("popstate", on); };
  }, []);

  // Wire the engine once, after the markup exists.
  useEffect(() => {
    if (booted.current) return; booted.current = true;
    // An engine error (for example from tampered saved data) must not take the whole app down with it.
    try {
      boot({
        go,
        sheet: (on) => setSheet(on),
        running: (on) => setRunning(on),
        onView: (f) => { watchers.current.add(f); },
      });
    } catch (e) { console.error("CleanSpeed engine:", e); }
  }, [go]);

  // On every screen change: canvases that were hidden measure themselves again, focus moves to the new heading.
  useEffect(() => {
    viewRef.current = view;
    watchers.current.forEach((f) => { try { f(view); } catch (e) { console.error(e); } });
    dispatchEvent(new Event("resize"));
    if (moved.current) {
      scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("h-" + view)?.focus({ preventScroll: true });
    }
    moved.current = true;
    document.title = view === "test" ? "CleanSpeed" : `${VIEWS.find((v) => v.id === view).label} · CleanSpeed`;
  }, [view]);

  const setTheme = useCallback((t) => { setThemeState(t); save("theme", t); }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") { if (hostTheme) root.dataset.theme = hostTheme; else delete root.dataset.theme; } else root.dataset.theme = theme;
    dispatchEvent(new Event("cs:theme"));
  }, [theme]);
  const nextTheme = { auto: "light", light: "dark", dark: "auto" }[theme];

  const closeSheet = () => document.getElementById("srvClose")?.click();
  useEffect(() => {
    if (!sheet && !more) return;
    const k = (e) => { if (e.key === "Escape") { if (sheet) closeSheet(); setMore(false); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [sheet, more]);

  const navItem = (v, cls) => (
    <button key={v.id} type="button" className={cls} data-go={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => go(v.id)}>
      <Icon name={v.id} /><span>{cls === "tab" ? v.short : v.label}</span>
    </button>
  );

  return (
    <>
      <a className="skip" href="#main">Skip to the speed test</a>
      <div className={"shell" + (running ? " is-running" : "")}>
        <header className="side">
          <div className="brand">
            <h1>Clean<span>Speed</span></h1>
            <button type="button" className="iconbtn themebtn" onClick={() => setTheme(nextTheme)}
              aria-label={`Theme: ${theme === "auto" ? "match device" : theme}. Switch to ${nextTheme === "auto" ? "match device" : nextTheme}`}>
              <Icon name={theme === "auto" ? "auto" : theme === "light" ? "sun" : "moon"} />
            </button>
          </div>
          <nav className="sidenav" aria-label="Sections">
            {VIEWS.slice(0, 5).map((v) => navItem(v, "navitem"))}
            <div className="navh">Security &amp; tools</div>
            {VIEWS.slice(5).map((v) => navItem(v, "navitem"))}
          </nav>
          <div className="sidefoot">
            {running ? <><b className="live-dot">Test running</b>Keep this tab in front.</> : <><b>No ads. No trackers.</b>Your results stay on this device.</>}
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          {ARTIFACT && (
            <p className="artnote" role="note">
              <b>Artifact edition.</b> Claude artifacts can only reach files published with the page, so this speed test measures download and latency to the artifact host. Upload, the global test servers, the vulnerability lookup, My IP and the DNS benchmark need the <a href={FULL_APP} target="_blank" rel="noopener">full app</a>.
            </p>
          )}
          {VIEWS.map(({ id, label, sub, C }) => (
            <div key={id} className={"view view-" + id} hidden={view !== id}>
              <div className="viewhead">
                <h2 id={"h-" + id} tabIndex={-1}>{label}</h2>
                <p>{sub}</p>
              </div>
              {id === "settings" ? <C theme={theme} setTheme={setTheme} /> : <C />}
            </div>
          ))}
        </main>
        <footer>CleanSpeed is open source. No cookies or analytics. Test servers: Cloudflare, LibreSpeed volunteers and Measurement Lab.</footer>
      </div>

      <nav className="tabbar" aria-label="Sections (compact)">
        {TABS.map((id) => navItem(VIEWS.find((v) => v.id === id), "tab"))}
        <button type="button" className="tab" data-go="more" aria-expanded={more} aria-controls="moreSheet" onClick={() => setMore((m) => !m)}
          aria-current={!TABS.includes(view) ? "page" : undefined}>
          <Icon name="more" /><span>More</span>
        </button>
      </nav>
      <div className="scrim" hidden={!more && !sheet} onClick={() => { if (sheet) closeSheet(); setMore(false); }}></div>
      <div className="glass moresheet" id="moreSheet" hidden={!more}>
        {VIEWS.filter((v) => !TABS.includes(v.id)).map((v) => navItem(v, "moreitem"))}
      </div>
      <ServerSheet />
    </>
  );
}
