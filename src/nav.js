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

// The request form sends once: while the request is on its way the button reads "Sending…" at its own width, keeps its
// pressed colour and ignores further presses. pageshow clears that, because the error page sends people Back to this form; so does a load that never
// arrives (stopped, or offline) after 10 s.
{
  const form = document.querySelector('.request-form'), send = form?.querySelector('[type="submit"]'), label = send?.textContent;
  let timer = 0;
  const ready = () => {
    clearTimeout(timer); form.removeAttribute('aria-busy'); send.removeAttribute('aria-disabled');
    send.textContent = label; send.style.minWidth = '';
  };
  form?.addEventListener('submit', event => {
    if (form.hasAttribute('aria-busy')) { event.preventDefault(); return; }
    form.setAttribute('aria-busy', 'true');
    send.setAttribute('aria-disabled', 'true');
    send.style.minWidth = `min(${send.offsetWidth}px, 100%)`; send.textContent = 'Sending…';
    timer = setTimeout(ready, 10000);
  });
  if (form) addEventListener('pageshow', ready);
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

// The live menu (James, 2026-09-30): one brand's menu itself, in a phone-sized frame that loads only when asked for. On
// a larger screen it opens in the page, where the page scrolls around it; on a small one (under 600 px either way) it
// fills the screen and the page underneath holds still. Escape closes it, except while a key goes to the menu inside
// the frame. Without JavaScript the link opens the menu in a new tab.
{
  const holder = document.querySelector('.live-menu'), link = holder?.querySelector('a');
  if (link && typeof HTMLDialogElement === 'function') {
    const open = document.createElement('button'), dialog = document.createElement('dialog');
    open.type = 'button'; open.className = holder.dataset.button || 'button'; open.textContent = 'Try one brand’s live menu';
    open.setAttribute('aria-haspopup', 'dialog');
    dialog.className = 'live-frame';
    dialog.setAttribute('aria-labelledby', 'live-frame-title');
    dialog.innerHTML = '<div class="live-frame-bar"><p id="live-frame-title">One brand’s live menu</p><button class="button" type="button">Close</button></div>';
    const close = dialog.querySelector('button'), small = matchMedia('(max-width: 37.4375em), (max-height: 37.4375em)');
    holder.replaceChildren(open, dialog);
    open.addEventListener('click', () => {
      if (!dialog.querySelector('iframe')) {
        const frame = document.createElement('iframe');
        frame.className = 'screen'; frame.title = 'One brand’s live menu'; frame.src = link.href;
        dialog.append(frame);
      }
      open.hidden = true;
      if (small.matches) dialog.showModal();
      else { dialog.show(); dialog.scrollIntoView({ block: 'nearest' }); }
      close.focus({ preventScroll: true });
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.matches(':modal')) dialog.close(); });
    dialog.addEventListener('close', () => { open.hidden = false; open.focus(); });
  }
}
