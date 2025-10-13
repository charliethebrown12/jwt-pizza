import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role } from "../src/service/pizzaService";
import applyDefaultMocks from './helpers/mockRoutes';

const mockAdmin: User = {
  id: 'a-001',
  name: 'Addy Min',
  email: 'a@jwt.com',
  password: 'admin',
  roles: [{ role: Role.Admin }],
};

async function adminLogin(page: Page) {
  // ensure default mocks and then login through UI
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('link', { name: 'AM' })).toBeVisible();
}

test('admin can filter users by name', async ({ page }) => {
  // prepare mocks but we'll override user list responses to simulate filtering
  await applyDefaultMocks(page, { users: [mockAdmin] });

  // route responses for user list depend on the `name` query param
  await page.route('**/api/user*', async (route) => {
    const url = route.request().url();
    const nameParam = /[?&]name=([^&]*)/.exec(url);

    const allUsers = [
      { id: 'u1', name: 'Alice Wonderland', email: 'alice@jwt.com', roles: [{ role: Role.Diner }] },
      { id: 'u2', name: 'Bob Builder', email: 'bob@jwt.com', roles: [{ role: Role.Diner }] },
      { id: 'u3', name: 'Carol', email: 'carol@jwt.com', roles: [{ role: Role.Admin }] },
    ];

    // default: return all users
    let users = allUsers;
    if (nameParam && nameParam[1]) {
      // name filter arrives wrapped in '*' e.g. *Ali*
      const raw = decodeURIComponent(nameParam[1]);
      const filter = raw.replace(/\*/g, '').toLowerCase();
      users = allUsers.filter((u) => (u.name || '').toLowerCase().includes(filter));
    }

    await route.fulfill({ json: { users, more: false } });
  });

  // go to app and login
  await page.goto('/');
  await adminLogin(page);

  // open admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible();

  // Ensure all users visible initially
  await expect(page.getByText('Alice Wonderland')).toBeVisible();
  await expect(page.getByText('Bob Builder')).toBeVisible();
  await expect(page.getByText('Carol', { exact: true })).toBeVisible();

  // Type filter for Alice and submit
  await page.getByPlaceholder('Filter users by name').fill('Alice');
  await page.getByRole('button', { name: 'Submit' }).nth(1).click();

  // Only Alice should remain
  await expect(page.getByText('Alice Wonderland')).toBeVisible();
  await expect(page.getByText('Bob Builder')).not.toBeVisible();
  await expect(page.getByText('Carol', { exact: true })).not.toBeVisible();
});

test('admin can paginate users list', async ({ page }) => {
  await applyDefaultMocks(page, { users: [mockAdmin] });

  // Serve different payloads depending on page query param
  await page.route('**/api/user*', async (route) => {
    const url = route.request().url();
    const pageParam = /[?&]page=(\d+)/.exec(url);
    const p = pageParam ? Number(pageParam[1]) : 0;

    if (p === 0) {
      await route.fulfill({ json: { users: [{ id: 'p0u1', name: 'Page0 User', email: 'p0@jwt' }], more: true } });
      return;
    }
    // page 1
    await route.fulfill({ json: { users: [{ id: 'p1u1', name: 'Page1 User', email: 'p1@jwt' }], more: false } });
  });

  await page.goto('/');
  await adminLogin(page);

  // open admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  // initial page should show Page0 User and next enabled
  await expect(page.getByText('Page0 User')).toBeVisible();
  const nextButton = page.getByRole('button', { name: '»' }).nth(1); // second pagination row for users
  const prevButton = page.getByRole('button', { name: '«' }).nth(1);
  await expect(nextButton).toBeEnabled();
  await expect(prevButton).toBeDisabled();

  // click next -> page 1
  await nextButton.click();
  await expect(page.getByText('Page1 User')).toBeVisible();
  await expect(nextButton).toBeDisabled();
  await expect(prevButton).toBeEnabled();

  // click prev -> back to page 0
  await prevButton.click();
  await expect(page.getByText('Page0 User')).toBeVisible();
});

export {};