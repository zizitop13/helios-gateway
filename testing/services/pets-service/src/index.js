import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";

const PORT = Number(process.env.PORT || 5001);

const pets = [
  { id: "p1", name: "Milo", species: "DOG", status: "AVAILABLE" },
  { id: "p2", name: "Luna", species: "CAT", status: "ADOPTED" },
  { id: "p3", name: "Kiwi", species: "BIRD", status: "AVAILABLE" }
];

const typeDefs = parse(/* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  enum RoleMatch {
    ANY
    ALL
  }

  directive @requiresRole(roles: [String!]!, match: RoleMatch = ANY) on FIELD_DEFINITION | OBJECT

  enum PetSpecies {
    DOG
    CAT
    BIRD
    FISH
    REPTILE
  }

  enum PetStatus {
    AVAILABLE
    ADOPTED
  }

  type Pet @key(fields: "id") {
    id: ID!
    name: String!
    species: PetSpecies!
    status: PetStatus!
  }

  type Query {
    pets: [Pet!]! @requiresRole(roles: ["viewer", "staff", "admin"], match: ANY)
    petById(id: ID!): Pet @requiresRole(roles: ["viewer", "staff", "admin"], match: ANY)
    internalPetCosts: [String!]! @requiresRole(roles: ["admin", "finance"], match: ALL)
  }
`);

const resolvers = {
  Query: {
    pets: () => pets,
    petById: (_, { id }) => pets.find((pet) => pet.id === id) || null,
    internalPetCosts: () => ["Dog avg intake: 120", "Cat avg intake: 90"]
  },
  Pet: {
    __resolveReference: (reference) => pets.find((pet) => pet.id === reference.id) || null
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
    console.log(`pets-service ready at http://localhost:${PORT}/graphql`);
  });
}

start().catch((error) => {
  console.error("pets-service failed to start:", error);
  process.exit(1);
});
