import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";

const PORT = Number(process.env.PORT || 5003);

const customers = [
  { id: "c1", name: "Alex Carter", email: "alex@example.com", tier: "GOLD" },
  { id: "c2", name: "Nina Brooks", email: "nina@example.com", tier: "SILVER" },
  { id: "c3", name: "Leo Park", email: "leo@example.com", tier: "BRONZE" }
];

const typeDefs = parse(/* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  enum RoleMatch {
    ANY
    ALL
  }

  directive @requiresRole(roles: [String!]!, match: RoleMatch = ANY) on FIELD_DEFINITION | OBJECT

  enum CustomerTier {
    BRONZE
    SILVER
    GOLD
  }

  type Customer @key(fields: "id") {
    id: ID!
    name: String!
    email: String! @requiresRole(roles: ["admin", "support"], match: ANY)
    tier: CustomerTier!
  }

  type Query {
    customers: [Customer!]! @requiresRole(roles: ["support", "admin"], match: ANY)
    customerById(id: ID!): Customer @requiresRole(roles: ["support", "admin"], match: ANY)
    customerAuditLog: [String!]! @requiresRole(roles: ["admin", "compliance"], match: ALL)
  }
`);

const resolvers = {
  Query: {
    customers: () => customers,
    customerById: (_, { id }) => customers.find((customer) => customer.id === id) || null,
    customerAuditLog: () => ["No anomalies", "Last review: 2026-03-14"]
  },
  Customer: {
    __resolveReference: (reference) =>
      customers.find((customer) => customer.id === reference.id) || null
  }
};

async function start() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);
  const server = new ApolloServer({ schema });
  await server.start();

  app.use("/graphql", expressMiddleware(server));

  app.listen(PORT, () => {
    console.log(`customers-service ready at http://localhost:${PORT}/graphql`);
  });
}

start().catch((error) => {
  console.error("customers-service failed to start:", error);
  process.exit(1);
});
