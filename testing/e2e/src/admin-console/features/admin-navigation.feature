Feature: Admin Console Navigation
  As a logged-in administrator
  I want to navigate between pages
  So that I can access different management sections

  Background:
    Given I am logged in as an admin

  Scenario: Navigate to Subgraphs page
    When I click "Subgraphs" in the navigation
    Then I should see a heading "Subgraphs"

  Scenario: Navigate to Status page
    When I click "Status" in the navigation
    Then I should see a heading "Gateway Status"

  Scenario: Open my profile from the top-right menu
    When I open my profile from the header
    Then I should see a heading "User Information"

  Scenario: Navigate to Users page
    When I click "Users" in the navigation
    Then I should see a heading "Users"
    And the old user and role navigation items should be absent

  Scenario: Logout from the profile menu
    When I log out from the profile menu
    Then I should see a heading "Admin Console Login"

  Scenario: Toggle theme
    When I click the theme button
    Then the page theme should toggle

