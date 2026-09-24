// Full-screen viewer for the gallery screenshots. Without this script each screenshot is a plain link to its
// large image, so nothing depends on it.
(() => {
  const links = [...document.querySelectorAll('.shot-link')];
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  const icon = d => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}"></path></svg>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'viewer';
  dialog.setAttribute('aria-label', 'Screenshot viewer');
  dialog.innerHTML = `
    <p class="viewer-count" aria-live="polite"></p>
    <button class="viewer-close" type="button" aria-label="Close">${icon('M6 6l12 12M18 6 6 18')}</button>
    <button class="viewer-step viewer-prev" type="button" aria-label="Previous screenshot">${icon('m15 5-7 7 7 7')}</button>
    <figure class="viewer-figure"><img class="viewer-image" alt="" width="1170" height="2532"><figcaption class="viewer-caption"></figcaption></figure>
    <button class="viewer-step viewer-next" type="button" aria-label="Next screenshot">${icon('m9 5 7 7-7 7')}</button>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  const image = $('.viewer-image'), caption = $('.viewer-caption'), count = $('.viewer-count');
  const prev = $('.viewer-prev'), next = $('.viewer-next');
  let group = [], index = 0, opener = null;

  const show = i => {
    index = Math.max(0, Math.min(group.length - 1, i));
    const link = group[index];
    image.src = link.getAttribute('href');
    const thumb = link.querySelector('img');
    image.alt = thumb.alt;
    image.width = Number(thumb.getAttribute('width'));
    image.height = Number(thumb.getAttribute('height'));
    caption.textContent = link.closest('figure').querySelector('figcaption')?.textContent ?? '';
    count.textContent = `${index + 1} of ${group.length}`;
    prev.disabled = index === 0;
    next.disabled = index === group.length - 1;
  };

  // One history entry while the viewer is open, so a phone's Back gesture closes it.
  if (history.state?.viewer) history.replaceState(null, '');
  const open = link => {
    group = [...link.closest('.screen-grid').querySelectorAll('.shot-link')];
    opener = link;
    show(group.indexOf(link));
    dialog.showModal();
    history.pushState({ viewer: true }, '');
  };
  dialog.addEventListener('close', () => {
    if (history.state?.viewer) history.back();
    image.removeAttribute('src');
    opener?.focus();
  });
  addEventListener('popstate', () => { if (dialog.open) dialog.close(); });

  for (const link of links) {
    link.addEventListener('click', e => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(link);
    });
  }
  $('.viewer-close').addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  // A tap outside the screenshot closes; a sideways swipe moves between screenshots; a downward swipe closes.
  dialog.addEventListener('click', e => { if (e.target === dialog || e.target.classList.contains('viewer-figure')) dialog.close(); });
  let start = null;
  dialog.addEventListener('pointerdown', e => { if (!e.target.closest('button')) start = { x: e.clientX, y: e.clientY }; });
  dialog.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    else if (dy > 80 && dy > Math.abs(dx)) dialog.close();
  });
})();
