import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { TMDBSearchResult, tmdbClient } from '@/clients/tmdb';

interface TMDBSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (imdbId: string, posterUrl: string) => void;
  mediaType: 'movie' | 'tv';
  initialQuery?: string;
}

export const TMDBSearchModal: React.FC<TMDBSearchModalProps> = ({
  visible,
  onClose,
  onSelect,
  mediaType,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [visible, initialQuery]);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const response = mediaType === 'movie' 
        ? await tmdbClient.searchMovies(q)
        : await tmdbClient.searchTV(q);
      setResults(response.results);
    } catch (error) {
      console.error('TMDB search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: TMDBSearchResult) => {
    setSelectedId(item.id);
    try {
      const imdbId = await tmdbClient.getIMDBId(item.id, mediaType);
      if (imdbId) {
        const posterUrl = tmdbClient.getPosterUrl(item.poster_path, 'w780');
        onSelect(imdbId, posterUrl);
        onClose();
      }
    } catch (error) {
      console.error('Failed to get IMDB ID:', error);
    } finally {
      setSelectedId(null);
    }
  };

  const renderItem = ({ item }: { item: TMDBSearchResult }) => {
    const title = item.title || item.name || 'Unknown';
    const year = item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || 'N/A';
    const posterUrl = tmdbClient.getPosterUrl(item.poster_path, 'w185');
    const rating = item.vote_average.toFixed(1);
    const isSelecting = selectedId === item.id;

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelectItem(item)}
        disabled={isSelecting}
        activeOpacity={0.7}
      >
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="image-outline" size={32} color="#666" />
          </View>
        )}
        
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {title} ({year})
          </Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.rating}>{rating}/10</Text>
          </View>
          <Text style={styles.overview} numberOfLines={3}>
            {item.overview || 'No description available'}
          </Text>
        </View>

        {isSelecting && (
          <ActivityIndicator size="small" color="#0A84FF" style={styles.selectingIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Search {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleSearch()}
              placeholder={`Search for ${mediaType === 'movie' ? 'movies' : 'TV shows'}...`}
              placeholderTextColor="#8E8E93"
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading && results.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.emptyText}>Searching...</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>
              {query ? 'No results found' : 'Enter a title to search'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: 'transparent',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 17,
    color: '#fff',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  posterPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  rating: {
    fontSize: 14,
    color: '#FFD700',
    marginLeft: 4,
    fontWeight: '500',
  },
  overview: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  selectingIndicator: {
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 17,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
});