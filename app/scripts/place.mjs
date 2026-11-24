// Copy the single-file build to the repository root, where GitHub Pages, server/server.py and the tests serve it.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
copyFileSync(here("../dist/index.html"), here("../../index.html"));
console.log("index.html updated at the repository root");
