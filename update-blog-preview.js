// update-blog-preview.js
// Reads all blog/*/index.html files, extracts title + date, sorts newest-first,
// takes the 3 most recent, and rewrites the blog preview grid in index.html.
//
// Triggered by GitHub Action on push to blog/** on main branch.
//
// Each blog post index.html must include:
//   <meta name="blog:date"  content="YYYY-MM-DD">
//   <meta name="blog:title" content="Post title">
//   <meta property="og:url" content="https://vcbjj.com/blog/SLUG/">

var fs   = require('fs');
var path = require('path');

var BLOG_DIR   = path.join(__dirname, '..', '..', 'blog');
var INDEX_FILE = path.join(__dirname, '..', '..', 'index.html');

if (!fs.existsSync(BLOG_DIR)) {
  console.log('No blog/ directory found.');
  process.exit(0);
}

var slugDirs = fs.readdirSync(BLOG_DIR).filter(function(name) {
  var full = path.join(BLOG_DIR, name);
  return fs.statSync(full).isDirectory() &&
         fs.existsSync(path.join(full, 'index.html'));
});

if (slugDirs.length === 0) {
  console.log('No blog post directories found.');
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

function extractSlug(html, dirName) {
  var ogUrl = extractMeta(html, 'og:url');
  if (ogUrl) {
    var m = ogUrl.match(/\/blog\/([^/]+)\//);
    if (m) return m[1];
  }
  return dirName;
}

function formatDisplayDate(isoDate) {
  var parts  = isoDate.split('-').map(Number);
  var y = parts[0], mo = parts[1], d = parts[2];
  var months = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];
  return d + ' ' + months[mo - 1] + ' ' + y;
}

// Extract the blog-preview-grid block by counting div depth
function extractGridBlock(html) {
  var marker = 'class="blog-preview-grid"';
  var start  = html.indexOf(marker);
  if (start === -1) return null;

  // Walk back to the opening <div
  var openDiv = html.lastIndexOf('<div', start);
  if (openDiv === -1) return null;

  // Now walk forward counting open/close divs until depth returns to 0
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
        return { start: openDiv, end: pos, block: html.slice(openDiv, pos) };
      }
    } else {
      break; // malformed
    }
  }
  return null;
}

var posts = [];

for (var i = 0; i < slugDirs.length; i++) {
  var slug = slugDirs[i];
  var html = fs.readFileSync(path.join(BLOG_DIR, slug, 'index.html'), 'utf8');

  var date = extractMeta(html, 'blog:date');
  if (!date) {
    var pub = extractMeta(html, 'article:published_time');
    if (pub) date = pub.slice(0, 10);
  }

  if (!date) {
    console.warn('WARNING: Skipping ' + slug + ' — no blog:date meta tag.');
    continue;
  }

  var title = extractMeta(html, 'blog:title') || extractTitle(html) || slug;
  var resolvedSlug = extractSlug(html, slug);

  posts.push({ date: date, title: title, slug: resolvedSlug });
}

if (posts.length === 0) {
  console.log('No parseable posts. Each post needs a blog:date meta tag.');
  process.exit(0);
}

posts.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
var latest = posts.slice(0, 3);

console.log('Latest 3 posts:');
latest.forEach(function(p) { console.log('  ' + p.date + '  /' + p.slug + '/'); });

function buildCard(p) {
  var display   = formatDisplayDate(p.date);
  var safeTitle = p.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '      <a href="blog/' + p.slug + '/" style="display:block;padding:18px;background:var(--surface);border:1px solid var(--border);border-radius:6px">\n' +
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
