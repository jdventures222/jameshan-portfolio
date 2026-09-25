# jameshan.fyt.life

The site of James Han, a full-stack developer in Orange County, California, who builds and maintains iOS apps, websites and business automations: a home page, a page for each project (a restaurant menu system and Fyt, an iPhone and Apple Watch app) and an About page.

It is plain HTML and CSS with no framework and no trackers, plus two small scripts, one for the full-screen screenshot viewer and one for the copy-address button; everything works without them.

## Build

```sh
node build.mjs
```

Node 22 or newer, nothing to install. The build renders every page in `src/`, fills every `{{token}}` from `facts.json`, derives the canonical URL, `robots.txt`, `sitemap.xml` and `CNAME` from the one host in `site.config.json`, checks that every local link and image resolves, and writes `dist/`. GitHub Actions runs the same command and publishes `dist/` to GitHub Pages on every push to `main`.

## Where the numbers come from

No number on the page is typed by hand. Each one lives in `facts.json` next to a note on its source and the date it was read, and is re-checked before a deploy.
