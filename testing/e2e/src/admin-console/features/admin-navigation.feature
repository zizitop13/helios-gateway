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

  Scenario: Navigate to User Info page
    When I click "User Info" in the navigation
    Then I should see a heading "User Info"

  Scenario: Navigate to Roles page
    When I click "Roles" in the navigation
    Then I should see a heading "Role Management"

  Scenario: Toggle theme
    When I click the theme button
    Then the page theme should toggle

