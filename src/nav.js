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
