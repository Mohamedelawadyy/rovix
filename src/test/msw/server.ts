import { setupServer } from 'msw/node';

/** Shared MSW server for tests. Add handlers per test with `server.use(...)`. */
export const server = setupServer();
