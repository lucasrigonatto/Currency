import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

if (typeof structuredClone !== 'function') {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

if (typeof window !== 'undefined' && !window.crypto?.randomUUID) {
  let n = 0;
  Object.defineProperty(window, 'crypto', {
    value: {
      ...(window.crypto || {}),
      randomUUID: () => {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      },
    },
  });
}

afterAll(async () => {
  const { db } = await import('./db');
  if (db.isOpen()) await db.close();
});

