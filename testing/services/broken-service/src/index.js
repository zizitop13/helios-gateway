import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";

const PORT = Number(process.env.PORT || 5004);

const typeDefs = parse(/* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  type BrokenHealthStatus @key(fields: "id") {
    id: ID!
    status: String!
  }

  type Query {
    brokenHealthStatus: BrokenHealthStatus!
  }
`);

const resolvers = {
  Query: {
    brokenHealthStatus: () => ({ id: "broken-health", status: "available-for-federation" }),
  },
  BrokenHealthStatus: {
    __resolveReference: (reference) => ({ id: reference.id, status: "available-for-federation" }),
  },
};

async function start() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);
  const server = new ApolloServer({ schema });
  await server.start();

  app.use("/graphql", (req, res, next) => {
      // res.status(500).json({
      //   errors: [{ message: "Simulated broken subgraph health check" }],
      // });
  });

  app.use("/graphql", expressMiddleware(server));

  app.listen(PORT, () => {
    console.log(`broken-service ready at http://localhost:${PORT}/graphql`);
  });
}

start().catch((error) => {
  console.error("broken-service failed to start:", error);
  process.exit(1);
});

