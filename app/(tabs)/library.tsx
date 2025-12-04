import { Text, ActivityIndicator, TextInput, View, StatusBar } from '@/components/Themed';
import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import TorrentGrid from '@/components/TorrentGrid';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const SearchScreen = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [allTorrents, setAllTorrents] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null);

  const fetchTorrents = async () => {
    setLoading(true);
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

      const torrents = await response.json();
      const list = Array.isArray(torrents) ? torrents : Object.values(torrents || {});

      const parsed = list.map((item: any) => ({
        hash: item.hash,
        title: item.title || 'Untitled',
        poster: item.poster || 'https://via.placeholder.com/150x225?text=No+Image',
        size: item.torrent_size,
        category: item.category,
      }));

      setAllTorrents(parsed);
    } catch (error) {
      console.error('Error fetching torrents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTorrents();
  }, []);

  useEffect(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (query.trim().length === 0) {
      clearSearch();
      return;
    }

    const timeout = setTimeout(() => {
      const filtered = allTorrents.filter(item =>
        item.title.toLowerCase().includes(query.trim().toLowerCase())
      );
      setFilteredResults(filtered);
    }, 300);

    setDebounceTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [query, allTorrents]);

  const clearSearch = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
    setQuery('');
    setFilteredResults([]);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerSubtitle}>
          {allTorrents.length} {allTorrents.length === 1 ? 'item' : 'items'} available
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper} pointerEvents="box-none">
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
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

      {/* Content Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#535aff" />
          <Text style={styles.loadingText}>Loading torrents...</Text>
        </View>
      ) : query.length > 0 && filteredResults.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="search-outline" color="#535aff" size={48} />
          </View>
          <Text style={styles.emptyStateTitle}>No Results</Text>
          <Text style={styles.emptyStateSubtitle}>
            Try a different search
          </Text>
        </View>
      ) : query.length === 0 && allTorrents.length > 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="film-outline" color="#535aff" size={48} />
          </View>
          <Text style={styles.emptyStateTitle}>Search Your Library</Text>
          <Text style={styles.emptyStateSubtitle}>
            Find movies and TV shows
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
              {filteredResults.length.toLocaleString()} {filteredResults.length === 1 ? 'RESULT' : 'RESULTS'}
            </Text>
            <TorrentGrid list={filteredResults} onTorrentItemPress={handleTorrentItemPress} />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
    letterSpacing: -0.08,
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
    paddingHorizontal: 8,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
    marginLeft: 2,
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
  contentContainer: {
    flex: 1,
  },
  contentWrapper: {
    flexGrow: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '400',
    letterSpacing: -0.41,
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
    backgroundColor: 'rgba(83, 90, 255, 0.15)',
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
    fontSize: 17,
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

export default SearchScreen;