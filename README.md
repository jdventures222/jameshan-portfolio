# jameshan.fyt.life

The site of James Han, a freelance software developer in Orange County, California, who builds websites, iPhone apps, automations and restaurant menus: a home page, a services page, a page for restaurant owners, a page for each project (a restaurant menu system and Pressure, an iPhone and Apple Watch app), an About page, a request form and a privacy page.

It is plain HTML and CSS with no framework and no trackers, plus three small scripts, one for the full-screen screenshot viewer, one for the copy-address button and one for the header's Start a project button, the request form's sending state, the live menu and keyboard focus in the picture rows; everything works without them.

## Build

```sh
node build.mjs
```

Node 22 or newer, nothing to install. The build renders every page in `src/`, fills every `{{token}}` from `facts.json`, derives the canonical URL, `robots.txt`, `sitemap.xml` and `CNAME` from the one host in `site.config.json`, checks that every local link and image resolves, and writes `dist/`. GitHub Actions runs the same command and publishes `dist/` to GitHub Pages on every push to `main`.

## Where the numbers come from

The figures about the work (users, posts, ratings, languages, brands) are not typed by hand. Each one lives in `facts.json` next to a note on its source and the date it was read, and is re-checked before a deploy.
