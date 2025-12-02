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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }

    router.push({
      pathname: '/torrent/details',
      params: { hash: item.hash },
    });
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
    <View style={styles.container}>
      <StatusBar />
      <ScrollView showsVerticalScrollIndicator={false} key={refreshKey}>
        {/* Carousel Section */}
        {!loading && (
          <PosterCarousel
            filter={selectedCategory}
            onItemPress={handleCarouselItemPress}
            autoPlay={true}
            autoPlayInterval={6000}
            carouselData={filteredData.length > 0 ? filteredData : emptyCarouselData}
          />
        )}

        {/* Category Filter Chips */}
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
                  activeOpacity={0.7}
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#535aff" />
            <Text style={styles.loadingText}>Loading your library...</Text>
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No items found</Text>
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
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    fontWeight: '400',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginVertical: 20,
  },
  filterSection: {
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#202020',
  },
  chipActive: {
    backgroundColor: '#535aff',
    borderColor: '#535aff',
  },
  chipText: {
    fontWeight: '500',
    color: '#fff',
    fontSize: 16
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: 500
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#999',
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
  },
});