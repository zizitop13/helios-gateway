import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Container, Grid, Group, Loader, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useAuth } from '../AuthContext';
import { usersApi, usersPreview } from '../usersApi';
import { UserRolesEditor } from '../components/UserRolesEditor';
import type { DirectoryUser } from '../types';

const PAGE_SIZE = 5;

export function UsersPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [pageTokens, setPageTokens] = useState<Array<string | undefined>>([undefined]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string>();
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const pageToken = pageTokens.at(-1);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const response = await usersApi.getUsers(token, { search, pageSize: PAGE_SIZE, pageToken });
        if (cancelled) return;
        setUsers(response.users);
        setNextPageToken(response.nextPageToken);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = setTimeout(() => { void load(); }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, search, pageToken, retry]);

  const changePage = (tokens: Array<string | undefined>) => {
    setSelectedUser(null);
    setPageTokens(tokens);
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Users</Title>
          <Text c="dimmed">Find Firebase users and manage their roles</Text>
        </div>
        {usersPreview && (
          <Alert title="Preview users" color="yellow">
            This page uses sample users. Role changes affect sample data only and reset on reload.
          </Alert>
        )}
        <TextInput
          label="Search users"
          placeholder="Search by email, name, or UID"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={event => { setSearch(event.currentTarget.value); changePage([undefined]); }}
        />
        <Grid align="flex-start">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack>
                <Title order={2}>Firebase users</Title>
                {loading && <Group role="status"><Loader size="sm" /><Text>Loading users...</Text></Group>}
                {error && !loading && (
                  <Alert icon={<IconAlertCircle size={16} />} title="Unable to load users" color="red">
                    <Stack gap="xs"><Text size="sm">{error}</Text><Button variant="light" onClick={() => setRetry(value => value + 1)}>Retry loading users</Button></Stack>
                  </Alert>
                )}
                {!loading && !error && (
                  <>
                    {users.length === 0 ? <Text>No users found.</Text> : (
                      <Table.ScrollContainer minWidth={450}>
                        <Table aria-label="Firebase users" highlightOnHover>
                          <Table.Thead><Table.Tr><Table.Th>User</Table.Th><Table.Th>Status</Table.Th><Table.Th>Roles</Table.Th></Table.Tr></Table.Thead>
                          <Table.Tbody>
                            {users.map(user => (
                              <Table.Tr key={user.uid} bg={selectedUser?.uid === user.uid ? 'var(--mantine-color-blue-light)' : undefined}>
                                <Table.Td>
                                  <Text fw={500}>{user.email || 'No email'}</Text>
                                  <Text size="sm" c="dimmed">{user.displayName || user.uid}</Text>
                                  <Badge size="xs" variant="light">Firebase</Badge>
                                </Table.Td>
                                <Table.Td><Badge color={user.disabled ? 'gray' : 'green'}>{user.disabled ? 'Disabled' : 'Active'}</Badge></Table.Td>
                                <Table.Td><Button size="xs" variant={selectedUser?.uid === user.uid ? 'filled' : 'light'} aria-label={`Manage roles for ${user.email || user.uid}`} aria-pressed={selectedUser?.uid === user.uid} onClick={() => setSelectedUser(user)}>Manage roles</Button></Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    )}
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Page {pageTokens.length}</Text>
                      <Group gap="xs">
                        <Button variant="default" disabled={pageTokens.length === 1} onClick={() => changePage(pageTokens.slice(0, -1))}>Previous</Button>
                        <Button variant="default" disabled={!nextPageToken} onClick={() => changePage([...pageTokens, nextPageToken])}>Next</Button>
                      </Group>
                    </Group>
                  </>
                )}
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 5 }}>
            {selectedUser && token
              ? <UserRolesEditor key={selectedUser.uid} token={token} user={selectedUser} />
              : <Card padding="lg" withBorder><Text c="dimmed">Select a user to view and edit their roles.</Text></Card>}
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
