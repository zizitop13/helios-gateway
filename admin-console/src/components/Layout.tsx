import { AppShell, Burger, Group, NavLink, Title, Button, Text, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHome, IconDatabase, IconActivity, IconUser, IconLogout, IconShield, IconBrandGraphql, IconMoon, IconSun } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api';
import type { GatewayStatus, SubgraphHealth } from '../types';
import { SandboxHealthModal } from './SandboxHealthModal';
import logoLight from '../../public/logo_light.svg';
import logoDark from '../../public/logo_dark.svg';

interface LayoutProps {
  children: ReactNode;
}

const SANDBOX_HEALTH_CHECK_TIMEOUT_MS = 10_000;

export function Layout({ children }: LayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const [sandboxModalOpened, { open: openSandboxModal, close: closeSandboxModal }] = useDisclosure(false);
  const [isCheckingSandboxHealth, setIsCheckingSandboxHealth] = useState(false);
  const [sandboxChecks, setSandboxChecks] = useState<Array<SubgraphHealth & { checking: boolean }>>([]);
  const [sandboxSummary, setSandboxSummary] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, token } = useAuth();
  const { colorScheme, toggleColorScheme } = useTheme();

  const logo = colorScheme === 'dark' ? logoDark : logoLight;

  useEffect(() => {
    if (!token) {
      setGatewayStatus(null);
      return;
    }

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const status = await api.getStatus(token);
        if (!cancelled) {
          setGatewayStatus(status);
        }
      } catch {
        if (!cancelled) {
          setGatewayStatus(null);
        }
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openSandbox = async () => {
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

  const handleOpenSandboxHealthCheck = async () => {
    if (!token) {
      alert('You must be authenticated to verify gateway health before opening Sandbox.');
      return;
    }

    openSandboxModal();
    setIsCheckingSandboxHealth(true);
    setSandboxSummary('Checking subgraph health...');
    setSandboxChecks([]);

    try {
      const { subgraphs } = await api.getSubgraphs(token);
      const initialChecks = subgraphs.map((subgraph) => ({
        name: subgraph.name,
        url: subgraph.url,
        healthy: false,
        error: undefined as string | undefined,
        checking: true,
      }));
      setSandboxChecks(initialChecks);

      let allHealthy = true;

      for (const subgraph of subgraphs) {
        try {
          const result = await api.getSubgraphHealth(
            token,
            subgraph.name,
            SANDBOX_HEALTH_CHECK_TIMEOUT_MS
          );

          setSandboxChecks((previous) =>
            previous.map((check) =>
              check.name === subgraph.name
                ? { ...check, healthy: result.healthy, error: result.error, checking: false }
                : check
            )
          );

          if (!result.healthy) {
            allHealthy = false;
          }
        } catch (error) {
          allHealthy = false;
          const message = error instanceof Error ? error.message : 'Unknown health check failure';

          setSandboxChecks((previous) =>
            previous.map((check) =>
              check.name === subgraph.name
                ? { ...check, healthy: false, error: message, checking: false }
                : check
            )
          );
        }
      }

      if (subgraphs.length === 0) {
        setSandboxSummary('No discovered subgraphs. You can open Sandbox.');
      } else if (allHealthy) {
        setSandboxSummary('All discovered subgraphs responded successfully. You can open Sandbox.');
      } else {
        setSandboxSummary('One or more subgraphs failed health check. You can still open Sandbox.');
      }
    } catch (e) {
      console.error(e);
      setSandboxSummary('Failed to load subgraphs for health checks. You can still open Sandbox.');
    } finally {
      setIsCheckingSandboxHealth(false);
    }
  };

  const navItems = [
    { icon: IconHome, label: 'Home', path: '/' },
    { icon: IconDatabase, label: 'Subgraphs', path: '/subgraphs' },
    { icon: IconActivity, label: 'Status', path: '/status' },
    { icon: IconUser, label: 'User Info', path: '/user' },
    { icon: IconShield, label: 'Roles', path: '/roles' },
  ];

  return (
    <AppShell
      header={{ height: 75 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      styles={{
        header: {
          backgroundColor: colorScheme === 'dark' ? '#0D1117' : '#F8F9FA',
          borderBottom: colorScheme === 'dark' ? '1px solid #1f2937' : '1px solid #DEE2E6',
        },
        navbar: {
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#F1F3F5',
          borderRight: colorScheme === 'dark' ? '1px solid #1f2937' : '1px solid #DEE2E6',
        },
        main: {
          backgroundColor: colorScheme === 'dark' ? '#0D1117' : '#FFFFFF',
          color: colorScheme === 'dark' ? '#E5E7EB' : '#212529',
        },
      }}
      padding="md"
    >
       <AppShell.Header>
         <Group h="100%" px="md" justify="space-between">
           <Group gap="sm">
             <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
             <Image src={logo} alt="Helios Gateway Logo" height={68} width="auto" fit="contain" />
             <div>
               <Title order={3}>Helios Gateway</Title>
               {gatewayStatus?.graphName ? (
                 <Text size="sm" c="dimmed">
                   Graph: <Text span fw={600}>{gatewayStatus.graphName}</Text> ({gatewayStatus.graphLabelKey || 'graph'})
                 </Text>
               ) : null}
             </div>
           </Group>
           <Group gap="xs">
             <Button
                leftSection={colorScheme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
                variant={colorScheme === 'dark' ? 'light' : 'filled'}
                color={colorScheme === 'dark' ? 'gray' : 'blue'}
               size="sm"
               onClick={toggleColorScheme}
               title={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} theme`}
             >
                Theme
             </Button>
             <Button
               leftSection={<IconLogout size={16} />}
               variant="light"
               color="red"
               onClick={handleLogout}
             >
               Logout
             </Button>
           </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="md">
          Navigation
        </Text>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            styles={{
              label: {
                color: colorScheme === 'dark' ? '#E5E7EB' : '#212529',
              },
            }}
            active={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (opened) toggle();
            }}
          />
        ))}
        <NavLink
          mt="md"
          label="GraphQL Sandbox"
          leftSection={<IconBrandGraphql size={20} stroke={1.5} />}
          styles={{
            label: {
              color: colorScheme === 'dark' ? '#E5E7EB' : '#212529',
            },
          }}
          onClick={() => {
            handleOpenSandboxHealthCheck();
            if (opened) toggle();
          }}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>

      <SandboxHealthModal
        opened={sandboxModalOpened}
        onClose={closeSandboxModal}
        onOpenSandbox={openSandbox}
        isChecking={isCheckingSandboxHealth}
        summary={sandboxSummary}
        checks={sandboxChecks}
      />
    </AppShell>
  );
}
