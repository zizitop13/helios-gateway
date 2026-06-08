export class LoginPage {
  constructor(page, basePath) {
    this.page = page;
    this.basePath = basePath;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /^Login$|^Signing in/ });
    this.errorAlert = page.getByText('Login failed');
  }

  async goto() {
    await this.page.goto(`${this.basePath}/login`);
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

