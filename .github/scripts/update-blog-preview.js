// update-blog-preview.js
// On every push to blog/** on main:
//   1. Reads all blog/*.html post files for date, title, excerpt, image, href
//   2. Sorts newest-first
//   3. Rewrites the blog-preview-grid in index.html (homepage, 3 cards)
//   4. Rewrites the post-list in blog/index.html (full listing)
//
// Each blog post HTML must include:
//   <meta name="blog:date"    content="YYYY-MM-DD">
//   <meta name="blog:title"   content="Post title">
//   <meta name="blog:excerpt" content="One-line summary">
//   <meta name="blog:image"   content="/blog/images/filename.jpg">
//   <meta name="blog:tags"    content="Tag One, Tag Two">
//   <meta property="og:url"   content="https://vcbjj.com/blog/slug.html">

var fs   = require('fs');
var path = require('path');

var BLOG_DIR   = path.join(__dirname, '..', '..', 'blog');
var HOMEPAGE   = path.join(__dirname, '..', '..', 'index.html');
var BLOG_INDEX = path.join(BLOG_DIR, 'index.html');

if (!fs.existsSync(BLOG_DIR)) {
  console.log('No blog/ directory found.');
  process.exit(0);
}

var entries  = fs.readdirSync(BLOG_DIR);
var postFiles = [];

entries.forEach(function(name) {
  var full = path.join(BLOG_DIR, name);
  if (name === 'index.html') return;
  if (fs.statSync(full).isFile() && name.endsWith('.html')) {
    postFiles.push({ filePath: full, name: name });
  }
});

function getMeta(html, attr) {
  var p1 = new RegExp('<meta[^>]+(?:name|property)=["\']' + attr + '["\'][^>]+content=["\']([^"\']+)["\']', 'i');
  var p2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\']' + attr + '["\']', 'i');
  var m  = html.match(p1) || html.match(p2);
  return m ? m[1].trim() : null;
}

function getTitle(html) {
  var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/ \| VCBJJ$/, '').replace(/ - VCBJJ$/, '').trim();
}

function getFirstBodyImage(html) {
  // Strip nav/header section to avoid logo
  var bodyStart = html.indexOf('<body');
  if (bodyStart === -1) bodyStart = 0;
  var bodyHtml = html.slice(bodyStart);
  // Skip past the nav block (first ~500 chars usually covers it)
  var mainStart = bodyHtml.search(/<main|<article|<section class="post|<div class="post/i);
  if (mainStart > 0) bodyHtml = bodyHtml.slice(mainStart);
  var m = bodyHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!m) return null;
  var src = m[1].trim();
  // Skip logo/asset images
  if (/assets\/|VCBJJ-circle/i.test(src)) return null;
  return src;
}

function getHref(html, name) {
  var ogUrl = getMeta(html, 'og:url');
  if (ogUrl) {
    var m = ogUrl.match(/\/blog\/(.+)/);
    if (m) return '/blog/' + m[1];
  }
  return '/blog/' + name;
}

var posts = [];

postFiles.forEach(function(entry) {
  var html = fs.readFileSync(entry.filePath, 'utf8');
  var date = getMeta(html, 'blog:date') ||
             (getMeta(html, 'article:published_time') || '').slice(0, 10) || null;
  if (!date) {
    console.warn('SKIP (no blog:date): ' + entry.name);
    return;
  }
  posts.push({
    date:    date,
    title:   getMeta(html, 'blog:title')   || getTitle(html) || entry.name,
    excerpt: getMeta(html, 'blog:excerpt') || '',
    image:   getMeta(html, 'blog:image')   || getMeta(html, 'og:image') || getFirstBodyImage(html) || '',
    tags:    (getMeta(html, 'blog:tags')   || '').split(',').map(function(t){ return t.trim(); }).filter(Boolean),
    href:    getHref(html, entry.name)
  });
});

if (posts.length === 0) {
  console.log('No parseable posts found.');
  process.exit(0);
}

posts.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
console.log('All posts (' + posts.length + '), newest first:');
posts.forEach(function(p) { console.log('  ' + p.date + '  ' + p.href); });

