import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Radio,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import type { AssignRolesResponse } from '../types';

type IdentifierType = 'uid' | 'email';

export function RolesPage() {
  const { token } = useAuth();
  const [identifierType, setIdentifierType] = useState<IdentifierType>('email');
  const [identifierValue, setIdentifierValue] = useState('');
  const [roles, setRoles] = useState<string[]>(['viewer']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignRolesResponse | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setAvailableRoles([]);
      return;
    }

    let cancelled = false;

    const loadRoles = async () => {
      try {
        const response = await api.getAvailableRoles(token);
        if (!cancelled) {
          setAvailableRoles(response.roles);
        }
      } catch {
        if (!cancelled) {
          setAvailableRoles([]);
        }
      }
    };

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const rolesHint = useMemo(() => {
    if (!availableRoles.length) {
      return 'No roles discovered from current schema yet';
    }

    return `Available roles from schema: ${availableRoles.join(', ')}`;
  }, [availableRoles]);

  const handleAssign = async () => {
    if (!token) {
      setError('Authentication token not available');
      return;
    }

    const value = identifierValue.trim();
    if (!value) {
      setError(`Please provide a valid ${identifierType}`);
      return;
    }

    const cleanedRoles = [...new Set(roles.map((role) => role.trim()).filter((role) => role.length > 0))];

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload =
        identifierType === 'uid'
          ? { uid: value, roles: cleanedRoles }
          : { email: value, roles: cleanedRoles };

      const response = await api.assignUserRoles(token, payload);
      setResult(response);
      setRoles(response.assigned.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Role Management</Title>
          <Text c="dimmed">Assign Firebase custom-claim roles to users</Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Radio.Group
              label="Find user by"
              value={identifierType}
              onChange={(value) => setIdentifierType(value as IdentifierType)}
            >
              <Group mt="xs">
                <Radio value="email" label="Email" />
                <Radio value="uid" label="UID" />
              </Group>
            </Radio.Group>

            <TextInput
              label={identifierType === 'email' ? 'User email' : 'User UID'}
              placeholder={identifierType === 'email' ? 'user@example.com' : 'firebase-uid'}
              value={identifierValue}
              onChange={(event) => setIdentifierValue(event.currentTarget.value)}
            />

            <TagsInput
              label="Roles"
              description={rolesHint}
              placeholder="Add role and press Enter"
              value={roles}
              onChange={setRoles}
              data={availableRoles}
            />

            {availableRoles.length > 0 && (
              <Group gap="xs">
                {availableRoles.map((role) => (
                  <Badge key={role} variant="light" color="grape">
                    {role}
                  </Badge>
                ))}
              </Group>
            )}

            <Button onClick={handleAssign} loading={loading}>
              Assign Roles
            </Button>
          </Stack>
        </Card>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {result && (
          <Alert icon={<IconCheck size={16} />} title="Roles updated" color="green">
            <Stack gap="xs">
              <Text size="sm">UID: {result.assigned.uid}</Text>
              <Text size="sm">Email: {result.assigned.email || 'N/A'}</Text>
              <Group gap="xs">
                {result.assigned.roles.map((role) => (
                  <Badge key={role} variant="light" color="blue">
                    {role}
                  </Badge>
                ))}
              </Group>
              {result.note && (
                <Alert color="orange" variant="light" title="Important">
                  <Text fw={700}>{result.note}</Text>
                </Alert>
              )}
            </Stack>
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
