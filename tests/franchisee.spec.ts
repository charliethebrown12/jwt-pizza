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

  // Return the currently logged in user
  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      // The dashboard expects an array of franchises for the logged-in user.
      await route.fulfill({ json: mockFranchiseData });
    }
  });

  await page.goto('/');
}

test('franchisee can view their dashboard with store data', async ({ page }) => {
  // --- ARRANGE & ACT #1: Log the user in ---
  await franchiseeInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockFranchisee.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockFranchisee.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // --- ASSERT #1: Verify login was successful (e.g., by checking for user initials) ---
  await expect(page.getByRole('link', { name: 'FO' })).toBeVisible();

  // --- ACT #2: Navigate to the franchisee dashboard ---
  await page.goto('/franchise-dashboard');

  // --- ASSERT #2: Verify the dashboard content ---
  // Check that the correct franchise name is the page title
  await expect(page.getByRole('heading', { name: "Frankie's Pizza Palace" })).toBeVisible();

  // Ensure the "no franchise" message is NOT visible
  await expect(page.getByText('So you want a piece of the pie?')).not.toBeVisible();

  // Find the table and check its contents
  const table = page.getByRole('table');
  await expect(table).toBeVisible();

  // Check the first store's data
  const row1 = page.getByRole('row', { name: /Downtown/i });
  await expect(row1).toBeVisible();
  await expect(row1).toContainText('55,000 ₿');

  // Check the second store's data
  const row2 = page.getByRole('row', { name: /Uptown/i });
  await expect(row2).toBeVisible();
  await expect(row2).toContainText('82,000 ₿');

  // Check for the "Create store" button
  await expect(page.getByRole('button', { name: 'Create store' })).toBeVisible();
});