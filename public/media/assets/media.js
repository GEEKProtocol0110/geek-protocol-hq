(() => {
  for (const button of document.querySelectorAll('[data-media-copy]')) {
    const target = document.querySelector(`#${button.dataset.mediaCopy}`);
    if (!target || !target.value) continue;
    const status = button.closest('[data-media-copy-group]')?.querySelector('[data-media-copy-status]');
    button.hidden = false;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      if (status) status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(target.value);
        if (status) status.textContent = `${button.dataset.mediaLabel} copied.`;
      } catch {
        target.focus();
        target.select();
        target.setSelectionRange?.(0, target.value.length);
        if (status) status.textContent = 'Text selected. Use your device’s Copy command.';
      } finally {
        button.disabled = false;
      }
    });
  }
})();
