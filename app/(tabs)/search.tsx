import { Text, ActivityIndicator, TextInput, View, StatusBar } from '@/components/Themed';
import { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import { StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import TorrentGrid from '@/components/TorrentGrid';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';

const SearchScreen = () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <View style={styles.searchInputContainer}>
        <TextInput
          style={[styles.searchInput, styles.darkSearchInput]}
          placeholder="Search movies, series or songs..."
          placeholderTextColor={'#888888'}
          value={query}
          onChangeText={setQuery}
          submitBehavior={'blurAndSubmit'}
        />
        {query.length > 0 && (
          <Pressable onPress={clearSearch} style={styles.clearIcon}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </Pressable>
        )}
      </View>

      {loading && <ActivityIndicator size="large" color="#535aff" style={styles.loader} />}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.searchResultsContainer}>
        {!loading && query.length > 0 && filteredResults.length === 0 && (
          <View style={styles.centeredContainer}>
            <Ionicons style={styles.noResults} name="search-outline" color="#535aff" size={70} />
            <Text style={styles.noResultsText}>No results found.</Text>
          </View>
        )}

        {!loading && query.length > 0 && filteredResults.length > 0 && (
          <TorrentGrid list={filteredResults} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30,
  },
  searchInputContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 780,
    margin: 'auto',
  },
  searchInput: {
    height: 40,
    borderRadius: 25,
    paddingLeft: 20,
    paddingRight: 40,
    fontSize: 16,
  },
  clearIcon: {
    position: 'absolute',
    right: 30,
    justifyContent: 'center',
    height: 40,
  },
  darkSearchInput: {
    backgroundColor: '#1f1f1f',
    color: '#fff',
  },
  loader: {
    marginTop: 20,
  },
  searchResultsContainer: {
    marginVertical: 20
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResults: {
    marginTop: 100,
    paddingBottom: 20,
  },
  noResultsText: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: '5%',
    color: '#888',
  },
});

export default SearchScreen;
