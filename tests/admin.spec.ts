import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role, Franchise } from "../src/service/pizzaService";
import applyDefaultMocks from './helpers/mockRoutes';

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
  await applyDefaultMocks(page, { users: [mockAdmin], franchises: { franchises: mockAllFranchises } });
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

test('admin can view user list and delete a user', async ({ page }) => {
  // prepare admin and mock users
  const mockUsers = [
    { id: 'u1', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
    { id: 'u2', name: 'Buddy', email: 'b@jwt.com', roles: [{ role: Role.Admin }] },
  ];

  let loggedInUser: User | undefined = mockAdmin;

  await applyDefaultMocks(page, { users: [mockAdmin], usersList: { users: mockUsers, more: false } });

  await page.goto('/');

  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // go to admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  // wait for users section to render
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible();
  // users should be visible
  await expect(page.getByText('Kai Chen')).toBeVisible();
  await expect(page.getByText('Buddy')).toBeVisible();

  // delete the first user
  const deleteButtons = page.getByRole('button', { name: 'Delete' });
  page.on('dialog', (dialog) => dialog.accept());
  await deleteButtons.first().click();

  // after delete, deleted user should be removed from the list
  await expect(page.getByText('Kai Chen')).not.toBeVisible();
});

test('admin delete user failure refreshes list', async ({ page }) => {
  const mockUsers = [
    { id: 'u1', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
    { id: 'u2', name: 'Buddy', email: 'b@jwt.com', roles: [{ role: Role.Admin }] },
  ];

  await applyDefaultMocks(page, { users: [mockAdmin], usersList: { users: mockUsers, more: false } });

  // Intercept DELETE to simulate server failure; allow other methods to continue to existing mocks
  await page.route('**/api/user/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 500, json: { message: 'Server error' } });
      return;
    }
    await route.continue();
  });

  await page.goto('/');

  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockAdmin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(mockAdmin.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // go to admin dashboard
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL(/.*admin-dashboard/);

  // ensure users are visible
  await expect(page.getByText('Kai Chen')).toBeVisible();

  // delete the first user but server will fail; accept confirmation
  const deleteButtons = page.getByRole('button', { name: 'Delete' });
  page.on('dialog', (dialog) => dialog.accept());
  await deleteButtons.first().click();

  // because delete failed, the component should refresh the list from the server and the user should still be visible
  await expect(page.getByText('Kai Chen')).toBeVisible();
});