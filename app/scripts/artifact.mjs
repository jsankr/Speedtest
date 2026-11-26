// Build the Claude-artifact edition into dist-artifact/: the page (unwrapped to the artifact page contract) plus the
// files it reaches beside it: speedtest.png and ping.txt for the speed test, assets/3d for the collider.
// The 1.6 MB IEEE maker registry (oui.txt) is left out of the artifact, so device lookup there points to the full app.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = here("../dist-artifact/");
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
execSync("npx vite build --outDir dist-artifact-raw --emptyOutDir", { cwd: here(".."), stdio: "inherit", env: { ...process.env, VITE_ARTIFACT: "1" } });
let html = readFileSync(here("../dist-artifact-raw/index.html"), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1], body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keep = [...head.matchAll(/<(style|script)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]); // inlined CSS and the app script
const page = [
  "<title>CleanSpeed</title>",
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="description" content="Ad-free, tracker-free speed test, router security check and network toolkit.">',
  ...keep.filter((t) => t.startsWith("<style")),
  body.trim(),
  ...keep.filter((t) => t.startsWith("<script")),
].join("\n");
writeFileSync(out + "cleanspeed.html", page);
// A valid PNG of random noise: artifacts only serve web media types, and random pixels can't be compressed,
// so every byte counted by the download test really crossed the network.
execSync(`python3 -c "import os,zlib,struct;w=h=1800;raw=b''.join(b'\\0'+os.urandom(w*3) for _ in range(h));c=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff);open('${out}speedtest.png','wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+c(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+c(b'IDAT',zlib.compress(raw,0))+c(b'IEND',b''))"`);
writeFileSync(out + "ping.txt", "1");
mkdirSync(out + "assets/3d", { recursive: true });
for (const f of ["scene.json", ...Array.from({ length: 9 }, (_, i) => `collider-0${i}.webp`)]) cpSync(here("../../assets/3d/" + f), out + "assets/3d/" + f);
rmSync(here("../dist-artifact-raw"), { recursive: true, force: true });
console.log("artifact edition written to app/dist-artifact/ (" + (page.length / 1024).toFixed(0) + " KB page)");
