import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { AxiosError } from 'axios';
import { acknowledgmentApi, EntraIdConfig } from '../services/api';

export function AllStaffGroupConfig() {
  const [config, setConfig] = useState<EntraIdConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupIdInput, setGroupIdInput] = useState('');
  const toast = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await acknowledgmentApi.getEntraIdConfig();
      setConfig(data);
      setGroupIdInput(data.groupId || '');
    } catch (error: unknown) {
      console.error('Error fetching config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Entra ID configuration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSetGroup = async () => {
    if (!groupIdInput.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a group ID',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setSaving(true);
      const updatedConfig = await acknowledgmentApi.setEntraIdConfig(groupIdInput.trim());
      setConfig(updatedConfig);
      toast({
        title: 'Success',
        description: `Group "${updatedConfig.groupName}" configured successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error: unknown) {
      console.error('Error setting config:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to set group configuration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await acknowledgmentApi.syncEntraIdUsers();
      await fetchConfig(); // Refresh config to get updated lastSyncedAt
      toast({
        title: 'Success',
        description: `Successfully synced ${result.synced} users`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error: unknown) {
      console.error('Error syncing users:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to sync users',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (): string => {
    if (!config?.groupId) {
      return 'red';
    }
    if (!config.lastSyncedAt) {
      return 'gray';
    }
    const lastSynced = new Date(config.lastSyncedAt);
    const daysSinceSync = Math.floor(
      (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSync < 7) {
      return 'green';
    }
    return 'yellow';
  };

  const getStatusText = (): string => {
    if (!config?.groupId) {
      return 'Not Configured';
    }
    if (!config.lastSyncedAt) {
      return 'Never Synced';
    }
    const lastSynced = new Date(config.lastSyncedAt);
    const daysSinceSync = Math.floor(
      (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSync < 7) {
      return 'Synced Recently';
    }
    return 'Sync Stale';
  };

  if (loading) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">All Staff Group Configuration</Heading>
        <Box p={8} textAlign="center">
          <Spinner size="xl" />
        </Box>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">All Staff Group Configuration</Heading>

      <Alert status="info">
        <AlertIcon />
        <Box>
          <AlertTitle>About This Configuration</AlertTitle>
          <AlertDescription>
            Configure the Entra ID group that represents all staff who should acknowledge documents.
            This group is used to determine the total number of users who should acknowledge each document.
          </AlertDescription>
        </Box>
      </Alert>

      {/* Current Configuration */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>
          Current Configuration
        </Heading>

        {config?.groupId ? (
          <VStack align="stretch" spacing={4}>
            <HStack>
              <Text fontWeight="medium">Group Name:</Text>
              <Text>{config.groupName || 'Unknown'}</Text>
            </HStack>
            <HStack>
              <Text fontWeight="medium">Group ID:</Text>
              <Text fontFamily="mono" fontSize="sm">
                {config.groupId}
              </Text>
            </HStack>
            <HStack>
              <Text fontWeight="medium">Last Synced:</Text>
              {config.lastSyncedAt ? (
                <Text>
                  {new Date(config.lastSyncedAt).toLocaleString()}
                </Text>
              ) : (
                <Text color="gray.500">Never</Text>
              )}
            </HStack>
            <HStack>
              <Text fontWeight="medium">Status:</Text>
              <Badge colorScheme={getStatusColor()}>{getStatusText()}</Badge>
            </HStack>
          </VStack>
        ) : (
          <Alert status="warning">
            <AlertIcon />
            <AlertDescription>
              No group configured. Please configure a group below.
            </AlertDescription>
          </Alert>
        )}
      </Box>

      {/* Configuration Form */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>
          Set All Staff Group
        </Heading>

        <FormControl mb={4}>
          <FormLabel>Entra ID Group Object ID</FormLabel>
          <Input
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            placeholder="Enter group object ID (e.g., 12345678-1234-1234-1234-123456789012)"
            fontFamily="mono"
          />
          <FormHelperText>
            Enter the object ID of the Entra ID group that contains all staff members.
            You can find this in the Azure Portal under the group's properties.
          </FormHelperText>
        </FormControl>

        <Button
          colorScheme="blue"
          onClick={handleSetGroup}
          isLoading={saving}
          isDisabled={!groupIdInput.trim()}
        >
          Set Group
        </Button>
      </Box>

      {/* Sync Controls */}
      {config?.groupId && (
        <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
          <Heading size="md" mb={4}>
            Sync Users
          </Heading>

          <Text mb={4}>
            Sync all members from the configured group to the local cache. This should be done
            regularly to keep the user list up to date.
          </Text>

          <Button
            colorScheme="green"
            onClick={handleSync}
            isLoading={syncing}
            isDisabled={!config.groupId}
          >
            Sync Users Now
          </Button>
        </Box>
      )}
    </VStack>
  );
}

