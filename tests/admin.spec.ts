import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role, Franchise } from "../src/service/pizzaService";

const mockAdmin: User = {
  id: 'a-001',
  name: 'Addy Min',
  email: 'a@jwt.com',
  password: 'admin',
  roles: [{ role: Role.Admin }],
};

// Mock data for a list of all franchises an admin might see
const mockAllFranchises: Franchise[] = [
  {
    id: 'fran-abc',
    name: "Frankie's Pizza Palace",
    stores: [
      { id: 's-001', name: 'Downtown', totalRevenue: 55000 },
      { id: 's-002', name: 'Uptown', totalRevenue: 82000 },
    ],
  },
  {
    id: 'fran-xyz',
    name: 'Pizza Pocket',
    stores: [{ id: 's-003', name: 'Lehi', totalRevenue: 120000 }],
  },
];

async function adminInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { [mockAdmin.email!]: mockAdmin };

  // Authorize login for the admin
  await page.route('**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    await route.fulfill({ json: { user: loggedInUser, token: 'admin-token' } });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { franchises: mockAllFranchises } });
    }
  });

  await page.goto('/');
}

test('admin can view the list of all franchises', async ({ page }) => {
  await adminInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'AM' })).toBeVisible();

  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  await expect(page.getByRole('heading', { name: /Franchises/i })).toBeVisible();

  await expect(page.getByText("Frankie's Pizza Palace")).toBeVisible();
  await expect(page.getByText('Pizza Pocket')).toBeVisible();

  await expect(page.getByText('Downtown')).toBeVisible();
  await expect(page.getByText('Uptown')).toBeVisible();
  await expect(page.getByText('Lehi')).toBeVisible();
});

test('admin can navigate to create franchise page', async ({ page }) => {
  await adminInit(page);
  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // go to admin dashboard and click Add Franchise
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.waitForURL(/.*create-franchise/);

  // Confirm the create franchise form exists
  await expect(page.getByPlaceholder('franchise name')).toBeVisible();
  await expect(page.getByPlaceholder('franchisee admin email')).toBeVisible();
});

test('admin can navigate to close franchise and close store pages', async ({ page }) => {
  await adminInit(page);
  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // go to admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  const closeButtons = page.getByRole('button', { name: 'Close' });
  await closeButtons.first().click();
  await page.waitForURL(/.*close-franchise/);
  await expect(page.getByRole('heading', { name: /Sorry to see you go/i })).toBeVisible();

  await page.goBack();
  await page.waitForURL(/.*admin-dashboard/);
  await closeButtons.nth(1).click();
  await page.waitForURL(/.*close-store/);
  await expect(page.getByRole('heading', { name: /Sorry to see you go/i })).toBeVisible();
});