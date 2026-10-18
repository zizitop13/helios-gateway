import { spawnSync } from 'node:child_process';

for (const directory of ['gateway', 'admin-console', 'testing/e2e', 'testing/services/pets-shop-ui', ...['pets', 'orders', 'customers', 'broken'].map(name => `testing/services/${name}-service`)]) {
  const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
