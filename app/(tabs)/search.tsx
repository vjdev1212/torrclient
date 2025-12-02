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

const CATEGORY_MAP: Record<number, string> = {
  2000: 'Movies',
  5000: 'TV',
  3000: 'Audio',
  4000: 'PC',
  6000: 'XXX',
  7000: 'Books',
  8000: 'Other',
};

const ProwlarrSearchScreen = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingIndexers, setLoadingIndexers] = useState(true);
  const [results, setResults] = useState<ProwlarrSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  
  const [indexers, setIndexers] = useState<ProwlarrIndexer[]>([]);
  const [selectedIndexer, setSelectedIndexer] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    loadIndexers();
  }, []);

  const loadIndexers = async () => {
    try {
      const client = new ProwlarrClient();
      await client.initialize();
      const fetchedIndexers = await client.getIndexers();
      setIndexers(fetchedIndexers.filter(i => i.enable));
      setLoadingIndexers(false);
    } catch (error) {
      console.error('Failed to load indexers:', error);
      showAlert('Error', 'Failed to load Prowlarr indexers');
      setLoadingIndexers(false);
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
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        limit: 100,
      });

      // Filter by selected indexer if specified
      let filtered = searchResults;
      if (selectedIndexer !== null) {
        filtered = searchResults.filter(r => r.indexerId === selectedIndexer);
      }

      // Sort by relevance: seeders desc, then size desc, then age asc
      const sorted = filtered.sort((a, b) => {
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

  const handleSelectTorrent = (result: ProwlarrSearchResult) => {
    if (isHapticsSupported()) Haptics.selectionAsync();
    
    const link = result.magnetUrl || result.hash || result.infoHash || result.downloadUrl || result.guid || '';
    router.push({
      pathname: '/(tabs)/add',
      params: { magnet: link },
    });
  };

  const getCategoryBadge = (categories: number[]) => {
    const mainCategory = categories.find(c => c in CATEGORY_MAP);
    return mainCategory ? CATEGORY_MAP[mainCategory] : 'Other';
  };

  const getIndexerMenuActions = () => {
    const actions = [
      {
        id: 'all',
        title: 'All Indexers',
        state: selectedIndexer === null ? 'on' : 'off' as 'on' | 'off',
      },
      ...indexers.map(indexer => ({
        id: indexer.id.toString(),
        title: indexer.name,
        state: (selectedIndexer === indexer.id ? 'on' : 'off') as 'on' | 'off',
      })),
    ];
    return actions;
  };

  const getCategoryMenuActions = () => {
    const availableCategories = [2000, 5000, 3000, 7000, 8000];
    return availableCategories.map(cat => ({
      id: cat.toString(),
      title: CATEGORY_MAP[cat] || 'Unknown',
      state: (selectedCategories.includes(cat) ? 'on' : 'off') as 'on' | 'off',
    }));
  };

  const selectedIndexerName = selectedIndexer 
    ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
    : 'All Indexers';

  const selectedCategoriesText = selectedCategories.length > 0
    ? selectedCategories.map(c => CATEGORY_MAP[c]).join(', ')
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
              <Text style={styles.headerTitle}>Search Torrents</Text>
              <Text style={styles.headerSubtitle}>
                Search using Prowlarr indexers
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
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={handleSearch} 
                style={styles.searchButton}
                disabled={!query.trim() || loading}
              >
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Filters */}
            {!loadingIndexers && (
              <View style={styles.filtersContainer}>
                {/* Indexer Dropdown */}
                <MenuView
                  onPressAction={({ nativeEvent }) => {
                    const id = nativeEvent.event;
                    if (id === 'all') {
                      setSelectedIndexer(null);
                    } else {
                      setSelectedIndexer(parseInt(id));
                    }
                    if (isHapticsSupported()) Haptics.selectionAsync();
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

                {/* Category Dropdown */}
                <MenuView
                  onPressAction={({ nativeEvent }) => {
                    const id = parseInt(nativeEvent.event);
                    if (selectedCategories.includes(id)) {
                      setSelectedCategories(selectedCategories.filter(c => c !== id));
                    } else {
                      setSelectedCategories([...selectedCategories, id]);
                    }
                    if (isHapticsSupported()) Haptics.selectionAsync();
                  }}
                  actions={getCategoryMenuActions()}
                  shouldOpenOnLongPress={false}
                >
                  <View style={styles.filterButton}>
                    <Ionicons name="folder-outline" size={16} color="#999" />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                      {selectedCategoriesText}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                  </View>
                </MenuView>
              </View>
            )}

            {/* Loading Indicator */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#535aff" />
                <Text style={styles.loadingText}>Searching indexers...</Text>
              </View>
            )}

            {/* Results */}
            {!loading && searched && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeader}>
                  {results.length} {results.length === 1 ? 'Result' : 'Results'}
                </Text>
                
                {results.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={48} color="#333" />
                    <Text style={styles.emptyStateText}>No torrents found</Text>
                    <Text style={styles.emptyStateSubtext}>Try a different search term or filter</Text>
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
                      <Text style={styles.resultTitle} numberOfLines={2}>
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
    borderRadius: 14,
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
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#535aff',
    padding: 8,
    borderRadius: 8,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
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