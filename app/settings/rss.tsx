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
import { useRouter } from 'expo-router';

interface RSSFeedConfig {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    refreshInterval: number; // in minutes
}

const RSS_FEEDS_KEY = StorageKeys.RSS_FEEDS_KEY || 'TORRCLIENT_RSS_FEEDS_KEY';

const RSSFeedsScreen = () => {
    const router = useRouter();
    const [feeds, setFeeds] = useState<RSSFeedConfig[]>([]);
    const [saving, setSaving] = useState(false);
    const [expandedFeedId, setExpandedFeedId] = useState<string>('');

    useEffect(() => {
        loadRSSFeeds();
    }, []);

    const loadRSSFeeds = async () => {
        try {
            const feedsJson = storageService.getItem(RSS_FEEDS_KEY);

            if (feedsJson) {
                const loadedFeeds = JSON.parse(feedsJson);
                setFeeds(loadedFeeds);
                setExpandedFeedId(loadedFeeds[0]?.id || '');
            } else {
                const defaultFeed: RSSFeedConfig = {
                    id: Date.now().toString(),
                    name: '',
                    url: '',
                    enabled: true,
                    refreshInterval: 30,
                };
                setFeeds([defaultFeed]);
                setExpandedFeedId(defaultFeed.id);
            }
        } catch (error) {
            console.error('Failed to load RSS feeds:', error);
        }
    };

    const saveRSSFeeds = async () => {
        setSaving(true);
        try {
            if (isHapticsSupported()) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            for (const feed of feeds) {
                if (!feed.url) {
                    showAlert('Missing URL', `Feed "${feed.name || 'Unnamed'}" requires a URL.`);
                    setSaving(false);
                    return;
                }
                if (!feed.url.startsWith('http')) {
                    showAlert('Invalid URL', `Feed "${feed.name}" has an invalid URL (must start with http/https).`);
                    setSaving(false);
                    return;
                }
            }

            storageService.setItem(RSS_FEEDS_KEY, JSON.stringify(feeds));
            showAlert('Saved', 'RSS feed configurations saved successfully.');
        } catch (error) {
            console.error('Failed to save RSS feeds:', error);
            showAlert('Error', 'Failed to save configurations.');
        } finally {
            setSaving(false);
        }
    };

    const addFeed = () => {
        const newFeed: RSSFeedConfig = {
            id: Date.now().toString(),
            name: '',
            url: '',
            enabled: true,
            refreshInterval: 30,
        };
        setFeeds([...feeds, newFeed]);
        setExpandedFeedId(newFeed.id);
    };

    const deleteFeed = async (id: string) => {
        if (feeds.length === 1) {
            showAlert('Cannot Delete', 'You must have at least one RSS feed configured.');
            return;
        }

        const confirmed = await confirmAction(
            'Delete Feed',
            'Are you sure you want to delete this RSS feed?',
            'Delete'
        );
        if (!confirmed) return;

        const newFeeds = feeds.filter(f => f.id !== id);
        setFeeds(newFeeds);

        if (expandedFeedId === id) {
            setExpandedFeedId(newFeeds[0].id);
        }
    };

    const updateFeed = (id: string, updates: Partial<RSSFeedConfig>) => {
        setFeeds(feeds.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const toggleExpanded = (id: string) => {
        setExpandedFeedId(expandedFeedId === id ? '' : id);
    };

    const navigateToFeedViewer = (feed: RSSFeedConfig) => {
        if (!feed.url) {
            showAlert('Invalid Feed', 'Please configure a URL for this feed first.');
            return;
        }
        router.push({
            pathname: '/(tabs)/rss',
            params: { feedId: feed.id }
        });
    };

    const renderFeed = (feed: RSSFeedConfig) => {
        const isExpanded = feed.id === expandedFeedId;

        return (
            <View key={feed.id} style={styles.feedCard}>
                {/* Feed Header */}
                <Pressable
                    onPress={() => toggleExpanded(feed.id)}
                    style={({ pressed }) => [
                        styles.feedHeader,
                        pressed && styles.cellPressed
                    ]}
                >
                    <View style={styles.feedHeaderContent}>
                        <View style={styles.feedStatusIndicator}>
                            <View style={[
                                styles.statusDot,
                                feed.enabled ? styles.statusDotActive : styles.statusDotInactive
                            ]} />
                        </View>
                        <View style={styles.feedInfo}>
                            <Text style={styles.feedName}>
                                {feed.name || 'Unnamed Feed'}
                            </Text>
                            {feed.url ? (
                                <Text style={styles.feedUrl} numberOfLines={1}>
                                    {feed.url}
                                </Text>
                            ) : null}
                        </View>
                        <Pressable
                            onPress={() => navigateToFeedViewer(feed)}
                            style={styles.viewButton}
                            hitSlop={8}
                        >
                            <Ionicons name="newspaper-outline" size={20} color="#007AFF" />
                        </Pressable>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#8E8E93"
                        />
                    </View>
                </Pressable>

                {/* Expanded Feed Config */}
                {isExpanded && (
                    <View style={styles.feedDetails}>
                        {/* Feed Name */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Name</Text>
                            <TextInput
                                style={styles.formInput}
                                value={feed.name}
                                onChangeText={(text) => updateFeed(feed.id, { name: text })}
                                placeholder="My RSS Feed"
                                placeholderTextColor="#8E8E93"
                                textAlign="right"
                            />
                        </View>

                        <View style={styles.rowSeparator} />

                        {/* Feed URL */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>URL</Text>
                            <TextInput
                                style={styles.formInput}
                                value={feed.url}
                                onChangeText={(text) => updateFeed(feed.id, { url: text })}
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="https://example.com/feed.xml"
                                placeholderTextColor="#8E8E93"
                                textAlign="right"
                            />
                        </View>

                        <View style={styles.rowSeparator} />

                        {/* Enabled Toggle */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Enabled</Text>
                            <Switch
                                value={feed.enabled}
                                onValueChange={(value) => updateFeed(feed.id, { enabled: value })}
                                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                                ios_backgroundColor="#E5E5EA"
                            />
                        </View>

                        <View style={styles.rowSeparator} />

                        {/* Refresh Interval */}
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Refresh Interval</Text>
                            <View style={styles.intervalContainer}>
                                <TextInput
                                    style={styles.intervalInput}
                                    value={feed.refreshInterval.toString()}
                                    onChangeText={(text) => {
                                        const num = parseInt(text) || 30;
                                        updateFeed(feed.id, { refreshInterval: num });
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="30"
                                    placeholderTextColor="#8E8E93"
                                    textAlign="right"
                                />
                                <Text style={styles.intervalUnit}>min</Text>
                            </View>
                        </View>

                        {/* Delete Button */}
                        {feeds.length > 1 && (
                            <>
                                <Pressable
                                    onPress={() => deleteFeed(feed.id)}
                                    style={({ pressed }) => [
                                        styles.deleteButton,
                                        pressed && styles.cellPressed
                                    ]}
                                >
                                    <Text style={styles.deleteButtonText}>Delete Feed</Text>
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
                <Text style={styles.headerTitle}>RSS Feeds</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {/* Section Header */}
                <View style={styles.sectionHeaderContainer}>
                    <Text style={styles.sectionHeader}>FEEDS</Text>
                </View>

                {/* Feeds Section */}
                <View style={styles.section}>
                    {feeds.map(renderFeed)}
                </View>

                {/* Add Feed Button */}
                <Pressable
                    onPress={addFeed}
                    style={({ pressed }) => [
                        styles.addFeedButton,
                        pressed && styles.cellPressed
                    ]}
                >
                    <Ionicons name="add-circle" size={22} color="#007AFF" />
                    <Text style={styles.addFeedText}>Add Feed</Text>
                </Pressable>

                {/* Footer Text */}
                <Text style={styles.footerText}>
                    RSS feeds are automatically refreshed based on the configured interval. Tap the newspaper icon to view feed items.
                </Text>

                {/* Save Button */}
                <Pressable
                    onPress={saveRSSFeeds}
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
    },
    section: {
        marginBottom: 35,
    },
    feedCard: {
        backgroundColor: '#1C1C1E',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 10,
        overflow: 'hidden',
    },
    feedHeader: {
        paddingVertical: 11,
        paddingHorizontal: 16,
    },
    feedHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cellPressed: {
        backgroundColor: '#2C2C2E',
    },
    feedStatusIndicator: {
        padding: 4,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusDotActive: {
        backgroundColor: '#34C759',
    },
    statusDotInactive: {
        backgroundColor: '#8E8E93',
    },
    feedInfo: {
        flex: 1,
    },
    feedName: {
        fontSize: 16,
        fontWeight: '400',
        color: '#FFFFFF',
        letterSpacing: -0.41,
    },
    feedUrl: {
        fontSize: 15,
        color: '#8E8E93',
        marginTop: 1,
        letterSpacing: -0.24,
    },
    viewButton: {
        padding: 4,
    },
    feedDetails: {
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
        fontSize: 16,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        marginRight: 16,
    },
    formInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        paddingVertical: 0,
    },
    intervalContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    intervalInput: {
        fontSize: 16,
        color: '#FFFFFF',
        letterSpacing: -0.41,
        textAlign: 'right',
        minWidth: 50,
    },
    intervalUnit: {
        fontSize: 16,
        color: '#8E8E93',
        letterSpacing: -0.41,
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
    deleteButton: {
        paddingVertical: 11,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#FF453A',
        letterSpacing: -0.41,
    },
    addFeedButton: {
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
    addFeedText: {
        fontSize: 16,
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
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: -0.41,
    },
});

export default RSSFeedsScreen;