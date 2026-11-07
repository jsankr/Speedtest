#!/usr/bin/env python3
"""CleanSpeed self-hosted test server. Python 3.9+ standard library only.

Endpoints (CORS open so the web page can call it from any origin):
  GET  /ping           -> 204, no body (latency)
  GET  /down?bytes=N   -> N bytes of random data (max 100 MB per request)
  POST /up             -> reads and discards the body, returns {"received": N}
  GET  /               -> serves ../index.html (the CleanSpeed app) if present

Run:   python3 server.py --port 8080
Then open http://<host>:8080/ (the app is served from the same origin), or in the app
choose Change server -> Your own server. A page loaded over https (e.g. GitHub Pages) can
only use an https test server, so put it behind TLS (Caddy/nginx) for that case.
"""
import argparse, json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

MAX_DOWN = 100_000_000
BLOCK = os.urandom(1 << 20)  # 1 MiB of incompressible data, reused
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "CleanSpeed"

    def log_message(self, *a):  # no request logging: nothing about clients is retained
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.send_header("Content-Length", "0"); self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/ping":
            self.send_response(204); self._cors(); self.send_header("Content-Length", "0"); self.end_headers(); return
        if u.path == "/down":
            try:
                n = max(0, min(MAX_DOWN, int(parse_qs(u.query).get("bytes", ["0"])[0])))
            except ValueError:
                self.send_error(400); return
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(n)); self.end_headers()
            try:
                while n > 0:
                    k = min(n, len(BLOCK)); self.wfile.write(BLOCK[:k]); n -= k
            except (BrokenPipeError, ConnectionResetError):
                pass  # client aborted at end of phase; expected
            return
        if u.path in ("/", "/index.html") and os.path.exists(WEB):
            body = open(WEB, "rb").read()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        self.send_error(404)

    def do_POST(self):
        if urlparse(self.path).path != "/up":
            self.send_error(404); return
        n = int(self.headers.get("Content-Length", 0) or 0)
        got = 0
        try:
            while got < n:
                chunk = self.rfile.read(min(1 << 20, n - got))
                if not chunk: break
                got += len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            return
        body = json.dumps({"received": got}).encode()
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    a = ap.parse_args()
    print(f"CleanSpeed server on http://{a.host}:{a.port}", file=sys.stderr)
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()
