import { Given, When, Then, expect } from '../../fixtures.js';

Given('I open the admin console login page', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.page.getByRole('heading', { name: 'Admin Console Login' }).waitFor();
});

When('I login as an admin user', async ({ loginPage }) => {
  const email = process.env.E2E_ADMIN_FINANCE_EMAIL;
  const password = process.env.E2E_ADMIN_FINANCE_PASSWORD;
  if (!email || !password) throw new Error('E2E_ADMIN_FINANCE_EMAIL / E2E_ADMIN_FINANCE_PASSWORD not set');
  await loginPage.login(email, password);
});

When('I enter email {string} and password {string}', async ({ loginPage }, email, password) => {
  await loginPage.emailInput.fill(email);
  await loginPage.passwordInput.fill(password);
});

When('I click the login button', async ({ loginPage }) => {
  await loginPage.submitButton.click();
});

Then('I should see the admin dashboard', async ({ page, basePath }) => {
  await page.waitForURL((url) => {
    const path = url.pathname;
    return path === basePath || path === `${basePath}/` || path.endsWith('/');
  }, { timeout: 15_000 });
  await page.getByRole('heading', { name: 'Admin Console' }).waitFor();
});

Then('I should see a login error', async ({ page }) => {
  await page.getByText('Login failed').waitFor({ timeout: 10_000 });
});

Then('the login button should be disabled', async ({ loginPage }) => {
  await expect(loginPage.submitButton).toBeDisabled();
});

