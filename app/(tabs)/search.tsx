// ============================================================================
// File: app/(tabs)/search.tsx
// Main Unified Search Screen
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import ProwlarrClient, { ProwlarrSearchResult, ProwlarrIndexer, ProwlarrCategory } from '@/clients/prowlarr';
import { getTorrServerUrl } from '@/utils/TorrServer';
import { StorageKeys, storageService } from '@/utils/StorageService';

// Import UI Components
import { SearchHeader } from '@/components/search/SearchHeader';
import { SourceSelector } from '@/components/search/SourceSelector';
import { SearchBar } from '@/components/search/SearchBar';
import { ProwlarrFilters } from '@/components/search/ProwlarrFilters';
import { RSSFilters } from '@/components/search/RSSFilters';
import { ProwlarrResultCard } from '@/components/search/ProwlarrResultCard';
import { RSSResultCard } from '@/components/search/RSSResultCard';
import { EmptyState } from '@/components/search/EmptyState';
import { LoadingState } from '@/components/search/LoadingState';
import { ErrorState } from '@/components/search/ErrorState';
import { ResultsHeader } from '@/components/search/ResultsHeader';

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

const SearchScreen = () => {
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
            setResults(rssItems.map(item => ({ source: 'rss', rssItem: item })));
        } else {
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

    // Initial loading
    if (loadingData && indexers.length === 0 && !error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoadingState searchSource={searchSource} />
            </SafeAreaView>
        );
    }

    // Error state
    if (error && indexers.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ErrorState error={error} onRetry={handleRetry} />
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
                        <SearchHeader />

                        <SourceSelector
                            selectedSource={searchSource}
                            onSourceChange={handleSourceChange}
                        />

                        <SearchBar
                            query={query}
                            onQueryChange={setQuery}
                            onClear={handleClear}
                            onSubmit={handleSearch}
                            searchSource={searchSource}
                        />

                        {searchSource === 'prowlarr' && (
                            <ProwlarrFilters
                                indexers={indexers}
                                categories={categories}
                                selectedIndexer={selectedIndexer}
                                selectedCategory={selectedCategory}
                                selectedCategoryName={selectedCategoryName}
                                onIndexerSelect={handleIndexerSelect}
                                onCategorySelect={handleCategorySelect}
                            />
                        )}

                        {searchSource === 'rss' && (
                            <RSSFilters
                                feeds={rssFeeds}
                                selectedFeed={selectedRssFeed}
                                onFeedSelect={handleRssFeedSelect}
                            />
                        )}

                        {loading && <LoadingState searchSource={searchSource} />}

                        {!loading && !searched && (
                            <EmptyState
                                searchSource={searchSource}
                                rssFeeds={rssFeeds}
                                searched={searched}
                            />
                        )}

                        {!loading && searched && (
                            <View style={styles.resultsContainer}>
                                <ResultsHeader count={results.length} />

                                {results.length === 0 ? (
                                    <EmptyState
                                        searchSource={searchSource}
                                        rssFeeds={rssFeeds}
                                        searched={searched}
                                    />
                                ) : (
                                    results.map((result, index) => {
                                        if (result.source === 'prowlarr' && result.prowlarrResult) {
                                            return (
                                                <ProwlarrResultCard
                                                    key={result.prowlarrResult.guid || index}
                                                    result={result.prowlarrResult}
                                                    onStream={() => handleStreamNow(result)}
                                                    onAdd={() => handleAddTorrent(result)}
                                                    getCategoryBadge={getCategoryBadge}
                                                    formatFileSize={ProwlarrClient.formatFileSize}
                                                    formatAge={ProwlarrClient.formatAge}
                                                />
                                            );
                                        }

                                        if (result.source === 'rss' && result.rssItem) {
                                            return (
                                                <RSSResultCard
                                                    key={result.rssItem.guid || index}
                                                    item={result.rssItem}
                                                    onStream={() => handleStreamNow(result)}
                                                    onAdd={() => handleAddTorrent(result)}
                                                    formatDate={formatDate}
                                                    formatSize={formatSize}
                                                />
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

export default SearchScreen;

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
    resultsContainer: {
        backgroundColor: 'transparent',
    },
});