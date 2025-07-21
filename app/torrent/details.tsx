import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text } from '@/components/Themed';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { getTorrServerUrl } from '@/utils/TorrServer';
import { ImpactFeedbackStyle } from 'expo-haptics';

const TorrentDetails = () => {
  const { hash } = useLocalSearchParams();
  const [torrentData, setTorrentData] = useState<any>(null);
  const [cacheData, setCacheData] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isLargeScreen = width > 768 && !isPortrait;
  const ref = useRef<ScrollView | null>(null);

  useEffect(() => {
    let interval: any;

    const loadBaseUrl = async () => {
      const url = await getTorrServerUrl();
      setBaseUrl(url);
      return url;
    };

    const fetchDetails = async (baseUrl: string) => {
      try {
        const torrentRes = await fetch(`${baseUrl}/torrents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', hash }),
        });

        const torrentResult = await torrentRes.json();

        let files = [];
        if (torrentResult.data) {
          try {
            const parsed = JSON.parse(torrentResult.data);
            files = parsed?.TorrServer?.Files || [];
          } catch (err) {
            console.error('Failed to parse files from data:', err);
          }
        }

        setTorrentData({
          title: torrentResult.title || 'Untitled',
          poster: torrentResult.poster || 'https://via.placeholder.com/150x225?text=No+Image',
          category: torrentResult.category || 'unknown',
          size: torrentResult.torrent_size,
          files,
        });
      } catch (error) {
        console.error('Error fetching torrent details:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCache = async (baseUrl: string) => {
      try {
        const cacheRes = await fetch(`${baseUrl}/cache`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', hash }),
        });
        const cacheResult = await cacheRes.json();
        setCacheData((prev: any) =>
          JSON.stringify(prev) !== JSON.stringify(cacheResult) ? cacheResult : prev
        );
      } catch (error) {
        console.error('Error fetching cache data:', error);
      }
    };

    if (hash) {
      loadBaseUrl().then((url: any) => {
        fetchDetails(url);
        fetchCache(url);
        interval = setInterval(() => fetchCache(url), 3000);
      });
    }

    return () => clearInterval(interval);
  }, [hash]);

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" style={styles.activityIndicator} color="#535aff" />
        <Text style={styles.centeredText}>Loading</Text>
      </View>
    );
  }

  if (!torrentData) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.centeredText}>No details available</Text>
      </View>
    );
  }

  const getFormattedCategory = (category: string) => {
    if (!category) return '';
    switch (category.toLowerCase()) {
      case 'movie':
        return 'Movie';
      case 'tv':
        return 'TV Show';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  const videoFiles = torrentData.files.filter((file: any) =>
    /\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v)$/i.test(file.path)
  );

  const handleFileLink = async (file: any) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
    }
    const encodedPath = encodeURIComponent(file.path);
    const streamUrl = `${baseUrl}/stream/${encodedPath}?link=${hash}&index=${file.id}&play`;
    Linking.openURL(streamUrl);
  };

  const handleDrop = async () => {
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
      }
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drop', hash }),
      });
      alert('Torrent dropped successfully');
    } catch (error) {
      console.error('Drop failed:', error);
      alert('Failed to drop torrent');
    }
  };

  const handleWipe = async () => {
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
      }
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rem', hash }),
      });
      alert('Torrent Deleted successfully');
      router.back();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to Delete torrent');
    }
  };


  const CacheInfo = React.memo(({ cacheData }: { cacheData: any }) => {
    if (!cacheData?.Torrent) return null;

    return (
      <View style={[styles.metaRow, { marginTop: 4 }]}>
        <View style={styles.metaItem}>
          <Ionicons name="download" size={16} color="#aaa" style={{ marginRight: 5 }} />
          <Text style={styles.metaText}>{cacheData.Torrent.download_speed?.toFixed(2)} MB/s</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people" size={16} color="#aaa" style={{ marginRight: 5 }} />
          <Text style={styles.metaText}>{cacheData.Torrent.total_peers}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="arrow-up-circle" size={16} color="#aaa" style={{ marginRight: 5 }} />
          <Text style={styles.metaText}>{cacheData.Torrent.connected_seeders}</Text>
        </View>
      </View>
    );
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container} ref={ref}>
      <StatusBar />
      <View style={[styles.rootContainer, {
        flexDirection: isLargeScreen ? 'row' : 'column',
        marginTop: isLargeScreen ? 50 : 0
      }]}>
        <View style={isLargeScreen ? styles.leftHalf : styles.fullWidth}>
          <Image
            source={{ uri: torrentData.poster }}
            style={styles.posterImage}
            resizeMode="cover"
          />
        </View>

        <View style={isLargeScreen ? styles.rightHalf : styles.fullWidth}>
          <Text style={[styles.title, { textAlign: 'center' }]}>{torrentData.title}</Text>
          <Text style={styles.metaText}>
            {getFormattedCategory(torrentData.category)} | {(torrentData.size / (1024 ** 3)).toFixed(2)} GB
          </Text>
          {cacheData && <CacheInfo cacheData={cacheData} />}
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#535aff' }]}
          onPress={handleDrop}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="remove-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Drop</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
          onPress={handleWipe}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </View>
        </TouchableOpacity>
      </View>

      {videoFiles.length > 0 && (
        <View style={{ marginHorizontal: 10 }}>
          <Text style={styles.cacheTitle}>Files</Text>
          {videoFiles.map((file: any, index: number) => (
            <View key={index} style={styles.cacheBox}>
              <TouchableOpacity onPress={() => handleFileLink(file)}>
                <Text style={styles.cacheText}>
                  {file.path} ({(file.length / (1024 ** 2)).toFixed(2)} MB)
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <BottomSpacing space={100} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rootContainer: {
    justifyContent: 'flex-start',
  },
  posterImage: {
    width: '100%',
    aspectRatio: 1 / 1,
    borderRadius: 10,
    alignSelf: 'center',
  },
  leftHalf: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightHalf: {
    flex: 2,
    paddingLeft: 10,
    justifyContent: 'flex-start',
  },
  fullWidth: {
    width: '100%',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 14,
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 5
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignSelf: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    marginRight: 10,
    justifyContent: 'center',
  },
  cacheBox: {
    marginHorizontal: 10,
    marginVertical: 10,
    padding: 20,
    backgroundColor: '#101010',
    borderRadius: 8
  },
  cacheTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
    marginHorizontal: 20
  },
  cacheText: {
    fontSize: 14,
    marginBottom: 2,
  },
  activityIndicator: {
    marginBottom: 10,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredText: {
    fontSize: 18,
    textAlign: 'center',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default TorrentDetails;
