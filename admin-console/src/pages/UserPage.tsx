import { Container, Title, Text, Card, Stack, Group, Loader, Alert, Badge, Table } from '@mantine/core';
import { IconAlertCircle, IconUser, IconMail, IconShield, IconClock } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { type UserInfo } from '../types';

export function UserPage() {
  const { token } = useAuth();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await api.getMe(token) as UserInfo;
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user info');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  if (loading) {
    return (
      <Container size="xl">
        <Stack align="center" mt={100}>
          <Loader size="xl" />
          <Text>Loading user information...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mt="md">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>User Information</Title>
          <Text c="dimmed">Your authentication details and roles</Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconUser size={20} />
                    <Text fw={500}>User ID</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{user.uid}</Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconMail size={20} />
                    <Text fw={500}>Email</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{user.email || 'Not available'}</Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconShield size={20} />
                    <Text fw={500}>Roles</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="light" color="blue">
                        {role}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconClock size={20} />
                    <Text fw={500}>Token Expiration</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {user.tokenExpiration 
                      ? new Date(user.tokenExpiration).toLocaleString()
                      : 'Not available'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>
      </Stack>
    </Container>
  );
}
