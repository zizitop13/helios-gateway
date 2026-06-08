import { Button, Group, Loader, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconExternalLink, IconX } from '@tabler/icons-react';
import type { SubgraphHealth } from '../types';

type SandboxHealthCheck = SubgraphHealth & { checking: boolean };

interface SandboxHealthModalProps {
  opened: boolean;
  onClose: () => void;
  onOpenSandbox: () => void;
  isChecking: boolean;
  summary: string;
  checks: SandboxHealthCheck[];
}

export function SandboxHealthModal({
  opened,
  onClose,
  onOpenSandbox,
  isChecking,
  summary,
  checks,
}: SandboxHealthModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnClickOutside={!isChecking}
      closeOnEscape={!isChecking}
      withCloseButton={!isChecking}
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      title="GraphQL Sandbox Health Check"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {summary}
        </Text>

        {checks.map((check) => (
          <div key={check.name}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                {check.checking ? (
                  <Loader size="xs" />
                ) : (
                  <ThemeIcon size="sm" variant="light" color={check.healthy ? 'green' : 'red'}>
                    {check.healthy ? <IconCheck size={12} /> : <IconX size={12} />}
                  </ThemeIcon>
                )}
                <Text size="sm">{check.name}</Text>
              </Group>
            </Group>
            <Text size="xs" c="dimmed">
              {check.url}
            </Text>
            {check.error && (
              <Text size="xs" c="red">
                {check.error}
              </Text>
            )}
          </div>
        ))}

        {!isChecking && (
          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              Close
            </Button>
            <Button leftSection={<IconExternalLink size={16} />} onClick={onOpenSandbox}>
              Open Sandbox
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
