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
import { StatusBar, View } from '@/components/Themed';
import { showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import ProwlarrClient, { ProwlarrSearchResult, ProwlarrIndexer, ProwlarrCategory } from '@/clients/prowlarr';
import { StorageKeys, storageService } from '@/utils/StorageService';
import { SearchHeader } from '@/components/search/SearchHeader';
import { SourceSelector } from '@/components/search/SourceSelector';
import { SearchBar } from '@/components/search/SearchBar';
import { ProwlarrFilters } from '@/components/search/ProwlarrFilters';
import { RSSFilters } from '@/components/search/RSSFilters';
import { RSSResultCard } from '@/components/search/RSSResultCard';
import { EmptyState } from '@/components/search/EmptyState';
import { LoadingState } from '@/components/search/LoadingState';
import { ResultsHeader } from '@/components/search/ResultsHeader';
import { streamTorrentFile } from '@/utils/TorrServer';
import { ProwlarrResultCard } from '@/components/search/ProwlarrResultCard';
import BlurGradientBackground from '@/components/BlurGradientBackground';

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

    // Configured sources
    const [isProwlarrConfigured, setIsProwlarrConfigured] = useState(false);
    const [isRssConfigured, setIsRssConfigured] = useState(false);

    // Search state — default source will be set after we know what's configured
    const [searchSource, setSearchSource] = useState<SearchSource>('prowlarr');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [results, setResults] = useState<UnifiedSearchResult[]>([]);
    const [searched, setSearched] = useState(false);

    // Streaming state
    const [streamingItems, setStreamingItems] = useState<Set<string>>(new Set());

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
            // Refresh RSS feeds and Prowlarr indexers when returning to screen
            // (user may have just configured something in Settings)
            loadRssFeeds();
            loadProwlarrIndexers();
        }, [])
    );

    const loadData = async () => {
        setLoadingData(true);
        // Run both in parallel, neither blocks the other
        await Promise.all([loadRssFeeds(), loadProwlarrIndexers()]);
        setLoadingData(false);
    };

    const loadProwlarrIndexers = async () => {
        try {
            const client = new ProwlarrClient();
            const initialized = await client.initialize();
            if (!initialized) {
                setIsProwlarrConfigured(false);
                // If prowlarr is not configured and rss is, switch to rss
                setSearchSource(prev => prev === 'prowlarr' ? 'rss' : prev);
                return;
            }

            const [fetchedIndexers, fetchedCategories] = await Promise.all([
                client.getIndexers(),
                client.getCategories(),
            ]);

            if (fetchedIndexers && Array.isArray(fetchedIndexers)) {
                setIndexers(fetchedIndexers.filter(i => i.enable));
            }
            if (fetchedCategories && Array.isArray(fetchedCategories)) {
                setCategories(fetchedCategories.filter(c => c.id === 2000 || c.id === 5000));
            }

            setIsProwlarrConfigured(true);
        } catch (err) {
            // Prowlarr unreachable — not an error worth surfacing at load time
            console.warn('Could not load Prowlarr indexers:', err instanceof Error ? err.message : err);
            setIsProwlarrConfigured(false);
            setSearchSource(prev => prev === 'prowlarr' ? 'rss' : prev);
        }
    };

    const loadRssFeeds = async () => {
        try {
            const feedsJson = storageService.getItem(RSS_FEEDS_KEY);
            if (feedsJson) {
                const loadedFeeds: RSSFeedConfig[] = JSON.parse(feedsJson);
                const enabledFeeds = loadedFeeds.filter(f => f.enabled !== false);
                setRssFeeds(loadedFeeds);
                const hasFeeds = enabledFeeds.length > 0;
                setIsRssConfigured(hasFeeds);
                // If rss is not configured and we're currently on rss, switch to prowlarr
                if (!hasFeeds) {
                    setSearchSource(prev => prev === 'rss' ? 'prowlarr' : prev);
                }
            } else {
                setIsRssConfigured(false);
                setSearchSource(prev => prev === 'rss' ? 'prowlarr' : prev);
            }
        } catch (error) {
            console.error('Failed to load RSS feeds:', error);
            setIsRssConfigured(false);
        }
    };

    // Derive the list of available sources to pass to SourceSelector
    const availableSources: SearchSource[] = [
        ...(isProwlarrConfigured ? (['prowlarr'] as SearchSource[]) : []),
        ...(isRssConfigured ? (['rss'] as SearchSource[]) : []),
    ];

    const handleSearch = async () => {
        if (searchSource === 'prowlarr') {
            await handleProwlarrSearch();
        } else {
            await handleRssSearch();
        }
    };

    const handleProwlarrSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        setResults([]);

        try {
            const client = new ProwlarrClient();
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
            const message = error instanceof Error ? error.message : 'Unknown error';
            showAlert('Search Error', message);
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

        try {
            const response = await fetch(feedConfig.url, {
                headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const parsedItems = parseRSS(await response.text());
            setRssItems(parsedItems);

            if (!query.trim()) {
                setResults(parsedItems.map(item => ({ source: 'rss', rssItem: item })));
                setSearched(true);
            }
        } catch (error) {
            showAlert('RSS Error', error instanceof Error ? error.message : 'Failed to fetch feed');
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
                const tag = enclosureMatch[0];
                enclosure = {
                    url: extractAttribute(tag, 'url'),
                    type: extractAttribute(tag, 'type'),
                    length: extractAttribute(tag, 'length'),
                };
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
        const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
        return match ? match[1].trim() : '';
    };

    const extractAttribute = (tag: string, attrName: string): string => {
        const match = tag.match(new RegExp(`${attrName}=["']([^"']+)["']`, 'i'));
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
        setRefreshing(true);
        if (searchSource === 'rss' && selectedRssFeed) {
            await fetchRSSFeed(selectedRssFeed);
        } else if (searchSource === 'prowlarr' && searched) {
            await handleProwlarrSearch();
        }
        setRefreshing(false);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
    };

    const handleSourceChange = async (source: SearchSource) => {
        setSearchSource(source);
        setQuery('');
        setResults([]);
        setSearched(false);
        if (source === 'rss') await loadRssFeeds();
    };

    const handleRssFeedSelect = async (feedId: string) => {
        const feed = rssFeeds.find(f => f.id === feedId);
        if (!feed) return;
        setSelectedRssFeed(feed);
        setQuery('');
        setResults([]);
        setSearched(false);
        await fetchRSSFeed(feed);
    };

    const handleAddTorrent = async (result: UnifiedSearchResult) => {
        let link = '';
        let title = '';

        if (result.source === 'prowlarr' && result.prowlarrResult) {
            const r = result.prowlarrResult;
            link = r.magnetUrl || r.hash || r.infoHash || r.downloadUrl || r.guid || '';
            title = r.title;
        } else if (result.source === 'rss' && result.rssItem) {
            link = result.rssItem.enclosure?.url || result.rssItem.link;
            title = result.rssItem.title;
        }

        if (!link) {
            showAlert('No Link', 'This torrent does not have a valid link.');
            return;
        }

        router.push({ pathname: '/torrent/add', params: { magnet: link, titleParam: title } });
    };

    const getResultKey = (result: UnifiedSearchResult): string => {
        if (result.source === 'prowlarr' && result.prowlarrResult) {
            return result.prowlarrResult.guid || result.prowlarrResult.hash || '';
        }
        if (result.source === 'rss' && result.rssItem) {
            return result.rssItem.guid || result.rssItem.link;
        }
        return '';
    };

    const handleStreamNow = async (result: UnifiedSearchResult) => {
        let torrentLink = '';
        let title = '';

        if (result.source === 'prowlarr' && result.prowlarrResult) {
            const r = result.prowlarrResult;
            torrentLink = r.hash || r.infoHash || r.magnetUrl || r.downloadUrl || r.guid || '';
            title = r.title;
        } else if (result.source === 'rss' && result.rssItem) {
            torrentLink = result.rssItem.enclosure?.url || result.rssItem.link;
            title = result.rssItem.title;
        }

        if (!torrentLink) {
            showAlert('No Link', 'This torrent does not have a valid link.');
            return;
        }

        await streamTorrentFile({ link: torrentLink, title, fileTitle: title, preload: false });
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
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
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
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    };

    const getCategoryDisplayName = (categoryId: number): string => {
        if (categoryId === 2000) return 'Movie';
        if (categoryId === 5000) return 'TV Show';
        for (const category of categories) {
            const sub = category.subCategories.find(s => s.id === categoryId);
            if (sub) return `${category.name} - ${sub.name.replace(`${category.name}/`, '')}`;
        }
        return 'Other';
    };

    const getCategoryBadge = (categoryIds: any[]) => {
        if (!categoryIds?.length) return 'Unknown';
        return getCategoryDisplayName(categoryIds[0].id);
    };

    const handleIndexerSelect = (indexerId: string) => {
        setSelectedIndexer(indexerId === 'all' ? null : parseInt(indexerId));
    };

    const handleCategorySelect = (categoryId: string) => {
        if (categoryId === 'all') {
            setSelectedCategory(null);
            setSelectedCategoryName('All Categories');
        } else {
            const catId = parseInt(categoryId);
            setSelectedCategory(catId);
            setSelectedCategoryName(getCategoryDisplayName(catId));
        }
    };

    if (loadingData) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoadingState searchSource={searchSource} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar />
            <BlurGradientBackground />
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

                        {/* Only render SourceSelector when both sources are configured */}
                        {availableSources.length > 1 && (
                            <SourceSelector
                                selectedSource={searchSource}
                                onSourceChange={handleSourceChange}
                                availableSources={availableSources}
                            />
                        )}

                        {searchSource === 'prowlarr' && isProwlarrConfigured && (
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

                        {searchSource === 'rss' && isRssConfigured && (
                            <RSSFilters
                                feeds={rssFeeds}
                                selectedFeed={selectedRssFeed}
                                onFeedSelect={handleRssFeedSelect}
                            />
                        )}

                        {(isProwlarrConfigured || isRssConfigured) && (
                            <SearchBar
                                query={query}
                                onQueryChange={setQuery}
                                onClear={handleClear}
                                onSubmit={handleSearch}
                                searchSource={searchSource}
                            />
                        )}

                        {loading && <LoadingState searchSource={searchSource} />}

                        {!loading && !searched && (
                            <EmptyState
                                searchSource={searchSource}
                                rssFeeds={rssFeeds}
                                searched={searched}
                                isProwlarrConfigured={isProwlarrConfigured}
                                isRssConfigured={isRssConfigured}
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
                                        isProwlarrConfigured={isProwlarrConfigured}
                                        isRssConfigured={isRssConfigured}
                                    />
                                ) : (
                                    results.map((result, index) => {
                                        const resultKey = getResultKey(result);
                                        const isStreaming = streamingItems.has(resultKey);

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
                                                    isStreaming={isStreaming}
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
                                                    isStreaming={isStreaming}
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
    container: { flex: 1 },
    keyboardAvoid: { flex: 1 },
    scrollContainer: { flexGrow: 1 },
    contentWrapper: {
        flex: 1,
        paddingHorizontal: 20,
        maxWidth: 780,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    resultsContainer: { backgroundColor: 'transparent' },
});