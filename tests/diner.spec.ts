import { test, expect } from "playwright-test-coverage";
import { User, Role, Order } from "../src/service/pizzaService";
import { Page } from "@playwright/test";

const mockDiner: User = { 
  id: '3', 
  name: 'Kai Chen', 
  email: 'd@jwt.com', 
  password: 'a', 
  roles: [{ role: Role.Diner }] 
};

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { 'd@jwt.com': mockDiner };

  // Authorize login for the given user
  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: 'abcdef',
    };
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ json: loginRes });
  });

  // Return the currently logged in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: 'LotaPizza',
          stores: [
            { id: 4, name: 'Lehi' },
            { id: 5, name: 'Springville' },
            { id: 6, name: 'American Fork' },
          ],
        },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
      ],
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  // Order a pizza.
  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  await page.goto('/');
}

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('diner dashboard without orders', async ({ page }) => {
  basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  // 2. Mock the API to return an empty order history
  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({ json: { orders: [] } });
  });
  await page.goto('/diner-dashboard');
  await expect(page.getByText(mockDiner.name!)).toBeVisible();
  await expect(page.getByText(mockDiner.email!)).toBeVisible();

  // Check for the "no orders" message and link
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy one' })).toHaveAttribute('href', '/menu');

  // Ensure the order table is NOT there
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
  basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  // 2. Mock the API to return an empty order history
  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({ json: { orders: mockOrders } });
  });

  await page.goto('/diner-dashboard');
  await expect(page.getByText('How have you lived this long without having a pizza?')).not.toBeVisible();

  // Check that the table and its header are visible
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row', { name: 'ID Price Date' })).toBeVisible();

  // Verify the content of the first order
  const row1 = page.getByRole('row', { name: /101/ }); // Find row by order ID
  await expect(row1).toContainText('101');
  await expect(row1).toContainText('0.008 ₿'); // 0.0038 + 0.0042 = 0.008
  await expect(row1).toContainText(mockOrders[0].date.toLocaleString());

  // Verify the content of the second order
  const row2 = page.getByRole('row', { name: /102/ });
  await expect(row2).toContainText('102');
  await expect(row2).toContainText('0.001 ₿');
  await expect(row2).toContainText(mockOrders[1].date.toLocaleString());
});