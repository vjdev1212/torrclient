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
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

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
                    style={({ pressed }) => [
                        styles.instanceHeader,
                        pressed && styles.cellPressed
                    ]}
                >
                    <View style={styles.instanceHeaderContent}>
                        <Pressable
                            onPress={() => setActiveInstanceId(instance.id)}
                            style={styles.radioButton}
                            hitSlop={8}
                        >
                            <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                                {isActive && <View style={styles.radioInner} />}
                            </View>
                        </Pressable>
                        <View style={styles.instanceInfo}>
                            <Text style={styles.instanceName}>
                                {instance.name || 'Unnamed Instance'}
                            </Text>
                            {instance.url ? (
                                <Text style={styles.instanceUrl} numberOfLines={1}>
                                    {instance.url}
                                </Text>
                            ) : null}
                        </View>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#8E8E93"
                        />
                    </View>
                </Pressable>

                {/* Expanded Instance Config */}
                {isExpanded && (
                    <View style={styles.instanceDetails}>
                        {/* Instance Name */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Name</Text>
                            <TextInput
                                style={styles.formInput}
                                value={instance.name}
                                onChangeText={(text) => updateInstance(instance.id, { name: text })}
                                placeholder="My Prowlarr"
                                placeholderTextColor="#8E8E93"
                                textAlign="right"
                            />
                        </View>

                        <View style={styles.rowSeparator} />

                        {/* Instance URL */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>URL</Text>
                            <TextInput
                                style={styles.formInput}
                                value={instance.url}
                                onChangeText={(text) => updateInstance(instance.id, { url: text })}
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="http://192.168.1.10:9696"
                                placeholderTextColor="#8E8E93"
                                textAlign="right"
                            />
                        </View>

                        <View style={styles.rowSeparator} />

                        {/* API Key */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>API Key</Text>
                            <PasswordInput
                                value={instance.apiKey}
                                onChangeText={(text) => updateInstance(instance.id, { apiKey: text })}
                                placeholder="Required"
                            />
                        </View>

                        <View style={styles.sectionSeparator} />

                        {/* Basic Authentication Toggle */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Basic Auth</Text>
                            <Switch
                                value={instance.authEnabled}
                                onValueChange={(value) => updateInstance(instance.id, { authEnabled: value })}
                                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                                ios_backgroundColor="#E5E5EA"
                            />
                        </View>

                        {/* Auth Credentials */}
                        {instance.authEnabled && (
                            <>
                                <View style={styles.rowSeparator} />

                                <View style={styles.formRow}>
                                    <Text style={styles.formLabel}>Username</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={instance.username}
                                        onChangeText={(text) => updateInstance(instance.id, { username: text })}
                                        autoCapitalize="none"
                                        placeholder="Username"
                                        placeholderTextColor="#8E8E93"
                                        textAlign="right"
                                    />
                                </View>

                                <View style={styles.rowSeparator} />

                                <View style={styles.formRow}>
                                    <Text style={styles.formLabel}>Password</Text>
                                    <PasswordInput
                                        value={instance.password}
                                        onChangeText={(text) => updateInstance(instance.id, { password: text })}
                                        placeholder="Password"
                                    />
                                </View>
                            </>
                        )}

                        <View style={styles.sectionSeparator} />

                        {/* Custom Headers Section */}
                        <View style={styles.headersSectionTitle}>
                            <Text style={styles.sectionFooter}>CUSTOM HEADERS</Text>
                            <Pressable
                                onPress={() => addCustomHeader(instance.id)}
                                hitSlop={8}
                            >
                                <Text style={styles.addHeaderLink}>Add</Text>
                            </Pressable>
                        </View>

                        {instance.customHeaders.length === 0 ? (
                            <View style={styles.emptyHeaders}>
                                <Text style={styles.emptyHeadersText}>No custom headers</Text>
                            </View>
                        ) : (
                            <View style={styles.headersList}>
                                {instance.customHeaders.map((header, index) => (
                                    <View key={index}>
                                        {index > 0 && <View style={styles.rowSeparator} />}
                                        <View style={styles.headerItem}>
                                            <View style={styles.headerInputs}>
                                                <TextInput
                                                    style={[styles.formInput, styles.headerKeyInput]}
                                                    value={header.key}
                                                    onChangeText={(text) => updateCustomHeader(instance.id, index, { key: text })}
                                                    placeholder="Header"
                                                    placeholderTextColor="#8E8E93"
                                                    autoCapitalize="none"
                                                />
                                                <View style={styles.headerColon}>
                                                    <Text style={styles.headerColonText}>:</Text>
                                                </View>
                                                <TextInput
                                                    style={[styles.formInput, styles.headerValueInput]}
                                                    value={header.value}
                                                    onChangeText={(text) => updateCustomHeader(instance.id, index, { value: text })}
                                                    placeholder="Value"
                                                    placeholderTextColor="#8E8E93"
                                                />
                                            </View>
                                            <Pressable
                                                onPress={() => deleteCustomHeader(instance.id, index)}
                                                style={styles.deleteHeaderButton}
                                                hitSlop={8}
                                            >
                                                <Ionicons name="remove-circle-outline" size={22} color="#FF3B30" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Delete Button */}
                        {instances.length > 1 && (
                            <>
                                <View style={styles.sectionSeparator} />
                                <Pressable
                                    onPress={() => deleteInstance(instance.id)}
                                    style={({ pressed }) => [
                                        styles.deleteButton,
                                        pressed && styles.cellPressed
                                    ]}
                                >
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
                <Text style={styles.headerTitle}>Prowlarr</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {/* Section Header */}
                <View style={styles.sectionHeaderContainer}>
                    <Text style={styles.sectionHeader}>INSTANCES</Text>
                </View>

                {/* Instances Section */}
                <View style={styles.section}>
                    {instances.map(renderInstance)}
                </View>

                {/* Add Instance Button */}
                <Pressable
                    onPress={addInstance}
                    style={({ pressed }) => [
                        styles.addInstanceButton,
                        pressed && styles.cellPressed
                    ]}
                >
                    <Ionicons name="add-circle" size={22} color="#007AFF" />
                    <Text style={styles.addInstanceText}>Add Instance</Text>
                </Pressable>

                {/* Footer Text */}
                <Text style={styles.footerText}>
                    Select an active instance by tapping the radio button. Custom headers can be added for advanced configuration.
                </Text>

                {/* Save Button */}
                <Pressable
                    onPress={saveProwlarrConfigs}
                    disabled={saving}
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && !saving && styles.saveButtonPressed,
                        saving && styles.saveButtonDisabled
                    ]}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
};

const PasswordInput = ({ value, onChangeText, placeholder = "Required" }: { value: string; onChangeText: (text: string) => void; placeholder?: string }) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={styles.passwordContainer}>
            <TextInput
                style={styles.passwordInput}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder={placeholder}
                placeholderTextColor="#8E8E93"
                textAlign="right"
            />
            <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                hitSlop={8}
            >
                <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#8E8E93"
                />
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: '#000000',
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.37,
    },
    content: {
        paddingBottom: 40,
    },
    sectionHeaderContainer: {
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 6,
        backgroundColor: '#000000',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '400',
        color: '#8E8E93',
        letterSpacing: -0.08,
    },
    section: {
        marginBottom: 35,
    },
    instanceCard: {
        backgroundColor: '#1C1C1E',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 10,
        overflow: 'hidden',
    },
    instanceHeader: {
        paddingVertical: 11,
        paddingHorizontal: 16,
    },
    instanceHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cellPressed: {
        backgroundColor: '#2C2C2E',
    },
    radioButton: {
        padding: 4,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#48484A',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
    radioOuterActive: {
        borderColor: '#0A84FF',
        backgroundColor: '#0A84FF',
    },
    radioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
    instanceInfo: {
        flex: 1,
    },
    instanceName: {
        fontSize: 17,
        fontWeight: '400',
        color: '#FFFFFF',
        letterSpacing: -0.41,
    },
    instanceUrl: {
        fontSize: 15,
        color: '#8E8E93',
        marginTop: 1,
        letterSpacing: -0.24,
    },
    instanceDetails: {
        backgroundColor: '#1C1C1E',
    },
    formRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        paddingHorizontal: 16,
        minHeight: 44,
    },
    formLabel: {
        fontSize: 17,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        marginRight: 16,
    },
    formInput: {
        flex: 1,
        fontSize: 17,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        paddingVertical: 0,
    },
    passwordContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    passwordInput: {
        flex: 1,
        fontSize: 17,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        paddingVertical: 0,
        paddingRight: 8,
    },
    eyeIcon: {
        padding: 4,
    },
    rowSeparator: {
        height: 0.5,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    sectionSeparator: {
        height: 20,
        backgroundColor: '#000000',
    },
    headersSectionTitle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#000000',
    },
    sectionFooter: {
        fontSize: 13,
        fontWeight: '400',
        color: '#8E8E93',
        letterSpacing: -0.08,
    },
    addHeaderLink: {
        fontSize: 17,
        color: '#0A84FF',
        letterSpacing: -0.41,
    },
    emptyHeaders: {
        paddingVertical: 28,
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
    emptyHeadersText: {
        fontSize: 17,
        color: '#8E8E93',
        letterSpacing: -0.41,
    },
    headersList: {
        backgroundColor: '#1C1C1E',
    },
    headerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 16,
        gap: 12,
    },
    headerInputs: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerKeyInput: {
        flex: 1,
    },
    headerColon: {
        paddingHorizontal: 4,
    },
    headerColonText: {
        fontSize: 17,
        color: '#8E8E93',
    },
    headerValueInput: {
        flex: 1.5,
    },
    deleteHeaderButton: {
        padding: 4,
    },
    deleteButton: {
        paddingVertical: 11,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
    deleteButtonText: {
        fontSize: 17,
        fontWeight: '400',
        color: '#FF453A',
        letterSpacing: -0.41,
    },
    addInstanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1C1C1E',
        marginHorizontal: 20,
        paddingVertical: 11,
        borderRadius: 10,
        gap: 8,
        marginBottom: 8,
    },
    addInstanceText: {
        fontSize: 17,
        fontWeight: '400',
        color: '#0A84FF',
        letterSpacing: -0.41,
    },
    footerText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
        paddingHorizontal: 36,
        paddingTop: 8,
        paddingBottom: 24,
        textAlign: 'left',
        letterSpacing: -0.08,
    },
    saveButton: {
        backgroundColor: '#0A84FF',
        marginHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveButtonPressed: {
        backgroundColor: '#0066CC',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.41,
    },
});

export default ProwlarrScreen;