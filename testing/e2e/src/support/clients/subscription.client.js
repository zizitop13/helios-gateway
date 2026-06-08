export function subscriptionFieldsQuery() {
  return /* GraphQL */ `
    query SubscriptionFields {
      __schema {
        subscriptionType {
          fields {
            name
          }
        }
      }
    }
  `;
}
