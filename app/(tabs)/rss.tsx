import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { StorageKeys, storageService } from '@/utils/StorageService';

interface RSSFeedConfig {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    refreshInterval: number;
}

interface RSSItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    guid: string;
    enclosure?: {
        url: string;
        type: string;
        length: string;
    };
}

const RSS_FEEDS_KEY = StorageKeys.RSS_FEEDS_KEY || 'rss_feeds';

const RSSViewerScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const feedId = params.feedId as string;

    const [feed, setFeed] = useState<RSSFeedConfig | null>(null);
    const [items, setItems] = useState<RSSItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async () => {
        try {
            const feedsJson = storageService.getItem(RSS_FEEDS_KEY);
            if (!feedsJson) {
                setError('Feed configuration not found');
                setLoading(false);
                return;
            }

            const feeds: RSSFeedConfig[] = JSON.parse(feedsJson);
            const currentFeed = feeds.find(f => f.id === feedId);

            if (!currentFeed) {
                setError('Feed not found');
                setLoading(false);
                return;
            }

            setFeed(currentFeed);
            await fetchRSSFeed(currentFeed);
        } catch (error) {
            console.error('Failed to load feed:', error);
            setError('Failed to load feed configuration');
            setLoading(false);
        }
    };

    const fetchRSSFeed = async (feedConfig: RSSFeedConfig, isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const headers: HeadersInit = {
                'Accept': 'application/rss+xml, application/xml, text/xml',
            };

            const response = await fetch(feedConfig.url, { headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const xmlText = await response.text();
            const parsedItems = parseRSS(xmlText);
            setItems(parsedItems);
        } catch (error) {
            console.error('Failed to fetch RSS feed:', error);
            setError(error instanceof Error ? error.message : 'Failed to fetch feed');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const parseRSS = (xmlText: string): RSSItem[] => {
        const items: RSSItem[] = [];
        
        // Simple XML parsing (in production, use a proper XML parser)
        const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
        
        if (!itemMatches) return items;

        itemMatches.forEach(itemXml => {
            const title = extractTag(itemXml, 'title');
            const link = extractTag(itemXml, 'link');
            const description = extractTag(itemXml, 'description');
            const pubDate = extractTag(itemXml, 'pubDate');
            const guid = extractTag(itemXml, 'guid') || link;

            // Extract enclosure (for torrent links)
            const enclosureMatch = itemXml.match(/<enclosure[^>]*>/i);
            let enclosure;
            if (enclosureMatch) {
                const enclosureTag = enclosureMatch[0];
                const url = extractAttribute(enclosureTag, 'url');
                const type = extractAttribute(enclosureTag, 'type');
                const length = extractAttribute(enclosureTag, 'length');
                enclosure = { url, type, length };
            }

            if (title) {
                items.push({
                    title: cleanHTML(title),
                    link,
                    description: cleanHTML(description),
                    pubDate,
                    guid,
                    enclosure,
                });
            }
        });

        return items;
    };

    const extractTag = (xml: string, tagName: string): string => {
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : '';
    };

    const extractAttribute = (tag: string, attrName: string): string => {
        const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');
        const match = tag.match(regex);
        return match ? match[1] : '';
    };

    const cleanHTML = (text: string): string => {
        return text
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    };

    const handleRefresh = async () => {
        if (!feed || refreshing) return;
        if (isHapticsSupported()) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await fetchRSSFeed(feed, true);
    };

    const handleAddToTorrServer = async (item: RSSItem) => {
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }

        // Get torrent link from enclosure or link
        const torrentLink = item.enclosure?.url || item.link;

        if (!torrentLink) {
            showAlert('No Link', 'This item does not have a torrent link.');
            return;
        }

        // Navigate to add torrent screen
        router.push({
            pathname: '/torrent/add',
            params: { 
                magnet: torrentLink,
                titleParam: item.title 
            },
        });
    };

    const handleOpenLink = async (url: string) => {
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                showAlert('Cannot Open Link', 'This link cannot be opened.');
            }
        } catch (error) {
            showAlert('Error', 'Failed to open link.');
        }
    };

    const formatDate = (dateString: string): string => {
        if (!dateString) return 'Unknown date';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
            });
        } catch {
            return dateString;
        }
    };

    const formatSize = (bytes: string): string => {
        const size = parseInt(bytes);
        if (isNaN(size)) return '';
        
        const gb = size / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        
        const mb = size / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    if (loading && items.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centeredContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.centeredText}>Loading feed...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error && items.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centeredContainer}>
                    <View style={styles.errorIcon}>
                        <Ionicons name="alert-circle-outline" color="#FF3B30" size={48} />
                    </View>
                    <Text style={styles.errorTitle}>Failed to Load Feed</Text>
                    <Text style={styles.errorSubtitle}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleRefresh}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#007AFF"
                    />
                }
            >
                <View style={styles.contentWrapper}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                            hitSlop={8}
                        >
                            <Ionicons name="chevron-back" size={28} color="#007AFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                {feed?.name || 'RSS Feed'}
                            </Text>
                            <Text style={styles.headerSubtitle}>
                                {items.length} {items.length === 1 ? 'item' : 'items'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleRefresh}
                            style={styles.refreshButton}
                            disabled={refreshing}
                            hitSlop={8}
                        >
                            <Ionicons 
                                name="refresh" 
                                size={24} 
                                color={refreshing ? "#8E8E93" : "#007AFF"} 
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Items */}
                    {items.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyStateIcon}>
                                <Ionicons name="newspaper-outline" size={48} color="#007AFF" />
                            </View>
                            <Text style={styles.emptyStateTitle}>No Items</Text>
                            <Text style={styles.emptyStateSubtext}>
                                This feed doesn't have any items yet
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.itemsContainer}>
                            {items.map((item, index) => (
                                <View key={item.guid || index} style={styles.itemCard}>
                                    {/* Item Header */}
                                    <View style={styles.itemHeader}>
                                        <View style={styles.itemDateBadge}>
                                            <Ionicons name="time-outline" size={12} color="#8E8E93" />
                                            <Text style={styles.itemDate}>
                                                {formatDate(item.pubDate)}
                                            </Text>
                                        </View>
                                        {item.enclosure && (
                                            <View style={styles.sizeBadge}>
                                                <Ionicons name="cube-outline" size={12} color="#8E8E93" />
                                                <Text style={styles.sizeText}>
                                                    {formatSize(item.enclosure.length)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Item Title */}
                                    <Text style={styles.itemTitle} numberOfLines={3}>
                                        {item.title}
                                    </Text>

                                    {/* Item Description */}
                                    {item.description && (
                                        <Text style={styles.itemDescription} numberOfLines={2}>
                                            {item.description}
                                        </Text>
                                    )}

                                    {/* Action Buttons */}
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={styles.addButton}
                                            onPress={() => handleAddToTorrServer(item)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                                            <Text style={styles.addButtonText}>Add to TorrServer</Text>
                                        </TouchableOpacity>
                                        {item.link && (
                                            <TouchableOpacity
                                                style={styles.linkButton}
                                                onPress={() => handleOpenLink(item.link)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="open-outline" size={18} color="#007AFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <BottomSpacing space={100} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default RSSViewerScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
    },
    contentWrapper: {
        flex: 1,
        paddingHorizontal: 20,
        maxWidth: 780,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    centeredText: {
        marginTop: 16,
        fontSize: 17,
        color: '#8E8E93',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
    errorIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.35,
    },
    errorSubtitle: {
        fontSize: 17,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '400',
        letterSpacing: -0.41,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 120,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '500',
        textAlign: 'center',
        letterSpacing: -0.41,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: 'transparent',
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitleContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.35,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '400',
        marginTop: 2,
    },
    refreshButton: {
        padding: 4,
    },
    itemsContainer: {
        backgroundColor: 'transparent',
    },
    itemCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    itemDateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    itemDate: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    sizeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    sizeText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
        lineHeight: 22,
        letterSpacing: -0.41,
    },
    itemDescription: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 20,
        marginBottom: 12,
        letterSpacing: -0.24,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'transparent',
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(142, 142, 147, 0.2)',
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
        letterSpacing: -0.24,
    },
    linkButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 22,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: 0.35,
    },
    emptyStateSubtext: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
        paddingHorizontal: 20,
        fontWeight: '400',
        letterSpacing: -0.41,
        lineHeight: 22,
    },
});