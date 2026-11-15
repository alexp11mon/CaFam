// Spec 024: stands between the app and the local Supabase stack, adds a fixed
// delay to every request (the round trip Vercel -> Supabase) and counts them.
// Usage: node scripts/perf/latency-proxy.mjs [delayMs=30] [port=54399] [target=54321]
import http from "node:http";
import net from "node:net";

const delay = Number(process.argv[2] ?? 30);
const port = Number(process.argv[3] ?? 54399);
const target = Number(process.argv[4] ?? 54321);
let stats = { total: 0, paths: {} };

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const server = http.createServer(async (req, res) => {
  if (req.url === "/__stats") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(stats));
    return;
  }
  if (req.url === "/__reset") {
    stats = { total: 0, paths: {} };
    res.end("ok");
    return;
  }
  const path = (req.url ?? "").split("?")[0];
  if (req.method !== "OPTIONS") {
    stats.total += 1;
    stats.paths[path] = (stats.paths[path] ?? 0) + 1;
  }
  await wait(delay);
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: target,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.statusCode = 502;
    res.end();
  });
  req.pipe(upstream);
});

// Realtime: pass the WebSocket upgrade through untouched.
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(target, "127.0.0.1", () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(port, () =>
  console.log(`latency proxy :${port} -> :${target}, ${delay} ms`),
);
