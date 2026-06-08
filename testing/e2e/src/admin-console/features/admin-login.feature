Feature: Admin Console Login
  As an administrator
  I want to log in to the admin console
  So that I can manage the Helios Gateway

  Scenario: Successful login with valid admin credentials
    Given I open the admin console login page
    When I login as an admin user
    Then I should see the admin dashboard

  Scenario: Failed login with invalid credentials
    Given I open the admin console login page
    When I enter email "nobody@invalid.example.com" and password "wrongpassword"
    And I click the login button
    Then I should see a login error

  Scenario: Login button is disabled for empty fields
    Given I open the admin console login page
    Then the login button should be disabled

