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

interface CategoryOption {
    id: number;
    name: string;
}

const ProwlarrSearchScreen = () => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [results, setResults] = useState<ProwlarrSearchResult[]>([]);
    const [searched, setSearched] = useState(false);

    const [indexers, setIndexers] = useState<ProwlarrIndexer[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [selectedIndexer, setSelectedIndexer] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const client = new ProwlarrClient();
            await client.initialize();

            // Load indexers
            const fetchedIndexers = await client.getIndexers();
            
            if (!fetchedIndexers || !Array.isArray(fetchedIndexers)) {
                console.error('Invalid indexers data:', fetchedIndexers);
                showAlert('Error', 'Failed to load indexers from Prowlarr');
                setLoadingData(false);
                return;
            }
            
            setIndexers(fetchedIndexers.filter(i => i.enable));

            // Load categories from Prowlarr API
            const fetchedCategories = await client.getCategories();
            
            // Filter for Movies and TV categories with their subcategories
            const moviesTVCategories: CategoryOption[] = [];
            
            fetchedCategories.forEach(category => {
                if (category.id === 2000) { // Movies
                    moviesTVCategories.push({ id: category.id, name: 'Movies (All)' });
                    category.subCategories.forEach(sub => {
                        moviesTVCategories.push({ 
                            id: sub.id, 
                            name: sub.name.replace('Movies/', '') 
                        });
                    });
                } else if (category.id === 5000) { // TV
                    moviesTVCategories.push({ id: category.id, name: 'TV (All)' });
                    category.subCategories.forEach(sub => {
                        moviesTVCategories.push({ 
                            id: sub.id, 
                            name: sub.name.replace('TV/', '') 
                        });
                    });
                }
            });

            setCategories(moviesTVCategories);
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

        try {
            const client = new ProwlarrClient();
            await client.initialize();

            const searchResults = await client.search({
                query: query.trim(),
                indexerIds: selectedIndexer ? [selectedIndexer] : undefined,
                categories: selectedCategory ? [selectedCategory] : undefined,
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
        
        // Check if it's a main category
        if (categoryId === 2000) return 'Movies';
        if (categoryId === 5000) return 'TV';
        
        // Check subcategories
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            return category.name;
        }
        
        return 'Other';
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
            ...categories.map(category => ({
                id: category.id.toString(),
                title: category.name,
                state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
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

    const handleCategorySelect = async (categoryId: string) => {
        if (categoryId === 'all') {
            setSelectedCategory(null);
        } else {
            setSelectedCategory(parseInt(categoryId));
        }
        if (isHapticsSupported()) {
            await Haptics.selectionAsync();
        }
    };

    const selectedIndexerName = selectedIndexer
        ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
        : 'All Indexers';

    const selectedCategoryName = selectedCategory
        ? categories.find(c => c.id === selectedCategory)?.name || 'All Categories'
        : 'All Categories';

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

                        {/* Filters */}
                        {!loadingData && (
                            <View style={styles.filtersContainer}>
                                <View style={styles.filtersRow}>
                                    <MenuView
                                        onPressAction={({ nativeEvent }) => {
                                            handleIndexerSelect(nativeEvent.event);
                                        }}
                                        actions={getIndexerMenuActions()}
                                        shouldOpenOnLongPress={false}
                                        themeVariant="dark"
                                    >
                                        <View style={styles.filterButton}>
                                            <Ionicons name="server-outline" size={16} color="#999" />
                                            <Text style={styles.filterButtonText} numberOfLines={1}>
                                                {selectedIndexerName}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color="#666" />
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
                                            <Ionicons name="film-outline" size={16} color="#999" />
                                            <Text style={styles.filterButtonText} numberOfLines={1}>
                                                {selectedCategoryName}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color="#666" />
                                        </View>
                                    </MenuView>
                                </View>
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
                                </Text>

                                {results.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="search-outline" size={48} color="#333" />
                                        <Text style={styles.emptyStateText}>No torrents found</Text>
                                        <Text style={styles.emptyStateSubtext}>
                                            Try adjusting your filters or search term
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
                                            {/* Header with Category Badge */}
                                            <View style={styles.cardHeader}>
                                                <View style={styles.categoryBadge}>
                                                    <Text style={styles.categoryText}>
                                                        {getCategoryBadge(result.categories)}
                                                    </Text>
                                                </View>
                                                <View style={styles.qualityBadge}>
                                                    <Ionicons name="arrow-up" size={12} color="#4ade80" />
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
                                                    <Ionicons name="server" size={12} color="#666" />
                                                    <Text style={styles.metaChipText}>{result.indexer}</Text>
                                                </View>
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="cube" size={12} color="#666" />
                                                    <Text style={styles.metaChipText}>
                                                        {ProwlarrClient.formatFileSize(result.size)}
                                                    </Text>
                                                </View>
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="time" size={12} color="#666" />
                                                    <Text style={styles.metaChipText}>
                                                        {ProwlarrClient.formatAge(result.ageMinutes)}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Download Indicator */}
                                            <View style={styles.downloadIndicator}>
                                                <Ionicons name="download-outline" size={14} color="#535aff" />
                                                <Text style={styles.downloadText}>Tap to add</Text>
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
        fontWeight: '500',
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
    filtersRow: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: 'transparent',
    },
    filterButton: {
        flex: 1,
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
        fontWeight: '500',
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
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: 'transparent',
    },
    resultTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
        lineHeight: 21,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
        backgroundColor: 'transparent',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    metaChipText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    categoryBadge: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#ccc',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    qualityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    seedersText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4ade80',
    },
    downloadIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        gap: 6,
    },
    downloadText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#aaaaaa',
    },
});