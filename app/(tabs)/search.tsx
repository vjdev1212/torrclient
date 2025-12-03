import React, { useState, useEffect } from 'react';
import {
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import ProwlarrClient, { ProwlarrSearchResult, ProwlarrIndexer } from '@/clients/prowlarr';

interface Category {
    id: number;
    name: string;
}

const ProwlarrSearchScreen = () => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [results, setResults] = useState<ProwlarrSearchResult[]>([]);
    const [allResults, setAllResults] = useState<ProwlarrSearchResult[]>([]); // Store all results
    const [searched, setSearched] = useState(false);

    const [indexers, setIndexers] = useState<ProwlarrIndexer[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedIndexer, setSelectedIndexer] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Filter results when indexer filter changes
    useEffect(() => {
        if (allResults.length > 0) {
            filterResults();
        }
    }, [selectedIndexer, allResults]);

    const loadData = async () => {
        try {
            const client = new ProwlarrClient();
            await client.initialize();

            // Load indexers
            const fetchedIndexers = await client.getIndexers();
            
            // Add validation check
            if (!fetchedIndexers || !Array.isArray(fetchedIndexers)) {
                console.error('Invalid indexers data:', fetchedIndexers);
                showAlert('Error', 'Failed to load indexers from Prowlarr');
                setLoadingData(false);
                return;
            }
            
            setIndexers(fetchedIndexers.filter(i => i.enable));

            // Extract unique categories from all indexers for display
            const categoryMap = new Map<number, string>();

            const commonCategories: Record<number, string> = {
                // Movies
                2000: "Movies",

                // TV Shows
                5000: "TV",
            };

            // First, add common categories
            Object.entries(commonCategories).forEach(([id, name]) => {
                categoryMap.set(parseInt(id), name);
            });

            // Convert to array and sort
            const categoriesArray = Array.from(categoryMap.entries())
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.id - b.id);

            setCategories(categoriesArray);
            setLoadingData(false);
        } catch (error) {
            console.error('Failed to load data:', error);
            showAlert('Error', 'Failed to load Prowlarr data. Please check your configuration.');
            setLoadingData(false);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) {
            return;
        }

        if (isHapticsSupported()) await Haptics.selectionAsync();
        setLoading(true);
        setSearched(true);
        setResults([]);
        setAllResults([]);

        try {
            const client = new ProwlarrClient();
            await client.initialize();

            const searchResults = await client.search({
                query: query.trim(),
                categories: undefined, // Always search all categories
                limit: 100,
            });

            // Sort by relevance: seeders desc, then size desc, then age asc
            const sorted = searchResults.sort((a, b) => {
                const seedersA = a.seeders || 0;
                const seedersB = b.seeders || 0;
                if (seedersB !== seedersA) return seedersB - seedersA;

                if (b.size !== a.size) return b.size - a.size;

                const ageA = a.ageMinutes || 999999;
                const ageB = b.ageMinutes || 999999;
                return ageA - ageB;
            });

            setAllResults(sorted); // Store all results
            filterResultsAfterSearch(sorted); // Apply current filter to new results
        } catch (error) {
            console.error('Search error:', error);
            showAlert('Search Error', 'Failed to search torrents. Please check your Prowlarr configuration.');
        } finally {
            setLoading(false);
        }
    };

    const filterResultsAfterSearch = (searchResults: ProwlarrSearchResult[]) => {
        let filtered = [...searchResults];

        // Filter by selected indexer if specified
        if (selectedIndexer !== null) {
            filtered = filtered.filter(r => r.indexerId === selectedIndexer);
        }

        setResults(filtered);
    };

    const filterResults = () => {
        let filtered = [...allResults];

        // Filter by selected indexer if specified
        if (selectedIndexer !== null) {
            filtered = filtered.filter(r => r.indexerId === selectedIndexer);
        }

        setResults(filtered);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setAllResults([]);
        setSearched(false);
        if (isHapticsSupported()) Haptics.selectionAsync();
    };

    const handleSelectTorrent = async(result: ProwlarrSearchResult) => {
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }

        const link = result.magnetUrl || result.hash || result.infoHash || result.downloadUrl || result.guid || '';
        router.push({
            pathname: '/torrent/add',
            params: { magnet: link, titleParam: result.title },
        });
    };

    const getCategoryBadge = (categoryIds: number[]) => {
        if (!categoryIds || categoryIds.length === 0) return 'Unknown';
        
        const categoryId = categoryIds[0];
        const categoryMap: Record<number, string> = {
            2000: 'Movies',
            5000: 'TV',
        };
        
        return categoryMap[categoryId] || 'Other';
    };

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

    const handleIndexerSelect = async (indexerId: string) => {
        if (indexerId === 'all') {
            setSelectedIndexer(null);
        } else {
            setSelectedIndexer(parseInt(indexerId));
        }
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }
    };

    const selectedIndexerName = selectedIndexer
        ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
        : 'All Indexers';

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
                >
                    <View style={styles.contentWrapper}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Search</Text>
                            <Text style={styles.headerSubtitle}>
                                Search using Prowlarr
                            </Text>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBarContainer}>
                            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search for movies, shows, music..."
                                autoCapitalize="none"
                                placeholderTextColor="#666"
                                returnKeyType="search"
                                onSubmitEditing={handleSearch}
                                submitBehavior="blurAndSubmit"
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                                    <Ionicons name="close-circle" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Indexer Filter */}
                        {!loadingData && (
                            <View style={styles.filtersContainer}>
                                <MenuView
                                    onPressAction={({ nativeEvent }) => {
                                        handleIndexerSelect(nativeEvent.event);
                                    }}
                                    actions={getIndexerMenuActions()}
                                    shouldOpenOnLongPress={false}
                                >
                                    <View style={styles.filterButton}>
                                        <Ionicons name="server-outline" size={16} color="#999" />
                                        <Text style={styles.filterButtonText} numberOfLines={1}>
                                            {selectedIndexerName}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#666" />
                                    </View>
                                </MenuView>
                            </View>
                        )}

                        {/* Loading Data Indicator */}
                        {loadingData && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#535aff" />
                                <Text style={styles.loadingText}>Loading indexers...</Text>
                            </View>
                        )}

                        {/* Loading Search Indicator */}
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#535aff" />
                                <Text style={styles.loadingText}>Searching indexers...</Text>
                            </View>
                        )}

                        {/* Results */}
                        {!loading && !loadingData && searched && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.resultsHeader}>
                                    {results.length} {results.length === 1 ? 'Result' : 'Results'}
                                    {selectedIndexer && ` (${selectedIndexerName})`}
                                </Text>

                                {results.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="search-outline" size={48} color="#333" />
                                        <Text style={styles.emptyStateText}>No torrents found</Text>
                                        <Text style={styles.emptyStateSubtext}>
                                            {selectedIndexer 
                                                ? 'Try selecting a different indexer or search term'
                                                : 'Try a different search term'}
                                        </Text>
                                    </View>
                                ) : (
                                    results.map((result, index) => (
                                        <TouchableOpacity
                                            key={result.guid || index}
                                            style={styles.resultCard}
                                            onPress={() => handleSelectTorrent(result)}
                                            activeOpacity={0.7}
                                        >
                                            {/* Title */}
                                            <Text style={styles.resultTitle} numberOfLines={10}>
                                                {result.title}
                                            </Text>

                                            {/* Meta Row 1 */}
                                            <View style={styles.metaRow}>
                                                <View style={styles.metaItem}>
                                                    <Text style={styles.metaLabel}>Indexer</Text>
                                                    <Text style={styles.metaValue}>{result.indexer}</Text>
                                                </View>
                                                <View style={styles.metaItem}>
                                                    <Text style={styles.metaLabel}>Size</Text>
                                                    <Text style={styles.metaValue}>
                                                        {ProwlarrClient.formatFileSize(result.size)}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Meta Row 2 */}
                                            <View style={styles.metaRow}>
                                                <View style={styles.metaItem}>
                                                    <Text style={styles.metaLabel}>Peers</Text>
                                                    <Text style={[styles.metaValue, styles.peersText]}>
                                                        {result.seeders || 0} / {result.leechers || 0}
                                                    </Text>
                                                </View>
                                                <View style={styles.metaItem}>
                                                    <Text style={styles.metaLabel}>Age</Text>
                                                    <Text style={styles.metaValue}>
                                                        {ProwlarrClient.formatAge(result.ageMinutes)}
                                                    </Text>
                                                </View>
                                                <View style={styles.categoryBadge}>
                                                    <Text style={styles.categoryText}>
                                                        {getCategoryBadge(result.categories)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))
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

export default ProwlarrSearchScreen;

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
    header: {
        paddingTop: 20,
        paddingBottom: 24,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#999',
        marginTop: 6,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f0f0f',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#1f1f1f',
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        paddingVertical: 8,
    },
    clearButton: {
        padding: 4,
    },
    filtersContainer: {
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f0f0f',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1f1f1f',
        gap: 8,
    },
    filterButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#ccc',
        fontWeight: '500',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        color: '#999',
    },
    resultsContainer: {
        backgroundColor: 'transparent',
    },
    resultsHeader: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#999',
        marginTop: 16,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    resultCard: {
        backgroundColor: '#0f0f0f',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1f1f1f',
    },
    resultTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 14,
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    metaItem: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    metaLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#ccc',
    },
    peersText: {
        color: '#535aff',
    },
    categoryBadge: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#2a2a2a',
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});