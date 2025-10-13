import { Page } from '@playwright/test';
import { User } from '../../src/service/pizzaService';

type Opts = {
  users?: User[];
  franchises?: any;
  menu?: any;
  orders?: any;
  docs?: any;
  usersList?: any;
};

export async function applyDefaultMocks(page: Page, opts: Opts = {}) {
  // Clear any persisted tokens or orders to avoid cross-test state leakage
  await page.evaluate(() => {
    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('jwtp-order');
      // Also clear any other session/local state left by previous tests
      // (safe to call in tests)
      // localStorage.clear(); sessionStorage.clear(); // commented to avoid removing unrelated keys
    } catch (e) {}
  });
  const users = opts.users || [];
  const validUsers: Record<string, User> = {};
  users.forEach((u) => (validUsers[u.email || ''] = { ...u }));

  // Start with no logged in user; tests should explicitly login when needed.
  let loggedInUser: User | undefined = undefined;
  const tokenMap: Record<string, string> = {};

  // auth routes: login (PUT), register (POST), logout (DELETE)
  await page.route('**/api/auth', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'PUT') {
      const body = req.postDataJSON();
      const u = validUsers[body.email];
      if (u && u.password === body.password) {
  loggedInUser = { ...u };
        const token = `tok-${Math.random().toString(36).slice(2, 8)}`;
        tokenMap[token] = loggedInUser.id || '';
        await route.fulfill({ json: { user: loggedInUser, token } });
      } else {
        await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      }
      return;
    }

    if (method === 'POST') {
      const body = req.postDataJSON();
      const newUser: User = { ...body, id: `${Math.floor(Math.random() * 10000)}` };
      validUsers[newUser.email || ''] = newUser;
      loggedInUser = { ...newUser };
      const token = `tok-${Math.random().toString(36).slice(2, 8)}`;
      tokenMap[token] = loggedInUser.id || '';
      await route.fulfill({ json: { user: loggedInUser, token } });
      return;
    }

    if (method === 'DELETE') {
      await route.fulfill({ json: {} });
      return;
    }

    await route.continue();
  });

  // user/me
  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  // update user
  await page.route(/\/api\/user\/[^/]+$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const updated = route.request().postDataJSON();
      // Merge updated fields with existing user to avoid wiping fields like password when not provided
      const existing = loggedInUser || Object.values(validUsers).find((u: any) => u.id === updated.id) || {};
      const merged = { ...existing, ...updated };
      // If password omitted in update (undefined/null/empty), preserve existing password
      if ((!merged.password || merged.password === '') && existing.password) {
        merged.password = existing.password;
      }
      loggedInUser = { ...merged };
      // keep the validUsers map in sync so future logins return the updated user
      try {
        if (loggedInUser && loggedInUser.email) {
          validUsers[loggedInUser.email || ''] = { ...loggedInUser };
        }
      } catch (e) {}
      const token = `tok-${Math.random().toString(36).slice(2, 8)}`;
      await route.fulfill({ json: { user: loggedInUser, token } });
      return;
    }
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: {} });
      return;
    }
    await route.continue();
  });

  // list users
  if (opts.usersList) {
    await page.route('**/api/user*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: opts.usersList });
        return;
      }
      await route.continue();
    });
  }

  // menu
  if (opts.menu) {
    await page.route('**/api/order/menu', async (route) => {
      await route.fulfill({ json: opts.menu });
    });
  }

  // orders
  if (opts.orders) {
    await page.route('**/api/order', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({ json: { order: { ...body, id: Math.floor(Math.random() * 1000) }, jwt: 'fake-jwt' } });
        return;
      }
      await route.fulfill({ json: opts.orders });
    });
  }

  // franchises - accept either an array or an object { franchises: [...] }
  if (opts.franchises) {
    const payload = Array.isArray(opts.franchises) ? { franchises: opts.franchises } : opts.franchises;
    // Match /api/franchise, /api/franchise?..., and /api/franchise/:id
    await page.route(/\/api\/franchise(\/.*|\?.*)?$/, async (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url();
        // If request includes an id (path longer than /api/franchise), return array form for single franchise
        const hasId = /\/api\/franchise\/[^\/?]+/.test(url);
        if (hasId && Array.isArray(payload.franchises)) {
          // find by id; the service expects an array of franchises, so return [found] or []
          const idMatch = url.match(/\/api\/franchise\/([^\/\?]+)/);
          const id = idMatch && idMatch[1];
          const found = payload.franchises.find((f: any) => f.id === id);
          await route.fulfill({ json: found ? [found] : [] });
          return;
        }
        await route.fulfill({ json: payload });
        return;
      }
      await route.continue();
    });
  }

  // docs
  if (opts.docs) {
    await page.route('**/api/docs', async (route) => {
      await route.fulfill({ json: opts.docs });
    });
  }

  await page.goto('/');
}

export default applyDefaultMocks;
