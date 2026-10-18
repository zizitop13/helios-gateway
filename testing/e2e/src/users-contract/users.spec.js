import { test, expect } from '@playwright/test';
import { LoginPage } from '../admin-console/pages/login.page.js';

const aliceUid = 'firebase:alice/one';
const alice = { uid: aliceUid, email: 'alice@example.test', displayName: 'Alice', provider: 'firebase', disabled: false };
const bob = { uid: 'bob', email: 'bob@example.test', displayName: 'Bob', provider: 'firebase', disabled: false };
const usersTable = page => page.getByRole('table', { name: 'Firebase users' });
const editor = page => page.getByRole('region', { name: 'User roles' });
const assignedRoles = page => editor(page).getByLabel('Assigned roles', { exact: true });
const select = (page, email) => page.getByRole('button', { name: `Manage roles for ${email}`, exact: true }).click();
const save = page => editor(page).getByRole('button', { name: 'Save roles', exact: true });

let requests;
let roles;
test.beforeEach(async ({ page }) => {
  requests = [];
  roles = { [aliceUid]: ['viewer'], bob: ['staff', 'support'] };
  await page.route('**/admin/api/roles', route => route.fulfill({ json: { roles: ['viewer', 'staff', 'support'] } }));
  await page.route('**/admin/api/users**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ url, method: request.method(), authorization: request.headers().authorization });
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      requests.at(-1).payload = payload;
      roles[payload.uid] = payload.roles;
      return route.fulfill({ json: { status: 'ok', assigned: { uid: payload.uid, roles: payload.roles }, note: 'Refresh the user token for changes to take effect.' } });
    }
    const match = url.pathname.match(/^\/admin\/api\/users\/(.+)\/roles$/u);
    if (match) {
      const uid = decodeURIComponent(match[1]);
      return route.fulfill({ json: { uid, roles: roles[uid] || [] } });
    }
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const users = [alice, bob].filter(user => user.email.includes(search));
    return route.fulfill({ json: { users } });
  });
  const loginPage = new LoginPage(page, '');
  await loginPage.goto();
  await loginPage.login(process.env.E2E_ADMIN_FINANCE_EMAIL, process.env.E2E_ADMIN_FINANCE_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Admin Console', exact: true })).toBeVisible();
});

test('uses the documented search and UID role contracts with bearer auth', async ({ page }) => {
  await page.goto('/users');
  await expect(usersTable(page)).toBeVisible();
  await expect(page.getByText('Preview users', { exact: true })).toHaveCount(0);
  await page.getByLabel('Search users', { exact: true }).fill('  alice@  ');
  await expect(usersTable(page).getByText('bob@example.test', { exact: true })).toHaveCount(0);
  await select(page, alice.email);
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toBeVisible();
  const input = editor(page).getByLabel('Roles', { exact: true });
  await input.fill('support');
  await input.press('Enter');
  await save(page).click();
  await expect(editor(page).getByText('Roles updated', { exact: true })).toBeVisible();
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toBeVisible();
  await expect(assignedRoles(page).getByText('support', { exact: true })).toBeVisible();
  expect(requests.some(({ url }) => url.searchParams.get('search') === 'alice@' && url.searchParams.get('pageSize') === '5')).toBe(true);
  expect(requests.some(({ url }) => url.pathname === '/admin/api/users/firebase%3Aalice%2Fone/roles')).toBe(true);
  expect(requests.find(request => request.method === 'POST').payload).toEqual({ uid: aliceUid, roles: ['viewer', 'support'] });
  expect(requests.every(request => /^Bearer .+/u.test(request.authorization))).toBe(true);
  await expect(editor(page).getByText('Refresh the user token for changes to take effect.')).toBeVisible();
});

