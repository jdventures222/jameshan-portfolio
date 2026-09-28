// Keyboard focus in a sideways row brings the whole card or picture into view, where browsers leave it half off the
// row's edge. A click or tap leaves the row where it is.
addEventListener('focusin', event => {
  const item = event.target.closest('.offer > li, .screens > *'), row = item?.parentElement;
  if (!item || !event.target.matches(':focus-visible') || row.scrollWidth <= row.clientWidth) return;
  const a = item.getBoundingClientRect(), r = row.getBoundingClientRect();
  if (a.left < r.left || a.right > r.right) item.scrollIntoView({ block: 'nearest', inline: 'start' });
});
// Fyt's home picture row is a Tab stop only while it scrolls sideways (below 64em); on desktop it holds nothing to reach.
for (const row of document.querySelectorAll('.band.shots[tabindex]')) {
  new ResizeObserver(() => { row.tabIndex = row.scrollWidth > row.clientWidth ? 0 : -1; }).observe(row);
}

// Shows the header's "Start a project" once the page's title and its own "Start a project" buttons are out of sight,
// the way the menus' bar shows their logo. Without JavaScript the header keeps the name and About only.
(() => {
  const header = document.querySelector('.site-header');
  const cta = header?.querySelector('.nav-cta');
  if (!cta || location.pathname.startsWith('/request/') || typeof IntersectionObserver !== 'function') return;
  const targets = [document.querySelector('main h1'), ...document.querySelectorAll('main a.button[href="/request/"]')].filter(Boolean);
  const inSight = new Set();
  // Anything under the sticky header counts as out of sight.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.isIntersecting ? inSight.add(entry.target) : inSight.delete(entry.target);
    header.classList.toggle('scrolled', !inSight.size);
  }, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` });
  for (const target of targets) observer.observe(target);
})();
