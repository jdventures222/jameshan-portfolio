// Build dist/ from src/, facts.json and site.config.json. Usage: node build.mjs
// Every .html under src/ (except src/partials/) renders to the same path in dist/.
// Tokens: {{path.in.facts}} or {{path|format}}; {{site.host}} and {{site.url}} come from site.config.json.
// {{include partials/<file>}} inlines a file from src/partials. Every value is HTML-escaped.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, sep, posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');
const read = p => readFileSync(join(root, p), 'utf8');

const config = JSON.parse(read('site.config.json'));
const facts = JSON.parse(read('facts.json'));
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(config.host ?? '')) throw new Error(`site.config.json: bad host "${config.host}"`);
const origin = `https://${config.host}`;
const data = { ...facts, site: { host: config.host, url: `${origin}/` } };

const utc = opts => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isoDate = v => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v))) throw new Error(`"${v}" is not a YYYY-MM-DD date`);
  return new Date(v);
};
const num = v => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${v}" is not a number`);
  return v;
};
const formats = {
  // A date never breaks across lines: "September 21, 2026" is joined by no-break spaces.
  date: v => utc({ month: 'long', day: 'numeric', year: 'numeric' }).format(isoDate(v)).replaceAll(' ', '\u00a0'),
  month: v => utc({ month: 'long', year: 'numeric' }).format(isoDate(v)).replaceAll(' ', '\u00a0'),
  year: v => utc({ year: 'numeric' }).format(isoDate(v)),
  fixed1: v => num(v).toFixed(1),
  usd: v => '$' + num(v).toLocaleString('en-US'),
  count: v => {
    if (!Array.isArray(v)) throw new Error(`"${v}" is not a list`);
    return v.length;
  },
};

// The month under the home heading comes from the build itself (Pacific time): the Pages workflow rebuilds the site on
// the first of each month, and on every push.
data.build = { month: formats.month(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())) };

// Only |count may take a list, and never an empty one.
function lookup(path, fmt) {
  const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
  const list = fmt === 'count' && Array.isArray(v) && v.length > 0;
  if (v == null || v === '' || (typeof v === 'object' && !list)) throw new Error(`no value for {{${path}${fmt ? `|${fmt}` : ''}}}`);
  return v;
}

// The header marks the page the reader is on.
const navCurrent = {
  'about/index.html': ['/about/', 'page'],
};
function markNav(html, file) {
  if (!navCurrent[file]) return html;
  const [href, value] = navCurrent[file], attr = `href="${href}"`;
  const start = html.indexOf('<nav class="wrap nav"'), end = html.indexOf('</nav>', start);
  const nav = html.slice(start, end);
  if (start < 0 || nav.split(attr).length !== 2) throw new Error(`${file}: the header has no single ${attr} to mark as current`);
  return html.slice(0, start) + nav.replace(attr, `${attr} aria-current="${value}"`) + html.slice(end);
}

