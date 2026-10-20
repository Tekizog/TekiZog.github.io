const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function postHarness(hostname = 'example.com') {
  const requests = [], intervals = [], listeners = new Set(), cancelled = [];
  const images = [];
  let connected = false, serial = 0;
  const body = {
    replaceChildren(fragment) {
      assert.equal(fragment, content);
      assert.equal(images[0].loading, 'lazy');
      assert.equal(images[0].decoding, 'async');
      connected = true;
    }
  };
  const content = {
    querySelectorAll(selector) {
      if (selector === 'img') return images;
      return [];
    }
  };
  const elements = {
    '#postBody': body,
    '#postTitle': {},
    '#postMeta': {},
    '#postNav': {},
    '.post-wrap': { children: [], appendChild(node) { this.children.push(node); } }
  };
  const document = {
    readyState: 'loading', hidden: false,
    documentElement: { scrollHeight: 2000 },
    addEventListener() {},
    querySelector(selector) { return elements[selector] || null; },
    getElementById() { return { getBoundingClientRect: () => ({ top: 200 }) }; },
    createElement(tag) {
      if (tag === 'template') return {
        content,
        set innerHTML(value) {
          connected = false;
          images.length = 0;
          images.push({ hasAttribute: () => false });
        }
      };
      if (tag === 'aside') return {
        querySelectorAll: () => [],
        remove() {
          const children = elements['.post-wrap'].children;
          children.splice(children.indexOf(this), 1);
        }
      };
      return {};
    }
  };
  const context = {
    document, URLSearchParams,
    location: { hostname, search: '?p=sample', href: 'https://example.com/post.html?p=sample' },
    navigator: {}, console,
    marked: { use() {}, parse: x => x },
    setInterval: callback => intervals.push(callback),
    setTimeout() {}, clearTimeout() {},
    requestAnimationFrame: () => ++serial,
    cancelAnimationFrame: id => cancelled.push(id),
    fetch(url, options) {
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      requests.push({ url, options, resolve });
      return promise;
    }
  };
  context.window = {
    SAKURA_CONFIG: {}, marked: context.marked, innerWidth: 1440,
    innerHeight: 900, scrollY: 0,
    addEventListener(event, callback) { if (event === 'scroll') listeners.add(callback); },
    removeEventListener(event, callback) { if (event === 'scroll') listeners.delete(callback); }
  };
  let source = read('assets/js/post.js');
  source = source.replace('  if (document.readyState === "loading")',
    '  globalThis.testAPI = { init, enhance, buildTOC };\n  if (document.readyState === "loading")');
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, document, requests, intervals, listeners, cancelled, elements, images,
    connected: () => connected, api: context.testAPI };
}

test('external scripts are deferred, unique and dependency-ordered in the head', () => {
  for (const name of ['index.html', 'post.html']) {
    const html = read(name);
    const scripts = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)];
    const expected = name === 'index.html'
      ? ['assets/config.js?v=20260913', 'assets/js/site.js']
      : ['assets/config.js?v=20260913', 'assets/js/marked.min.js', 'assets/js/site.js', 'assets/js/post.js'];
    assert.deepEqual(scripts.map(match => match[2]), expected);
    for (const script of scripts) {
      assert.match(script[1], /\bdefer\b/);
      assert.ok(script.index < html.indexOf('</head>'));
      assert.ok(fs.existsSync(path.join(root, script[2].split('?')[0])));
    }
    assert.ok(html.indexOf('localStorage.getItem') < scripts[0].index);
  }
});

test('production requests use HTTP cache and article/index load concurrently', async () => {
  const h = postHarness();
  h.api.init();
  assert.deepEqual(h.requests.map(r => r.url), ['posts.json', 'posts/sample.md']);
  assert.ok(h.requests.every(r => r.options.cache === 'default'));
  assert.equal(h.intervals.length, 0);
  h.requests[0].resolve({ ok: true, json: async () => ({ posts: [] }) });
  h.requests[1].resolve({ ok: true, text: async () => '# Sample\n\n![test](test.png)' });
  await flush();
  assert.equal(h.connected(), true);
});

test('image enhancement preserves explicit author loading attributes', () => {
  const h = postHarness();
  const image = { loading: 'eager', decoding: 'sync', hasAttribute: () => true };
  h.api.enhance({ querySelectorAll: selector => selector === 'img' ? [image] : [] });
  assert.equal(image.loading, 'eager');
  assert.equal(image.decoding, 'sync');
});

