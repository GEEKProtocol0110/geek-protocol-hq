import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const origin = 'https://www.geekprotocol.xyz';
const decode = text => text.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([a-f\d]+));/gi, (match, dec, hex) => dec || hex ? String.fromCodePoint(parseInt(dec || hex, hex ? 16 : 10)) : ({ '&amp;':'&', '&quot;':'"', '&apos;':"'", '&#39;':"'", '&lt;':'<', '&gt;':'>' })[match.toLowerCase()] || match);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3])]));
const htmlFiles = folder => readdirSync(folder, { withFileTypes:true }).flatMap(e => e.isDirectory() ? htmlFiles(`${folder}/${e.name}`) : e.name.endsWith('.html') ? [`${folder}/${e.name}`] : []);
const managed = new Set(['description','robots','theme-color', 'og:type','og:site_name','og:title','og:description','og:url','og:locale','og:image','og:image:alt','og:image:type','og:image:width','og:image:height','twitter:card','twitter:site','twitter:title','twitter:description','twitter:image','twitter:image:alt']);

export function metadataFor(page, config) {
  const meta = (key, value) => `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escape(value)}" />`;
  const lines = [`<title>${escape(page.title)}</title>`, meta('description',page.description),meta('theme-color','#080b0b'),meta('robots',page.index ? 'index,follow' : page.private ? 'noindex,nofollow' : 'noindex,follow'),'<link rel="icon" type="image/png" href="/assets/geek-protocol-logo.png" />'];
  if (!page.private) {
    const image = page.image || config.image, alt = page.imageAlt || config.imageAlt;
    const wide = (page.imageWidth || config.imageWidth) / (page.imageHeight || config.imageHeight) > 1.5;
    lines.push(`<link rel="canonical" href="${origin}${page.path}" />`, meta('og:type','website'),meta('og:site_name',config.siteName),meta('og:locale','en_US'),meta('og:title',page.title),meta('og:description',page.description),meta('og:url',origin+page.path),meta('og:image',origin+image),meta('og:image:type','image/png'),meta('og:image:width',page.imageWidth || config.imageWidth),meta('og:image:height',page.imageHeight || config.imageHeight),meta('og:image:alt',alt),meta('twitter:card',wide ? 'summary_large_image' : 'summary'),meta('twitter:site',config.socialHandle),meta('twitter:title',page.title),meta('twitter:description',page.description),meta('twitter:image',origin+image),meta('twitter:image:alt',alt));
  }
  return `<!-- site-metadata:start -->\n    ${lines.join('\n    ')}\n    <!-- site-metadata:end -->`;
}

export function renderMetadata(html, page, config) {
  return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
    head = head.replace(/<!-- site-metadata:(?:start|end) -->/g,'').replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'')
      .replace(/<meta\b[^>]*>/gi, tag => managed.has(attrs(tag).name || attrs(tag).property) ? '' : tag)
      .replace(/<link\b[^>]*>/gi, tag => ['canonical','icon'].includes(attrs(tag).rel) ? '' : tag);
    // Remove only blank lines left by the managed fields. Keep scripts/styles in order.
    head = head.replace(/^[ \t]*\r?\n/gm,'');
    assert.match(head, /<meta\b[^>]*charset\s*=/i, page.file);
    return head.replace(/(<meta\b[^>]*charset\s*=[^>]*>)\s*/i, (_, tag) => `${tag}\n    ${metadataFor(page, config)}\n    `);
  });
}

export function checkSitePages({ write = false } = {}) {
  const config = JSON.parse(readFileSync('docs/site-pages.json','utf8'));
  assert.equal(config.origin,origin);
  const files = [...htmlFiles('public'),...htmlFiles('server/ops-ui')].sort();
  assert.deepEqual(config.pages.map(p => p.file).sort(),files,'Every HTML page needs a metadata record');
  assert.equal(new Set(config.pages.map(p => p.path)).size,config.pages.length);
  const routes = new Map(config.pages.map(p => [p.path,p]));
  let localLinks = 0, externalLinks = 0;
  const outputs = new Map();
  for (const page of config.pages) {
    assert.match(page.path,/^\/(?:[a-z0-9-]+\/)*$/);
    assert.ok(page.title.trim() && page.description.trim().length >= 40, page.file);
    if (page.file.startsWith('server/') || page.path === '/ops-login/') assert.ok(page.private && !page.index);
    const image = page.image || config.image;
    assert.ok(existsSync(`public${image}`),'Share image must be a local asset');
    const input = readFileSync(page.file,'utf8'), html = renderMetadata(input,page,config);
    assert.equal(renderMetadata(html,page,config),html,'Metadata generation must be idempotent');
    outputs.set(page.file,html);
  }
  for (const [file,html] of outputs) {
    const page = config.pages.find(p => p.file === file);
    for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
      const a = attrs(match[0]); if (!a.href || /^(?:mailto:|tel:)/i.test(a.href)) continue;
      assert.ok(!/^(?:javascript|data):/i.test(a.href),`Unsafe link in ${file}`);
      const u = new URL(a.href,origin+page.path);
      if (![origin,'https://geekprotocol.xyz'].includes(u.origin)) { externalLinks++; continue; }
      const route = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
      const target = resolve('public',decodeURIComponent(u.pathname).replace(/^\//,''));
      assert.ok(!relative(resolve('public'),target).startsWith('..'),file);
      const targetPage = routes.get(route);
      assert.ok(targetPage || existsSync(target) || u.pathname.startsWith('/api/') || u.pathname.startsWith('/moderate'),`Broken internal link: ${file} -> ${a.href}`);
      if (u.hash && targetPage) {
        const targetHtml = outputs.get(targetPage.file);
        const ids = [...targetHtml.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => decode(m[1]));
        assert.ok(ids.includes(decodeURIComponent(u.hash.slice(1))),`Missing fragment: ${file} -> ${a.href}`);
      }
      localLinks++;
    }
  }
  const indexed = config.pages.filter(p => p.index);
  outputs.set('public/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+indexed.map(p=>`  <url><loc>${origin}${p.path}</loc></url>`).join('\n')+'\n</urlset>\n');
  outputs.set('public/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ops/\n\nSitemap: ${origin}/sitemap.xml\n`);
  for (const [file,content] of outputs) {
    if (write) writeFileSync(file,content);
    else assert.equal(readFileSync(file,'utf8'),content,`Stale metadata/sitemap: ${file}; run npm run site:write`);
  }
  return { pages:config.pages.length,publicPages:config.pages.filter(p=>p.file.startsWith('public/')).length,indexed:indexed.length,localLinks,externalLinks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(checkSitePages({ write:process.argv.includes('--write') })));
