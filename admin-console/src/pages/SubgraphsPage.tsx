import { Container, Title, Text, Card, Badge, Stack, Group, Loader, Alert, Table } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { type Subgraph } from '../types';

type SubgraphRow = Omit<Subgraph, 'status'> & {
  status: 'loading' | 'active' | 'failed';
};

export function SubgraphsPage() {
  const { token } = useAuth();
  const [subgraphs, setSubgraphs] = useState<SubgraphRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [expectedSubgraphsCount, setExpectedSubgraphsCount] = useState<number | null>(null);
  const [checkedSubgraphsCount, setCheckedSubgraphsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const loadSubgraphs = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setHealthLoading(false);
        setError(null);
        setSubgraphs([]);
        setExpectedSubgraphsCount(null);
        setCheckedSubgraphsCount(0);

        const data = await api.getSubgraphs(token);
        setSubgraphs(
          data.subgraphs.map((subgraph) => ({
            name: subgraph.name,
            url: subgraph.url,
            status: 'loading',
            labels: subgraph.labels,
          }))
        );
        setExpectedSubgraphsCount(data.subgraphs.length);
        setLoading(false);
        setHealthLoading(data.subgraphs.length > 0);

        await api.streamSubgraphs(token, {
          signal: abortController.signal,
          onStart: ({ total }) => {
            setExpectedSubgraphsCount(total);
          },
          onSubgraph: (subgraph) => {
            setCheckedSubgraphsCount((currentCount) => currentCount + 1);
            setSubgraphs((currentSubgraphs) => {
              const nextSubgraph: SubgraphRow = {
                name: subgraph.name,
                url: subgraph.url,
                status: subgraph.status === 'active' ? 'active' : 'failed',
                labels: subgraph.labels,
              };
              const existingIndex = currentSubgraphs.findIndex(
                (currentSubgraph) => currentSubgraph.name === subgraph.name
              );

              if (existingIndex === -1) {
                return [...currentSubgraphs, nextSubgraph];
              }

              return currentSubgraphs.map((currentSubgraph, index) =>
                index === existingIndex ? nextSubgraph : currentSubgraph
              );
            });
          },
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        setError(err instanceof Error ? err.message : 'Failed to fetch subgraphs');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          setHealthLoading(false);
        }
      }
    };

    loadSubgraphs();

    return () => {
      abortController.abort();
    };
  }, [token]);

  if (loading && subgraphs.length === 0) {
    return (
      <Container size="xl">
        <Stack align="center" mt={100}>
          <Loader size="xl" />
          <Text>Loading subgraphs...</Text>
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

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Subgraphs</Title>
          <Text c="dimmed">
            {healthLoading
              ? `Checking discovered federated subgraph services${expectedSubgraphsCount === null ? '' : ` (${checkedSubgraphsCount}/${expectedSubgraphsCount})`}`
              : 'Discovered federated subgraph services'}
          </Text>
        </div>

        {subgraphs.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title="No Subgraphs" color="blue">
            No subgraph services have been discovered yet.
          </Alert>
        ) : (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Table.ScrollContainer minWidth={960}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>URL</Table.Th>
                    <Table.Th style={{ minWidth: 110 }}>Status</Table.Th>
                    <Table.Th>Labels</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {subgraphs.map((subgraph) => (
                    <Table.Tr key={subgraph.name}>
                      <Table.Td>
                        <Text fw={500}>{subgraph.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{subgraph.url}</Text>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {subgraph.status === 'loading' ? (
                          <Loader size="xs" />
                        ) : (
                          <Badge color={subgraph.status === 'active' ? 'green' : 'red'}>
                            {subgraph.status}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {Object.entries(subgraph.labels).map(([key, value]) => (
                            <Badge key={key} variant="light" size="sm">
                              {key}: {value}
                            </Badge>
                          ))}
                          {Object.keys(subgraph.labels).length === 0 && (
                            <Text size="sm" c="dimmed">No labels</Text>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
