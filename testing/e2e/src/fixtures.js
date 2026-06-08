import { test as base, createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { LoginPage } from './admin-console/pages/login.page.js';
import { LayoutPage } from './admin-console/pages/layout.page.js';
import { SubgraphsPage } from './admin-console/pages/subgraphs.page.js';

export { expect };

export const test = base.extend({
  basePath: [process.env.ADMIN_CONSOLE_BASE_PATH || '/admin/console', { option: true }],

  loginPage: async ({ page, basePath }, use) => {
    await use(new LoginPage(page, basePath));
  },

  layoutPage: async ({ page }, use) => {
    await use(new LayoutPage(page));
  },

  subgraphsPage: async ({ page }, use) => {
    await use(new SubgraphsPage(page));
  },
});

export const { Given, When, Then, Before } = createBdd(test);


