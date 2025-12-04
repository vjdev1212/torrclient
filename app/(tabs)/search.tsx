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
import ProwlarrClient, { ProwlarrSearchResult, ProwlarrIndexer, ProwlarrCategory } from '@/clients/prowlarr';

const ProwlarrSearchScreen = () => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<ProwlarrSearchResult[]>([]);
    const [searched, setSearched] = useState(false);

    const [indexers, setIndexers] = useState<ProwlarrIndexer[]>([]);
    const [categories, setCategories] = useState<ProwlarrCategory[]>([]);
    const [selectedIndexer, setSelectedIndexer] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>('All Categories');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingData(true);
        setError(null);
        try {
            const client = new ProwlarrClient();
            await client.initialize();

            // Load indexers
            const fetchedIndexers = await client.getIndexers();

            if (!fetchedIndexers || !Array.isArray(fetchedIndexers)) {
                throw new Error('Invalid indexers data received from Prowlarr');
            }

            const enabledIndexers = fetchedIndexers.filter(i => i.enable);
            
            if (enabledIndexers.length === 0) {
                throw new Error('No enabled indexers found in Prowlarr');
            }

            setIndexers(enabledIndexers);

            // Load categories from Prowlarr API
            const fetchedCategories = await client.getCategories();

            // Filter for Movies and TV categories
            const moviesTVCategories = fetchedCategories.filter(
                category => category.id === 2000 || category.id === 5000
            );

            setCategories(moviesTVCategories);
            setLoadingData(false);
        } catch (error) {
            console.error('Failed to load data:', error);
            setError(error instanceof Error ? error.message : 'Failed to load Prowlarr data');
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

        try {
            const client = new ProwlarrClient();
            await client.initialize();

            const searchResults = await client.search({
                query: query.trim(),
                indexerIds: selectedIndexer !== null ? [selectedIndexer] : undefined,
                categories: selectedCategory !== null ? [selectedCategory] : undefined,
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

            setResults(sorted);
        } catch (error) {
            console.error('Search error:', error);
            showAlert('Search Error', 'Failed to search torrents. Please check your Prowlarr configuration.');
        } finally {
            setLoading(false);
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

    const handleSelectTorrent = async (result: ProwlarrSearchResult) => {
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }

        const link = result.magnetUrl || result.hash || result.infoHash || result.downloadUrl || result.guid || '';
        router.push({
            pathname: '/torrent/add',
            params: { magnet: link, titleParam: result.title },
        });
    };

    const getCategoryDisplayName = (categoryId: number): string => {
        // Main categories
        if (categoryId === 2000) return 'Movies (All)';
        if (categoryId === 5000) return 'TV (All)';

        // Find in subcategories
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
            ...categories.map(category => {
                // Check if any subcategory is selected
                const isSubcategorySelected = category.subCategories.some(sub => sub.id === selectedCategory);

                return {
                    id: category.id.toString(),
                    title: `${category.name} (All)`,
                    state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                    titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                    subactions: [
                        // Add main category as first subaction
                        {
                            id: category.id.toString(),
                            title: 'All',
                            state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                            titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                        },
                        // Add all subcategories
                        ...category.subCategories.map(sub => ({
                            id: sub.id.toString(),
                            title: sub.name.replace(`${category.name}/`, ''),
                            state: selectedCategory === sub.id ? ('on' as const) : ('off' as const),
                            titleColor: selectedCategory === sub.id ? '#007AFF' : undefined,
                        })),
                    ],
                };
            }),
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

    const handleCategorySelect = async (categoryId: string) => {
        if (categoryId === 'all') {
            setSelectedCategory(null);
            setSelectedCategoryName('All Categories');
        } else {
            const catId = parseInt(categoryId);
            setSelectedCategory(catId);
            setSelectedCategoryName(getCategoryDisplayName(catId));
        }
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }
    };

    const selectedIndexerName = selectedIndexer !== null
        ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
        : 'All Indexers';

    // Initial loading state - centered
    if (loadingData && indexers.length === 0 && !error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centeredContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.centeredText}>Loading indexers...</Text>
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
                        Check your Prowlarr configuration in settings
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
                >
                    <View style={styles.contentWrapper}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Search</Text>
                            <Text style={styles.headerSubtitle}>
                                Find torrents with Prowlarr
                            </Text>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBarContainer}>
                            <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Movies, TV Shows, Music"
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

                        {/* Filters */}
                        <View style={styles.filtersContainer}>
                            <MenuView
                                onPressAction={({ nativeEvent }) => {
                                    handleIndexerSelect(nativeEvent.event);
                                }}
                                actions={getIndexerMenuActions()}
                                shouldOpenOnLongPress={false}
                                themeVariant="dark"
                            >
                                <View style={[styles.filterButton]}>
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
                                <View style={[styles.filterButton]}>
                                    <Ionicons name="film-outline" size={18} color="#8E8E93" />
                                    <Text style={styles.filterButtonText} numberOfLines={1}>
                                        {selectedCategoryName}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                                </View>
                            </MenuView>
                        </View>

                        {/* Loading Search Indicator */}
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>Searching...</Text>
                            </View>
                        )}

                        {/* Empty state - No search yet */}
                        {!loading && !searched && (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyStateIcon}>
                                    <Ionicons name="search-outline" size={48} color="#007AFF" />
                                </View>
                                <Text style={styles.emptyStateTitle}>Search Torrents</Text>
                                <Text style={styles.emptyStateSubtext}>
                                    Enter a movie or TV show name to search across indexers
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
                                    results.map((result, index) => (
                                        <TouchableOpacity
                                            key={result.guid || index}
                                            style={styles.resultCard}
                                            onPress={() => handleSelectTorrent(result)}
                                            activeOpacity={0.6}
                                        >
                                            {/* Header with Category Badge */}
                                            <View style={styles.cardHeader}>
                                                <View style={styles.categoryBadge}>
                                                    <Text style={styles.categoryText}>
                                                        {getCategoryBadge(result.categories)}
                                                    </Text>
                                                </View>
                                                <View style={styles.qualityBadge}>
                                                    <Ionicons name="arrow-up" size={11} color="#34C759" />
                                                    <Text style={styles.seedersText}>{result.seeders || 0}</Text>
                                                </View>
                                            </View>

                                            {/* Title */}
                                            <Text style={styles.resultTitle} numberOfLines={3}>
                                                {result.title}
                                            </Text>

                                            {/* Meta Info */}
                                            <View style={styles.metaContainer}>
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="server" size={12} color="#8E8E93" />
                                                    <Text style={styles.metaChipText}>{result.indexer}</Text>
                                                </View>
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="cube" size={12} color="#8E8E93" />
                                                    <Text style={styles.metaChipText}>
                                                        {ProwlarrClient.formatFileSize(result.size)}
                                                    </Text>
                                                </View>
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="time" size={12} color="#8E8E93" />
                                                    <Text style={styles.metaChipText}>
                                                        {ProwlarrClient.formatAge(result.ageMinutes)}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Download Indicator */}
                                            <View style={styles.downloadIndicator}>
                                                <Ionicons name="arrow-down-circle" size={16} color="#007AFF" />
                                                <Text style={styles.downloadText}>Add Torrent</Text>
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
        fontWeight: '600',
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
        fontWeight: '600',
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
        letterSpacing: -0.08,
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
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 12,
        letterSpacing: -0.08,
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
        fontWeight: '600',
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
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
        letterSpacing: -0.08,
    },
    categoryBadge: {
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '600',
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
        fontWeight: '600',
        color: '#34C759',
        letterSpacing: -0.08,
    },
    downloadIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(142, 142, 147, 0.2)',
        gap: 6,
    },
    downloadText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#007AFF',
        letterSpacing: -0.24,
    },
});