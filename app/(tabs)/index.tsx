import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StatusBar } from '@/components/Themed';
import TorrentGrid from '@/components/TorrentGrid';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import PosterCarousel from '@/components/PosterCarousel';

const HomeScreen = () => {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh watch history when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setSelectedCategory('All');
      fetchTorrents();
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  const categories = ['All', 'Movies', 'TV', 'Other'];

  const handleCategoryPress = async (category: string) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedCategory(category);

    if (category === 'All') {
      setFilteredData(data);
    } else {
      const filtered = data.filter((item: any) => {
        const itemCategory = item.category?.toLowerCase() || 'other';

        switch (category) {
          case 'Movies':
            return itemCategory === 'movie';
          case 'TV':
            return itemCategory === 'tv';
          case 'Other':
            return itemCategory !== 'movie' && itemCategory !== 'tv';
          default:
            return true;
        }
      });
      setFilteredData(filtered);
    }
  };


  const fetchTorrents = async () => {
    setLoading(true);
    try {
      const baseUrl = getTorrServerUrl();
      const authHeader = getTorrServerAuthHeader();
      const response = await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify({ action: 'list' }),
      });

      const torrents = await response.json();
      const list = Array.isArray(torrents) ? torrents : Object.values(torrents || {});

      const parsed = list.map((item: any) => ({
        id: item.hash,
        hash: item.hash,
        title: item.title || 'Untitled',
        subtitle: item.description || `Size: ${formatSize(item.torrent_size)}`,
        poster: item.poster || 'https://dummyimage.com/500x750/1A1A1A/FFFFFF.png&text= ',
        size: item.torrent_size,
        category: item.category,
        type: getCategoryType(item.category),
      }));

      setData(parsed);

      // Apply current filter to new data
      if (selectedCategory === 'All') {
        setFilteredData(parsed);
      } else {
        const filtered = parsed.filter((item: any) => {
          const itemCategory = item.category?.toLowerCase() || 'other';

          switch (selectedCategory) {
            case 'Movies':
              return itemCategory === 'movie';
            case 'TV':
              return itemCategory === 'tv';
            case 'Other':
              return itemCategory !== 'movie' && itemCategory !== 'tv';
            default:
              return true;
          }
        });
        setFilteredData(filtered);
      }
    } catch (error) {
      console.log('Error fetching torrents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTorrents();
  }, []);

  const getCategoryType = (category: string | undefined): string => {
    const cat = category?.toLowerCase() || 'other';
    if (cat === 'movie') return 'Movie';
    if (cat === 'tv') return 'TV Show';
    return 'Media';
  };

  const emptyCarouselData = [{
    id: 0,
    hash: '',
    title: 'Nothing here yet',
    subtitle: '',
    poster: '',
    size: 0,
    category: 'other',
    type: getCategoryType(selectedCategory),
  },
  {
    id: 1,
    hash: '',
    title: 'Nothing here yet',
    subtitle: '',
    poster: '',
    size: 0,
    category: 'other',
    type: getCategoryType(selectedCategory),
  }];

  const formatSize = (bytes: number | undefined): string => {
    if (!bytes) return 'Unknown size';
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const handleCarouselItemPress = async (item: any) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    router.push({
      pathname: '/torrent/details',
      params: { hash: item.hash },
    });
  };

  const handleTorrentItemPress = async (item: any) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    router.push({
      pathname: '/torrent/details',
      params: { hash: item.hash },
    });
  };

  // Show centered loader during initial load
  if (loading && data.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar />
        <View style={styles.centeredLoadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your library...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar />
      <ScrollView showsVerticalScrollIndicator={false} key={refreshKey}>
        {/* Carousel Section - Always rendered to prevent layout shift */}
        <PosterCarousel
          filter={selectedCategory}
          onItemPress={handleCarouselItemPress}
          autoPlay={true}
          autoPlayInterval={6000}
          carouselData={filteredData.length > 0 ? filteredData : emptyCarouselData}
        />

        {/* Category Filter Chips - iOS Segmented Control Style */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            <View style={styles.categoryChipsContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.chip,
                    selectedCategory === category && styles.chipActive
                  ]}
                  onPress={() => handleCategoryPress(category)}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.chipText,
                    selectedCategory === category && styles.chipTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Content */}
        {filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Items</Text>
            <Text style={styles.emptySubtitle}>
              Try selecting a different category
            </Text>
          </View>
        ) : (
          <TorrentGrid list={filteredData} onTorrentItemPress={handleTorrentItemPress} />
        )}
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  filterSection: {
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(118, 118, 128, 0.25)',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontWeight: '400',
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: -0.24,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.35,
  },
  emptySubtitle: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});