import { test, expect } from 'playwright-test-coverage';
import { Page } from '@playwright/test';
import { User, Role } from '../src/service/pizzaService';
import applyDefaultMocks from './helpers/mockRoutes';

test('updateUser', async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await applyDefaultMocks(page, { users: [], menu: [] });
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
  // change the name in the edit dialog before submitting
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  // wait for success toast and updated main content
  await expect(page.getByRole('status')).toContainText('Profile updated');
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
  await applyDefaultMocks(page, { users: [initialUser], menu: [] });
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

test('payment page renders order from sessionStorage and shows multi-item text', async ({ page }) => {
  const dinerUser: User = { id: 'u-d', name: 'Diner User', email: 'diner@jwt.test', password: 'dpass', roles: [{ role: Role.Diner }] };
  const menu = [
    { id: 'm1', title: 'Margherita', description: 'Cheese', price: 5, image: '' },
    { id: 'm2', title: 'Pepperoni', description: 'Spicy', price: 7, image: '' },
  ];
  const franchises = {
    franchises: [
      { id: 'fr-1', name: 'Test Fran', stores: [{ id: 's-1', name: 'Test Store', totalRevenue: 0 }] },
    ],
  };
  // apply mocks including menu/franchises up front (applyDefaultMocks clears local/session storage)
  await applyDefaultMocks(page, { users: [dinerUser], menu, franchises });

  // login as diner to satisfy getUser check in Payment
  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(dinerUser.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(dinerUser.password!);
  await page.getByRole('button', { name: 'Login' }).click();

  // wait for login to complete and token to be persisted
  await page.waitForFunction(() => !!localStorage.getItem('token'));

    // Instead of directly navigating to /payment, go through the UI: menu -> select store -> add pizzas -> checkout
  await page.goto('/menu');

    // wait for menu items to load and be visible
    await expect(page.getByText('Margherita')).toBeVisible();
    await expect(page.getByText('Pepperoni')).toBeVisible();

    // select the store
    await page.getByRole('combobox').selectOption('s-1');

    // add two pizzas by clicking the card buttons
  await page.getByText('Margherita').click();
  await page.getByText('Pepperoni').click();

  // wait for the menu to show two selected pizzas
  await expect(page.getByText(/Selected pizzas:\s*2/)).toBeVisible();

    // ensure Checkout becomes enabled and then click it, waiting for the navigation to /payment
    const checkoutBtn = page.getByRole('button', { name: 'Checkout' });
    await expect(checkoutBtn).toBeEnabled();
    await Promise.all([
      page.waitForURL(/.*payment/),
      checkoutBtn.click(),
    ]);

});