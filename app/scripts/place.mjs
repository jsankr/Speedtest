// Copy the single-file build to the repository root, where GitHub Pages, server/server.py and the tests serve it,
// and pin its scripts with a Content-Security-Policy: only the exact inline scripts in this build may run
// (SHA-256 hashes), so injected markup can't execute even if an escaping bug slips through.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
let html = readFileSync(here("../dist/index.html"), "utf8");

const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .filter((m) => !/\bsrc=/.test(m[0].slice(0, m[0].indexOf(">"))))
  .map((m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
if (!hashes.length) throw new Error("no inline script found to hash");

export const CSP = [
  "default-src 'none'",
  `script-src ${hashes.join(" ")}`,
  "style-src 'unsafe-inline'",            // the engine sets style attributes (bar widths, colours)
  "img-src 'self' data:",                 // collider plates, icons
  "font-src data:",                       // bundled typefaces
  "manifest-src data:",                   // embedded web-app manifest
  "connect-src 'self' https: wss: http:", // speed-test servers are user-selectable (incl. your own on http)
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="no-referrer">\n`;
html = html.replace(/<meta charset="utf-8">\n?/i, (m) => m + meta);
if (!html.includes("Content-Security-Policy")) throw new Error("CSP not inserted");
writeFileSync(here("../../index.html"), html);
writeFileSync(here("../../server/csp.txt"), CSP + "\n");
console.log(`index.html updated at the repository root (CSP with ${hashes.length} script hash${hashes.length > 1 ? "es" : ""})`);
