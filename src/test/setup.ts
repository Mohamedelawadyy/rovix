import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// Integration tests load lazy routes and several mocked requests; under a full parallel run the
// default 1s for findBy*/waitFor is too tight. Assertions are unchanged, only the wait.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no <dialog> modal API. Minimal stand-in: real browsers provide focus trapping and
// the inert background; tests only need open/close state and the close event.
if (typeof HTMLDialogElement !== 'undefined' && !('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

// Any request without a handler fails the test, so no test silently hits a real network.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
