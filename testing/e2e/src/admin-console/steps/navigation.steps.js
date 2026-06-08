import { Given, When, Then, expect } from '../../fixtures.js';

let previousColorScheme;

Given('I am logged in as an admin', async ({ loginPage, page, basePath }) => {
  await loginPage.goto();
  const email = process.env.E2E_ADMIN_FINANCE_EMAIL;
  const password = process.env.E2E_ADMIN_FINANCE_PASSWORD;
  if (!email || !password) throw new Error('E2E_ADMIN_FINANCE_EMAIL / E2E_ADMIN_FINANCE_PASSWORD not set');
  await loginPage.login(email, password);
  await page.waitForURL(
    (url) => {
      const path = url.pathname;
      return path === basePath || path === `${basePath}/` || !path.endsWith('/login');
    },
    { timeout: 15_000 }
  );
});

When('I click {string} in the navigation', async ({ layoutPage }, label) => {
  await layoutPage.clickNavItem(label);
});

When('I click the theme button', async ({ layoutPage, page }) => {
  previousColorScheme = await page.locator('html').getAttribute('data-mantine-color-scheme');
  await layoutPage.toggleTheme();
});

Then('I should see a heading {string}', async ({ page }, text) => {
  await page.getByRole('heading', { name: text }).waitFor({ timeout: 10_000 });
});

Then('the page theme should toggle', async ({ page }) => {
  await expect
    .poll(async () => page.locator('html').getAttribute('data-mantine-color-scheme'))
    .not.toBe(previousColorScheme);
});

