export class SubgraphsPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Subgraphs' });
    this.table = page.getByRole('table');
    this.noSubgraphsAlert = page.getByText('No Subgraph');
    this.dataRows = page.locator('tbody tr');
  }

  async waitForLoad() {
    await this.heading.waitFor();
    await Promise.race([
      this.table.waitFor({ timeout: 10_000 }),
      this.noSubgraphsAlert.waitFor({ timeout: 10_000 }),
    ]);
  }

  async getRowCount() {
    if (await this.table.isVisible()) {
      return this.dataRows.count();
    }
    return 0;
  }

  async getRowTexts() {
    const rows = await this.dataRows.all();
    return Promise.all(rows.map((r) => r.innerText()));
  }

  getRowByName(name) {
    return this.dataRows.filter({ hasText: name }).first();
  }
}

