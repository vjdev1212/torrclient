import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { StatusBar, Text, View } from '@/components/Themed';
import { confirmAction, isHapticsSupported, showAlert } from '@/utils/platform';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StorageKeys, storageService } from '@/utils/StorageService';

interface CustomHeader {
  key: string;
  value: string;
}

interface ProwlarrConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  authEnabled: boolean;
  username: string;
  password: string;
  customHeaders: CustomHeader[];
}

const PROWLARR_CONFIGS_KEY = StorageKeys.PROWLARR_CONFIGS_KEY;
const PROWLARR_ACTIVE_ID_KEY = StorageKeys.PROWLARR_ACTIVE_ID_KEY;

const ProwlarrScreen = () => {
  const [instances, setInstances] = useState<ProwlarrConfig[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expandedInstanceId, setExpandedInstanceId] = useState<string>('');

  useEffect(() => {
    loadProwlarrConfigs();
  }, []);

  const loadProwlarrConfigs = async () => {
    try {
      const instancesJson = storageService.getItem(PROWLARR_CONFIGS_KEY);
      const activeId = storageService.getItem(PROWLARR_ACTIVE_ID_KEY);

      if (instancesJson) {
        const loadedInstances = JSON.parse(instancesJson);
        setInstances(loadedInstances);
        setActiveInstanceId(activeId || (loadedInstances[0]?.id || ''));
        setExpandedInstanceId(activeId || (loadedInstances[0]?.id || ''));
      } else {
        // Create default instance
        const defaultInstance: ProwlarrConfig = {
          id: Date.now().toString(),
          name: '',
          url: '',
          apiKey: '',
          authEnabled: false,
          username: '',
          password: '',
          customHeaders: [],
        };
        setInstances([defaultInstance]);
        setActiveInstanceId(defaultInstance.id);
        setExpandedInstanceId(defaultInstance.id);
      }
    } catch (error) {
      console.error('Failed to load Prowlarr configs:', error);
    }
  };

  const saveProwlarrConfigs = async () => {
    setSaving(true);
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }

      // Validate all instances
      for (const instance of instances) {
        if (!instance.url) {
          showAlert('Missing URL', `Instance "${instance.name || 'Unnamed'}" requires a URL.`);
          setSaving(false);
          return;
        }
        if (!instance.url.startsWith('http')) {
          showAlert('Invalid URL', `Instance "${instance.name}" has an invalid URL (must start with http/https).`);
          setSaving(false);
          return;
        }
        if (!instance.apiKey) {
          showAlert('Missing API Key', `Instance "${instance.name || 'Unnamed'}" requires an API key.`);
          setSaving(false);
          return;
        }
        if (instance.authEnabled && (!instance.username || !instance.password)) {
          showAlert('Missing Credentials', `Instance "${instance.name}" has authentication enabled but missing username or password.`);
          setSaving(false);
          return;
        }
      }

      storageService.setItem(PROWLARR_CONFIGS_KEY, JSON.stringify(instances));
      storageService.setItem(PROWLARR_ACTIVE_ID_KEY, activeInstanceId);

      showAlert('Saved', 'Prowlarr configurations saved successfully.');
    } catch (error) {
      console.error('Failed to save Prowlarr configs:', error);
      showAlert('Error', 'Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  const addInstance = () => {
    const newInstance: ProwlarrConfig = {
      id: Date.now().toString(),
      name: '',
      url: '',
      apiKey: '',
      authEnabled: false,
      username: '',
      password: '',
      customHeaders: [],
    };
    setInstances([...instances, newInstance]);
    setExpandedInstanceId(newInstance.id);
  };

  const deleteInstance = async (id: string) => {
    if (instances.length === 1) {
      showAlert('Cannot Delete', 'You must have at least one Prowlarr instance configured.');
      return;
    }

    const confirmed = await confirmAction(
      'Delete Instance',
      'Are you sure you want to delete this Prowlarr instance?',
      'Delete'
    );
    if (!confirmed) return;

    const newInstances = instances.filter(i => i.id !== id);
    setInstances(newInstances);

    if (activeInstanceId === id) {
      setActiveInstanceId(newInstances[0].id);
    }
    if (expandedInstanceId === id) {
      setExpandedInstanceId(newInstances[0].id);
    }
  };

  const updateInstance = (id: string, updates: Partial<ProwlarrConfig>) => {
    setInstances(instances.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const addCustomHeader = (instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;

    const newHeader: CustomHeader = { key: '', value: '' };
    updateInstance(instanceId, {
      customHeaders: [...instance.customHeaders, newHeader]
    });
  };

  const updateCustomHeader = (instanceId: string, headerIndex: number, updates: Partial<CustomHeader>) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;

    const updatedHeaders = [...instance.customHeaders];
    updatedHeaders[headerIndex] = { ...updatedHeaders[headerIndex], ...updates };
    updateInstance(instanceId, { customHeaders: updatedHeaders });
  };

  const deleteCustomHeader = (instanceId: string, headerIndex: number) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;

    const updatedHeaders = instance.customHeaders.filter((_, idx) => idx !== headerIndex);
    updateInstance(instanceId, { customHeaders: updatedHeaders });
  };

  const toggleExpanded = (id: string) => {
    setExpandedInstanceId(expandedInstanceId === id ? '' : id);
  };

  const renderInstance = (instance: ProwlarrConfig) => {
    const isActive = instance.id === activeInstanceId;
    const isExpanded = instance.id === expandedInstanceId;

    return (
      <View key={instance.id} style={styles.instanceCard}>
        {/* Instance Header */}
        <Pressable
          onPress={() => toggleExpanded(instance.id)}
          style={styles.instanceHeader}
        >
          <View style={styles.instanceHeaderLeft}>
            <Pressable
              onPress={() => setActiveInstanceId(instance.id)}
              style={styles.radioButton}
            >
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive && <View style={styles.radioInner} />}
              </View>
            </Pressable>
            <View style={styles.instanceInfo}>
              <Text style={styles.instanceName}>
                {instance.name || 'Unnamed Instance'}
              </Text>
              <Text style={styles.instanceUrl} numberOfLines={1}>
                {instance.url || 'Not configured'}
              </Text>
            </View>
          </View>
          <View style={styles.instanceHeaderRight}>
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

        {/* Expanded Instance Config */}
        {isExpanded && (
          <View style={styles.instanceDetails}>
            <View style={styles.separator} />

            {/* Instance Name */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="pricetag-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                <Text style={styles.label}>Instance Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={instance.name}
                onChangeText={(text) => updateInstance(instance.id, { name: text })}
                placeholder="My Prowlarr"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.separator} />

            {/* Instance URL */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="globe-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                <Text style={styles.label}>Base URL</Text>
              </View>
              <TextInput
                style={styles.input}
                value={instance.url}
                onChangeText={(text) => updateInstance(instance.id, { url: text })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.10:9696"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.separator} />

            {/* API Key */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="key-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                <Text style={styles.label}>API Key</Text>
              </View>
              <PasswordInput
                value={instance.apiKey}
                onChangeText={(text) => updateInstance(instance.id, { apiKey: text })}
                placeholder="Enter API key"
              />
            </View>

            <View style={styles.separator} />

            {/* Basic Authentication Toggle */}
            <View style={styles.toggleWrapper}>
              <View style={styles.toggleLeft}>
                <View style={styles.toggleIconContainer}>
                  <Ionicons
                    name={instance.authEnabled ? "shield-checkmark" : "shield-outline"}
                    size={20}
                    color="#ff9500"
                  />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Basic Authentication</Text>
                  <Text style={styles.toggleDescription}>
                    {instance.authEnabled ? 'Enabled' : 'Optional'}
                  </Text>
                </View>
              </View>
              <Switch
                value={instance.authEnabled}
                onValueChange={(value) => updateInstance(instance.id, { authEnabled: value })}
                thumbColor={instance.authEnabled ? '#ff9500' : '#888'}
                trackColor={{ false: '#202020', true: 'rgba(255, 149, 0, 0.3)' }}
                ios_backgroundColor="#202020"
              />
            </View>

            {/* Auth Credentials */}
            {instance.authEnabled && (
              <>
                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="person-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                    <Text style={styles.label}>Username</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={instance.username}
                    onChangeText={(text) => updateInstance(instance.id, { username: text })}
                    autoCapitalize="none"
                    placeholder="Enter username"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="lock-closed-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <PasswordInput
                    value={instance.password}
                    onChangeText={(text) => updateInstance(instance.id, { password: text })}
                  />
                </View>
              </>
            )}

            <View style={styles.separator} />

            {/* Custom Headers Section */}
            <View style={styles.headersSection}>
              <View style={styles.headersSectionHeader}>
                <View style={styles.labelRow}>
                  <Ionicons name="code-outline" size={18} color="#ff9500" style={styles.labelIcon} />
                  <Text style={styles.label}>Custom Headers</Text>
                </View>
                <Pressable
                  onPress={() => addCustomHeader(instance.id)}
                  style={styles.addHeaderButton}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#ff9500" />
                  <Text style={styles.addHeaderText}>Add</Text>
                </Pressable>
              </View>

              {instance.customHeaders.length === 0 ? (
                <View style={styles.emptyHeaders}>
                  <Text style={styles.emptyHeadersText}>No custom headers added</Text>
                </View>
              ) : (
                <View style={styles.headersList}>
                  {instance.customHeaders.map((header, index) => (
                    <View key={index} style={styles.headerItem}>
                      <View style={styles.headerInputs}>
                        <TextInput
                          style={[styles.input, styles.headerKeyInput]}
                          value={header.key}
                          onChangeText={(text) => updateCustomHeader(instance.id, index, { key: text })}
                          placeholder="Header name"
                          placeholderTextColor="#666"
                          autoCapitalize="none"
                        />
                        <TextInput
                          style={[styles.input, styles.headerValueInput]}
                          value={header.value}
                          onChangeText={(text) => updateCustomHeader(instance.id, index, { value: text })}
                          placeholder="Value"
                          placeholderTextColor="#666"
                        />
                      </View>
                      <Pressable
                        onPress={() => deleteCustomHeader(instance.id, index)}
                        style={styles.deleteHeaderButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#ff4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Delete Button */}
            {instances.length > 1 && (
              <>
                <View style={styles.separator} />
                <Pressable
                  onPress={() => deleteInstance(instance.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  <Text style={styles.deleteButtonText}>Delete Instance</Text>
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
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="search-outline" size={28} color="#ff9500" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Prowlarr</Text>
            <Text style={styles.headerSubtitle}>Indexer management</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Instances Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>INSTANCES ({instances.length})</Text>
            <Pressable onPress={addInstance} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={20} color="#ff9500" />
              <Text style={styles.addButtonText}>Add Instance</Text>
            </Pressable>
          </View>

          {instances.map(renderInstance)}
        </View>

        {/* Save Button */}
        <Pressable
          onPress={saveProwlarrConfigs}
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
          <Ionicons name="information-circle-outline" size={20} color="#ff9500" />
          <Text style={styles.infoText}>
            Select an active instance by tapping the radio button. You can configure multiple Prowlarr instances and add custom headers for advanced use cases.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const PasswordInput = ({ value, onChangeText, placeholder = "Enter password" }: { value: string; onChangeText: (text: string) => void; placeholder?: string }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.passwordContainer}>
      <TextInput
        style={[styles.input, styles.passwordInput]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        placeholder={placeholder}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#535aff',
  },
  instanceCard: {
    backgroundColor: '#101010',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#202020',
    marginBottom: 12,
    overflow: 'hidden',
  },
  instanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  instanceHeaderLeft: {
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
    borderColor: '#ff9500',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff9500',
  },
  instanceInfo: {
    flex: 1,
  },
  instanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  instanceUrl: {
    fontSize: 13,
    color: '#888',
  },
  instanceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff9500',
  },
  instanceDetails: {
    backgroundColor: '#101010',
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
    fontWeight: '600',
    color: '#fff',
  },
  input: {
    height: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#303030',
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
    top: 7,
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
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#888',
  },
  separator: {
    height: 1,
    backgroundColor: '#202020',
  },
  headersSection: {
    padding: 16,
  },
  headersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9500',
  },
  emptyHeaders: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyHeadersText: {
    fontSize: 13,
    color: '#666',
  },
  headersList: {
    gap: 10,
  },
  headerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  headerKeyInput: {
    flex: 2,
  },
  headerValueInput: {
    flex: 3,
  },
  deleteHeaderButton: {
    padding: 4,
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
    fontWeight: '600',
    color: '#ff4444',
  },
  saveButton: {
    backgroundColor: '#ff9500',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 320,
    width: '100%',
    margin: 'auto',
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonPressed: {
    backgroundColor: '#e68a00',
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
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
    marginLeft: 10,
  },
});

export default ProwlarrScreen;