import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";

const PORT = Number(process.env.PORT || 5002);

const orders = [
  { id: "o1", petId: "p1", customerId: "c1", status: "PENDING", total: 199.0 },
  { id: "o2", petId: "p2", customerId: "c2", status: "COMPLETED", total: 149.0 }
];

const orderUpdateSubscribers = new Set();

function publishOrderUpdated(order) {
  for (const subscriber of orderUpdateSubscribers) {
    subscriber(order);
  }
}

async function* subscribeToOrderUpdates(id) {
  const queue = [];
  let notify;

  const push = (order) => {
    if (id && order.id !== id) {
      return;
    }

    queue.push(order);
    notify?.();
  };

  orderUpdateSubscribers.add(push);

  try {
    while (true) {
      if (queue.length === 0) {
        await new Promise((resolve) => {
          notify = resolve;
        });
        notify = undefined;
      }

      while (queue.length > 0) {
        yield { orderUpdated: queue.shift() };
      }
    }
  } finally {
    orderUpdateSubscribers.delete(push);
  }
}

const typeDefs = parse(/* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  enum RoleMatch {
    ANY
    ALL
  }

  directive @requiresRole(roles: [String!]!, match: RoleMatch = ANY) on FIELD_DEFINITION | OBJECT

  type Pet @key(fields: "id") {
    id: ID!
  }

  type Customer @key(fields: "id") {
    id: ID!
  }

  type AdoptionOrder @key(fields: "id") @requiresRole(roles: ["staff", "admin"], match: ANY) {
    id: ID!
    pet: Pet!
    customer: Customer!
    status: String!
    total: Float!
  }

  type Query {
    orders: [AdoptionOrder!]! @requiresRole(roles: ["staff", "admin"], match: ANY)
    orderById(id: ID!): AdoptionOrder @requiresRole(roles: ["staff", "admin"], match: ANY)
    financeReport: [String!]! @requiresRole(roles: ["admin", "finance"], match: ALL)
  }

  input UpdateOrderInput {
    status: String
    total: Float
    petId: ID
    customerId: ID
  }

  type Mutation {
    updateOrder(id: ID!, input: UpdateOrderInput!): AdoptionOrder!
      @requiresRole(roles: ["staff", "admin"], match: ANY)
  }

  type Subscription {
    orderUpdated(id: ID): AdoptionOrder!
      @requiresRole(roles: ["staff", "admin"], match: ANY)
  }
`);

const resolvers = {
  Query: {
    orders: () => orders,
    orderById: (_, { id }) => orders.find((order) => order.id === id) || null,
    financeReport: () => ["Total orders: 2", "Revenue: 348.00"]
  },
  Mutation: {
    updateOrder: (_, { id, input }) => {
      const order = orders.find((candidate) => candidate.id === id);
      if (!order) {
        throw new Error(`Order ${id} not found`);
      }

      const hasStatus = input.status !== undefined;
      const hasTotal = input.total !== undefined;
      const hasPetId = input.petId !== undefined;
      const hasCustomerId = input.customerId !== undefined;

      if (!hasStatus && !hasTotal && !hasPetId && !hasCustomerId) {
        throw new Error("No fields provided to update");
      }

      if (hasStatus) {
        order.status = input.status;
      }
      if (hasTotal) {
        order.total = input.total;
      }
      if (hasPetId) {
        order.petId = input.petId;
      }
      if (hasCustomerId) {
        order.customerId = input.customerId;
      }

      publishOrderUpdated(order);

      return order;
    }
  },
  Subscription: {
    orderUpdated: {
      subscribe: (_, { id }) => subscribeToOrderUpdates(id)
    }
  },
  AdoptionOrder: {
    __resolveReference: (reference) => orders.find((order) => order.id === reference.id) || null,
    pet: (order) => ({ __typename: "Pet", id: order.petId }),
    customer: (order) => ({ __typename: "Customer", id: order.customerId })
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
    console.log(`orders-service ready at http://localhost:${PORT}/graphql`);
  });
}

start().catch((error) => {
  console.error("orders-service failed to start:", error);
  process.exit(1);
});
