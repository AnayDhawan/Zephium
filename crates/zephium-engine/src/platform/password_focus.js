(page => {
  // Runs only in a browser-owned isolated world. Answers '1' once the person
  // puts the caret in a password field by clicking it or tabbing to it, and
  // never reads what any field holds.
  'use strict';
  const STOP = '__zephiumPasswordFocusStop';
  const MAX_DOCUMENTS = 16;
  const INTENT_MS = 1000;
  const TYPING_MS = 1000;
  if (location.href !== page) return Promise.resolve(null);
  return new Promise(resolve => {
    const documents = [];
    let settled = false;
    let intent = null;
    let typedAt = -Infinity;
    const now = () => performance.now();
    const origin = event => event.composedPath()[0] ?? event.target;
    const password = node => node?.localName === 'input' && String(node.type).toLowerCase() === 'password';
    const aims = (node, field) => node === field || node?.closest?.('label')?.control === field;
    const pointer = event => {
      if (event.isTrusted) intent = { node: origin(event), at: now() };
    };
    const keyed = event => {
      if (!event.isTrusted) return;
      if (event.key === 'Tab') {
        intent = now() - typedAt < TYPING_MS ? null : { node: null, at: now() };
      } else if (!event.metaKey && !event.ctrlKey
          && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
        typedAt = now();
        intent = null;
      }
    };
    const focus = event => {
      if (!event.isTrusted) return;
      const field = origin(event);
      const by = intent;
      intent = null;
      if (!by || now() - by.at > INTENT_MS || !password(field)) return;
      if (by.node && !aims(by.node, field)) return;
      finish('1');
    };
    const enter = frame => {
      let inner = null;
      try { inner = frame.contentDocument; } catch {}
      if (inner) attach(inner);
    };
    const loaded = event => {
      const node = event.target;
      if (node?.localName === 'iframe' || node?.localName === 'frame') enter(node);
    };
    const LISTENERS = [['pointerdown', pointer], ['keydown', keyed], ['focusin', focus], ['load', loaded]];
    function attach(doc) {
      if (settled || documents.length >= MAX_DOCUMENTS) return;
      if (documents.some(ref => ref.deref() === doc)) return;
      documents.push(new WeakRef(doc));
      for (const [type, listener] of LISTENERS) doc.addEventListener(type, listener, true);
      for (const frame of doc.querySelectorAll('iframe,frame')) {
        if (documents.length >= MAX_DOCUMENTS) break;
        enter(frame);
      }
    }
    function finish(value) {
      if (settled) return;
      settled = true;
      for (const ref of documents) {
        const doc = ref.deref();
        if (doc) for (const [type, listener] of LISTENERS) doc.removeEventListener(type, listener, true);
      }
      if (globalThis[STOP] === finish) delete globalThis[STOP];
      resolve(value);
    }
    const earlier = globalThis[STOP];
    if (typeof earlier === 'function') earlier(null);
    globalThis[STOP] = finish;
    try { attach(document); } catch { finish(null); }
  });
})
