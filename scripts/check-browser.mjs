// Desktop/mobile smoke checks using the locally installed Chrome and Node 22.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const tmp = await mkdtemp('/private/tmp/rania-browser-');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, reject) => { server.on('error', reject); server.listen(0, '127.0.0.1', ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', `--user-data-dir=${tmp}`, '--remote-debugging-port=0', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
const browserErrors = [];
chrome.stderr.on('data', () => {});
let socket;
const delay = ms => new Promise(ok => setTimeout(ok, ms));
try {
  let port;
  for (let i = 0; i < 75; i++) {
    try { port = (await readFile(join(tmp, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(200); }
  }
  assert.ok(port, 'Chrome must start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, reject) => { socket.onopen = ok; socket.onerror = reject; });
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const item = pending.get(event.id);
      if (item) { pending.delete(event.id); event.error ? item.reject(event.error) : item.resolve(event.result); }
    } else if (event.method === 'Runtime.exceptionThrown') browserErrors.push(event.params.exceptionDetails.text);
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true, userGesture:true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled:true });
  await cdp('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await cdp('Page.navigate', { url:origin });
  for (let i=0; i<60; i++) { if (await evaluate("document.readyState === 'complete' && !!document.querySelector('.filter.is-active')")) break; await delay(100); }
  await evaluate("document.fonts.ready.then(() => true)");
  await evaluate("Promise.all([...document.images].filter(img => img.hasAttribute('src')).map(img => { img.loading='eager'; return img.decode(); })).then(() => true)");
  await delay(750);
  assert.equal(await evaluate("document.querySelectorAll('.publication').length"), 13);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Desktop must not overflow');
  assert.equal(await evaluate("[...document.images].filter(img => img.hasAttribute('src')).every(img => img.complete && img.naturalWidth > 0)"), true, 'Images must load');
  assert.equal(await evaluate("document.querySelector('.paper-image').getBoundingClientRect().width > 420"), true, 'Desktop figures are more than twice the original 206px width');
  assert.equal(await evaluate("document.querySelectorAll('[data-figure]').length"), 12, 'Twelve original figures/tables');
  assert.equal(await evaluate("document.querySelector('#paper-finmmeval-overview img') === null"), true, 'No invented figure for inaccessible chapter');
  await writeFile('/private/tmp/rania-github-desktop.png', Buffer.from((await cdp('Page.captureScreenshot', { format:'png' })).data, 'base64'));
  await evaluate("document.querySelector('#publications').scrollIntoView({behavior:'instant'})");
  await writeFile('/private/tmp/rania-github-papers.png', Buffer.from((await cdp('Page.captureScreenshot', { format:'png' })).data, 'base64'));
  const visible = () => evaluate("[...document.querySelectorAll('.publication')].filter(p => !p.hidden).length");
  await evaluate("document.querySelector('[data-filter=\"1\"]').click()");
  assert.equal(await visible(), 4, 'First-author filter');
  assert.equal(await evaluate("[...document.querySelectorAll('.year-group')].filter(g => !g.hidden).length"), 2, 'Empty year groups are hidden');
  await evaluate("document.querySelector('[data-filter=\"2\"]').click()");
  assert.equal(await visible(), 3, 'Second-author filter');
  await evaluate("document.querySelector('[data-filter=\"other\"]').click()");
  assert.equal(await visible(), 6, 'Third/fourth-author filter');
  assert.equal(await evaluate("[...document.querySelectorAll('.publication')].filter(p => !p.hidden).every(p => ['3','4'].includes(p.dataset.authorPosition))"), true);
  await evaluate("document.querySelector('[data-filter=\"all\"]').click()");
  assert.equal(await visible(), 13);
  await evaluate("document.querySelector('[data-cite=\"geometry\"]').click()");
  assert.equal(await evaluate("document.querySelector('dialog').open"), true);
  assert.equal(await evaluate("document.querySelector('#citation-text').value.includes('2605.09195')"), true);
  await cdp('Browser.grantPermissions', { origin, permissions:['clipboardReadWrite','clipboardSanitizedWrite'] });
  await evaluate("document.querySelector('#copy-citation').click()");
  await delay(150);
  assert.equal(await evaluate("document.querySelector('#copy-status').textContent"), 'Citation copied.');
  await cdp('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await cdp('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  assert.equal(await evaluate("document.querySelector('dialog').open"), false, 'Escape closes citation');
  await evaluate("document.querySelector('[data-cite=\"kitab\"]').click()");
  assert.equal(await evaluate("document.querySelector('#citation-text').value.includes('10.18653/v1/2025.findings-acl.1135')"), true, 'Proceedings DOI citation');
  await evaluate("document.querySelector('#citation-dialog .close-dialog').click()");
  await evaluate("document.querySelector('[data-figure=\"frames\"]').focus(); document.querySelector('[data-figure=\"frames\"]').click()");
  await evaluate("document.querySelector('#expanded-figure').decode().then(() => true)");
  assert.equal(await evaluate("document.querySelector('#figure-dialog').open"), true, 'Figure viewer opens');
  assert.equal(await evaluate("document.querySelector('#expanded-figure').getBoundingClientRect().width > 800"), true, 'Figure enlarged in viewer');
  assert.equal(await evaluate("document.querySelector('#figure-source').href.includes('#S3.F2')"), true, 'Original figure source');
  await writeFile('/private/tmp/rania-github-figure.png', Buffer.from((await cdp('Page.captureScreenshot', { format:'png' })).data, 'base64'));
  await cdp('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await cdp('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  assert.equal(await evaluate("document.querySelector('#figure-dialog').open"), false, 'Escape closes figure');
  assert.equal(await evaluate("document.activeElement.dataset.figure"), 'frames', 'Focus returns to figure link');
  await cdp('Emulation.setDeviceMetricsOverride', { width:768, height:1000, deviceScaleFactor:1, mobile:false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Tablet must not overflow');
  await cdp('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  await evaluate("scrollTo({top:0,behavior:'instant'})");
  await delay(250);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Phone must not overflow');
  await writeFile('/private/tmp/rania-github-mobile.png', Buffer.from((await cdp('Page.captureScreenshot', { format:'png' })).data, 'base64'));
  await evaluate("document.querySelector('#publications').scrollIntoView({behavior:'instant'})");
  await writeFile('/private/tmp/rania-github-mobile-papers.png', Buffer.from((await cdp('Page.captureScreenshot', { format:'png' })).data, 'base64'));
  await evaluate("document.querySelector('[data-figure=\"poetry\"]').click()");
  await evaluate("document.querySelector('#expanded-figure').decode().then(() => true)");
  assert.equal(await evaluate("document.querySelector('#figure-dialog').scrollWidth <= document.querySelector('#figure-dialog').clientWidth"), true, 'Phone figure viewer must not overflow');
  await evaluate("document.querySelector('.close-figure').click()");
  assert.equal(await evaluate("document.querySelector('#figure-dialog').open"), false, 'Figure close button');
  await cdp('Emulation.setDeviceMetricsOverride', { width:320, height:700, deviceScaleFactor:1, mobile:true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Small phone must not overflow');
  assert.deepEqual(browserErrors, [], 'No JavaScript errors');
  // Content and all publication links remain available with JavaScript disabled.
  await cdp('Emulation.setScriptExecutionDisabled', { value:true });
  await cdp('Page.reload');
  await delay(300);
  const dom = await cdp('DOM.getDocument');
  const all = await cdp('DOM.querySelectorAll', { nodeId:dom.root.nodeId, selector:'.publication' });
  assert.equal(all.nodeIds.length, 13);
  const figureLinks = await cdp('DOM.querySelectorAll', { nodeId:dom.root.nodeId, selector:'.paper-image[href^="./assets/"]' });
  assert.equal(figureLinks.nodeIds.length, 12, 'Full-size figures work without JavaScript');
  console.log(JSON.stringify({ status:'passed', publications:13, firstAuthor:4, secondAuthor:3, thirdOrFourthAuthor:6, originalFigures:12, viewports:[1440,768,390,320], checks:['image loading','larger figures','author filters','citation dialog','clipboard copy','figure viewer and source links','Escape dismissal and focus return','responsive overflow','no JavaScript errors','content without JavaScript'], screenshots:['/private/tmp/rania-github-desktop.png','/private/tmp/rania-github-papers.png','/private/tmp/rania-github-figure.png','/private/tmp/rania-github-mobile.png','/private/tmp/rania-github-mobile-papers.png'] }));
} finally {
  socket?.close();
  chrome.kill('SIGTERM');
  server.close();
}
