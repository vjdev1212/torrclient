import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Linking,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
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

const RSS_FEEDS_KEY = StorageKeys.RSS_FEEDS_KEY || 'TORRCLIENT_RSS_FEEDS_KEY';

const RSSViewerScreen = () => {
    const router = useRouter();

    const [feeds, setFeeds] = useState<RSSFeedConfig[]>([]);
    const [selectedFeed, setSelectedFeed] = useState<RSSFeedConfig | null>(null);
    const [items, setItems] = useState<RSSItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<RSSItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadFeeds();
    }, []);

    useEffect(() => {
        filterItems();
    }, [searchQuery, items]);

    const loadFeeds = async () => {
        try {
            const feedsJson = storageService.getItem(RSS_FEEDS_KEY);
            if (!feedsJson) {
                setError('No RSS feeds configured. Please add a feed first.');
                setLoading(false);
                return;
            }

            const loadedFeeds: RSSFeedConfig[] = JSON.parse(feedsJson);
            
            if (loadedFeeds.length === 0) {
                setError('No RSS feeds configured. Please add a feed first.');
                setLoading(false);
                return;
            }

            setFeeds(loadedFeeds);

            // Select the first enabled feed, or just the first feed
            const defaultFeed = loadedFeeds.find(f => f.enabled) || loadedFeeds[0];
            setSelectedFeed(defaultFeed);
            await fetchRSSFeed(defaultFeed);
        } catch (error) {
            console.error('Failed to load feeds:', error);
            setError('Failed to load feed configuration. Please try again.');
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
        
        const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
        
        if (!itemMatches) return items;

        itemMatches.forEach(itemXml => {
            const title = extractTag(itemXml, 'title');
            const link = extractTag(itemXml, 'link');
            const description = extractTag(itemXml, 'description');
            const pubDate = extractTag(itemXml, 'pubDate');
            const guid = extractTag(itemXml, 'guid') || link;

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

    const filterItems = () => {
        if (!searchQuery.trim()) {
            setFilteredItems(items);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = items.filter(item => 
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
        setFilteredItems(filtered);
    };

    const handleRefresh = async () => {
        if (!selectedFeed || refreshing) return;
        if (isHapticsSupported()) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await fetchRSSFeed(selectedFeed, true);
    };

    const handleFeedSelect = async (feedId: string) => {
        const feed = feeds.find(f => f.id === feedId);
        if (!feed) return;

        setSelectedFeed(feed);
        setSearchQuery('');
        setItems([]);
        
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }
        
        await fetchRSSFeed(feed);
    };

    const handleAddToTorrServer = async (item: RSSItem) => {
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }

        const torrentLink = item.enclosure?.url || item.link;

        if (!torrentLink) {
            showAlert('No Link', 'This item does not have a torrent link.');
            return;
        }

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

    const handleClearSearch = () => {
        setSearchQuery('');
        if (isHapticsSupported()) Haptics.selectionAsync();
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

    const getFeedMenuActions = () => {
        return feeds.map(feed => ({
            id: feed.id,
            title: feed.name || 'Unnamed Feed',
            state: selectedFeed?.id === feed.id ? ('on' as const) : ('off' as const),
            titleColor: selectedFeed?.id === feed.id ? '#007AFF' : undefined,
        }));
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
                    {error.includes('configured') ? (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => router.back()}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.retryButtonText}>Go Back</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={handleRefresh}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                    )}
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
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.contentWrapper}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>RSS Feeds</Text>
                        <Text style={styles.headerSubtitle}>
                            Browse your feed items
                        </Text>
                    </View>

                    {/* Feed Selector */}
                    {feeds.length > 0 && (
                        <MenuView
                            onPressAction={({ nativeEvent }) => {
                                handleFeedSelect(nativeEvent.event);
                            }}
                            actions={getFeedMenuActions()}
                            shouldOpenOnLongPress={false}
                            themeVariant="dark"
                        >
                            <View style={styles.feedSelector}>
                                <View style={styles.feedSelectorContent}>
                                    <Ionicons name="newspaper" size={18} color="#8E8E93" />
                                    <Text style={styles.feedSelectorText} numberOfLines={1}>
                                        {selectedFeed?.name || 'Select Feed'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                                </View>
                            </View>
                        </MenuView>
                    )}

                    {/* Search Bar */}
                    <View style={styles.searchBarContainer}>
                        <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search in feed..."
                            autoCapitalize="none"
                            placeholderTextColor="#8E8E93"
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                                <Ionicons name="close-circle" size={20} color="#8E8E93" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Results Count */}
                    {items.length > 0 && (
                        <Text style={styles.resultsHeader}>
                            {searchQuery ? (
                                `${filteredItems.length} of ${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'}`
                            ) : (
                                `${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'}`
                            )}
                        </Text>
                    )}

                    {/* Items */}
                    {filteredItems.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyStateIcon}>
                                <Ionicons 
                                    name={searchQuery ? "search-outline" : "newspaper-outline"} 
                                    size={48} 
                                    color="#007AFF" 
                                />
                            </View>
                            <Text style={styles.emptyStateTitle}>
                                {searchQuery ? 'No Results' : 'No Items'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                {searchQuery 
                                    ? 'Try adjusting your search query'
                                    : "This feed doesn't have any items yet"
                                }
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.itemsContainer}>
                            {filteredItems.map((item, index) => (
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
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.35,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '400',
    },
    feedSelector: {
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    feedSelectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
    },
    feedSelectorText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
        paddingHorizontal: 8,
        height: 36,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 6,
        marginLeft: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        paddingVertical: 8,
        letterSpacing: -0.41,
    },
    clearButton: {
        padding: 2,
        marginLeft: 4,
    },
    resultsHeader: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 12,
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