import { Text, ActivityIndicator, TextInput, View, StatusBar } from '@/components/Themed';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import TorrentGrid from '@/components/TorrentGrid';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MenuView, MenuComponentRef, MenuAction } from '@react-native-menu/menu';

const LibraryScreen = () => {
  const router = useRouter();
  const categoryMenuRef = useRef<MenuComponentRef>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTorrents, setAllTorrents] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>(['all']);

  const fetchTorrents = async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeader = await getTorrServerAuthHeader();
      const baseUrl = await getTorrServerUrl();
      const response = await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {})
        },
        body: JSON.stringify({ action: 'list' }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const torrents = await response.json();
      const list = Array.isArray(torrents) ? torrents : Object.values(torrents || {});

      const parsed = list.map((item: any) => ({
        hash: item.hash,
        title: item.title || 'Untitled',
        poster: item.poster || 'https://via.placeholder.com/150x225?text=No+Image',
        size: item.torrent_size,
        category: item.category || 'Uncategorized',
      }));

      setAllTorrents(parsed);

      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(parsed.map((t: any) => t.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching torrents:', error);
      setError(error instanceof Error ? error.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log('Library screen focused - fetching torrents');
      fetchTorrents();
      
      return () => {
        // Optional cleanup when screen loses focus
        console.log('Library screen unfocused');
      };
    }, [])
  );

  useEffect(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);

    const timeout = setTimeout(() => {
      let filtered = allTorrents;

      // Filter by category
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(item => item.category === selectedCategory);
      }

      // Filter by search query
      if (query.trim().length > 0) {
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(query.trim().toLowerCase())
        );
      }

      setFilteredResults(filtered);
    }, 300);

    setDebounceTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [query, allTorrents, selectedCategory]);

  const clearSearch = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
    setQuery('');
  };

  const handleRetry = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    fetchTorrents();
  };

  const handleTorrentItemPress = async (item: any) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }

    router.push({
      pathname: '/torrent/details',
      params: { hash: item.hash },
    });
  };

  const handleAddTorrent = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Navigate to add torrent screen
    router.push('/torrent/add');
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCategory(categoryId);
  };

  const getCategoryDisplayName = (category: string) => {
    if (category === 'all') return 'All';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Build menu actions for categories
  const categoryActions = categories.map(cat => ({
    id: cat,
    title: getCategoryDisplayName(cat),
    state: selectedCategory === cat ? 'on' : 'off',   
  }));

  // Initial loading state - centered loader
  if (loading && allTorrents.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.centeredText}>Loading your library...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && allTorrents.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar />
        <View style={styles.centeredContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" color="#FF3B30" size={48} />
          </View>
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <Pressable 
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const displayResults = query.length > 0 || selectedCategory !== 'all' ? filteredResults : allTorrents;
  const shouldShowResults = displayResults.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Library</Text>
            <Text style={styles.headerSubtitle}>
              {allTorrents.length} {allTorrents.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Pressable 
            style={styles.addButton}
            onPress={handleAddTorrent}
          >
            <Ionicons name="add-circle" size={20} color="#0A84FF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper} pointerEvents="box-none">
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search library"
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            submitBehavior="blurAndSubmit"
          />
          {query.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <MenuView
          ref={categoryMenuRef}
          title="Filter by Category"
          onPressAction={({ nativeEvent }) => {
            handleCategorySelect(nativeEvent.event);
          }}
          actions={categoryActions as MenuAction[]}
          shouldOpenOnLongPress={false}
        >
          <Pressable style={styles.filterButton}>
            <Ionicons name="funnel-outline" size={18} color="#0A84FF" />
            <Text style={styles.filterButtonText}>
              {selectedCategory === 'all' ? 'All Categories' : getCategoryDisplayName(selectedCategory)}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#0A84FF" />
          </Pressable>
        </MenuView>
      </View>

      {/* Content Area */}
      {allTorrents.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="library-outline" color="#0A84FF" size={48} />
          </View>
          <Text style={styles.emptyStateTitle}>Library Empty</Text>
          <Text style={styles.emptyStateSubtitle}>
            Tap the Add button to get started
          </Text>
        </View>
      ) : displayResults.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="search-outline" color="#0A84FF" size={48} />
          </View>
          <Text style={styles.emptyStateTitle}>No Results</Text>
          <Text style={styles.emptyStateSubtitle}>
            Try adjusting your search or filter
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.contentContainer}
          contentContainerStyle={styles.contentWrapper}
        >
          <View style={styles.resultsWrapper}>
            <Text style={styles.resultsCount}>
              {displayResults.length.toLocaleString()} {displayResults.length === 1 ? 'RESULT' : 'RESULTS'}
            </Text>
            <TorrentGrid list={displayResults} onTorrentItemPress={handleTorrentItemPress} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    margin: 'auto',
    maxWidth: 780
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
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0A84FF',
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: 0.35,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',    
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    marginLeft: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A84FF',
    letterSpacing: -0.24,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    paddingVertical: 8,
    outlineWidth: 0,
    cursor: 'text',
    letterSpacing: -0.41,
  },
  clearButton: {
    padding: 2,
    marginLeft: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    gap: 6,
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    fontSize: 15,
    color: '#0A84FF',
    fontWeight: '500',
    letterSpacing: -0.24,
  },
  contentContainer: {
    flex: 1,
  },
  contentWrapper: {
    flexGrow: 1,
  },
  emptyStateContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  resultsWrapper: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  resultsCount: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 20,
    letterSpacing: -0.08,
  },
});

export default LibraryScreen;