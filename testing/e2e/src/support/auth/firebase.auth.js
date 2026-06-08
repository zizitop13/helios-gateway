import { firebaseWebApiKey } from '../env.js';
import { credentials } from '../roles.js';

const tokens = new Map();

async function signInWithPassword(request, email, password) {
  const response = await request.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseWebApiKey}`,
    {
      data: {
        email,
        password,
        returnSecureToken: true,
      },
    }
  );

  const payload = await response.json();

  if (!response.ok()) {
    throw new Error(
      `Firebase sign-in failed for ${email}: ${payload?.error?.message || response.status()}`
    );
  }

  if (!payload.idToken) {
    throw new Error(`Firebase sign-in did not return idToken for ${email}`);
  }

  return payload.idToken;
}

export const firebaseAuth = {
  async signInAs(request, role) {
    if (!credentials[role]) {
      throw new Error(`Unknown e2e role: ${role}`);
    }

    if (!tokens.has(role)) {
      tokens.set(
        role,
        await signInWithPassword(request, credentials[role].email, credentials[role].password)
      );
    }

    return tokens.get(role);
  },
};
