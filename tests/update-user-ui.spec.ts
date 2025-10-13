import { test, expect } from 'playwright-test-coverage';
import applyDefaultMocks from './helpers/mockRoutes';
import { User } from '../src/service/pizzaService';

test('diner profile update shows saving and success', async ({ page }) => {
  const email = `ux${Math.floor(Math.random() * 10000)}@jwt.com`;
  const user: User = { id: 'u-ux', name: 'UX Person', email, password: 'pass', roles: [{ role: 'diner' as any }] };
  await applyDefaultMocks(page, { users: [user], menu: [] });

  await page.goto('/');
  // login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('pass');
  await page.getByRole('button', { name: 'Login' }).click();

  // go to profile - wait for header to show initials after login
  const initials = (user.name || '').split(' ').length > 1 ? (user.name || '').split(' ')[0].charAt(0) + (user.name || '').split(' ').slice(-1)[0].charAt(0) : (user.name || '').charAt(0);
  await expect(page.getByRole('link', { name: initials })).toBeVisible();
  await page.getByRole('link', { name: initials }).click();
  await expect(page.getByRole('main')).toContainText('UX Person');

  // open edit
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');

  // change name and submit
  await page.getByRole('textbox').first().fill('UX Person Updated');
  await page.getByRole('button', { name: 'Update' }).click();

  // wait for success toast and updated main content
  await page.waitForSelector('[role="status"]', { timeout: 5000 });
  await expect(page.getByRole('status')).toContainText('Profile updated');

  // dialog should close and main should show updated name
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
  await expect(page.getByRole('main')).toContainText('UX Person Updated');
});
