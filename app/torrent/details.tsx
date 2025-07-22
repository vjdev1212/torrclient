import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text } from '@/components/Themed';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
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
        const authHeader = await getTorrServerAuthHeader();
        const torrentRes = await fetch(`${baseUrl}/torrents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader || {})
          },
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
        const authHeader = await getTorrServerAuthHeader();
        const cacheRes = await fetch(`${baseUrl}/cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader || {})
          },
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

  const handleDrop = () => {
    Alert.alert(
      'Confirm Drop',
      'Are you sure you want to drop this torrent?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Drop',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isHapticsSupported()) {
                await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
              }
              const authHeader = await getTorrServerAuthHeader();
              await fetch(`${baseUrl}/torrents`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authHeader || {})
                },
                body: JSON.stringify({ action: 'drop', hash }),
              });
              alert('Torrent dropped successfully');
            } catch (error) {
              console.error('Drop failed:', error);
              alert('Failed to drop torrent');
            }
          }
        }
      ]
    );
  };

  const handleWipe = () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to permanently delete this torrent?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isHapticsSupported()) {
                await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
              }
              const authHeader = await getTorrServerAuthHeader();
              await fetch(`${baseUrl}/torrents`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authHeader || {})
                },
                body: JSON.stringify({ action: 'rem', hash }),
              });
              alert('Torrent deleted successfully');
              router.back();
            } catch (error) {
              console.error('Delete failed:', error);
              alert('Failed to delete torrent');
            }
          }
        }
      ]
    );
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${units[i]}`;
  }


  const CacheInfo = React.memo(({ cacheData }: { cacheData: any }) => {
    if (!cacheData?.Torrent) return null;

    return (
      <View>
        <Text style={[styles.cacheTitle, { marginHorizontal: 25 }]}>Torrent Details</Text>
        <View style={styles.metaTable}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Category:</Text>
            <Text style={styles.metaValue}>{getFormattedCategory(torrentData.category)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Size:</Text>
            <Text style={styles.metaValue}>{formatBytes(torrentData.size)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status:</Text>
            <Text style={styles.metaValue}>{cacheData.Torrent.stat_string}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Peers:</Text>
            <Text style={styles.metaValue}>{cacheData.Torrent.total_peers}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Seeders:</Text>
            <Text style={styles.metaValue}>{cacheData.Torrent.connected_seeders}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Download Speed:</Text>
            <Text style={styles.metaValue}>
              {cacheData.Torrent?.download_speed > 0
                ? `${formatBytes(cacheData.Torrent.download_speed)}/s`
                : '0 KB/s'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Bytes Read:</Text>
            <Text style={styles.metaValue}>{formatBytes(cacheData.Torrent?.bytes_read)}/s</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Bytes Written:</Text>
            <Text style={styles.metaValue}>{formatBytes(cacheData.Torrent?.bytes_written)}/s</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Active Peers:</Text>
            <Text style={styles.metaValue}>{cacheData.Torrent.active_peers}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Pending Peers:</Text>
            <Text style={styles.metaValue}>{cacheData.Torrent.pending_peers}</Text>
          </View>
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
            style={isLargeScreen ? styles.landscapePosterImage : styles.portraitPosterImage}
            resizeMode="cover"
          />
        </View>

        <View style={isLargeScreen ? styles.rightHalf : styles.fullWidth}>
          <Text style={[styles.title, { textAlign: 'center' }]}>{torrentData.title}</Text>
          {cacheData && <CacheInfo cacheData={cacheData} />}

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

          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginVertical: 20 }}>
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
        </View>
      </View>
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
  portraitPosterImage: {
    width: '100%',
    margin: 'auto',
    aspectRatio: 3 / 4,
    alignSelf: 'center',
  },
  landscapePosterImage: {
    width: '75%',
    aspectRatio: 2 / 3,
    alignSelf: 'center',
    borderRadius: 8
  },
  leftHalf: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightHalf: {
    flex: 2,
    padding: 20,
    justifyContent: 'flex-start',
  },
  fullWidth: {
    width: '100%',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 25,
  },
  metaText: {
    fontSize: 14,
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 5
  },
  metaTable: {
    marginBottom: 15,
    marginTop: 8,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#101010',
    borderRadius: 8,
    textAlign: 'justify'
  },
  metaRow: {
    flexDirection: 'row',
    marginVertical: 4
  },
  metaLabel: {
    fontSize: 14,
    color: '#fff',
    marginRight: 30,
    flex: 1
  },
  metaValue: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'left',
    flex: 1.25
  },
  cacheBox: {
    marginHorizontal: 10,
    marginVertical: 10,
    padding: 20,
    backgroundColor: '#101010',
    borderRadius: 8,
    alignSelf: 'center',
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
    borderRadius: 25,
    marginHorizontal: 30
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