test('passes opaque page cursors and resets them when searching', async ({ page }) => {
  await page.route('**/admin/api/users?**', route => {
    const url = new URL(route.request().url());
    const secondPage = url.searchParams.has('pageToken');
    requests.push({ url });
    return route.fulfill({ json: { users: [secondPage ? bob : alice], nextPageToken: secondPage ? undefined : 'opaque+/=cursor' } });
  });
  await page.goto('/users');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(usersTable(page).getByText(bob.email, { exact: true })).toBeVisible();
  expect(requests.at(-1).url.searchParams.get('pageToken')).toBe('opaque+/=cursor');
  await page.getByLabel('Search users', { exact: true }).fill('alice');
  await expect(usersTable(page).getByText(alice.email, { exact: true })).toBeVisible();
  expect(requests.at(-1).url.searchParams.has('pageToken')).toBe(false);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
});

test('shows list errors and retries without falling back to sample users', async ({ page }) => {
  await page.route('**/admin/api/users?**', route => route.fulfill({ status: 403, json: { message: 'Directory access denied' } }));
  await page.goto('/users');
  await expect(page.getByText('Directory access denied', { exact: true })).toBeVisible();
  await expect(usersTable(page)).toHaveCount(0);
  await expect(page.getByText('Preview users', { exact: true })).toHaveCount(0);
  await page.unroute('**/admin/api/users?**');
  await page.getByRole('button', { name: 'Retry loading users' }).click();
  await expect(usersTable(page).getByText(alice.email, { exact: true })).toBeVisible();
});

test('cannot save when roles fail to load and can retry', async ({ page }) => {
  await page.route('**/admin/api/users/*/roles', route => route.fulfill({ status: 500, json: { message: 'Role lookup unavailable' } }));
  await page.goto('/users');
  await select(page, alice.email);
  await expect(editor(page).getByText('Role lookup unavailable', { exact: true })).toBeVisible();
  await expect(save(page)).toHaveCount(0);
  await page.unroute('**/admin/api/users/*/roles');
  await page.getByRole('button', { name: 'Retry loading roles' }).click();
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toBeVisible();
  await expect(save(page)).toBeDisabled();
});

test('retains saved roles and the draft after a failed assignment', async ({ page }) => {
  await page.route('**/admin/api/users/roles', route => route.fulfill({ status: 500, json: { message: 'Assignment failed' } }));
  await page.goto('/users');
  await select(page, alice.email);
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear all roles' }).click();
  await save(page).click();
  await expect(editor(page).getByText('Assignment failed', { exact: true })).toBeVisible();
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await page.unroute('**/admin/api/users/roles');
  await save(page).click();
  await expect(editor(page).getByText('Roles updated', { exact: true })).toBeVisible();
  await expect(editor(page).getByText('No roles assigned', { exact: true })).toBeVisible();
  expect(requests.find(request => request.method === 'POST').payload).toEqual({ uid: aliceUid, roles: [] });
});

test('ignores a late role response after selecting another user', async ({ page }) => {
  let releaseResponse;
  let markRequested;
  const requested = new Promise(resolve => { markRequested = resolve; });
  const released = new Promise(resolve => { releaseResponse = resolve; });
  await page.route('**/admin/api/users/firebase%3Aalice%2Fone/roles', async route => {
    markRequested();
    await released;
    await route.fulfill({ json: { uid: aliceUid, roles: ['viewer'] } });
  });
  await page.goto('/users');
  await select(page, alice.email);
  await requested;
  await expect(editor(page).getByText('Loading roles...', { exact: true })).toBeVisible();
  await select(page, bob.email);
  await expect(assignedRoles(page).getByText('staff', { exact: true })).toBeVisible();
  const response = page.waitForResponse(url => url.url().includes('firebase%3Aalice%2Fone/roles'));
  releaseResponse();
  await response;
  await expect(editor(page).getByText(bob.email, { exact: true })).toBeVisible();
  await expect(assignedRoles(page).getByText('viewer', { exact: true })).toHaveCount(0);
  await expect(assignedRoles(page).getByText('support', { exact: true })).toBeVisible();
});