test('preview polling pauses in background and never overlaps slow requests', async () => {
  const h = postHarness('localhost');
  h.api.init();
  assert.ok(h.requests.every(r => r.options.cache === 'no-cache'));
  const poll = h.intervals[0];
  poll();
  assert.equal(h.requests.length, 2);
  h.requests[0].resolve({ ok: true, json: async () => ({ posts: [] }) });
  h.requests[1].resolve({ ok: true, text: async () => '# Sample' });
  await flush();
  h.document.hidden = true;
  poll();
  assert.equal(h.requests.length, 2);
  h.document.hidden = false;
  poll(); poll();
  assert.equal(h.requests.length, 3);
  h.requests[2].resolve({ ok: true, text: async () => '# Updated' });
  await flush();
  assert.equal(h.requests.filter(r => r.url === 'posts.json').length, 2);
  poll();
  assert.equal(h.requests.length, 5);
});

test('TOC rebuild removes old nodes, scroll listeners and pending frames', () => {
  const h = postHarness();
  const headings = Array.from({ length: 3 }, (_, i) => ({ tag: 'H2', text: `Section ${i}`, id: `sec-${i}` }));
  h.api.buildTOC(headings);
  assert.equal(h.listeners.size, 1);
  for (const callback of h.listeners) callback();
  h.api.buildTOC(headings);
  assert.equal(h.listeners.size, 1);
  assert.equal(h.elements['.post-wrap'].children.length, 1);
  assert.equal(h.cancelled.length, 1);
  h.api.buildTOC([]);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.elements['.post-wrap'].children.length, 0);
});

test('404 pauses background animations and resumes only previously playing video', async () => {
  const html = read('404.html');
  assert.match(html, /body\.is-hidden \.petal \{ animation-play-state: paused; \}/);
  const handlers = {};
  let plays = 0, pauses = 0;
  const video = {
    paused: false,
    pause() { pauses++; this.paused = true; },
    play() { plays++; this.paused = false; return Promise.resolve(); },
    addEventListener(event, callback) { handlers[event] = callback; }
  };
  const document = {
    hidden: false,
    body: { appendChild() {}, classList: { toggle() {} } },
    createDocumentFragment: () => ({ appendChild() {} }),
    createElement: () => ({ style: {} }),
    querySelector: () => video,
    addEventListener(event, callback) { handlers[event] = callback; }
  };
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1], { document, Math });
  document.hidden = true; handlers.visibilitychange();
  assert.equal(pauses, 1);
  document.hidden = false; handlers.visibilitychange();
  assert.equal(plays, 1);
  video.paused = true;
  document.hidden = true; handlers.visibilitychange();
  document.hidden = false; handlers.visibilitychange();
  assert.equal(plays, 1);
  video.autoplay = true;
  video.paused = true;
  document.hidden = true;
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1], { document, Math });
  document.hidden = false; handlers.visibilitychange();
  assert.equal(plays, 2);
});

test('background video defers hidden startup and never plays during hidden readiness', () => {
  const timers = [], handlers = {}, attributes = {}, classes = new Set();
  let plays = 0, loads = 0;
  const video = {
    classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
    getAttribute: key => attributes[key],
    setAttribute: (key, value) => { attributes[key] = value; },
    play() { plays++; return Promise.resolve(); }, pause() {}, load() { loads++; },
    addEventListener() {}, readyState: 0, currentTime: 0
  };
  const document = {
    hidden: true, readyState: 'complete', title: '樱花街道 · 桜の街道',
    documentElement: { setAttribute() {}, getAttribute() { return 'day'; } },
    querySelectorAll: () => [],
    querySelector: selector => selector === '#bgVideo' ? video : null,
    addEventListener(event, callback) { handlers[event] = callback; }
  };
  const context = {
    document, navigator: {}, location: { hostname: 'example.com' },
    localStorage: { getItem: () => null },
    setTimeout(callback) { timers.push(callback); },
    window: {
      SAKURA_CONFIG: { video: { hd: 'hd.mp4', sd: 'sd.mp4' } }, innerWidth: 1440,
      matchMedia: () => ({ matches: false }),
      requestIdleCallback(callback) { timers.push(callback); },
      addEventListener() {}
    }
  };
  let source = read('assets/js/site.js');
  source = source.replace('  if (document.readyState === "loading")',
    '  globalThis.testAPI = { initVideo };\n  if (document.readyState === "loading")');
  document.readyState = 'loading';
  vm.createContext(context);
  vm.runInContext(source, context);
  document.readyState = 'complete';
  context.testAPI.initVideo();
  assert.equal(loads, 0);
  assert.equal(timers.length, 0);
  document.hidden = false; handlers.visibilitychange();
  timers.shift()();
  assert.equal(loads, 1);
  document.hidden = true; handlers.visibilitychange();
  video.readyState = 2; video.currentTime = 5;
  timers.shift()();
  assert.equal(plays, 0);
  document.hidden = false; handlers.visibilitychange();
  assert.equal(plays, 1);
});
