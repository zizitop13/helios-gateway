import { When, Then, expect } from '../../fixtures.js';

const usersTable = page => page.getByRole('table', { name: 'Firebase users' });
const editor = page => page.getByRole('region', { name: 'User roles' });
const assignedRoles = page => editor(page).getByLabel('Assigned roles', { exact: true });

Then('I should see the users preview notice', async ({ page }) => {
  await expect(page.getByText('This page uses sample users.', { exact: false })).toBeVisible();
});

Then('the users list should contain {string}', async ({ page }, email) => {
  await expect(usersTable(page).getByText(email, { exact: true })).toBeVisible();
});

Then('the users list should not contain {string}', async ({ page }, email) => {
  await expect(usersTable(page)).toBeVisible();
  await expect(usersTable(page).getByText(email, { exact: true })).toHaveCount(0);
});

Then('the user {string} should be disabled', async ({ page }, email) => {
  await expect(usersTable(page).getByRole('row').filter({ hasText: email }).getByText('Disabled', { exact: true })).toBeVisible();
});

When('I search users for {string}', async ({ page }, search) => {
  await page.getByLabel('Search users', { exact: true }).fill(search);
});

Then('I should see no matching users', async ({ page }) => {
  await expect(page.getByText('No users found.', { exact: true })).toBeVisible();
});

When('I open the next users page', async ({ page }) => {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
});

When('I open the previous users page', async ({ page }) => {
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
});

When('I manage roles for {string}', async ({ page }, identifier) => {
  await page.getByRole('button', { name: `Manage roles for ${identifier}`, exact: true }).click();
  await expect(editor(page).getByLabel('Roles', { exact: true })).toBeEnabled();
});

Then('the selected user should have role {string}', async ({ page }, role) => {
  await expect(assignedRoles(page).getByText(role, { exact: true })).toBeVisible();
});

Then('the selected user should not have role {string}', async ({ page }, role) => {
  await expect(assignedRoles(page).getByText(role, { exact: true })).toHaveCount(0);
});

Then('I should see no assigned roles', async ({ page }) => {
  await expect(editor(page).getByText('No roles assigned', { exact: true })).toBeVisible();
});

When('I add the role {string}', async ({ page }, role) => {
  const input = editor(page).getByLabel('Roles', { exact: true });
  await input.fill(role);
  await input.press('Enter');
});

When('I remove the role {string}', async ({ page }, role) => {
  await editor(page).locator('.mantine-Pill-root').filter({ hasText: role }).getByRole('button', { includeHidden: true }).click();
});

When('I clear the selected user\'s roles', async ({ page }) => {
  await editor(page).getByRole('button', { name: 'Clear all roles' }).click();
});

When('I save the selected user\'s roles', async ({ page }) => {
  await editor(page).getByRole('button', { name: 'Save roles', exact: true }).click();
});

Then('I should see the roles saved confirmation', async ({ page }) => {
  await expect(editor(page).getByText('Roles updated', { exact: true })).toBeVisible();
});

When('I open the legacy roles bookmark', async ({ page, basePath }) => {
  await page.goto(`${basePath}/roles`);
  await expect(page).toHaveURL(new RegExp(`${basePath}/users$`));
});

When('I open the legacy user bookmark', async ({ page, basePath }) => {
  await page.goto(`${basePath}/user`);
  await expect(page).toHaveURL(new RegExp(`${basePath}/profile$`));
});
