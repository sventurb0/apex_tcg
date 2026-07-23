import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const endpoint = process.argv[2] ?? "http://127.0.0.1:9223";
const targetUrl = process.argv[3] ?? "http://127.0.0.1:5173/#play";
const navigationUrl = new URL(targetUrl);
navigationUrl.searchParams.set("verify", String(Date.now()));
const screenshotPath = resolve(process.argv[4] ?? "artifacts/compact-play-1920x1080.png");
const subjectDeckId = process.argv[5] ?? "skeledirge-armarouge";
const detailsScreenshotPath = screenshotPath.replace(/\.png$/i, "-details.png");
const pages = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = pages.find((candidate) => candidate.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveSocket, rejectSocket) => {
  socket.addEventListener("open", resolveSocket, { once: true });
  socket.addEventListener("error", rejectSocket, { once: true });
});

let messageId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handlers = pending.get(message.id);
  if (!handlers) return;
  pending.delete(message.id);
  if (message.error) handlers.reject(new Error(message.error.message));
  else handlers.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, rejectCommand) => pending.set(id, { resolve: resolveCommand, reject: rejectCommand }));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(expression, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: navigationUrl.href });
await waitFor(`document.querySelector('button.primary')?.textContent?.includes('Start game')`);
const playOption = await evaluate(`(() => { const option = document.querySelector('select[aria-label="Your deck"] option[value="${subjectDeckId}"]'); return option ? { text: option.textContent.trim(), disabled: option.disabled } : null; })()`);
const subjectDeckName = playOption?.text?.replace(/\s*—.*$/, "") ?? subjectDeckId;
await evaluate(`[...document.querySelectorAll('.top-nav button')].find(node => node.textContent.trim() === 'Premade').click()`); await waitFor(`[...document.querySelectorAll('.deck-tile h2')].some(node => node.textContent.includes('Okidogi ex Poison'))`);
await waitFor(`[...document.querySelectorAll('.deck-tile h2')].some(node => node.textContent.includes(${JSON.stringify(subjectDeckName)}))`);
const premade = await evaluate(`(() => { const tile = [...document.querySelectorAll('.deck-tile')].find(node => node.querySelector('h2')?.textContent.includes(${JSON.stringify(subjectDeckName)})); return tile ? { heading: tile.querySelector('h2')?.textContent.trim(), badge: tile.querySelector('.support-badge')?.textContent.trim(), thumbnailCount: tile.querySelectorAll('img').length, text: tile.innerText } : null; })()`);
await evaluate(`(() => { const tile = [...document.querySelectorAll('.deck-tile')].find(node => node.querySelector('h2')?.textContent.includes(${JSON.stringify(subjectDeckName)})); [...tile.querySelectorAll('button')].find(node => node.textContent.trim() === 'Open in builder').click(); })()`);
await waitFor(`document.querySelector('fieldset[aria-label="Card presentation"]')`);
const builderHybrid = await evaluate(`({ selected: document.querySelector('fieldset[aria-label="Card presentation"] .selected')?.textContent?.trim(), catalogueImages: document.querySelectorAll('.catalogue-hybrid-tile img').length, deckRowImages: document.querySelectorAll('.deck-row img').length })`);
await evaluate(`[...document.querySelectorAll('fieldset[aria-label="Card presentation"] button')].find(node => node.textContent.trim() === 'Image').click()`);
await waitFor(`document.querySelector('.catalogue-results--image')`);
const builderImage = await evaluate(`({ selected: document.querySelector('fieldset[aria-label="Card presentation"] .selected')?.textContent?.trim(), catalogueImages: document.querySelectorAll('.catalogue-image-tile img').length, fullTextCards: document.querySelectorAll('.catalogue-image-tile .printed-card').length })`);
await evaluate(`[...document.querySelectorAll('.top-nav button')].find(node => node.textContent.trim() === 'Simulation Lab').click()`); await waitFor(`document.querySelector('h1')?.textContent?.includes('Simulation Lab')`);
const simulationOption = await evaluate(`(() => { const option = document.querySelector('select[aria-label="Subject deck"] option[value="${subjectDeckId}"]'); return option ? { text: option.textContent.trim(), disabled: option.disabled } : null; })()`);
await evaluate(`[...document.querySelectorAll('.top-nav button')].find(node => node.textContent.trim() === 'Play').click()`); await waitFor(`document.querySelector('button.primary')?.textContent?.includes('Start game')`);
await evaluate(`(() => { const select = document.querySelector('select[aria-label="Your deck"]'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, '${subjectDeckId}'); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await waitFor(`document.querySelector('select[aria-label="Your deck"]')?.value === '${subjectDeckId}' && !document.querySelector('button.primary')?.disabled`);
await evaluate(`document.querySelector('button.primary').click()`);
await waitFor(`document.querySelector('[data-testid="compact-game-board"]')`);
await waitFor(`document.querySelector('.action-select-active')`);
await evaluate(`document.querySelector('.action-select-active').click()`);
await waitFor(`document.querySelector('.action-finish-setup')`);
await evaluate(`document.querySelector('.action-finish-setup').click()`);
for (let setupStep = 0; setupStep < 40 && !(await evaluate(`Boolean(document.querySelector('.action-end-turn'))`)); setupStep += 1) {
  const setupAction = await evaluate(`(() => { const node = document.querySelector('.action-draw-mulligan, .action-select-active, .action-finish-setup'); if (!node) return false; node.click(); return true; })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, setupAction ? 150 : 300));
}
await waitFor(`document.querySelector('.action-end-turn')`, 20_000);

