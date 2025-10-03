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

  // Mock the endpoint that the Admin Dashboard calls to get the list of franchises
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { franchises: mockAllFranchises } });
    }
  });

  await page.goto('/');
}

test('admin can view the list of all franchises', async ({ page }) => {
  // --- ARRANGE & ACT #1: Log the user in ---
  await adminInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // --- ASSERT #1: Verify login was successful ---
  await expect(page.getByRole('link', { name: 'AM' })).toBeVisible();

  // --- ACT #2: Navigate to the admin dashboard ---
  await page.goto('/admin-dashboard'); // Assuming this is the correct URL

  // --- ASSERT #2: Verify the dashboard content ---
  // Check for a heading and the table
  await expect(page.getByRole('heading', { name: /Franchise Management/i })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();

  // Verify the data for the first franchise is in the table
  const row1 = page.getByRole('row', { name: /Frankie's Pizza Palace/i });
  await expect(row1).toBeVisible();
  await expect(row1).toContainText('2 stores'); // Example assertion

  // Verify the data for the second franchise is in the table
  const row2 = page.getByRole('row', { name: /Pizza Pocket/i });
  await expect(row2).toBeVisible();
  await expect(row2).toContainText('1 stores'); // Example assertion
});