import { test, expect } from "playwright-test-coverage";
import { User, Role, Order } from "../src/service/pizzaService";
import { Page } from "@playwright/test";
import applyDefaultMocks from './helpers/mockRoutes';

const mockDiner: User = { 
  id: '3', 
  name: 'Kai Chen', 
  email: 'd@jwt.com', 
  password: 'a', 
  roles: [{ role: Role.Diner }] 
};

async function basicInit(page: Page) {
  await applyDefaultMocks(page, {
    users: [mockDiner],
    menu: [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ],
    franchises: {
      franchises: [
        { id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }, { id: 5, name: 'Springville' }, { id: 6, name: 'American Fork' }] },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
      ],
    },
    orders: { orders: [] },
  });
}

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('docs page shows API endpoints', async ({ page }) => {
  await page.route('**/api/docs', async (route) => {
    const docs = { endpoints: [{ requiresAuth: false, method: 'GET', path: '/api/health', description: 'Health check', example: 'GET /api/health', response: { ok: true } }] };
    await route.fulfill({ json: docs });
  });

  await page.goto('/docs/service');
  await page.waitForResponse((resp) => resp.url().includes('/api/docs') && resp.status() === 200);
  await expect(page.getByRole('heading', { name: /JWT Pizza API/i })).toBeVisible();
  await expect(page.getByText('GET /api/health')).toBeVisible();
  await expect(page.getByText('Health check')).toBeVisible();
});

test('diner dashboard without orders', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Wait for login to complete (header initials)
  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible({ timeout: 10000 });

  await page.route('**/api/order', async (route) => {
    await route.fulfill({ json: { orders: [] } });
  });
  // Navigate via app nav so client state (user) is preserved
  await page.goto('/diner-dashboard');
  await page.waitForURL(/.*diner-dashboard/);

  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy one' })).toHaveAttribute('href', '/menu');

  await expect(page.getByRole('table')).not.toBeVisible();
});

test('diner dashboard with orders', async ({ page }) => {
const mockOrders: Order[] = [
  {
    id: '101',
    items: [
      { menuId: '1', description: 'Veggie', price: 0.0038 },
      { menuId: '2', description: 'Pepperoni', price: 0.0042 },
    ],
    storeId: '4',
    franchiseId: '2',
    date: new Date('2025-10-03T10:00:00Z').toISOString(),
  },
  {
    id: '102',
    items: [{ menuId: '3', description: 'Margarita', price: 0.001 }],
    storeId: '7',
    franchiseId: '3',
    date: new Date('2025-09-15T18:30:00Z').toISOString(),
  },
];
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({ json: { orders: mockOrders } });
  });

  await page.goto('/diner-dashboard');
  await expect(page.getByText('How have you lived this long without having a pizza?')).not.toBeVisible();

  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row', { name: 'ID Price Date' })).toBeVisible();

  const row1 = page.getByRole('row', { name: /101/ }); 
  await expect(row1).toContainText('101');
  await expect(row1).toContainText('0.008 ₿');
  await expect(row1).toContainText(mockOrders[0].date.toLocaleString());

  const row2 = page.getByRole('row', { name: /102/ });
  await expect(row2).toContainText('102');
  await expect(row2).toContainText('0.001 ₿');
  await expect(row2).toContainText(mockOrders[1].date.toLocaleString());
});

test('about and history and static pages render', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: /Our employees/i })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: /Mama Rucci, my my/i })).toBeVisible();

  await page.goto('/some-random-page-that-does-not-exist');
  await expect(page.getByText(/dropped a pizza on the floor/i)).toBeVisible();
});

test('register and logout pages', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByPlaceholder('Full name')).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();

  await page.route('**/api/auth', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    await route.fallback();
  });
  await page.goto('/logout');
  await page.waitForURL('/');
  await expect(page.getByRole('button', { name: 'Order now' })).toBeVisible();
});