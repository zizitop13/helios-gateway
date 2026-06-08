export class LayoutPage {
  constructor(page) {
    this.page = page;
    this.themeButton = page.getByRole('button', { name: 'Theme' });
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
    this.sandboxNavItem = page.getByText('GraphQL Sandbox', { exact: true }).first();
    this.sandboxHealthDialog = page.getByRole('dialog', { name: 'GraphQL Sandbox Health Check' });
    this.openSandboxButton = this.sandboxHealthDialog.getByRole('button', { name: 'Open Sandbox' });
  }

  async clickNavItem(label) {
    await this.page.getByText(label, { exact: true }).first().click();
  }

  async toggleTheme() {
    await this.themeButton.click();
  }

  async openSandboxHealthCheck() {
    await this.sandboxNavItem.click();
  }

  getSandboxHealthSummary(summaryText) {
    return this.sandboxHealthDialog.getByText(summaryText, { exact: true });
  }

  getFailedServiceEntry(serviceName) {
    return this.sandboxHealthDialog.locator('div').filter({ hasText: serviceName }).first();
  }

  async logout() {
    await this.logoutButton.click();
  }
}

