import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar, Text, View } from '@/components/Themed';
import { confirmAction, isHapticsSupported, showAlert } from '@/utils/platform';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StorageKeys, storageService } from '@/utils/StorageService';

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  authEnabled: boolean;
  username: string;
  password: string;
}
const TORRSERVER_CONFIGS_KEY = StorageKeys.TORRCLIENT_TORRSERVER_CONFIGS_KEY
const TORRSERVER_ACTIVE_ID_KEY = StorageKeys.TORRCLIENT_TORRSERVER_ACTIVE_ID_KEY

const TorrServerScreen = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expandedServerId, setExpandedServerId] = useState<string>('');

  useEffect(() => {
    loadServerConfigs();
  }, []);

  const loadServerConfigs = async () => {
    try {
      const serversJson = await AsyncStorage.getItem(TORRSERVER_CONFIGS_KEY);
      const activeId = await AsyncStorage.getItem(TORRSERVER_ACTIVE_ID_KEY);

      if (serversJson) {
        const loadedServers = JSON.parse(serversJson);
        setServers(loadedServers);
        setActiveServerId(activeId || (loadedServers[0]?.id || ''));
        setExpandedServerId(activeId || (loadedServers[0]?.id || ''));
      } else {
        // Create default server
        const defaultServer: ServerConfig = {
          id: Date.now().toString(),
          name: 'Primary Server',
          url: 'http://192.168.1.10:5665',
          authEnabled: false,
          username: '',
          password: '',
        };
        setServers([defaultServer]);
        setActiveServerId(defaultServer.id);
        setExpandedServerId(defaultServer.id);
      }
    } catch (error) {
      console.error('Failed to load server configs:', error);
    }
  };

  const saveServerConfigs = async () => {
    setSaving(true);
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }

      // Validate all servers
      for (const server of servers) {
        if (!server.url.startsWith('http')) {
          showAlert('Invalid URL', `Server "${server.name}" has an invalid URL (must start with http/https).`);
          setSaving(false);
          return;
        }
        if (server.authEnabled && (!server.username || !server.password)) {
          showAlert('Missing Credentials', `Server "${server.name}" has authentication enabled but missing username or password.`);
          setSaving(false);
          return;
        }
      }

      await AsyncStorage.setItem(TORRSERVER_CONFIGS_KEY, JSON.stringify(servers));
      await AsyncStorage.setItem(TORRSERVER_ACTIVE_ID_KEY, activeServerId);

      showAlert('Saved', 'Server configurations saved successfully.');
    } catch (error) {
      console.error('Failed to save server configs:', error);
      showAlert('Error', 'Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  const addServer = () => {
    const newServer: ServerConfig = {
      id: Date.now().toString(),
      name: `Server ${servers.length + 1}`,
      url: 'http://',
      authEnabled: false,
      username: '',
      password: '',
    };
    setServers([...servers, newServer]);
    setExpandedServerId(newServer.id);
  };

  const deleteServer = async (id: string) => {
    if (servers.length === 1) {
      showAlert('Cannot Delete', 'You must have at least one server configured.');
      return;
    }

    const confirmed = await confirmAction(
      'Delete Server',
      'Are you sure you want to delete this server configuration?',
      'Delete'
    );
    if (!confirmed) return;

    const newServers = servers.filter(s => s.id !== id);
    setServers(newServers);

    if (activeServerId === id) {
      setActiveServerId(newServers[0].id);
    }
    if (expandedServerId === id) {
      setExpandedServerId(newServers[0].id);
    }
  };

  const updateServer = (id: string, updates: Partial<ServerConfig>) => {
    setServers(servers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleExpanded = (id: string) => {
    setExpandedServerId(expandedServerId === id ? '' : id);
  };

  const renderServer = (server: ServerConfig) => {
    const isActive = server.id === activeServerId;
    const isExpanded = server.id === expandedServerId;

    return (
      <View key={server.id} style={styles.serverCard}>
        {/* Server Header */}
        <Pressable
          onPress={() => toggleExpanded(server.id)}
          style={styles.serverHeader}
        >
          <View style={styles.serverHeaderLeft}>
            <Pressable
              onPress={() => setActiveServerId(server.id)}
              style={styles.radioButton}
            >
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive && <View style={styles.radioInner} />}
              </View>
            </Pressable>
            <View style={styles.serverInfo}>
              <Text style={styles.serverName}>{server.name}</Text>
              <Text style={styles.serverUrl} numberOfLines={1}>
                {server.url || 'Not configured'}
              </Text>
            </View>
          </View>
          <View style={styles.serverHeaderRight}>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#888"
            />
          </View>
        </Pressable>

        {/* Expanded Server Config */}
        {isExpanded && (
          <View style={styles.serverDetails}>
            <View style={styles.separator} />

            {/* Server Name */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="pricetag-outline" size={18} color="#535aff" style={styles.labelIcon} />
                <Text style={styles.label}>Server Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={server.name}
                onChangeText={(text) => updateServer(server.id, { name: text })}
                placeholder="My Server"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.separator} />

            {/* Server URL */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="server-outline" size={18} color="#535aff" style={styles.labelIcon} />
                <Text style={styles.label}>Base URL</Text>
              </View>
              <TextInput
                style={styles.input}
                value={server.url}
                onChangeText={(text) => updateServer(server.id, { url: text })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.10:5665"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.separator} />

            {/* Authentication Toggle */}
            <View style={styles.toggleWrapper}>
              <View style={styles.toggleLeft}>
                <View style={styles.toggleIconContainer}>
                  <Ionicons
                    name={server.authEnabled ? "lock-closed" : "lock-open-outline"}
                    size={20}
                    color="#535aff"
                  />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Authentication</Text>
                  <Text style={styles.toggleDescription}>
                    {server.authEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={server.authEnabled}
                onValueChange={(value) => updateServer(server.id, { authEnabled: value })}
                thumbColor={server.authEnabled ? '#535aff' : '#666'}
                trackColor={{ false: '#2a2a2a', true: 'rgba(83, 90, 255, 0.3)' }}
                ios_backgroundColor="#2a2a2a"
              />
            </View>

            {/* Auth Credentials */}
            {server.authEnabled && (
              <>
                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="person-outline" size={18} color="#535aff" style={styles.labelIcon} />
                    <Text style={styles.label}>Username</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={server.username}
                    onChangeText={(text) => updateServer(server.id, { username: text })}
                    autoCapitalize="none"
                    placeholder="Enter username"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="key-outline" size={18} color="#535aff" style={styles.labelIcon} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <PasswordInput
                    value={server.password}
                    onChangeText={(text) => updateServer(server.id, { password: text })}
                  />
                </View>
              </>
            )}

            {/* Delete Button */}
            {servers.length > 1 && (
              <>
                <View style={styles.separator} />
                <Pressable
                  onPress={() => deleteServer(server.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  <Text style={styles.deleteButtonText}>Delete Server</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TorrServer</Text>
        <Text style={styles.headerSubtitle}>Manage your server connections</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Servers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>SERVERS ({servers.length})</Text>
            <Pressable onPress={addServer} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={20} color="#535aff" />
              <Text style={styles.addButtonText}>Add Server</Text>
            </Pressable>
          </View>

          {servers.map(renderServer)}
        </View>

        {/* Save Button */}
        <Pressable
          onPress={saveServerConfigs}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled
          ]}
        >
          <Ionicons
            name={saving ? "hourglass-outline" : "checkmark-circle-outline"}
            size={20}
            color="#fff"
            style={styles.saveButtonIcon}
          />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save All Configurations'}
          </Text>
        </Pressable>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#535aff" />
          <Text style={styles.infoText}>
            Select an active server by tapping the radio button. Expand each server to configure its settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const PasswordInput = ({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.passwordContainer}>
      <TextInput
        style={[styles.input, styles.passwordInput]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        placeholder="Enter password"
        placeholderTextColor="#666"
      />
      <Pressable
        onPress={() => setShowPassword(!showPassword)}
        style={styles.eyeIcon}
      >
        <Ionicons
          name={showPassword ? "eye-off-outline" : "eye-outline"}
          size={20}
          color="#666"
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    margin: 'auto',
    maxWidth: 780
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    fontWeight: 500,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 500,
    color: '#888',
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: 500,
    color: '#535aff',
  },
  serverCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 12,
    overflow: 'hidden',
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  serverHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  radioButton: {
    marginRight: 12,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#535aff',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#535aff',
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: 500,
    color: '#fff',
    marginBottom: 2,
  },
  serverUrl: {
    fontSize: 13,
    color: '#888',
  },
  serverHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    backgroundColor: 'rgba(83, 90, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: 500,
    color: '#535aff',
  },
  serverDetails: {
    backgroundColor: '#1a1a1a',
  },
  inputWrapper: {
    padding: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
  },
  input: {
    height: 44,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  toggleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  toggleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(83, 90, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: 500,
    color: '#fff',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#888',
  },
  separator: {
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: 500,
    color: '#ff4444',
  },
  saveButton: {
    backgroundColor: '#535aff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 300,
    width: '100%',
    margin: 'auto'
  },
  saveButtonPressed: {
    backgroundColor: '#4248d9',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 500,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(83, 90, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(83, 90, 255, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
    marginLeft: 10,
  },
});

export default TorrServerScreen;