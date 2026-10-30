import { h } from './dom.js';
import { tr } from '../i18n/i18n.js';

/** Centered accessible dialog. buttons: [{ label, primary, onClick }]. */
let modalId = 0;

export function showModal(root, { title, body, buttons = [{ label: tr('Tamam'), primary: true }], onClose, className = '' }) {
  const id = ++modalId;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.removeEventListener('keydown', onKeydown);
    overlay.remove();
    onClose?.();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const dialog = h(`div.modal${className ? `.${className}` : ''}`, {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': `modal-title-${id}`,
    'aria-describedby': `modal-body-${id}`,
    tabindex: '-1',
  },
    h('h2', { id: `modal-title-${id}` }, title),
    body instanceof Node
      ? h('div.modal-body', { id: `modal-body-${id}` }, body)
      : h('div.modal-body', { id: `modal-body-${id}`, html: body }),
    h('div.modal-actions',
      ...buttons.map((b) => h(`button.btn${b.primary ? '.primary' : ''}${b.danger ? '.danger' : ''}`, {
        onclick: () => { close(); b.onClick?.(); },
      }, b.label)),
    ),
  );
  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
      event.preventDefault();
      first.focus();
    }
  }
  const overlay = h('div.modal-overlay',
    dialog,
  );
  root.append(overlay);
  dialog.addEventListener('keydown', onKeydown);
  (dialog.querySelector('button:not(:disabled)') ?? dialog).focus();
  return close;
}
