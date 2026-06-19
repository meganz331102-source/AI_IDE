// Lokalny serwer HTTP serwujący pliki projektu pod podgląd w iframe.
// Do każdego HTML wstrzykuje skrypt "element pickera" – pozwala
// użytkownikowi klikać elementy na stronie i wysyłać je do AI.
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AddressInfo } from 'net';

let server: Server | null = null;
let currentRoot: string | null = null;
let currentPort: number | null = null;

const PICKER_SCRIPT = `
<script>
(function() {
  if (window.__aiidePickerLoaded) return;
  window.__aiidePickerLoaded = true;

  let active = false;
  let hoveredEl = null;
  let overlay = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6366f1;background:rgba(99,102,241,0.15);box-shadow:0 0 0 1px rgba(255,255,255,0.4);transition:all 60ms;border-radius:2px;';
    document.body.appendChild(overlay);
  }
  function position(el) {
    const r = el.getBoundingClientRect();
    overlay.style.top = r.top + 'px';
    overlay.style.left = r.left + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
  }
  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName !== 'BODY' && parts.length < 6) {
      let s = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\\s+/).filter(c => c && !c.includes(':')).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const sib = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(cur) + 1) + ')';
      }
      parts.unshift(s);
      cur = parent;
    }
    return parts.join(' > ');
  }
  function onMouseMove(e) {
    if (!active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== overlay) {
      hoveredEl = el;
      if (!overlay) createOverlay();
      position(el);
    }
  }
  function onClick(e) {
    if (!active) {
      // Picker NIEaktywny — blokuj external navigation (anchor + form submit),
      // które wywalają iframe na "about:blank" lub blank-outują podgląd.
      var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (anchor) {
        var href = anchor.getAttribute('href') || '';
        var isExternal = /^(https?:|mailto:|tel:)/i.test(href) || (anchor.target === '_blank');
        if (isExternal) {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({ type: 'AIIDE_OPEN_EXTERNAL', url: anchor.href }, '*');
        }
      }
      return;
    }
    // Picker aktywny — przechwyć klik i poślij info o elemencie
    e.preventDefault();
    e.stopPropagation();
    var target = hoveredEl || (document.elementFromPoint(e.clientX, e.clientY));
    if (!target) return;
    var selector = getSelector(target);
    var outerHTML = target.outerHTML.slice(0, 2500);
    var text = (target.textContent || '').trim().slice(0, 240);
    window.parent.postMessage({
      type: 'AIIDE_ELEMENT_PICKED',
      selector: selector,
      outerHTML: outerHTML,
      text: text,
      tagName: target.tagName.toLowerCase(),
    }, '*');
    setActive(false);
  }
  function onSubmit(e) {
    // Form submit w statycznym podglądzie nawiguje iframe gdzieś indziej
    // i robi blank-out. Blokujemy zawsze (i tak nie ma backendu do obsługi).
    e.preventDefault();
    e.stopPropagation();
  }
  function setActive(on) {
    active = on;
    if (!on) {
      if (overlay) { overlay.remove(); overlay = null; }
      hoveredEl = null;
      document.body.style.cursor = '';
    } else {
      document.body.style.cursor = 'crosshair';
    }
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'AIIDE_PICKER_TOGGLE') {
      setActive(!!e.data.active);
    }
  });
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
})();
</script>`;

function injectPicker(html: string): string {
  if (html.includes('</body>')) return html.replace('</body>', PICKER_SCRIPT + '</body>');
  if (html.includes('</html>')) return html.replace('</html>', PICKER_SCRIPT + '</html>');
  return html + PICKER_SCRIPT;
}

const CT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
};

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!currentRoot) { res.writeHead(404); res.end('No project loaded'); return; }

  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.normalize(path.join(currentRoot, urlPath));
  if (!filePath.startsWith(currentRoot)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const tryIndex = path.join(filePath, 'index.html');
      try {
        await fs.stat(tryIndex);
        const html = await fs.readFile(tryIndex, 'utf8');
        res.writeHead(200, { 'Content-Type': CT['.html'] });
        res.end(injectPicker(html));
        return;
      } catch {
        res.writeHead(404); res.end('No index.html in directory'); return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CT[ext] || 'application/octet-stream';
    if (ext === '.html' || ext === '.htm') {
      const content = await fs.readFile(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(injectPicker(content));
    } else {
      const content = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': content.length });
      res.end(content);
    }
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

// Lista wszystkich plików .html w projekcie – dla projektów bez index.html w root
async function listHtmlFiles(rootPath: string, max = 20): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const SKIP = new Set(['node_modules', '.git', 'dist', 'release', '.next', 'build', 'out']);
  const found: string[] = [];
  async function walk(dir: string) {
    if (found.length >= max) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (found.length >= max) return;
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith('.html') || e.name.endsWith('.htm')) {
        found.push(path.relative(rootPath, full));
      }
    }
  }
  await walk(rootPath);
  return found.sort();
}

export async function startPreviewServer(): Promise<number> {
  if (server && currentPort) return currentPort;
  return new Promise((resolve, reject) => {
    server = createServer(handleRequest);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address() as AddressInfo;
      currentPort = addr.port;
      resolve(currentPort);
    });
  });
}

export function setPreviewRoot(rootPath: string) {
  currentRoot = rootPath;
}

// Wyszukuje "główny" plik startowy w typowych miejscach.
// Dla projektów wbudowanych (Next.js out, Vite dist, Webpack build, docs)
// index.html nie leży w root. Próbujemy najpopularniejsze ścieżki.
const COMMON_INDEX_PATHS = [
  'index.html',
  'public/index.html',
  'out/index.html',
  'dist/index.html',
  'build/index.html',
  'docs/index.html',
  'www/index.html',
  'site/index.html',
  '_site/index.html',
  'public_html/index.html',
];

export async function findStartHtml(rootPath: string): Promise<string | null> {
  const fs = await import('fs/promises');
  const path = await import('path');
  for (const rel of COMMON_INDEX_PATHS) {
    const full = path.join(rootPath, rel);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) return rel;
    } catch { /* nie istnieje */ }
  }
  return null;
}

export async function listAllHtmlFiles(rootPath: string): Promise<string[]> {
  return listHtmlFiles(rootPath);
}

export function stopPreviewServer() {
  if (server) { server.close(); server = null; }
  currentPort = null;
  currentRoot = null;
}
