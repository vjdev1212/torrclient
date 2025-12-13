import React, { useState, useEffect } from 'react';
import {
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import ProwlarrClient, { ProwlarrSearchResult, ProwlarrIndexer, ProwlarrCategory } from '@/clients/prowlarr';
import { getTorrServerUrl } from '@/utils/TorrServer';
import { StorageKeys, storageService } from '@/utils/StorageService';

// Types
type SearchSource = 'prowlarr' | 'rss';

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

interface UnifiedSearchResult {
    source: SearchSource;
    prowlarrResult?: ProwlarrSearchResult;
    rssItem?: RSSItem;
}

const RSS_FEEDS_KEY = StorageKeys.RSS_FEEDS_KEY || 'TORRCLIENT_RSS_FEEDS_KEY';

const UnifiedSearchScreen = () => {
    const router = useRouter();
    
    // Search state
    const [searchSource, setSearchSource] = useState<SearchSource>('prowlarr');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<UnifiedSearchResult[]>([]);
    const [searched, setSearched] = useState(false);

    // Prowlarr state
    const [indexers, setIndexers] = useState<ProwlarrIndexer[]>([]);
    const [categories, setCategories] = useState<ProwlarrCategory[]>([]);
    const [selectedIndexer, setSelectedIndexer] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>('All Categories');

    // RSS state
    const [rssFeeds, setRssFeeds] = useState<RSSFeedConfig[]>([]);
    const [selectedRssFeed, setSelectedRssFeed] = useState<RSSFeedConfig | null>(null);
    const [rssItems, setRssItems] = useState<RSSItem[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (searchSource === 'rss') {
                loadRssFeeds();
            }
        }, [searchSource])
    );

    const loadData = async () => {
        setLoadingData(true);
        setError(null);
        
        try {
            // Load Prowlarr data
            const client = new ProwlarrClient();
            await client.initialize();

            const fetchedIndexers = await client.getIndexers();
            if (!fetchedIndexers || !Array.isArray(fetchedIndexers)) {
                throw new Error('Invalid indexers data received from Prowlarr');
            }

            const enabledIndexers = fetchedIndexers.filter(i => i.enable);
            if (enabledIndexers.length === 0) {
                throw new Error('No enabled indexers found in Prowlarr');
            }

            setIndexers(enabledIndexers);

            const fetchedCategories = await client.getCategories();
            const moviesTVCategories = fetchedCategories.filter(
                category => category.id === 2000 || category.id === 5000
            );
            setCategories(moviesTVCategories);

            // Load RSS feeds
            await loadRssFeeds();

            setLoadingData(false);
        } catch (error) {
            console.error('Failed to load data:', error);
            setError(error instanceof Error ? error.message : 'Failed to load data');
            setLoadingData(false);
        }
    };

    const loadRssFeeds = async () => {
        try {
            const feedsJson = storageService.getItem(RSS_FEEDS_KEY);
            if (feedsJson) {
                const loadedFeeds: RSSFeedConfig[] = JSON.parse(feedsJson);
                setRssFeeds(loadedFeeds);
            }
        } catch (error) {
            console.error('Failed to load RSS feeds:', error);
        }
    };

    const handleSearch = async () => {
        if (searchSource === 'prowlarr') {
            await handleProwlarrSearch();
        } else {
            await handleRssSearch();
        }
    };

    const handleProwlarrSearch = async () => {
        if (!query.trim()) return;

        if (isHapticsSupported()) await Haptics.selectionAsync();
        setLoading(true);
        setSearched(true);
        setResults([]);

        try {
            const client = new ProwlarrClient();
            await client.initialize();

            const searchResults = await client.search({
                query: query.trim(),
                indexerIds: selectedIndexer !== null ? [selectedIndexer] : undefined,
                categories: selectedCategory !== null ? [selectedCategory] : undefined,
                limit: 100,
            });

            const sorted = searchResults.sort((a, b) => {
                const seedersA = a.seeders || 0;
                const seedersB = b.seeders || 0;
                if (seedersB !== seedersA) return seedersB - seedersA;
                if (b.size !== a.size) return b.size - a.size;
                const ageA = a.ageMinutes || 999999;
                const ageB = b.ageMinutes || 999999;
                return ageA - ageB;
            });

            setResults(sorted.map(r => ({ source: 'prowlarr', prowlarrResult: r })));
        } catch (error) {
            console.error('Search error:', error);
            showAlert('Search Error', 'Failed to search torrents. Please check your Prowlarr configuration.');
        } finally {
            setLoading(false);
        }
    };

    const handleRssSearch = async () => {
        if (!selectedRssFeed) {
            showAlert('No Feed Selected', 'Please select an RSS feed first.');
            return;
        }

        setSearched(true);
        const searchQuery = query.trim().toLowerCase();
        
        if (!searchQuery) {
            // Show all items if no search query
            setResults(rssItems.map(item => ({ source: 'rss', rssItem: item })));
        } else {
            // Filter items
            const filtered = rssItems.filter(item => 
                item.title.toLowerCase().includes(searchQuery) ||
                item.description.toLowerCase().includes(searchQuery)
            );
            setResults(filtered.map(item => ({ source: 'rss', rssItem: item })));
        }
    };

    const fetchRSSFeed = async (feedConfig: RSSFeedConfig) => {
        setLoading(true);
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
            setRssItems(parsedItems);
            
            // Auto-display items if no search query
            if (!query.trim()) {
                setResults(parsedItems.map(item => ({ source: 'rss', rssItem: item })));
                setSearched(true);
            }
        } catch (error) {
            console.error('Failed to fetch RSS feed:', error);
            setError(error instanceof Error ? error.message : 'Failed to fetch feed');
            showAlert('RSS Error', 'Failed to fetch RSS feed.');
        } finally {
            setLoading(false);
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

    const handleRefresh = async () => {
        if (refreshing) return;
        
        if (isHapticsSupported()) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (searchSource === 'rss' && selectedRssFeed) {
            setRefreshing(true);
            await fetchRSSFeed(selectedRssFeed);
            setRefreshing(false);
        } else if (searchSource === 'prowlarr' && searched) {
            setRefreshing(true);
            await handleProwlarrSearch();
            setRefreshing(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
        if (isHapticsSupported()) Haptics.selectionAsync();
    };

    const handleRetry = async () => {
        if (isHapticsSupported()) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        loadData();
    };

    const handleSourceChange = async (source: SearchSource) => {
        if (isHapticsSupported()) await Haptics.selectionAsync();
        
        setSearchSource(source);
        setQuery('');
        setResults([]);
        setSearched(false);
        setError(null);

        if (source === 'rss') {
            await loadRssFeeds();
        }
    };

    const handleRssFeedSelect = async (feedId: string) => {
        const feed = rssFeeds.find(f => f.id === feedId);
        if (!feed) return;

        if (isHapticsSupported()) await Haptics.selectionAsync();

        setSelectedRssFeed(feed);
        setQuery('');
        setResults([]);
        setSearched(false);
        
        await fetchRSSFeed(feed);
    };

    const handleAddTorrent = async (result: UnifiedSearchResult) => {
        if (isHapticsSupported()) await Haptics.selectionAsync();

        let link = '';
        let title = '';

        if (result.source === 'prowlarr' && result.prowlarrResult) {
            const r = result.prowlarrResult;
            link = r.magnetUrl || r.hash || r.infoHash || r.downloadUrl || r.guid || '';
            title = r.title;
        } else if (result.source === 'rss' && result.rssItem) {
            const item = result.rssItem;
            link = item.enclosure?.url || item.link;
            title = item.title;
        }
        
        if (!link) {
            showAlert('No Link', 'This torrent does not have a valid link.');
            return;
        }

        router.push({
            pathname: '/torrent/add',
            params: { magnet: link, titleParam: title },
        });
    };

    const handleStreamNow = async (result: UnifiedSearchResult) => {
        if (isHapticsSupported()) await Haptics.selectionAsync();

        let torrentLink = '';
        let title = '';

        if (result.source === 'prowlarr' && result.prowlarrResult) {
            const r = result.prowlarrResult;
            torrentLink = r.hash || r.infoHash || r.magnetUrl || r.downloadUrl || r.guid || '';
            title = r.title;
        } else if (result.source === 'rss' && result.rssItem) {
            const item = result.rssItem;
            torrentLink = item.enclosure?.url || item.link;
            title = item.title;
        }

        if (!torrentLink) {
            showAlert('No Link', 'This torrent does not have a valid link.');
            return;
        }

        const baseUrl = getTorrServerUrl();
        const encodedLink = encodeURIComponent(torrentLink);
        const streamUrl = `${baseUrl}/stream?link=${encodedLink}&index=1&play&preload`;

        console.log('Stream Link', streamUrl);
        router.push({
            pathname: '/stream/player',
            params: { 
                url: streamUrl,
                title: title 
            },
        });
    };

    const formatDate = (dateString: string): string => {
        if (!dateString) return 'Unknown';
        
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

    const formatSize = (bytes: string | number): string => {
        const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
        if (isNaN(size)) return '';
        
        const gb = size / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        
        const mb = size / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const getCategoryDisplayName = (categoryId: number): string => {
        if (categoryId === 2000) return 'Movies (All)';
        if (categoryId === 5000) return 'TV (All)';

        for (const category of categories) {
            const subcategory = category.subCategories.find(sub => sub.id === categoryId);
            if (subcategory) {
                const mainName = category.name;
                const subName = subcategory.name.replace(`${mainName}/`, '');
                return `${mainName} - ${subName}`;
            }
        }
        return 'Other';
    };

    const getCategoryBadge = (categoryIds: number[]) => {
        if (!categoryIds || categoryIds.length === 0) return 'Unknown';
        return getCategoryDisplayName(categoryIds[0]);
    };

    // Menu actions
    const getSourceMenuActions = () => [
        {
            id: 'prowlarr',
            title: 'Prowlarr',
            state: searchSource === 'prowlarr' ? ('on' as const) : ('off' as const),
            titleColor: searchSource === 'prowlarr' ? '#007AFF' : undefined,
        },
        {
            id: 'rss',
            title: 'RSS Feeds',
            state: searchSource === 'rss' ? ('on' as const) : ('off' as const),
            titleColor: searchSource === 'rss' ? '#007AFF' : undefined,
        },
    ];

    const getIndexerMenuActions = () => {
        const actions = [
            {
                id: 'all',
                title: 'All Indexers',
                state: selectedIndexer === null ? ('on' as const) : ('off' as const),
                titleColor: selectedIndexer === null ? '#007AFF' : undefined,
            },
            ...indexers.map(indexer => ({
                id: indexer.id.toString(),
                title: indexer.name,
                state: selectedIndexer === indexer.id ? ('on' as const) : ('off' as const),
                titleColor: selectedIndexer === indexer.id ? '#007AFF' : undefined,
            })),
        ];
        return actions;
    };

    const getCategoryMenuActions = () => {
        const actions = [
            {
                id: 'all',
                title: 'All Categories',
                state: selectedCategory === null ? ('on' as const) : ('off' as const),
                titleColor: selectedCategory === null ? '#007AFF' : undefined,
            },
            ...categories.map(category => ({
                id: category.id.toString(),
                title: `${category.name} (All)`,
                state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                subactions: [
                    {
                        id: category.id.toString(),
                        title: 'All',
                        state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                        titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                    },
                    ...category.subCategories.map(sub => ({
                        id: sub.id.toString(),
                        title: sub.name.replace(`${category.name}/`, ''),
                        state: selectedCategory === sub.id ? ('on' as const) : ('off' as const),
                        titleColor: selectedCategory === sub.id ? '#007AFF' : undefined,
                    })),
                ],
            })),
        ];
        return actions;
    };

    const getRssFeedMenuActions = () => {
        return rssFeeds.map(feed => ({
            id: feed.id,
            title: feed.name || 'Unnamed Feed',
            state: selectedRssFeed?.id === feed.id ? ('on' as const) : ('off' as const),
            titleColor: selectedRssFeed?.id === feed.id ? '#007AFF' : undefined,
        }));
    };

    const handleIndexerSelect = async (indexerId: string) => {
        if (indexerId === 'all') {
            setSelectedIndexer(null);
        } else {
            setSelectedIndexer(parseInt(indexerId));
        }
        if (isHapticsSupported()) await Haptics.selectionAsync();
    };

    const handleCategorySelect = async (categoryId: string) => {
        if (categoryId === 'all') {
            setSelectedCategory(null);
            setSelectedCategoryName('All Categories');
        } else {
            const catId = parseInt(categoryId);
            setSelectedCategory(catId);
            setSelectedCategoryName(getCategoryDisplayName(catId));
        }
        if (isHapticsSupported()) await Haptics.selectionAsync();
    };

    const selectedIndexerName = selectedIndexer !== null
        ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
        : 'All Indexers';

    // Initial loading
    if (loadingData && indexers.length === 0 && !error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centeredContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.centeredText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (error && indexers.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centeredContainer}>
                    <View style={styles.errorIcon}>
                        <Ionicons name="server-outline" color="#FF3B30" size={48} />
                    </View>
                    <Text style={styles.errorTitle}>Connection Failed</Text>
                    <Text style={styles.errorSubtitle}>{error}</Text>
                    <Text style={styles.errorHint}>
                        Check your configuration in settings
                    </Text>
                    <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={handleRetry}
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
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
                            <Text style={styles.headerTitle}>Search</Text>
                            <Text style={styles.headerSubtitle}>
                                Find content from multiple sources
                            </Text>
                        </View>

                        {/* Source Selector */}
                        <MenuView
                            onPressAction={({ nativeEvent }) => {
                                handleSourceChange(nativeEvent.event as SearchSource);
                            }}
                            actions={getSourceMenuActions()}
                            shouldOpenOnLongPress={false}
                            themeVariant="dark"
                        >
                            <View style={styles.sourceSelector}>
                                <Ionicons name="layers-outline" size={18} color="#8E8E93" />
                                <Text style={styles.sourceSelectorText} numberOfLines={1}>
                                    {searchSource === 'prowlarr' ? 'Prowlarr' : 'RSS Feeds'}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                            </View>
                        </MenuView>

                        {/* Search Bar */}
                        <View style={styles.searchBarContainer}>
                            <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                                placeholder={searchSource === 'prowlarr' ? "Movies, TV Shows, Music" : "Search in feed..."}
                                autoCapitalize="none"
                                placeholderTextColor="#8E8E93"
                                returnKeyType="search"
                                onSubmitEditing={handleSearch}
                                submitBehavior="blurAndSubmit"
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                                    <Ionicons name="close-circle" size={20} color="#8E8E93" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filters - Prowlarr */}
                        {searchSource === 'prowlarr' && (
                            <View style={styles.filtersContainer}>
                                <MenuView
                                    onPressAction={({ nativeEvent }) => {
                                        handleIndexerSelect(nativeEvent.event);
                                    }}
                                    actions={getIndexerMenuActions()}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                >
                                    <View style={styles.filterButton}>
                                        <Ionicons name="server-outline" size={18} color="#8E8E93" />
                                        <Text style={styles.filterButtonText} numberOfLines={1}>
                                            {selectedIndexerName}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                                    </View>
                                </MenuView>

                                <MenuView
                                    onPressAction={({ nativeEvent }) => {
                                        handleCategorySelect(nativeEvent.event);
                                    }}
                                    actions={getCategoryMenuActions()}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                >
                                    <View style={styles.filterButton}>
                                        <Ionicons name="film-outline" size={18} color="#8E8E93" />
                                        <Text style={styles.filterButtonText} numberOfLines={1}>
                                            {selectedCategoryName}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                                    </View>
                                </MenuView>
                            </View>
                        )}

                        {/* Filters - RSS */}
                        {searchSource === 'rss' && rssFeeds.length > 0 && (
                            <View style={styles.filtersContainer}>
                                <MenuView
                                    onPressAction={({ nativeEvent }) => {
                                        handleRssFeedSelect(nativeEvent.event);
                                    }}
                                    actions={getRssFeedMenuActions()}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                >
                                    <View style={styles.filterButton}>
                                        <Ionicons name="newspaper-outline" size={18} color="#8E8E93" />
                                        <Text style={styles.filterButtonText} numberOfLines={1}>
                                            {selectedRssFeed?.name || 'Select Feed'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                                    </View>
                                </MenuView>
                            </View>
                        )}

                        {/* Loading */}
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>
                                    {searchSource === 'prowlarr' ? 'Searching...' : 'Loading feed...'}
                                </Text>
                            </View>
                        )}

                        {/* Empty state */}
                        {!loading && !searched && (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyStateIcon}>
                                    <Ionicons 
                                        name={searchSource === 'prowlarr' ? 'search-outline' : 'newspaper-outline'} 
                                        size={48} 
                                        color="#007AFF" 
                                    />
                                </View>
                                <Text style={styles.emptyStateTitle}>
                                    {searchSource === 'prowlarr' ? 'Search Torrents' : 'Select RSS Feed'}
                                </Text>
                                <Text style={styles.emptyStateSubtext}>
                                    {searchSource === 'prowlarr' 
                                        ? 'Enter a movie or TV show name to search'
                                        : rssFeeds.length === 0
                                            ? 'No RSS feeds configured. Add feeds in settings.'
                                            : 'Choose a feed from the selector above'
                                    }
                                </Text>
                            </View>
                        )}

                        {/* Results */}
                        {!loading && searched && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.resultsHeader}>
                                    {results.length.toLocaleString()} {results.length === 1 ? 'RESULT' : 'RESULTS'}
                                </Text>

                                {results.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <View style={styles.emptyStateIcon}>
                                            <Ionicons name="search-outline" size={48} color="#007AFF" />
                                        </View>
                                        <Text style={styles.emptyStateTitle}>No Results</Text>
                                        <Text style={styles.emptyStateSubtext}>
                                            Try adjusting your search or filters
                                        </Text>
                                    </View>
                                ) : (
                                    results.map((result, index) => {
                                        // Prowlarr Result
                                        if (result.source === 'prowlarr' && result.prowlarrResult) {
                                            const r = result.prowlarrResult;
                                            return (
                                                <View key={r.guid || index} style={styles.resultCard}>
                                                    {/* Header */}
                                                    <View style={styles.cardHeader}>
                                                        <View style={styles.sourceBadge}>
                                                            <Ionicons name="server" size={10} color="#007AFF" />
                                                            <Text style={styles.sourceText}>PROWLARR</Text>
                                                        </View>
                                                        <View style={styles.categoryBadge}>
                                                            <Text style={styles.categoryText}>
                                                                {getCategoryBadge(r.categories)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.qualityBadge}>
                                                            <Ionicons name="arrow-up" size={11} color="#34C759" />
                                                            <Text style={styles.seedersText}>{r.seeders || 0}</Text>
                                                        </View>
                                                    </View>

                                                    {/* Title */}
                                                    <Text style={styles.resultTitle}>{r.title}</Text>

                                                    {/* Meta Info */}
                                                    <View style={styles.metaContainer}>
                                                        <View style={styles.metaChip}>
                                                            <Ionicons name="server" size={12} color="#8E8E93" />
                                                            <Text style={styles.metaChipText}>{r.indexer}</Text>
                                                        </View>
                                                        <View style={styles.metaChip}>
                                                            <Ionicons name="cube" size={12} color="#8E8E93" />
                                                            <Text style={styles.metaChipText}>
                                                                {ProwlarrClient.formatFileSize(r.size)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.metaChip}>
                                                            <Ionicons name="time" size={12} color="#8E8E93" />
                                                            <Text style={styles.metaChipText}>
                                                                {ProwlarrClient.formatAge(r.ageMinutes)}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {/* Action Buttons */}
                                                    <View style={styles.actionButtons}>
                                                        <TouchableOpacity
                                                            style={styles.streamButton}
                                                            onPress={() => handleStreamNow(result)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                                                            <Text style={styles.streamButtonText}>Play</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.addButton}
                                                            onPress={() => handleAddTorrent(result)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                                                            <Text style={styles.addButtonText}>Add</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        }

                                        // RSS Result
                                        if (result.source === 'rss' && result.rssItem) {
                                            const item = result.rssItem;
                                            return (
                                                <View key={item.guid || index} style={styles.resultCard}>
                                                    {/* Header */}
                                                    <View style={styles.cardHeader}>
                                                        <View style={styles.sourceBadge}>
                                                            <Ionicons name="newspaper" size={10} color="#FF9500" />
                                                            <Text style={styles.sourceTextRss}>RSS</Text>
                                                        </View>
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

                                                    {/* Title */}
                                                    <Text style={styles.resultTitle}>{item.title}</Text>

                                                    {/* Action Buttons */}
                                                    <View style={styles.actionButtons}>
                                                        <TouchableOpacity
                                                            style={styles.streamButton}
                                                            onPress={() => handleStreamNow(result)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                                                            <Text style={styles.streamButtonText}>Play</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.addButton}
                                                            onPress={() => handleAddTorrent(result)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                                                            <Text style={styles.addButtonText}>Add</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        }

                                        return null;
                                    })
                                )}
                            </View>
                        )}

                        <BottomSpacing space={100} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default UnifiedSearchScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardAvoid: {
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
        marginBottom: 8,
    },
    errorHint: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        fontWeight: '400',
        letterSpacing: -0.24,
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
    sourceSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
        marginBottom: 12,
    },
    sourceSelectorText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
        letterSpacing: -0.41,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
        paddingHorizontal: 8,
        height: 36,
        marginBottom: 12,
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
    filtersContainer: {
        marginBottom: 20,
        backgroundColor: 'transparent',
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
    },
    filterButtonText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#8E8E93',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
    resultsContainer: {
        backgroundColor: 'transparent',
    },
    resultsHeader: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 12,
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
    resultCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'transparent',
        gap: 8,
    },
    sourceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    sourceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#007AFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sourceTextRss: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FF9500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    categoryBadge: {
        flex: 1,
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    qualityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(52, 199, 89, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    seedersText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#34C759',
    },
    itemDateBadge: {
        flex: 1,
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
    resultTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
        lineHeight: 22,
        letterSpacing: -0.41,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    metaChipText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'transparent',
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(142, 142, 147, 0.2)',
    },
    streamButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    streamButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
        letterSpacing: -0.24,
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
});