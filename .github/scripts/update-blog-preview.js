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
  console.log('N
