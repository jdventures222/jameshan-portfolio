# jameshan.fyt.life

The one-page site of James Han, a full-stack developer in Orange County, California, who builds apps, websites and automations end to end.

It is plain HTML and CSS with no JavaScript, no framework and no trackers: selected work, services, how a project runs, and how to get in touch.

## Build

```sh
node build.mjs
```

Node 22 or newer, nothing to install. The build reads `src/`, fills every `{{token}}` from `facts.json`, derives the canonical URL, `robots.txt`, `sitemap.xml` and `CNAME` from the one host in `site.config.json`, checks that every local link and image resolves, and writes `dist/`. GitHub Actions runs the same command and publishes `dist/` to GitHub Pages on every push to `main`.

## Where the numbers come from

No number on the page is typed by hand. Each one lives in `facts.json` next to a note on its source and the date it was read, and is re-checked before a deploy.