const metrics = await evaluate(`(() => {
  const board = document.querySelector('.board-panel');
  const actions = document.querySelector('.actions-panel');
  const play = document.querySelector('.play-page-active');
  const endTurn = document.querySelector('.action-end-turn');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: { clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight, bodyScrollHeight: document.body.scrollHeight },
    play: play ? { clientHeight: play.clientHeight, scrollHeight: play.scrollHeight } : null,
    board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight } : null,
    actions: actions ? { clientHeight: actions.clientHeight, scrollHeight: actions.scrollHeight } : null,
    playHeadingCount: [...document.querySelectorAll('h1')].filter((node) => node.textContent?.trim() === 'Play').length,
    playEyebrowCount: [...document.querySelectorAll('.eyebrow')].filter((node) => node.textContent?.includes('HUMAN VERSUS AI')).length,
    footerCount: document.querySelectorAll('.app-shell > footer').length,
    fullCatalogueCardsOnBoard: document.querySelectorAll('.game-layout .printed-card--full').length,
    activeBattleCards: document.querySelectorAll('.battle-card-active').length,
    benchBattleCards: document.querySelectorAll('.battle-card-bench').length,
    handBattleCards: document.querySelectorAll('.battle-card-hand').length,
    visibleCardImages: document.querySelectorAll('.game-layout img').length,
    hiddenOpponentImages: document.querySelectorAll('.hidden-hand img').length,
    selectedDisplay: document.querySelector('.game-display-pref .selected')?.textContent?.trim(),
    failedCardImages: [...document.querySelectorAll('.game-layout img')].filter((node) => node.complete && node.naturalWidth === 0).length,
    actionLogOpen: document.querySelector('.action-log-details')?.hasAttribute('open') ?? null,
    endTurnVisible: Boolean(endTurn && getComputedStyle(endTurn).display !== 'none'),
    endTurnContainerPosition: endTurn?.parentElement ? getComputedStyle(endTurn.parentElement).position : null,
    groupedActions: [...document.querySelectorAll('[data-action-count]')].filter((node) => Number(node.dataset.actionCount) > 1).map((node) => ({ label: node.textContent?.trim(), count: Number(node.dataset.actionCount) })),
  };
})()`);

const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
await mkdir(dirname(screenshotPath), { recursive: true });
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
await evaluate(`document.querySelector('.player-field.player .battle-card-active').click()`);
await waitFor(`document.querySelector('[role="dialog"]')`);
await waitFor(`document.querySelector('[role="dialog"] img')?.complete && document.querySelector('[role="dialog"] img')?.naturalWidth > 0`, 10_000);
const dialogMetrics = await evaluate(`({
  open: Boolean(document.querySelector('[role="dialog"]')),
  heading: document.querySelector('[role="dialog"] h2')?.textContent?.trim(),
  printedCardCount: document.querySelectorAll('[role="dialog"] .printed-card--full').length,
  imageLoaded: Boolean(document.querySelector('[role="dialog"] img')?.naturalWidth),
})`);
const detailsScreenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
await writeFile(detailsScreenshotPath, Buffer.from(detailsScreenshot.data, "base64"));
console.log(JSON.stringify({ preflight: { subjectDeckId, playOption, premade, builder: { hybrid: builderHybrid, image: builderImage }, simulationOption }, ...metrics, dialog: dialogMetrics, screenshotPath, detailsScreenshotPath }, null, 2));
socket.close();
