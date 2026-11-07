Feature: Admin Console Users
  As an administrator
  I want to select Firebase users before editing their roles
  So that I can manage access without entering an email manually

  Background:
    Given I am logged in as an admin
    When I click "Users" in the navigation

  Scenario: List sample users and identify disabled accounts
    Then I should see the users preview notice
    And the users list should contain "alice@example.test"
    And the user "carol@example.test" should be disabled

  Scenario: Search by email without case sensitivity
    When I search users for "  BOB@EXAMPLE  "
    Then the users list should contain "bob@example.test"
    And the users list should not contain "alice@example.test"

  Scenario: Empty search results and clearing the filter
    When I search users for "missing@example.test"
    Then I should see no matching users
    When I search users for ""
    Then the users list should contain "alice@example.test"

  Scenario: Page through the directory and select a user without an email
    When I open the next users page
    Then the users list should contain "frank@example.test"
    When I manage roles for "preview-no-email"
    Then I should see no assigned roles
    When I open the previous users page
    Then the users list should contain "alice@example.test"

  Scenario: Assign a role and preserve existing roles
    When I manage roles for "alice@example.test"
    Then the selected user should have role "viewer"
    When I add the role "support"
    And I save the selected user's roles
    Then the selected user should have role "viewer"
    And the selected user should have role "support"
    And I should see the roles saved confirmation
    When I manage roles for "bob@example.test"
    And I manage roles for "alice@example.test"
    Then the selected user should have role "support"

  Scenario: Remove one role while preserving another
    When I manage roles for "bob@example.test"
    Then the selected user should have role "staff"
    And the selected user should have role "support"
    When I remove the role "support"
    And I save the selected user's roles
    Then the selected user should have role "staff"
    And the selected user should not have role "support"

  Scenario: Remove all roles
    When I manage roles for "alice@example.test"
    Then the selected user should have role "viewer"
    When I clear the selected user's roles
    And I save the selected user's roles
    Then I should see no assigned roles
    And I should see the roles saved confirmation

  Scenario: Switching users discards unsaved role edits
    When I manage roles for "alice@example.test"
    Then the selected user should have role "viewer"
    When I add the role "custom-role"
    And I manage roles for "bob@example.test"
    Then the selected user should have role "staff"
    And the selected user should not have role "custom-role"
    When I manage roles for "alice@example.test"
    Then the selected user should not have role "custom-role"

  Scenario: Legacy bookmarks redirect to their new pages
    When I open the legacy roles bookmark
    Then I should see a heading "Users"
    When I open the legacy user bookmark
    Then I should see a heading "User Information"
