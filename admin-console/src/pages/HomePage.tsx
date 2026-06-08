import { Container, Title, Text, Card, SimpleGrid, Button, Group, Stack } from '@mantine/core';
import { IconBrandGraphql, IconDatabase, IconActivity, IconUser } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export function HomePage() {
  const { token } = useAuth();

  const handleOpenSandbox = async () => {
    if (!token) {
      alert('You must be authenticated to open Sandbox.');
      return;
    }

    try {
      await api.createSession(token);
      const { csrfToken } = await api.getCsrfToken();
      const sandboxUrl = `/graphql?csrfToken=${encodeURIComponent(csrfToken)}`;

      window.open(sandboxUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error(e);
      alert('Unable to create an authenticated Sandbox session.');
    }
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Admin Console</Title>
          <Text c="dimmed">Helios Gateway Administration</Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 2 }} spacing="lg">
          <Card shadow="sm" padding="lg" radius="md" withBorder component={Link} to="/subgraphs" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group>
              <IconDatabase size={32} />
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">Subgraphs</Text>
                <Text size="sm" c="dimmed">
                  View and manage federated subgraphs
                </Text>
              </div>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder component={Link} to="/status" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group>
              <IconActivity size={32} />
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">Gateway Status</Text>
                <Text size="sm" c="dimmed">
                  Monitor gateway health and metrics
                </Text>
              </div>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder component={Link} to="/user" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group>
              <IconUser size={32} />
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">User Info</Text>
                <Text size="sm" c="dimmed">
                  View your authentication details
                </Text>
              </div>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group>
              <IconBrandGraphql size={32} />
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">GraphQL Sandbox</Text>
                <Text size="sm" c="dimmed">
                  Interactive GraphQL query interface
                </Text>
              </div>
            </Group>
            <Button
              mt="md"
              fullWidth
              variant="light"
              onClick={handleOpenSandbox}
            >
              Open Sandbox
            </Button>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}

