import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { shipped } from "./files.mjs";

// Serves only the files listed in files.mjs, so local development matches the
// production build. Requests are matched by exact name; no path resolution
// against the file system takes place, which rules out directory traversal.
const root = new URL("../", import.meta.url);
const port = Number(process.env.PORT) || 5173;
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
const allowed = new Set(shipped);
// Apply the production response headers (CSP etc.) from vercel.json so
// policy violations show up during development and browser tests.
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));
const securityHeaders = Object.fromEntries(
  (vercel.headers || []).flatMap((h) => h.headers.map((x) => [x.key, x.value])),
);

createServer(async (req, res) => {
  try {
    const name =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(
        /^\//,
        "",
      ) || "index.html";
    if (!allowed.has(name)) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const body = await readFile(new URL(name, root));
    res.writeHead(200, {
      ...securityHeaders,
      "Content-Type": `${types[extname(name)] || "text/plain"}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`SiliconPath: http://localhost:${port}`),
);
