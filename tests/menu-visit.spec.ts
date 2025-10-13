import { test, expect } from 'playwright-test-coverage';
import applyDefaultMocks from './helpers/mockRoutes';

test('menu page basic render', async ({ page }) => {
  const sampleMenu = [
    { id: 'm1', title: 'Margherita', description: 'Classic', image: '', price: 10 },
  ];
  const sampleFranchises = { franchises: [{ id: 'f1', name: 'F1', stores: [{ id: 's1', name: 'Downtown' }] }] };

  await applyDefaultMocks(page, { users: [], menu: sampleMenu, franchises: sampleFranchises });
  await page.route('**/api/order/menu', async (route) => route.fulfill({ json: sampleMenu }));
  await page.route('**/api/franchise*', async (route) => route.fulfill({ json: sampleFranchises }));

  await page.goto('/menu');
  await expect(page.getByText('Pick your store and pizzas', { exact: false })).toBeVisible();
  // Ensure the pizza card is rendered
  await expect(page.getByText('Margherita')).toBeVisible();
});
