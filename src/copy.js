// Adds a "Copy address" button beside each [data-copy] address. The page is complete without it.
for (const address of document.querySelectorAll('[data-copy]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy address';
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      button.textContent = 'Copied';
      status.textContent = 'Address copied.';
    } catch {
      getSelection().selectAllChildren(address);
      status.textContent = 'Address selected. Copy it with your keyboard.';
    }
    setTimeout(() => { button.textContent = 'Copy address'; status.textContent = ''; }, 2500);
  });
  address.after(button, status);
}
