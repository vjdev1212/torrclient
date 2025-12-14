import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StatusBar } from '@/components/Themed';
import TorrentGrid from '@/components/TorrentGrid';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import PosterCarousel from '@/components/PosterCarousel';
import BottomSpacing from '@/components/BottomSpacing';

const HomeScreen = () => {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh watch history when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchTorrents();
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  const getCategorizedData = () => {
    const movies = data.filter((item: any) => item.category?.toLowerCase() === 'movie');
    const tvShows = data.filter((item: any) => item.category?.toLowerCase() === 'tv');
    const other = data.filter((item: any) => {
      const cat = item.category?.toLowerCase();
      return cat !== 'movie' && cat !== 'tv';
    });

    return { movies, tvShows, other };
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
        poster: item.poster,
        size: item.torrent_size,
        category: item.category,
        type: getCategoryType(item.category),
      }));

      setData(parsed);
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
    type: 'Media',
  },
  {
    id: 1,
    hash: '',
    title: 'Nothing here yet',
    subtitle: '',
    poster: '',
    size: 0,
    category: 'other',
    type: 'Media',
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

  const { movies, tvShows, other } = getCategorizedData();
  const hasAnyContent = movies.length > 0 || tvShows.length > 0 || other.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar />
      <ScrollView showsVerticalScrollIndicator={false} key={refreshKey}>
        {/* Carousel Section */}
        <PosterCarousel
          filter="All"
          onItemPress={handleCarouselItemPress}
          autoPlay={true}
          autoPlayInterval={6000}
          carouselData={data.length > 0 ? data : emptyCarouselData}
        />

        {/* Content Sections by Category */}
        {!hasAnyContent ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Items in Library</Text>
            <Text style={styles.emptySubtitle}>
              Add torrents to start building your collection
            </Text>
          </View>
        ) : (
          <>
            {/* Movies Section */}
            {movies.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.categoryTitle}>Movies</Text>
                <TorrentGrid 
                  list={movies} 
                  onTorrentItemPress={handleTorrentItemPress}
                  horizontal={true}
                />
              </View>
            )}

            {/* TV Shows Section */}
            {tvShows.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.categoryTitle}>TV Shows</Text>
                <TorrentGrid 
                  list={tvShows} 
                  onTorrentItemPress={handleTorrentItemPress}
                  horizontal={true}
                />
              </View>
            )}

            {/* Other Section */}
            {other.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.categoryTitle}>Other</Text>
                <TorrentGrid 
                  list={other} 
                  onTorrentItemPress={handleTorrentItemPress}
                  horizontal={true}
                />
              </View>
            )}
          </>
        )}

        {/* Bottom Padding */}
        <BottomSpacing space={100} />
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
  loadingText: {
    marginTop: 16,
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '400',
  },
  categorySection: {
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 16,
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
  bottomPadding: {
    height: 40,
    backgroundColor: 'transparent',
  },
});