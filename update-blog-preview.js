// update-blog-preview.js
// Reads blog posts from two structures:
//   1. Flat files:  blog/slug.html
//   2. Directories: blog/slug/index.html
// Extracts title + date, sorts newest-first, takes 3,
// rewrites the blog preview grid in index.html.

var fs   = require('fs');
var path = require('path');

var BLOG_DIR   = path.join(__dirname, '..', '..', 'blog');
var INDEX_FILE = path.join(__dirname, '..', '..', 'index.html');

if (!fs.existsSync(BLOG_DIR)) {
  console.log('No blog/ directory found.');
  process.exit(0);
}

var entries = fs.readdirSync(BLOG_DIR);
var postFiles = []; // { filePath, slug, href }

entries.forEach(function(name) {
  var full = path.join(BLOG_DIR, name);
  var stat = fs.statSync(full);

  if (stat.isDirectory()) {
    var idx = path.join(full, 'index.html');
    if (fs.existsSync(idx)) {
      postFiles.push({ filePath: idx, slug: name, href: 'blog/' + name + '/' });
    }
  } else if (name.endsWith('.html') && name !== 'index.html') {
    var slug = name.replace(/\.html$/, '');
    postFiles.push({ filePath: full, slug: slug, href: 'blog/' + name });
  }
});

if (postFiles.length === 0) {
  console.log('No blog post files found.');
  process.exit(0);
}

function extractMeta(html, attrName) {
  var patterns = [
    new RegExp('<meta[^>]+(?:name|property)=["\']' + attrName + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'),
    new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\']' + attrName + '["\']', 'i')
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (m) return m[1].trim();
  }
  return null;
}

function extractTitle(html) {
  var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/ \| VCBJJ$/, '').replace(/ - VCBJJ$/, '').trim();
}

function formatDisplayDate(isoDate) {
  var parts  = isoDate.split('-').map(Number);
  var y = parts[0], mo = parts[1], d = parts[2];
  var months = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];
  return d + ' ' + months[mo - 1] + ' ' + y;
}

// Extract blog-preview-grid block by counting div depth
function extractGridBlock(html) {
  var marker = 'class="blog-preview-grid"';
  var start  = html.indexOf(marker);
  if (start === -1) return null;

  var openDiv = html.lastIndexOf('<div', start);
  if (openDiv === -1) return null;

  var pos   = openDiv;
  var depth = 0;
  while (pos < html.length) {
    var nextOpen  = html.indexOf('<div', pos);
    var nextClose = html.indexOf('</div>', pos);

    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      depth++;
      pos = nextOpen + 4;
    } else if (nextClose !== -1) {
      depth--;
      pos = nextClose + 6;
      if (depth === 0) {
        return { start: openDiv, end: pos };
      }
    } else {
      break;
    }
  }
  return null;
}

var posts = [];

postFiles.forEach(function(entry) {
  var html = fs.readFileSync(entry.filePath, 'utf8');

  var date = extractMeta(html, 'blog:date');
  if (!date) {
    var pub = extractMeta(html, 'article:published_time');
    if (pub) date = pub.slice(0, 10);
  }

  if (!date) {
    console.warn('WARNING: Skipping ' + entry.slug + ' — no blog:date meta tag.');
    return;
  }

  var title = extractMeta(html, 'blog:title') || extractTitle(html) || entry.slug;

  // If og:url is present, use it to derive the href (most reliable)
  var ogUrl = extractMeta(html, 'og:url');
  var href  = entry.href;
  if (ogUrl) {
    var m = ogUrl.match(/\/blog\/(.+)/);
    if (m) href = 'blog/' + m[1];
  }

  posts.push({ date: date, title: title, href: href });
});

if (posts.length === 0) {
  console.log('No parseable posts. Each post needs a blog:date meta tag.');
  process.exit(0);
}

posts.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
var latest = posts.slice(0, 3);

console.log('Latest 3 posts:');
latest.forEach(function(p) { console.log('  ' + p.date + '  ' + p.href); });

function buildCard(p) {
  var display   = formatDisplayDate(p.date);
  var safeTitle = p.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '      <a href="' + p.href + '" style="display:block;padding:18px;background:var(--surface);border:1px solid var(--border);border-radius:6px">\n' +
         '        <div style="font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">' + display + '</div>\n' +
         '        <div style="font-size:14px;line-height:1.4;color:var(--text)">' + safeTitle + '</div>\n' +
         '      </a>';
}

var cards   = latest.map(buildCard).join('\n');
var newGrid = '    <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;max-width:680px" class="blog-preview-grid">\n' +
              cards + '\n' +
              '    </div>';

var indexHtml = fs.readFileSync(INDEX_FILE, 'utf8');
var found     = extractGridBlock(indexHtml);

if (!found) {
  console.error('ERROR: blog-preview-grid not found in index.html. Aborting.');
  process.exit(1);
}

indexHtml = indexHtml.slice(0, found.start) + newGrid + indexHtml.slice(found.end);
fs.writeFileSync(INDEX_FILE, indexHtml, 'utf8');
console.log('Done: index.html blog preview updated.');
