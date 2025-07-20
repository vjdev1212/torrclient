import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text, View } from '@/components/Themed';
import PlayButton from '@/components/PlayButton';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Ionicons } from '@expo/vector-icons';

const baseUrl = process.env.EXPO_PUBLIC_TORRSERVER_URL;

const TorrentDetails = () => {
  const { hash } = useLocalSearchParams();
  const [torrentData, setTorrentData] = useState<any>(null);
  const [cacheData, setCacheData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isLargeScreen = width > 768 && !isPortrait;
  const ref = useRef<ScrollView | null>(null);

  useFocusEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({ y: 0, animated: true });
    }
  });

  useEffect(() => {
    let interval: any;

    const fetchDetails = async () => {
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

    const fetchCache = async () => {
      try {
        const cacheRes = await fetch(`${baseUrl}/cache`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', hash }),
        });
        const cacheResult = await cacheRes.json();
        setCacheData(cacheResult);
      } catch (error) {
        console.error('Error fetching cache data:', error);
      }
    };

    if (hash) {
      fetchDetails();
      fetchCache();
      interval = setInterval(fetchCache, 3000);
    }

    return () => clearInterval(interval);
  }, [hash]);

  const handlePlayPress = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
    router.push({
      pathname: '/stream/embed',
      params: { hash, type: 'movie', name: torrentData?.title },
    });
  };

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
            {torrentData.category.charAt(0).toUpperCase() + torrentData.category.slice(1)} | {(torrentData.size / (1024 ** 3)).toFixed(2)} GB
          </Text>
          {cacheData && (
            <View style={[styles.metaRow, { marginTop: 4 }]}>
              <View style={styles.metaItem}>
                <Ionicons name="download" size={16} color="#aaa" style={{ marginRight: 5 }} />
                <Text style={styles.metaText}>{cacheData.Torrent?.download_speed?.toFixed(2)} MB/s</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people" size={16} color="#aaa" style={{ marginRight: 5 }} />
                <Text style={styles.metaText}>{cacheData.Torrent?.total_peers}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="arrow-up-circle" size={16} color="#aaa" style={{ marginRight: 5 }} />
                <Text style={styles.metaText}>{cacheData.Torrent?.connected_seeders}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {torrentData.files && torrentData.files.length > 0 && (
        <View style={[styles.cacheBox, { marginHorizontal: 20, marginTop: 10 }]}>
          <Text style={styles.cacheTitle}>Files</Text>
          {torrentData.files.map((file: any, index: number) => {
            const encodedPath = encodeURIComponent(file.path);
            const streamUrl = `${baseUrl}/stream/${encodedPath}?link=${hash}&index=${file.id}&play`;
            const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}`;

            return (
              <TouchableOpacity key={index} onPress={() => Linking.openURL(infuseUrl)}>
                <Text style={styles.cacheText}>
                  {file.path} ({(file.length / (1024 ** 2)).toFixed(2)} MB)
                </Text>
              </TouchableOpacity>
            );
          })}
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
    color: '#aaa',
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
    marginTop: 10,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#101010',
    borderRadius: 8
  },
  cacheTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
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
});

export default TorrentDetails;
