// Adds a "Copy address" button beside each [data-copy] address. The page is complete without it.
for (const address of document.querySelectorAll('[data-copy]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy address';
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  let reset, attempt = 0;
  button.addEventListener('click', async () => {
    const current = ++attempt;
    clearTimeout(reset);
    status.className = 'visually-hidden';
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      if (current !== attempt) return;
      button.textContent = 'Copied';
      status.textContent = 'Address copied.';
      reset = setTimeout(() => { button.textContent = 'Copy address'; status.textContent = ''; }, 2500);
    } catch {
      if (current !== attempt) return;
      getSelection().selectAllChildren(address);
      button.textContent = 'Try copying again';
      status.className = 'copy-status';
      status.textContent = 'Couldn’t copy. Select the address and copy it.';
    }
  });
  address.after(button, status);
}
