import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconRefresh, IconShoppingCart, IconUser } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { fetchDashboardData, type DashboardPermissions, updateOrder } from './api';
import type { DashboardData, UpdateOrderInput } from './types';

const emptyDashboard: DashboardData = {
  pets: [],
  orders: [],
  customers: [],
};

function LoginView() {
  const { loginWithEmail, error, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginDisabled = !email.trim() || !password.trim() || loading;

  const handleLogin = async () => {
    if (loginDisabled) {
      return;
    }
    await loginWithEmail(email.trim(), password.trim());
  };

  return (
    <Container size="xs" mt={96}>
      <Card shadow="sm" radius="md" withBorder>
        <Stack gap="md">
          <Title order={2}>Pets Shop Login</Title>
          <Text c="dimmed" size="sm">
            Sign in with Firebase. The gateway session is stored in HTTP-only cookies.
          </Text>
          {error ? <Alert color="red">{error}</Alert> : null}
          <TextInput
            label="Email"
            placeholder="employee@example.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
          />
          <PasswordInput
            label="Password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
          />
          <Button onClick={handleLogin} disabled={loginDisabled}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}

function DashboardView() {
  const { user, roles, logout, refreshToken } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, UpdateOrderInput>>({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const normalizedRoles = useMemo(
    () => roles.map((role) => role.trim().toLowerCase()).filter((role) => role.length > 0),
    [roles]
  );

  const permissions = useMemo<DashboardPermissions>(() => {
    const has = (role: string) => normalizedRoles.includes(role);
    return {
      canViewPets: has('viewer') || has('staff') || has('admin'),
      canViewOrders: has('staff') || has('admin'),
      canViewCustomers: has('support') || has('admin'),
      canViewCustomerEmail: has('support') || has('admin'),
    };
  }, [normalizedRoles]);

  const canEditStatus = normalizedRoles.includes('staff') || normalizedRoles.includes('admin');
  const canEditAllOrderFields = normalizedRoles.includes('admin');

  const roleBadges = useMemo(() => {
    if (!normalizedRoles.length) {
      return [<Badge key="none" color="gray">No roles in token</Badge>];
    }
    return normalizedRoles.map((role) => (
      <Badge key={role} color="blue" variant="light">
        {role}
      </Badge>
    ));
  }, [normalizedRoles]);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDashboardData(permissions);
      setDashboard(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
      setDashboard(emptyDashboard);
    } finally {
      setLoading(false);
    }
  }, [permissions, user]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const nextDrafts: Record<string, UpdateOrderInput> = {};
    for (const order of dashboard.orders) {
      nextDrafts[order.id] = {
        status: order.status,
        total: order.total,
        petId: order.pet.id,
        customerId: order.customer.id,
      };
    }
    setOrderDrafts(nextDrafts);
  }, [dashboard.orders]);

  const handleRefreshToken = async () => {
    await refreshToken();
    await loadDashboard();
  };

  const updateOrderDraft = (id: string, patch: UpdateOrderInput) => {
    setOrderDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const handleSaveOrder = async (id: string) => {
    if (!user || !canEditStatus) {
      return;
    }

    const draft = orderDrafts[id];
    const currentOrder = dashboard.orders.find((order) => order.id === id);
    if (!draft || !currentOrder) {
      return;
    }

    const payload: UpdateOrderInput = {};
    if (draft.status !== undefined && draft.status !== currentOrder.status) {
      payload.status = draft.status;
    }
    if (canEditAllOrderFields && draft.total !== undefined && draft.total !== currentOrder.total) {
      payload.total = draft.total;
    }
    if (canEditAllOrderFields && draft.petId !== undefined && draft.petId !== currentOrder.pet.id) {
      payload.petId = draft.petId;
    }
    if (
      canEditAllOrderFields &&
      draft.customerId !== undefined &&
      draft.customerId !== currentOrder.customer.id
    ) {
      payload.customerId = draft.customerId;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSavingOrderId(id);
    setError(null);
    try {
      await updateOrder(id, payload);
      await loadDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update order';
      setError(message);
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Title order={2}>Test Pets Shop</Title>
            <Text c="dimmed" size="sm">
              Connected to gateway endpoint `{import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000'}/graphql`
            </Text>
            <Group gap="xs">{roleBadges}</Group>
          </Stack>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={handleRefreshToken}>
              Refresh token
            </Button>
            <Button variant="light" onClick={loadDashboard}>
              Reload data
            </Button>
            <Button color="red" onClick={logout}>
              Logout
            </Button>
          </Group>
        </Group>

        <Card withBorder>
          <Group gap="xs">
            <IconUser size={16} />
            <Text size="sm">
              Signed in as <strong>{user?.email ?? user?.uid}</strong> ({user?.uid})
            </Text>
          </Group>
        </Card>

        {error ? (
          <Alert color="red" title="Gateway request failed">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Stack gap="md">
            {permissions.canViewPets ? (
              <Card withBorder>
                <Group mb="md" gap="xs">
                  <IconShoppingCart size={18} />
                  <Title order={4}>Pets</Title>
                </Group>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Species</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.pets.map((pet) => (
                      <Table.Tr key={pet.id}>
                        <Table.Td>{pet.id}</Table.Td>
                        <Table.Td>{pet.name}</Table.Td>
                        <Table.Td>{pet.species}</Table.Td>
                        <Table.Td>{pet.status}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            ) : null}

            {permissions.canViewOrders ? (
              <Card withBorder>
                <Title order={4} mb="md">Orders</Title>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th>Pet</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.orders.map((order) => (
                      <Table.Tr key={order.id}>
                        <Table.Td>{order.id}</Table.Td>
                        <Table.Td>
                          {canEditStatus ? (
                            <Select
                              size="xs"
                              data={['PENDING', 'COMPLETED', 'CANCELLED']}
                              value={orderDrafts[order.id]?.status ?? order.status}
                              onChange={(value) => updateOrderDraft(order.id, { status: value ?? order.status })}
                            />
                          ) : (
                            order.status
                          )}
                        </Table.Td>
                        <Table.Td>
                          {canEditAllOrderFields ? (
                            <NumberInput
                              size="xs"
                              min={0}
                              decimalScale={2}
                              fixedDecimalScale
                              value={orderDrafts[order.id]?.total ?? order.total}
                              onChange={(value) =>
                                updateOrderDraft(order.id, { total: typeof value === 'number' ? value : order.total })
                              }
                            />
                          ) : (
                            `$${order.total.toFixed(2)}`
                          )}
                        </Table.Td>
                        <Table.Td>
                          {canEditAllOrderFields ? (
                            <TextInput
                              size="xs"
                              value={orderDrafts[order.id]?.petId ?? order.pet.id}
                              onChange={(event) => updateOrderDraft(order.id, { petId: event.currentTarget.value })}
                            />
                          ) : (
                            order.pet.name
                          )}
                        </Table.Td>
                        <Table.Td>
                          {canEditAllOrderFields ? (
                            <TextInput
                              size="xs"
                              value={orderDrafts[order.id]?.customerId ?? order.customer.id}
                              onChange={(event) =>
                                updateOrderDraft(order.id, { customerId: event.currentTarget.value })
                              }
                            />
                          ) : (
                            order.customer.name
                          )}
                        </Table.Td>
                        <Table.Td>
                          {canEditStatus ? (
                            <Button
                              size="xs"
                              onClick={() => void handleSaveOrder(order.id)}
                              loading={savingOrderId === order.id}
                            >
                              Save
                            </Button>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Read-only
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            ) : null}

            {permissions.canViewCustomers ? (
              <Card withBorder>
                <Title order={4} mb="md">Customers</Title>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th>
                      <Table.Th>Name</Table.Th>
                      {permissions.canViewCustomerEmail ? <Table.Th>Email</Table.Th> : null}
                      <Table.Th>Tier</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.customers.map((customer) => (
                      <Table.Tr key={customer.id}>
                        <Table.Td>{customer.id}</Table.Td>
                        <Table.Td>{customer.name}</Table.Td>
                        {permissions.canViewCustomerEmail ? <Table.Td>{customer.email ?? 'n/a'}</Table.Td> : null}
                        <Table.Td>{customer.tier}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            ) : null}

            {!permissions.canViewPets && !permissions.canViewOrders && !permissions.canViewCustomers ? (
              <Alert color="yellow" title="No dashboard access for current roles">
                Current roles do not grant access to pets, orders, or customers queries.
              </Alert>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function AppContent() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <Group justify="center" mt={120}>
        <Loader />
      </Group>
    );
  }

  return token ? <DashboardView /> : <LoginView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
