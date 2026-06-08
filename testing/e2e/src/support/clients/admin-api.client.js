import { adminApiBaseUrl } from '../env.js';

export async function adminApiRequest(request, path, token) {
  const response = await request.get(`${adminApiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json();
  return { status: response.status(), payload };
}
