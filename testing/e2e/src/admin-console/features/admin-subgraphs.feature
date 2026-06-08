Feature: Subgraph Management
  As a logged-in administrator
  I want to view discovered subgraphs
  So that I can monitor federated services

  Background:
    Given I am logged in as an admin
    And I click "Subgraphs" in the navigation

  Scenario: Subgraphs page is accessible
    Then I should see a heading "Subgraphs"
    And the subgraph table should be visible

  Scenario: Each subgraph row has required fields
    Then each subgraph row should have a name and a URL

  Scenario: Subgraphs have a status indicator
    Then each subgraph row should show a status badge

  Scenario: Broken subgraph is shown as failed in the subgraphs table
    Then I should see the broken subgraph shown as failed in the subgraphs table

