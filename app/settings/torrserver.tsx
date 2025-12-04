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
const TORRSERVER_CONFIGS_KEY = StorageKeys.TORRSERVER_CONFIGS_KEY
const TORRSERVER_ACTIVE_ID_KEY = StorageKeys.TORRSERVER_ACTIVE_ID_KEY

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
      const serversJson = storageService.getItem(TORRSERVER_CONFIGS_KEY);
      const activeId = storageService.getItem(TORRSERVER_ACTIVE_ID_KEY);

      if (serversJson) {
        const loadedServers = JSON.parse(serversJson);
        setServers(loadedServers);
        setActiveServerId(activeId || (loadedServers[0]?.id || ''));
        setExpandedServerId(activeId || (loadedServers[0]?.id || ''));
      } else {
        // Create default server
        const defaultServer: ServerConfig = {
          id: Date.now().toString(),
          name: '',
          url: '',
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
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      storageService.setItem(TORRSERVER_CONFIGS_KEY, JSON.stringify(servers));
      storageService.setItem(TORRSERVER_ACTIVE_ID_KEY, activeServerId);

      showAlert('Saved', 'Server configurations saved successfully.');
    } catch (error) {
      console.error('Failed to save server configs:', error);
      showAlert('Error', 'Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  const addServer = () => {
    if (isHapticsSupported()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newServer: ServerConfig = {
      id: Date.now().toString(),
      name: ``,
      url: '',
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
    if (isHapticsSupported()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
          style={({ pressed }) => [
            styles.serverHeader,
            pressed && styles.serverHeaderPressed
          ]}
        >
          <View style={styles.serverHeaderLeft}>
            <Pressable
              onPress={() => {
                if (isHapticsSupported()) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setActiveServerId(server.id);
              }}
              style={styles.radioButton}
            >
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive && <View style={styles.radioInner} />}
              </View>
            </Pressable>
            <View style={styles.serverInfo}>
              <Text style={styles.serverName}>{server.name || 'Unnamed Server'}</Text>
              <Text style={styles.serverUrl} numberOfLines={1}>
                {server.url || 'Not configured'}
              </Text>
            </View>
          </View>
          <View style={styles.serverHeaderRight}>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#8E8E93"
            />
          </View>
        </Pressable>

        {/* Expanded Server Config */}
        {isExpanded && (
          <View style={styles.serverDetails}>
            <View style={styles.separator} />

            {/* Server Name */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>SERVER NAME</Text>
              <TextInput
                style={styles.input}
                value={server.name}
                onChangeText={(text) => updateServer(server.id, { name: text })}
                placeholder="My TorrServer"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.separator} />

            {/* Server URL */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>BASE URL</Text>
              <TextInput
                style={styles.input}
                value={server.url}
                onChangeText={(text) => updateServer(server.id, { url: text })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.10:5665"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.separator} />

            {/* Authentication Toggle */}
            <View style={styles.toggleWrapper}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleLabel}>Authentication</Text>
              </View>
              <Switch
                value={server.authEnabled}
                onValueChange={(value) => updateServer(server.id, { authEnabled: value })}
                thumbColor="#fff"
                trackColor={{ false: '#3A3A3C', true: '#34C759' }}
                ios_backgroundColor="#3A3A3C"
              />
            </View>

            {/* Auth Credentials */}
            {server.authEnabled && (
              <>
                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>USERNAME</Text>
                  <TextInput
                    style={styles.input}
                    value={server.username}
                    onChangeText={(text) => updateServer(server.id, { username: text })}
                    autoCapitalize="none"
                    placeholder="Username"
                    placeholderTextColor="#8E8E93"
                  />
                </View>

                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>PASSWORD</Text>
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
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed
                  ]}
                >
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Servers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>SERVERS</Text>
            <Pressable onPress={addServer} style={styles.addButton}>
              <Ionicons name="add-circle" size={26} color="#007AFF" />
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
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Configurations'}
          </Text>
        </Pressable>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Select an active server by tapping the radio button. Expand to configure settings.
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
        placeholder="Password"
        placeholderTextColor="#8E8E93"
      />
      <Pressable
        onPress={() => setShowPassword(!showPassword)}
        style={styles.eyeIcon}
      >
        <Ionicons
          name={showPassword ? "eye-off" : "eye"}
          size={20}
          color="#8E8E93"
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.35,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    letterSpacing: -0.08,
    textTransform: 'uppercase',
  },
  addButton: {
    padding: 4,
  },
  serverCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 60,
  },
  serverHeaderPressed: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  serverHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  radioButton: {
    marginRight: 12,
    padding: 4,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  radioOuterActive: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  serverInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  serverName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.41,
  },
  serverUrl: {
    fontSize: 13,
    color: '#8E8E93',
    letterSpacing: -0.08,
  },
  serverHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  activeBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: 0.6,
  },
  serverDetails: {
    backgroundColor: '#1C1C1E',
  },
  inputWrapper: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 8,
    letterSpacing: -0.08,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.41,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
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
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  toggleLeft: {
    flex: 1,
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.41,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(84, 84, 88, 0.65)',
    marginLeft: 16,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  deleteButtonPressed: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FF3B30',
    letterSpacing: -0.41,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 20,
    minHeight: 50,
  },
  saveButtonPressed: {
    backgroundColor: '#0051D5',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginLeft: 12,
    letterSpacing: -0.08,
  },
});

export default TorrServerScreen;