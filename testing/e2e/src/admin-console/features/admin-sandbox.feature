Feature: GraphQL Sandbox Health Check
  As a logged-in administrator
  I want the Sandbox health check to show unhealthy subgraphs
  So that I can decide whether to open Sandbox

  Background:
    Given I am logged in as an admin

  Scenario: Broken subgraph is shown as failed in the Sandbox health check
    When I open the GraphQL Sandbox health check modal
    Then I should see the broken subgraph shown as failed and can open the Sandbox
