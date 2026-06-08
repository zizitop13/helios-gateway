import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

dotenv.config({ path: '.env.local' });

dotenv.config({ path: '.env.local' });

const envFilePath = resolve(process.cwd(), '.env.local');

if (existsSync(envFilePath) && !process.env.GRAPHQL_ENDPOINT) {
  const envFileContent = readFileSync(envFilePath, 'utf-8');

  for (const line of envFileContent.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const bddTestDir = defineBddConfig({
  features: 'src/admin-console/**/*.feature',
  steps: ['src/admin-console/steps/**/*.js', 'src/fixtures.js'],
  outputDir: 'src/.features-gen',
});

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.ADMIN_CONSOLE_URL || 'http://localhost:4000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'admin-console',
      testDir: bddTestDir,
      testMatch: '**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-api',
      testDir: 'src/admin-api',
      testMatch: '**/*.spec.js',
      use: {
        baseURL: process.env.ADMIN_CONSOLE_URL || process.env.GRAPHQL_ENDPOINT,
      },
    },
    {
      name: 'gateway',
      testDir: 'src/gateway',
      testMatch: '**/*.spec.js',
      use: {
        baseURL: process.env.GRAPHQL_ENDPOINT,
      },
    },
  ],
});



