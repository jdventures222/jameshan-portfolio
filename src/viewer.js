// The menu photo viewer's gestures and thumbnail transitions, fitted to portrait screenshots.
// Without JavaScript, each .shot-link still opens its large image directly.
(() => {
  const links = [...document.querySelectorAll('.shot-link')];
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const icon = d => `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"></path></svg></span>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'viewer';
  dialog.setAttribute('aria-label', 'Screenshot viewer');
  dialog.innerHTML = `
    <div class="viewer-bg" aria-hidden="true"></div>
    <div class="viewer-track" tabindex="-1" role="group" aria-label="Screenshots"></div>
    <div class="viewer-chrome">
      <button class="viewer-close" type="button" aria-label="Close">${icon('M6 6l12 12M18 6 6 18')}</button>
      <p class="viewer-count" aria-live="polite" aria-atomic="true"></p>
      <p class="viewer-caption" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const track = $('.viewer-track'), bg = $('.viewer-bg'), chrome = $('.viewer-chrome');
  const caption = $('.viewer-caption'), count = $('.viewer-count');
  const closeButton = $('.viewer-close');
  const pointers = new Map();
  let group = [], index = 0, opener = null, tapped = null, tappedTop = 0, tappedWidth = 0, gesture = null;
  let scale = 1, tx = 0, ty = 0, chromeOn = true, closing = false, closeTimer = 0;
  let tap = null, tapTimer = 0, ownsHistory = false, waitingForBack = false, pendingOpen = null;
  // Focus goes back to the opener with a ring only when the viewer was left from the keyboard.
  let usedKeyboard = false;
  addEventListener('keydown', () => { usedKeyboard = true; }, true);
  addEventListener('pointerdown', () => { usedKeyboard = false; }, true);

  const width = () => track.clientWidth, height = () => track.clientHeight;
  const current = () => group[index];
  const transition = (element, value) => { element.style.transition = reduced.matches ? 'none' : value; };
  const animate = (element, frames, options) => {
    if (!reduced.matches) element.animate(frames, options);
  };
  const settleAnimations = () => {
    for (const element of [bg, chrome, ...group.flatMap(item => [item.figure, item.zoom])]) {
      for (const animation of element.getAnimations()) {
        animation.finish();
        animation.cancel();
      }
    }
  };
  const cancelTap = () => { clearTimeout(tapTimer); tapTimer = 0; tap = null; };
  const releasePointers = () => {
    const ids = [...pointers.keys()];
    pointers.clear();
    gesture = null;
    for (const id of ids) {
      if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
    }
    cancelTap();
  };

  function layout() {
    for (const item of group) {
      const ratio = Math.min(width() / item.w, height() / item.h);
      item.fit = { w: Math.round(item.w * ratio), h: Math.round(item.h * ratio) };
      item.zoom.style.width = `${item.fit.w}px`;
      item.zoom.style.height = `${item.fit.h}px`;
    }
  }
  function loadImages() {
    // Load the current image first, then its immediate neighbours.
    for (const i of [index, index - 1, index + 1]) {
      const item = group[i];
      if (!item) continue;
      item.image.fetchPriority = i === index ? 'high' : 'auto';
      if (!item.image.hasAttribute('src')) item.image.src = item.link.getAttribute('href');
    }
  }
  function setZoom(s, x, y, smooth = false) {
    scale = s; tx = x; ty = y;
    transition(current().zoom, smooth ? 'transform .25s ease-out' : 'none');
    current().zoom.style.transform = s === 1 && !x && !y ? '' : `translate(${x}px, ${y}px) scale(${s})`;
    track.classList.toggle('zoomed', s > 1.01);
  }
  function bounds(s) {
    return { x: Math.max(0, (current().fit.w * s - width()) / 2), y: Math.max(0, (current().fit.h * s - height()) / 2) };
  }
  function placeSlides(smooth = false) {
    group.forEach((item, i) => {
      transition(item.figure, smooth ? 'transform .3s cubic-bezier(.2,.8,.2,1)' : 'none');
      item.figure.style.transform = `translateX(${(i - index) * width()}px)`;
      item.figure.setAttribute('aria-hidden', String(i !== index));
    });
  }
  function setChrome(on) {
    chromeOn = on;
    // Keep keyboard events inside the modal when its buttons become inert.
    if (!on && chrome.contains(document.activeElement)) track.focus({ preventScroll: true });
    chrome.inert = !on;
    chrome.classList.toggle('off', !on);
    transition(chrome, 'opacity .2s ease-in-out');
    chrome.style.opacity = on ? 1 : 0;
  }
  function springBack() {
    transition(current().zoom, 'transform .34s cubic-bezier(.3,1.25,.5,1)');
    current().zoom.style.transform = '';
    transition(bg, 'opacity .3s'); bg.style.opacity = 1;
    transition(chrome, 'opacity .2s'); chrome.style.opacity = chromeOn ? 1 : 0;
  }
  function goTo(i, smooth = true) {
    if (!dialog.open || closing) return;
    settleAnimations();
    releasePointers();
    setZoom(1, 0, 0);
    springBack();
    index = clamp(i, 0, group.length - 1);
    setZoom(1, 0, 0);
    caption.textContent = current().caption;
    count.textContent = `${index + 1} of ${group.length}`;
    loadImages();
    placeSlides(smooth);
  }
  function thumbFrame(item) {
    const rect = item.thumb.getBoundingClientRect(), viewport = track.getBoundingClientRect();
    return {
      rect,
      transform: `translate(${rect.left + rect.width / 2 - viewport.left - width() / 2}px, ${rect.top + rect.height / 2 - viewport.top - height() / 2}px)`,
      radius: getComputedStyle(item.thumb).borderRadius,
    };
  }
  function runPendingOpen() {
    if (waitingForBack || closing || dialog.open || !pendingOpen) return;
    const link = pendingOpen;
    pendingOpen = null;
    open(link);
  }
  function open(link) {
    if (waitingForBack || closing) { pendingOpen = link; return; }
    if (dialog.open) return;
    opener = tapped = link;
    // Where the picture sat on screen, and the screen's width, so closing on it can put the page back exactly there.
    tappedTop = link.getBoundingClientRect().top; tappedWidth = innerWidth;
    group = [...link.closest('.screen-grid').querySelectorAll('.shot-link')].map(anchor => {
      const thumb = anchor.querySelector('img');
      const text = anchor.closest('figure')?.querySelector('figcaption')?.textContent.trim() || thumb.alt;
      const figure = document.createElement('figure'), zoom = document.createElement('div'), image = document.createElement('img');
      figure.className = 'viewer-figure'; zoom.className = 'viewer-zoom'; image.className = 'viewer-image';
      image.alt = thumb.alt || text;
      image.width = Number(thumb.getAttribute('width')) || thumb.naturalWidth;
      image.height = Number(thumb.getAttribute('height')) || thumb.naturalHeight;
      image.draggable = false; image.decoding = 'async';
      zoom.style.backgroundImage = `url(${JSON.stringify(thumb.currentSrc || thumb.src)})`;
      image.addEventListener('load', () => image.classList.add('loaded'));
      zoom.append(image); figure.append(zoom);
      return { link: anchor, thumb, caption: text, w: image.width, h: image.height, figure, zoom, image };
    });
    track.replaceChildren(...group.map(item => item.figure));
    index = group.findIndex(item => item.link === link);
    // The close handler returns focus to the picture last shown. Left focused, the tapped picture would be refocused by
    // the dialog as it closes, and nav.js would scroll its strip back to it.
    document.activeElement?.blur();
    dialog.showModal();
    // Forward can land on an old viewer entry; reuse it rather than stack a second one.
    if (history.state?.viewer) history.replaceState({ viewer: true }, '');
    else history.pushState({ viewer: true }, '');
    ownsHistory = true;
    layout();
    goTo(index, false);
    setChrome(true);
    closeButton.focus({ preventScroll: true });
    bg.style.transition = chrome.style.transition = 'none';
    bg.style.opacity = chrome.style.opacity = 1;
    const item = current(), frame = thumbFrame(item);
    if (reduced.matches || !frame.rect.width) return;
    animate(item.zoom, [
      { width: `${frame.rect.width}px`, height: `${frame.rect.height}px`, transform: frame.transform, borderRadius: frame.radius },
      { width: `${item.fit.w}px`, height: `${item.fit.h}px`, transform: 'none', borderRadius: '0px' },
    ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    animate(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    animate(chrome, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 160, easing: 'ease-in-out', fill: 'backwards' });
  }

  function close(fromPop = false, fling = null) {
    if (fromPop) ownsHistory = false;
    if (!dialog.open || closing) return;
    closing = true;
    settleAnimations();
    releasePointers();
    placeSlides();
    // Come back to the picture on screen: focus returns to it, and a sideways strip brings it fully into view first so
    // the closing animation can land on it, and so keyboard focus has nothing left to scroll. The page scrolls to a
    // picture in a stacked gallery or a later row; the picture that was opened is still on screen, so the page stays
    // put, since scrollIntoView honours the page's 6rem scroll padding and would pull a picture near the top down to it.
    opener = current().link;
    const strip = opener.closest('.screens');
    if (strip && strip.scrollWidth > strip.clientWidth) {
      const a = opener.getBoundingClientRect(), r = strip.getBoundingClientRect();
      if (a.left < r.left || a.right > r.right) strip.scrollLeft += a.left - r.left - (parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0);
    }
    if (!inPlace()) opener.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (reduced.matches) { dialog.close(); return; }
    const item = current(), frame = thumbFrame(item), rect = frame.rect;
    const bgFrom = getComputedStyle(bg).opacity, chromeFrom = getComputedStyle(chrome).opacity;
    bg.style.transition = chrome.style.transition = item.zoom.style.transition = 'none';
    bg.style.opacity = chrome.style.opacity = 0;
    animate(chrome, [{ opacity: chromeFrom }, { opacity: 0 }], { duration: 150 });
    let duration;
    if (fling) {
      const { dx, dy } = fling, d = Math.hypot(dx, dy) || 1;
      duration = 220;
      animate(item.zoom, [
        { transform: item.zoom.style.transform, opacity: 1 },
        { transform: `translate(${dx + dx / d * 190}px, ${dy + dy / d * 190}px) scale(.8)`, opacity: 0 },
      ], { duration, easing: 'ease-out', fill: 'forwards' });
    } else if (rect.width && rect.bottom > 0 && rect.top < height() && rect.right > 0 && rect.left < width() && scale <= 1.01) {
      duration = 280;
      animate(item.zoom, [
        { width: `${item.fit.w}px`, height: `${item.fit.h}px`, transform: 'none', borderRadius: '0px' },
        { width: `${rect.width}px`, height: `${rect.height}px`, transform: frame.transform, borderRadius: frame.radius },
      ], { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    } else {
      duration = 180;
      animate(item.zoom, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    }
    animate(bg, [{ opacity: bgFrom }, { opacity: 0 }], { duration, easing: 'ease-out' });
    closeTimer = setTimeout(() => dialog.close(), duration);
  }
  // The picture that was opened, on a screen as wide as when it was opened and still at least partly on it. Only the
  // width counts: Safari's toolbars grow and shrink the height while the viewer is open, and turning the phone changes
  // the width.
  function inPlace() {
    if (opener !== tapped || innerWidth !== tappedWidth) return false;
    const r = opener.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  // With the viewer closed and the page's own scrolling back, bring the page to the picture last shown: the one that
  // was opened returns to exactly where it sat (a browser with a classic scrollbar reflows the page as its scrollbar
  // leaves and returns, and Chrome does not re-anchor the scroll on the way back); any other scrolls into view, and
  // so does the opened one when the screen has turned, or its old place is now off a shorter screen.
  function settlePage() {
    if (!opener) return;
    if (opener === tapped && innerWidth === tappedWidth) { const off = opener.getBoundingClientRect().top - tappedTop; if (Math.abs(off) > 0.5) scrollBy(0, off); }
    if (!inPlace()) opener.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // One history entry per opening. Queue a rapid reopen until our Back traversal has finished.
  if (history.state?.viewer) history.replaceState(null, '');
  dialog.addEventListener('close', () => {
    clearTimeout(closeTimer);
    releasePointers();
    settleAnimations();
    if (ownsHistory && history.state?.viewer) { waitingForBack = true; history.back(); }
    ownsHistory = false;
    closing = false;
    bg.style.transition = chrome.style.transition = 'none';
    bg.style.opacity = 0; chrome.style.opacity = 1; chrome.inert = false;
    chrome.classList.remove('off'); chromeOn = true;
    track.classList.remove('zoomed');
    if (!pendingOpen) { settlePage(); opener?.focus({ preventScroll: true, focusVisible: usedKeyboard }); }
    runPendingOpen();
  });
  addEventListener('popstate', () => {
    const leaving = waitingForBack || dialog.open;
    waitingForBack = false;
    if (dialog.open) close(true);
    runPendingOpen();
    // Going back restores the page's scroll from when the viewer opened, just after this event; before the next paint,
    // bring the page back to the picture last shown, unless a queued opening has taken over.
    if (leaving) requestAnimationFrame(() => { if (!dialog.open || closing) settlePage(); });
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  closeButton.addEventListener('click', () => close());
  dialog.addEventListener('keydown', event => {
    if (!dialog.open || closing) return;
    cancelTap();
    setChrome(true);
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(index - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(index + 1); }
  });
  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(link);
    });
  }

  function tapAt(x, y) {
    const now = performance.now();
    if (tap && now - tap.time < 300 && Math.hypot(x - tap.x, y - tap.y) < 30) {
      cancelTap();
      if (scale > 1.01) { setZoom(1, 0, 0, true); return; }
      const s = 2.5, viewport = track.getBoundingClientRect(), bd = bounds(s);
      const px = x - viewport.left - width() / 2, py = y - viewport.top - height() / 2;
      setZoom(s, clamp(px - px * s, -bd.x, bd.x), clamp(py - py * s, -bd.y, bd.y), true);
      return;
    }
    cancelTap();
    const rect = current().zoom.getBoundingClientRect();
    if (scale <= 1.01 && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)) { close(); return; }
    tap = { x, y, time: now };
    tapTimer = setTimeout(() => {
      tap = null; tapTimer = 0;
      if (dialog.open && !closing) setChrome(!chromeOn);
    }, 300);
  }
  function startPinch() {
    const [a, b] = [...pointers.values()];
    gesture = { mode: 'pinch', d0: Math.max(distance(a, b), 1), m0: midpoint(a, b), s0: scale, tx0: tx, ty0: ty };
  }
  function velocity(g, now, x, y) {
    g.samples.push([now, x, y]);
    const first = g.samples.find(sample => now - sample[0] <= 100);
    if (!first || now - first[0] < 8) return { x: 0, y: 0 };
    const seconds = (now - first[0]) / 1000;
    return { x: (x - first[1]) / seconds, y: (y - first[2]) / seconds };
  }
  track.addEventListener('pointerdown', event => {
    if (!dialog.open || closing || (event.pointerType === 'mouse' && event.button !== 0) || pointers.size >= 2) return;
    settleAnimations();
    track.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = performance.now();
    if (pointers.size === 1) {
      gesture = { x0: event.clientX, y0: event.clientY, t0: now, tx0: tx, ty0: ty, mode: null, samples: [[now, event.clientX, event.clientY]] };
    } else {
      if (gesture?.mode === 'drag' || gesture?.mode === 'page') springBack();
      cancelTap();
      startPinch();
    }
  });
  track.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture || closing) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture, now = performance.now();
    if (g.mode === 'done') return;
    if (g.mode === 'pinch') {
      const [a, b] = [...pointers.values()], middle = midpoint(a, b), viewport = track.getBoundingClientRect();
      const s = clamp(g.s0 * distance(a, b) / g.d0, 1, 4), bd = bounds(s);
      const cx = (g.m0.x - viewport.left - width() / 2 - g.tx0) / g.s0;
      const cy = (g.m0.y - viewport.top - height() / 2 - g.ty0) / g.s0;
      setZoom(s, clamp(middle.x - viewport.left - width() / 2 - cx * s, -bd.x, bd.x), clamp(middle.y - viewport.top - height() / 2 - cy * s, -bd.y, bd.y));
      return;
    }
    const dx = event.clientX - g.x0, dy = event.clientY - g.y0;
    g.samples.push([now, event.clientX, event.clientY]);
    if (g.samples.length > 8) g.samples.shift();
    if (scale > 1.01) {
      if (!g.mode) { if (Math.hypot(dx, dy) < 6) return; g.mode = 'pan'; cancelTap(); }
      const bd = bounds(scale);
      setZoom(scale, clamp(g.tx0 + dx, -bd.x, bd.x), clamp(g.ty0 + dy, -bd.y, bd.y));
      return;
    }
    if (!g.mode) {
      if (Math.hypot(dx, dy) < 14) return;
      g.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'page' : 'drag';
      cancelTap();
    }
    current().zoom.style.transition = 'none';
    if (g.mode === 'page') current().zoom.style.transform = `translate(${dx}px, 0)`;
    else if (g.mode === 'drag') {
      const d = Math.hypot(dx, dy);
      current().zoom.style.transform = `translate(${dx}px, ${dy}px) scale(${1 - Math.min(d / 1400, .14)})`;
      bg.style.transition = chrome.style.transition = 'none';
      bg.style.opacity = Math.max(1 - d / 420, .4);
      chrome.style.opacity = Math.max(1 - d / 130, 0) * (chromeOn ? 1 : 0);
    }
  });
  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    const g = gesture;
    // Interrupted gestures must never page, dismiss, or count as taps.
    if (event.type !== 'pointerup') {
      releasePointers();
      if (g?.mode === 'drag' || g?.mode === 'page') springBack();
      return;
    }
    pointers.delete(event.pointerId);
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    if (!g) return;
    const now = performance.now();
    if (g.mode === 'pinch') {
      if (scale < 1.01) setZoom(1, 0, 0, true);
      if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        gesture = { x0: p.x, y0: p.y, t0: now, tx0: tx, ty0: ty, mode: scale > 1.01 ? 'pan' : 'done', samples: [] };
      } else gesture = null;
      return;
    }
    gesture = null;
    if (g.mode === 'pan' || g.mode === 'done') return;
    const dx = event.clientX - g.x0, dy = event.clientY - g.y0;
    const v = velocity(g, now, event.clientX, event.clientY);
    if (g.mode === 'page') {
      springBack();
      if (Math.abs(dx) > 48 || Math.abs(dx + v.x * .25) > 220) goTo(index + (dx < 0 ? 1 : -1));
    } else if (g.mode === 'drag') {
      if (Math.hypot(dx, dy) > 60 || Math.hypot(dx + v.x * .25, dy + v.y * .25) > 300) close(false, { dx, dy });
      else springBack();
    } else if (Math.hypot(dx, dy) < 10 && now - g.t0 < 350) tapAt(event.clientX, event.clientY);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) track.addEventListener(type, pointerEnd);
  function refit() {
    if (!dialog.open) return;
    if (closing) { clearTimeout(closeTimer); dialog.close(); return; }
    releasePointers();
    settleAnimations();
    layout();
    setZoom(1, 0, 0);
    placeSlides();
    bg.style.transition = chrome.style.transition = 'none';
    bg.style.opacity = 1; chrome.style.opacity = chromeOn ? 1 : 0;
  }
  addEventListener('resize', refit);
  reduced.addEventListener('change', refit);
})();
