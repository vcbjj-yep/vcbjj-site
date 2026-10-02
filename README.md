# vcbjj.com
VCBJJ Website
Marketing website for VCBJJ — VC Brazilian Jiu-Jitsu, Bangsar, KL.

Deployed via Cloudflare Pages.

## Pages

- `index.html` — Home / landing page
- `info.html` — Is VCBJJ Right For You?
- `about.html` — Coach Vince
- `getstarted.html` — Get Started (onboarding)
- `camps.html` — Camps & Seminars
- `seminar.html` — Priit Mihkelson Seminar (Nov 2026)
- `contact.html` — Register Interest

## Other files

- `llms.txt` — AI agent discovery file
- `robots.txt` — Search engine / crawler directives

## Shared styles

`site.css` holds the design tokens (colours, fonts, widths), reset, nav, footer, sections and buttons used by the public pages. Each page links it before its own `<style>` block, so a page can still override anything. To restyle the site, edit `site.css` first (tokens in `:root`).

Not yet on `site.css` (own layout/fonts, need a manual pass): `assess.html`, `shop.html`, `start.html`, `blog/gear-strip-wash.html`. The roadmap pages use `roadmap-shared.css`.

`site.css` is cached for 5 minutes (see `_headers`), so edits go live quickly.

## Stack

Static HTML/CSS/JS. No frameworks, no build tools.
