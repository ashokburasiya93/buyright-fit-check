// Local dev server: serves public/ and runs api/*.js like Vercel does. Usage: node server.js
const http = require("http"), fs = require("fs"), path = require("path"), url = require("url");
for (const f of [path.join(__dirname, ".env"), path.join(__dirname, "..", "..", ".env")]) if (fs.existsSync(f)) {
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  break;
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const PORT = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname.startsWith("/api/")) {
    const file = path.join(__dirname, "api", path.basename(u.pathname) + ".js");
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    let raw = ""; for await (const c of req) raw += c;
    req.query = u.query; try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return require(file)(req, res);
  }
  const f = path.join(__dirname, "public", u.pathname === "/" ? "index.html" : path.normalize(u.pathname));
  if (!f.startsWith(path.join(__dirname, "public")) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`BuyRight on http://localhost:${PORT}`));
