import { Container, Title, Text, TextInput, Button, Paper, Stack, Alert } from '@mantine/core';
import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginWithEmail, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await loginWithEmail(email.trim(), password.trim());
      navigate('/');
    } catch {
      // error state is handled by AuthContext
    }
  };

  return (
    <Container size="xs" mt={100}>
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2}>Admin Console Login</Title>
          <Text size="sm" c="dimmed">
            Sign in with your Firebase admin email and password.
          </Text>
          {error && (
            <Alert color="red" title="Login failed">
              {error}
            </Alert>
          )}
          <TextInput
            label="Email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <TextInput
            label="Password"
            placeholder="Your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <Button onClick={handleLogin} disabled={!email.trim() || !password.trim() || loading}>
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
