import { Page } from "@playwright/test";
import { User, Role, Franchise } from "../src/service/pizzaService";
import { test, expect } from "playwright-test-coverage";


const mockFranchisee: User = {
  id: 'f-123',
  name: 'Frankie Owner',
  email: 'frankie@jwt.com',
  password: 'a',
  roles: [{ role: Role.Franchisee, objectId: 'fran-abc' }], // Role is Franchisee
};

// The franchise data associated with the user
const mockFranchiseData: Franchise[] = [
  {
    id: 'fran-abc',
    name: "Frankie's Pizza Palace",
    stores: [
      { id: 's-001', name: 'Downtown', totalRevenue: 55000 },
      { id: 's-002', name: 'Uptown', totalRevenue: 82000 },
    ],
  },
];

async function franchiseeInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { [mockFranchisee.email!]: mockFranchisee };

  // Authorize login for the franchisee
  await page.route('**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    await route.fulfill({ json: { user: loggedInUser, token: 'franchisee-token' } });
  });

  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(/\/api\/franchise(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: mockFranchiseData });
    }
  });

  await page.goto('/');
}

test('franchisee can view their dashboard with store data', async ({ page }) => {
  await franchiseeInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockFranchisee.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockFranchisee.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'FO' })).toBeVisible();

  const globalNav = page.getByLabel('Global');
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/franchise') && resp.request().method() === 'GET'),
  globalNav.getByRole('link', { name: 'Franchise' }).first().click(),
  ]);
  await page.waitForURL(/.*franchise-dashboard/);

  await expect(page.getByRole('heading', { name: /Frankie's Pizza Palace/i })).toBeVisible();

  await expect(page.getByText('So you want a piece of the pie?')).not.toBeVisible();

  await expect(page.getByText("Frankie's Pizza Palace")).toBeVisible();
  await expect(page.getByText('Downtown')).toBeVisible();
  await expect(page.getByText('Uptown')).toBeVisible();

  await expect(page.getByText('55,000 ₿')).toBeVisible();
  await expect(page.getByText('82,000 ₿')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Create store' })).toBeVisible();
});

test('franchisee sees the marketing page when no franchise exists', async ({ page }) => {
  // Setup with no franchises returned
  await franchiseeInit(page);
  await page.route(/\/api\/franchise(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
    }
  });

  // login and navigate
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockFranchisee.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockFranchisee.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  const globalNav = page.getByLabel('Global');
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/franchise') && resp.request().method() === 'GET'),
    globalNav.getByRole('link', { name: 'Franchise' }).first().click(),
  ]);

  await expect(page.getByRole('heading', { name: 'So you want a piece of the pie?' })).toBeVisible();
  await expect(page.getByText('Call now')).toBeVisible();
});

test('franchisee can open create store form', async ({ page }) => {
  await franchiseeInit(page);
  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockFranchisee.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockFranchisee.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // Navigate to franchise dashboard
  const globalNav = page.getByLabel('Global');
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/franchise') && resp.request().method() === 'GET'),
    globalNav.getByRole('link', { name: 'Franchise' }).first().click(),
  ]);

  // Click Create store
  await page.getByRole('button', { name: 'Create store' }).click();
  await page.waitForURL(/.*create-store/);
  await expect(page.getByPlaceholder('store name')).toBeVisible();
});

test('franchisee can navigate to close store page from dashboard', async ({ page }) => {
  await franchiseeInit(page);
  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockFranchisee.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockFranchisee.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  const globalNav = page.getByLabel('Global');
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/franchise') && resp.request().method() === 'GET'),
    globalNav.getByRole('link', { name: 'Franchise' }).first().click(),
  ]);

  const closeStoreButtons = page.getByRole('button', { name: 'Close' });
  await closeStoreButtons.nth(1).click();
  await page.waitForURL(/.*close-store/);
  await expect(page.getByRole('heading', { name: /Sorry to see you go/i })).toBeVisible();
});