function render(file) {
  let html = readFileSync(join(src, file), 'utf8');
  data.page = dates[file];
  html = html.replace(/\{\{include (partials\/[\w.-]+)\}\}/g, (_, p) => {
    const part = readFileSync(join(src, p), 'utf8').trim();
    // A QR partial must encode this site, or a printed sheet points at an old host.
    if (p.includes('qr') && !part.includes(`<title>QR code for ${origin}</title>`)) throw new Error(`${p} is not labelled as encoding ${origin}; regenerate the QR code for this host`);
    return part;
  });
  html = markNav(html, file);
  html = html.replace(/\{\{([\w.]+)(?:\|(\w+))?\}\}/g, (_, path, fmt) => {
    if (fmt && !formats[fmt]) throw new Error(`${file}: unknown format |${fmt}`);
    const v = lookup(path, fmt);
    try {
      return escape(fmt ? formats[fmt](v) : v);
    } catch (e) {
      throw new Error(`${file}: {{${path}|${fmt}}}: ${e.message}`);
    }
  });
  if (/\{\{|\}\}/.test(html)) throw new Error(`${file}: unresolved token near "${html.match(/.{0,40}(\{\{|\}\}).{0,40}/)[0]}"`);
  return html;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const skip = s => s.endsWith('.html') || s.startsWith(join(src, 'partials')) || s === join(src, 'styles.css')
  || (s.startsWith(join(src, 'fonts') + sep) && s.endsWith('.css'));
cpSync(src, dist, { recursive: true, filter: s => !skip(s) });

// Page paths use forward slashes: they double as URL paths.
const pages = readdirSync(src, { recursive: true }).map(f => f.split(sep).join('/'))
  .filter(f => f.endsWith('.html') && !f.startsWith('partials/')).sort();
// Each page is dated by its own source file's history: its last commit (the sitemap's lastmod, its feed entry, About's
// dateModified) and its first, renames followed (About's dateCreated). A file git does not know yet is dated now. CI
// checks out the whole history (fetch-depth 0 in pages.yml); a shallow clone would date every page by its newest commit.
const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const now = new Date().toISOString();
const dates = Object.fromEntries(pages.map(f => [f, {
  modified: git(['log', '-1', '--format=%cI', '--', `src/${f}`]) || now,
  created: git(['log', '--follow', '--format=%cI', '--', `src/${f}`]).split('\n').filter(Boolean).at(-1) || now,
}]));
for (const f of pages) {
  mkdirSync(dirname(join(dist, f)), { recursive: true });
  writeFileSync(join(dist, f), render(f));
}

const fontCss = readdirSync(join(src, 'fonts')).filter(f => f.endsWith('.css')).sort()
  .map(f => read(`src/fonts/${f}`).replaceAll('url(./', 'url(fonts/'));
writeFileSync(join(dist, 'styles.css'), [...fontCss, read('src/styles.css')].join('\n'));

writeFileSync(join(dist, 'CNAME'), `${config.host}\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/feed.xml\n`);
const pageUrl = f => `${origin}/${f.replace(/(^|\/)index\.html$/, '$1')}`;
// A page's title and description, as rendered (already HTML-escaped, which XML reads the same way).
const head = f => { const html = readFileSync(join(dist, f), 'utf8'); return { title: html.match(/<title>([^<]*)<\/title>/)[1], summary: html.match(/<meta name="description" content="([^"]*)">/)[1] }; };
const listed = pages.filter(f => !['404.html', 'request/thanks/index.html', 'request/error/index.html', 'work/fyt/index.html'].includes(f))
  .map(f => ({ url: pageUrl(f), updated: dates[f].modified, ...head(f) })).sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map(p => `  <url><loc>${p.url}</loc><lastmod>${p.updated}</lastmod></url>`).join('\n')}
</urlset>
`);
// An Atom feed of the same pages, for the engines that take one (Google's account-free route, told of changes through
// the WebSub hub): each entry is a page's title and description under the date of its last change, newest first.
const newest = [...listed].sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
writeFileSync(join(dist, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escape(facts.person.name)}</title>
  <subtitle>${head('index.html').summary}</subtitle>
  <id>${origin}/</id>
  <link rel="self" type="application/atom+xml" href="${origin}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${origin}/"/>
  <link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
  <updated>${newest[0].updated}</updated>
  <author><name>${escape(facts.person.name)}</name><uri>${origin}/</uri></author>
${newest.map(p => `  <entry>
    <title>${p.title}</title>
    <id>${p.url}</id>
    <link rel="alternate" type="text/html" href="${p.url}"/>
    <updated>${p.updated}</updated>
    <summary>${p.summary}</summary>
  </entry>`).join('\n')}
</feed>
`);

// Every local reference must resolve inside dist/ (root-absolute from dist/, relative from the page's own folder;
// a folder must hold an index.html), and every #fragment must name an id on the page it points at.
const missing = [];
const ids = new Map(pages.map(f => [f, new Set([...readFileSync(join(dist, f), 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));
for (const f of pages) {
  const html = readFileSync(join(dist, f), 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)=(["'])([^"']+)\1/g)].map(m => m[2])
    .concat([...html.matchAll(/\ssrcset=(["'])([^"']+)\1/g)].flatMap(m => m[2].split(',').map(c => c.trim().split(/\s+/)[0])));
  for (const r of refs) {
    if (/^(https?:|mailto:|data:)/.test(r)) continue;
    const path = r.split(/[?#]/)[0], fragment = r.includes('#') ? r.slice(r.indexOf('#') + 1) : '';
    let target = f;
    if (path) {
      target = posix.normalize(path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(f), path));
      if (target.startsWith('..') || !existsSync(join(dist, target))) { missing.push(`${f}: ${r}`); continue; }
      if (statSync(join(dist, target)).isDirectory()) target = posix.join(target, 'index.html');
      if (!existsSync(join(dist, target))) { missing.push(`${f}: ${r}`); continue; }
    }
    if (fragment && ids.has(target) && !ids.get(target).has(fragment)) missing.push(`${f}: ${r}`);
  }
}
for (const u of read('dist/styles.css').matchAll(/url\(([^)]+)\)/g)) {
  if (!existsSync(join(dist, u[1].replace(/['"]/g, '')))) missing.push(`styles.css: ${u[1]}`);
}
if (missing.length) throw new Error(`missing local references:\n  ${missing.join('\n  ')}`);

const files = readdirSync(dist, { recursive: true, withFileTypes: true }).filter(d => d.isFile());
console.log(`built ${relative(root, dist)}/ for ${origin}: ${pages.join(', ')} and ${files.length} files in total`);
