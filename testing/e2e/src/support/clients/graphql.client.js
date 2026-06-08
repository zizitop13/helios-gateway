import { graphqlEndpoint } from '../env.js';

export async function graphqlRequest(request, query, token, variables = undefined) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await request.post(graphqlEndpoint, {
    headers,
    data: variables === undefined ? { query } : { query, variables },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Invalid JSON response from GraphQL endpoint (status ${response.status()}): ${await response.text()}`
    );
  }

  return { status: response.status(), payload };
}

export function firstErrorCode(payload) {
  return payload?.errors?.[0]?.extensions?.code;
}
