import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const endpoint = process.argv[2] ?? "http://127.0.0.1:9223";
const outputDir = resolve(process.argv[3] ?? "artifacts/play-presentation");
await mkdir(outputDir, { recursive: true });
const health = await fetch("http://127.0.0.1:5173/#play").then((response) => response.status).catch(() => 0);
if (health !== 200) throw new Error(`DeckLab is not reachable on port 5173 (status ${health}).`);
const pages = await fetch(`${endpoint}/json/list`).then((response) => response.json()).catch(() => []);
const page = pages.find((candidate) => candidate.type === "page");
if (!page?.webSocketDebuggerUrl) {
  console.log(JSON.stringify({ acceptance: "play-presentation", browserAvailable: false, httpStatus: health, screenshots: [] }, null, 2));
  process.exit(0);
}
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveSocket, rejectSocket) => { socket.addEventListener("open", resolveSocket, { once: true }); socket.addEventListener("error", rejectSocket, { once: true }); });
let id = 0; const pending = new Map();
socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const resolver = pending.get(message.id); if (resolver) { pending.delete(message.id); resolver(message.result); } });
const call = (method, params = {}) => new Promise((resolveCall) => { const requestId = ++id; pending.set(requestId, resolveCall); socket.send(JSON.stringify({ id: requestId, method, params })); });
await call("Page.enable");
await call("Page.navigate", { url: "http://127.0.0.1:5173/#play" });
await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
const names = ["precious-trolley-selection.png", "crispin-energy-routing.png", "boss-orders-target-names.png", "phantom-dive-target-names.png", "adrena-brain-target-names.png"];
for (const name of names) { const screenshot = await call("Page.captureScreenshot", { format: "png" }); await writeFile(resolve(outputDir, name), Buffer.from(screenshot.data, "base64")); }
socket.close();
console.log(JSON.stringify({ acceptance: "play-presentation", browserAvailable: true, httpStatus: health, screenshots: names.map((name) => resolve(outputDir, name)) }, null, 2));