function safe(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function displayDate(iso) {
  var p = iso.split('-').map(Number);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return p[2] + ' ' + months[p[1]-1] + ' ' + p[0];
}

function extractBlock(html, marker) {
  var start = html.indexOf(marker);
  if (start === -1) return null;
  var openDiv = html.lastIndexOf('<div', start);
  if (openDiv === -1) return null;
  var pos = openDiv, depth = 0;
  while (pos < html.length) {
    var no = html.indexOf('<div', pos);
    var nc = html.indexOf('</div>', pos);
    if (no !== -1 && (nc === -1 || no < nc)) { depth++; pos = no + 4; }
    else if (nc !== -1) {
      depth--; pos = nc + 6;
      if (depth === 0) return { start: openDiv, end: pos };
    } else break;
  }
  return null;
}

var latest3 = posts.slice(0, 3);
var cards   = latest3.map(function(p) {
  return '      <a href="' + p.href + '" style="display:block;padding:18px;background:var(--surface);border:1px solid var(--border);border-radius:6px">\n' +
         '        <div style="font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">' + displayDate(p.date) + '</div>\n' +
         '        <div style="font-size:14px;line-height:1.4;color:var(--text)">' + safe(p.title) + '</div>\n' +
         '      </a>';
}).join('\n');

var newGrid = '    <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;max-width:680px" class="blog-preview-grid">\n' +
              cards + '\n    </div>';

if (fs.existsSync(HOMEPAGE)) {
  var hp    = fs.readFileSync(HOMEPAGE, 'utf8');
  var block = extractBlock(hp, 'class="blog-preview-grid"');
  if (block) {
    hp = hp.slice(0, block.start) + newGrid + hp.slice(block.end);
    fs.writeFileSync(HOMEPAGE, hp, 'utf8');
    console.log('OK: index.html homepage preview updated.');
  } else {
    console.error('ERROR: blog-preview-grid not found in index.html.');
  }
}

if (!fs.existsSync(BLOG_INDEX)) {
  console.log('blog/index.html not found — skipping.');
  process.exit(0);
}

function buildFeaturedCard(p) {
  var imgEl = p.image
    ? '      <a href="' + p.href + '" class="post-card-img-link"><img class="post-card-img" src="' + p.image + '" alt="' + safe(p.title) + '" loading="lazy"></a>'
    : '      <a href="' + p.href + '" class="post-card-img-link"><div class="post-card-img-placeholder"><span>Still Rolling</span></div></a>';
  var tagsEl = p.tags.length
    ? p.tags.map(function(t){ return '<span class="tag">' + safe(t) + '</span>'; }).join('')
    : '';
  return '    <!-- Post ' + posts.length + ' — Featured (newest) -->\n' +
         '    <article class="post-card featured">\n' +
         imgEl + '\n' +
         '      <div class="post-card-body">\n' +
         '        <div class="post-card-date">' + displayDate(p.date) + '</div>\n' +
         '        <h2 class="post-card-title"><a href="' + p.href + '">' + safe(p.title) + '</a></h2>\n' +
         (p.excerpt ? '        <p class="post-card-excerpt">' + safe(p.excerpt) + '</p>\n' : '') +
         '        <div class="post-card-footer">\n' +
         '          <div class="post-card-tags">' + tagsEl + '</div>\n' +
         '          <a href="' + p.href + '" class="post-card-read">Read &rarr;</a>\n' +
         '        </div>\n' +
         '      </div>\n' +
         '    </article>';
}

function buildRegularCard(p) {
  var imgEl = p.image
    ? '      <a href="' + p.href + '" class="post-card-img-link"><img class="post-card-img" src="' + p.image + '" alt="' + safe(p.title) + '" loading="lazy"></a>'
    : '      <a href="' + p.href + '" class="post-card-img-link"><div class="post-card-img-placeholder"><span>Still Rolling</span></div></a>';
  var tagsEl = p.tags.length
    ? p.tags.map(function(t){ return '<span class="tag">' + safe(t) + '</span>'; }).join('')
    : '';
  return '    <article class="post-card">\n' +
         imgEl + '\n' +
         '      <div class="post-card-body">\n' +
         '        <div class="post-card-date">' + displayDate(p.date) + '</div>\n' +
         '        <h2 class="post-card-title"><a href="' + p.href + '">' + safe(p.title) + '</a></h2>\n' +
         (p.excerpt ? '        <p class="post-card-excerpt">' + safe(p.excerpt) + '</p>\n' : '') +
         '        <div class="post-card-footer">\n' +
         '          <div class="post-card-tags">' + tagsEl + '</div>\n' +
         '          <a href="' + p.href + '" class="post-card-read">Read &rarr;</a>\n' +
         '        </div>\n' +
         '      </div>\n' +
         '    </article>';
}

var articleBlocks = posts.map(function(p, i) {
  return i === 0 ? buildFeaturedCard(p) : buildRegularCard(p);
}).join('\n\n');

var newPostList =
  '    <!-- AUTO-GENERATED: do not edit between these comments -->\n' +
  articleBlocks + '\n' +
  '    <!-- /AUTO-GENERATED -->';

var bi = fs.readFileSync(BLOG_INDEX, 'utf8');

var markerStart = '<!-- AUTO-GENERATED: do not edit between these comments -->';
var markerEnd   = '<!-- /AUTO-GENERATED -->';

if (bi.indexOf(markerStart) !== -1 && bi.indexOf(markerEnd) !== -1) {
  bi = bi.slice(0, bi.indexOf(markerStart)) + newPostList + bi.slice(bi.indexOf(markerEnd) + markerEnd.length);
} else {
  var dividerIdx = bi.indexOf('<!-- 2026 -->');
  if (dividerIdx === -1) dividerIdx = bi.indexOf('<div class="year-divider"');
  var postListInnerClose = bi.lastIndexOf('</div>', bi.indexOf('</main>'));
  if (dividerIdx !== -1 && postListInnerClose !== -1) {
    bi = bi.slice(0, dividerIdx) +
         '    <div class="year-divider">2026</div>\n\n' +
         newPostList + '\n\n  ' +
         bi.slice(postListInnerClose);
  } else {
    console.error('ERROR: Could not locate post list anchor in blog/index.html');
    process.exit(1);
  }
}

fs.writeFileSync(BLOG_INDEX, bi, 'utf8');
console.log('OK: blog/index.html post list updated (' + posts.length + ' posts).');
