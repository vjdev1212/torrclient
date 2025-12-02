import React, { useState } from 'react';
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
import { Text, View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import ProwlarrClient, { ProwlarrSearchResult } from '@/clients/prowlarr';

const searchTypes = [
  { key: 'movie', label: 'Movie' },
  { key: 'tv', label: 'TV Show' },
];

const queryTypes = [
  { key: 'name', label: 'Name' },
  { key: 'imdb', label: 'IMDB ID' },
  { key: 'tmdb', label: 'TMDB ID' },
];

const ProwlarrSearchScreen = () => {
  const router = useRouter();
  const [searchType, setSearchType] = useState<'movie' | 'tv'>('movie');
  const [queryType, setQueryType] = useState<'name' | 'imdb' | 'tmdb'>('name');
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProwlarrSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      showAlert('Missing Query', 'Please enter a search term, IMDB ID, or TMDB ID.');
      return;
    }

    if (isHapticsSupported()) await Haptics.selectionAsync();
    setLoading(true);
    setSearched(true);
    setResults([]);

    try {
      const client = new ProwlarrClient();
      await client.initialize();

      let searchResults: ProwlarrSearchResult[] = [];

      if (searchType === 'movie') {
        if (queryType === 'name') {
          searchResults = await client.searchMovieByName(query.trim());
        } else if (queryType === 'imdb') {
          searchResults = await client.searchMovieByImdbId(query.trim());
        } else if (queryType === 'tmdb') {
          searchResults = await client.searchMovieByTmdbId(query.trim());
        }
      } else {
        const seasonNum = season ? parseInt(season) : undefined;
        const episodeNum = episode ? parseInt(episode) : undefined;

        if (queryType === 'name') {
          searchResults = await client.searchTVShowByName(query.trim(), seasonNum, episodeNum);
        } else if (queryType === 'imdb') {
          searchResults = await client.searchTVShowByImdbId(query.trim(), seasonNum, episodeNum);
        } else if (queryType === 'tmdb') {
          searchResults = await client.searchTVShowByTmdbId(query.trim(), seasonNum, episodeNum);
        }
      }

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

  const handleSelectTorrent = (result: ProwlarrSearchResult) => {
    if (isHapticsSupported()) Haptics.selectionAsync();
    
    const link = result.magnetUrl || result.downloadUrl || '';
    router.push({
      pathname: '/add',
      params: { magnet: link },
    });
  };

  const getCategoryBadge = (categories: number[]) => {
    if (categories.includes(2000)) return 'Movie';
    if (categories.includes(5000)) return 'TV';
    return 'Other';
  };

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

            {/* Search Form */}
            <View style={styles.form}>
              {/* Content Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Content Type</Text>
                <View style={styles.chipContainer}>
                  {searchTypes.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.chip,
                        searchType === type.key && styles.chipActive,
                      ]}
                      onPress={() => {
                        setSearchType(type.key as 'movie' | 'tv');
                        if (isHapticsSupported()) Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          searchType === type.key && styles.chipTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Query Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Search By</Text>
                <View style={styles.chipContainer}>
                  {queryTypes.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.chip,
                        queryType === type.key && styles.chipActive,
                      ]}
                      onPress={() => {
                        setQueryType(type.key as 'name' | 'imdb' | 'tmdb');
                        if (isHapticsSupported()) Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          queryType === type.key && styles.chipTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Query Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {queryType === 'name' ? 'Search Query' : queryType === 'imdb' ? 'IMDB ID' : 'TMDB ID'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={
                    queryType === 'name' 
                      ? 'Enter title...' 
                      : queryType === 'imdb' 
                      ? 'tt1234567' 
                      : '12345'
                  }
                  autoCapitalize="none"
                  placeholderTextColor="#666"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={handleSearch}
                />
              </View>

              {/* Season & Episode (TV only) */}
              {searchType === 'tv' && (
                <View style={styles.rowInputGroup}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Season <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.input}
                      value={season}
                      onChangeText={setSeason}
                      placeholder="1"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Episode <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.input}
                      value={episode}
                      onChangeText={setEpisode}
                      placeholder="1"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>
              )}

              {/* Search Button */}
              <TouchableOpacity
                style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                onPress={handleSearch}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.searchButtonText}>
                  {loading ? 'Searching...' : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>

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
                    <Text style={styles.emptyStateText}>No torrents found</Text>
                    <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
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
    paddingBottom: 32,
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
  form: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  rowInputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ccc',
    marginBottom: 10,
  },
  optional: {
    fontSize: 13,
    fontWeight: '400',
    color: '#777',
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  chipActive: {
    backgroundColor: '#535aff',
    borderColor: '#535aff',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  chipTextActive: {
    color: '#fff',
  },
  searchButton: {
    backgroundColor: '#535aff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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