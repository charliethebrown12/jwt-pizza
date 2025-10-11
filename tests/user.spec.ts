import { test, expect } from 'playwright-test-coverage';
import { Page } from '@playwright/test';
import { User, Role } from '../src/service/pizzaService';

test('updateUser', async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

// Helper to mock auth and user update endpoints for UI-driven update tests
async function setupUpdateRoutes(page: Page, initialUser: User) {
  let loggedInUser: User | undefined = { ...initialUser };

  // Handle auth (login/logout)
  await page.route('**/api/auth', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'PUT') {
      const body = req.postDataJSON();
      if (loggedInUser && body.email === loggedInUser.email && body.password === loggedInUser.password) {
        await route.fulfill({ json: { user: loggedInUser, token: 'tok-1' } });
      } else {
        await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      }
      return;
    }

    if (method === 'POST') {
      // registration - accept and return created user
      const body = route.request().postDataJSON();
      loggedInUser = { ...body, id: `${Math.floor(Math.random() * 10000)}` };
      await route.fulfill({ json: { user: loggedInUser, token: 'tok-reg' } });
      return;
    }

    if (method === 'DELETE') {
      // logout - do not remove the user record, only clear session in a real server.
      // Keep `loggedInUser` so tests can re-login with updated credentials.
      await route.fulfill({ json: {} });
      return;
    }
  });

  // Provide current user
  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  // Accept user updates
  await page.route(/\/api\/user\/.+$/, async (route) => {
    if (route.request().method() === 'PUT') {
      const updated = route.request().postDataJSON();
      loggedInUser = { ...updated };
      await route.fulfill({ json: { user: loggedInUser, token: 'tok-updated' } });
      return;
    }
    await route.continue();
  });

  // Minimal menu to avoid unrelated failures
  await page.route('**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.goto('/');
}

test('updateUser works when logged in as Admin role', async ({ page }) => {
  const adminUser: User = { id: 'u-admin', name: 'Admin User', email: 'admin@jwt.test', password: 'adminpass', roles: [{ role: Role.Admin }] };
  await setupUpdateRoutes(page, adminUser);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(adminUser.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(adminUser.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/diner-dashboard');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');

  await page.getByRole('textbox').first().fill('Admin Person Updated');
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('Admin Person Updated');
});

test('updateUser works when logged in as Franchisee role', async ({ page }) => {
  const franUser: User = { id: 'u-fran', name: 'Fran User', email: 'fran@jwt.test', password: 'franpass', roles: [{ role: Role.Franchisee, objectId: 'fr-1' }] };
  await setupUpdateRoutes(page, franUser);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(franUser.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(franUser.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/diner-dashboard');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');

  await page.getByRole('textbox').first().fill('Fran Updated');
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('Fran Updated');
});