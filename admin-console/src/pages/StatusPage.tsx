import { Container, Title, Text, Card, Stack, Group, Loader, Alert, Badge, Table } from '@mantine/core';
import { IconAlertCircle, IconClock, IconServer, IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { type GatewayStatus } from '../types';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function StatusPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await api.getStatus(token) as GatewayStatus;
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <Container size="xl">
        <Stack align="center" mt={100}>
          <Loader size="xl" />
          <Text>Loading gateway status...</Text>
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

  if (!status) {
    return null;
  }

  const showLastSchemaReload = false;

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Gateway Status</Title>
          <Text c="dimmed">Real-time gateway metrics and health information</Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconClock size={20} />
                    <Text fw={500}>Uptime</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge size="lg" variant="light" color="blue">
                    {formatUptime(status.uptime)}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconServer size={20} />
                    <Text fw={500}>Discovery Mode</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge size="lg" variant="light" color="cyan">
                    {status.discoveryMode}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Group gap="sm">
                    <IconServer size={20} />
                    <Text fw={500}>Services Count</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge size="lg" variant="light" color="green">
                    {status.servicesCount}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              {showLastSchemaReload && (
                <Table.Tr>
                  <Table.Td>
                    <Group gap="sm">
                      <IconRefresh size={20} />
                      <Text fw={500}>Last Schema Reload</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {status.lastSchemaReloadTime
                        ? new Date(status.lastSchemaReloadTime).toLocaleString()
                        : 'Never'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>
      </Stack>
    </Container>
  );
}
