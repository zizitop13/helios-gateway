import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, TagsInput, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { usersApi } from '../usersApi';
import type { AssignRolesResponse, DirectoryUser } from '../types';

interface UserRolesEditorProps {
  token: string;
  user: DirectoryUser;
}

// Adapted from RolesPage: schema role hints, editable tags, normalization,
// assignment results and token-refresh notes are retained for a selected UID.
export function UserRolesEditor({ token, user }: UserRolesEditorProps) {
  const [roles, setRoles] = useState<string[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<AssignRolesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    setError(null);
    const load = async () => {
      try {
        const [assigned, available] = await Promise.all([
          usersApi.getUserRoles(token, user.uid), usersApi.getAvailableRoles(token),
        ]);
        if (cancelled) return;
        setAssignedRoles(assigned.roles);
        setRoles(assigned.roles);
        setAvailableRoles(available.roles);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load roles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token, user.uid, retry]);

  const cleanedRoles = useMemo(() => [...new Set(roles.map(role => role.trim()).filter(Boolean))], [roles]);
  const unchanged = cleanedRoles.length === assignedRoles.length && cleanedRoles.every(role => assignedRoles.includes(role));
  const rolesHint = availableRoles.length
    ? `Available roles from schema: ${availableRoles.join(', ')}`
    : 'No roles discovered from current schema yet';

  const handleAssign = async () => {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const response = await usersApi.assignUserRoles(token, { uid: user.uid, roles: cleanedRoles });
      setAssignedRoles(response.assigned.roles);
      setRoles(response.assigned.roles);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign roles');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder component="section" aria-label="User roles">
      <Stack gap="md">
        <div>
          <Title order={2}>User roles</Title>
          <Text fw={600}>{user.email || user.displayName || user.uid}</Text>
          <Text size="sm" c="dimmed">UID: {user.uid}</Text>
        </div>
        {loading && <Group role="status"><Loader size="sm" /><Text>Loading roles...</Text></Group>}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Unable to update roles" color="red">
            <Stack gap="xs">
              <Text size="sm">{error}</Text>
              {!loaded && <Button variant="light" onClick={() => setRetry(value => value + 1)}>Retry loading roles</Button>}
            </Stack>
          </Alert>
        )}
        {loaded && !loading && (
          <>
            <div>
              <Text size="sm" fw={500} mb="xs">Assigned roles</Text>
              <Group gap="xs" aria-label="Assigned roles">
                {assignedRoles.length ? assignedRoles.map(role => <Badge key={role}>{role}</Badge>) : <Text size="sm" c="dimmed">No roles assigned</Text>}
              </Group>
            </div>
            <TagsInput
              label="Roles"
              description={rolesHint}
              placeholder="Add role and press Enter"
              value={roles}
              onChange={value => { setRoles(value); setResult(null); }}
              data={availableRoles}
              disabled={saving}
            />
            <Text size="sm" c="dimmed">Remove a tag to remove a role, then save. An empty list removes all roles.</Text>
            <Group>
              <Button onClick={handleAssign} loading={saving} disabled={unchanged}>Save roles</Button>
              <Button variant="subtle" color="red" disabled={saving || roles.length === 0} onClick={() => { setRoles([]); setResult(null); }}>Clear all roles</Button>
            </Group>
          </>
        )}
        {result && (
          <Alert icon={<IconCheck size={16} />} title="Roles updated" color="green">
            <Text size="sm">Saved roles for {user.email || user.uid}.</Text>
            {result.note && <Text size="sm" mt="xs">{result.note}</Text>}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
