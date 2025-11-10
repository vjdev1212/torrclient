import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text } from '@/components/Themed';
import * as Haptics from 'expo-haptics';
import { getOriginalPlatform, isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useActionSheet } from '@expo/react-native-action-sheet';
import * as Clipboard from 'expo-clipboard';

const TorrentDetails = () => {
  const { showActionSheetWithOptions } = useActionSheet();
  const { hash } = useLocalSearchParams();
  const [torrentData, setTorrentData] = useState<any>(null);
  const [cacheData, setCacheData] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const [cacheLoading, setCacheLoading] = useState(true);
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
      } finally {
        setCacheLoading(false);
      }
    };

    if (hash) {
      loadBaseUrl().then((url: any) => {
        Promise.all([
          fetchDetails(url),
          fetchCache(url)
        ]).then(() => {
          interval = setInterval(() => fetchCache(url), 3000);
        });
      });
    }

    return () => clearInterval(interval);
  }, [hash]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#535aff" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!torrentData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>No details available</Text>
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }

    setTimeout(() => {
      showPreloadOrPlaySheet(file);
    }, 100);
  };

  const showPreloadOrPlaySheet = (file: any) => {
    const options = ['Preload', 'Play', 'Cancel'];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 2,
        title: 'Choose Action',
        textStyle: { color: '#fff' },
        titleTextStyle: { color: '#007aff' },
        containerStyle: { backgroundColor: '#101010' },
        cancelButtonTintColor: '#ff4757',
        userInterfaceStyle: 'dark',
      },
      async (index) => {
        const encodedPath = encodeURIComponent(file.path);
        const streamUrl = `${baseUrl}/stream/${encodedPath}?link=${hash}&index=${file.id}`;

        if (index === 0) {
          try {
            const preloadUrl = `${streamUrl}&preload`;
            const authHeader = await getTorrServerAuthHeader();
            await fetch(preloadUrl, {
              method: 'GET',
              headers: { ...(authHeader || {}) },
            });
            Alert.alert('Preload started', 'Torrent file is now preloading.');
          } catch {
            Alert.alert('Preload failed', 'Unable to start preload.');
          }
        }

        if (index === 1) {
          setTimeout(() => {
            const playUrl = `${window.location.origin}${streamUrl}&play`;
            console.log('PlayUrl', playUrl)
            showPlayerSelection(playUrl);
          }, 300);
        }
      }
    );
  };

  const showPlayerSelection = (streamUrl: string) => {
    const playerOptions: { label: string; url: string }[] = [];

    if (getOriginalPlatform() === 'ios') {
      playerOptions.push(
        { label: 'Infuse', url: `infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}` },
        { label: 'Vidhub', url: `open-vidhub://x-callback-url/open?url=${encodeURIComponent(streamUrl)}` },
        { label: 'VLC', url: `vlc://${streamUrl}` }
      );
    } else if (getOriginalPlatform() === 'android') {
      playerOptions.push(
        { label: 'VLC', url: `vlc://${streamUrl}` },
        {
          label: 'MX Player',
          url: `intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`,
        }
      );
    } else {
      playerOptions.push({ label: 'New Window', url: streamUrl });
    }

    playerOptions.push(
      { label: 'Copy Link', url: 'copy' },
      { label: 'Share', url: 'share' },
      { label: 'Cancel', url: 'cancel' }
    );

    const options = playerOptions.map((p) => p.label);

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        title: 'Open with...',
        textStyle: { color: '#fff' },
        titleTextStyle: { color: '#007aff' },
        containerStyle: { backgroundColor: '#101010' },
        cancelButtonTintColor: '#ff4757',
        userInterfaceStyle: 'dark',
      },
      async (selectedIndex) => {
        const selected = playerOptions[selectedIndex as any];
        if (!selected || selected.url === 'cancel') return;

        if (selected.url === 'copy') {
          await Clipboard.setStringAsync(streamUrl);
          Alert.alert('Copied', 'Stream link copied to clipboard.');
          return;
        }

        if (selected.url === 'share') {
          try {
            await Share.share({ message: streamUrl, url: streamUrl, title: 'Open Stream' });
          } catch {
            Alert.alert('Unable to share', 'Please copy and open the stream manually.');
          }
          return;
        }

        Linking.openURL(selected.url);
      }
    );
  };

  const confirmAction = async (
    title: string,
    message: string,
    confirmText: string
  ): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
  };

  const handleDrop = async () => {
    const confirmed = await confirmAction(
      'Confirm Drop',
      'Are you sure you want to drop this torrent?',
      'Drop'
    );
    if (!confirmed) return;

    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
      }
      const authHeader = await getTorrServerAuthHeader();
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify({ action: 'drop', hash }),
      });
      alert('Torrent has been dropped.');
    } catch (error) {
      console.error('Drop failed:', error);
      alert('Failed to drop torrent.');
    }
  };

  const handleWipe = async () => {
    const confirmed = await confirmAction(
      'Confirm Delete',
      'Are you sure you want to permanently delete this torrent?',
      'Delete'
    );
    if (!confirmed) return;

    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Soft);
      }
      const authHeader = await getTorrServerAuthHeader();
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify({ action: 'rem', hash }),
      });
      alert('Torrent has been deleted.');
      router.back();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete torrent.');
    }
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${units[i]}`;
  }

  const CacheInfo = React.memo(({ cacheData, cacheLoading }: { cacheData: any, cacheLoading: boolean }) => {
    if (cacheLoading) {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
            <InfoRow label="Size" value={formatBytes(torrentData.size)} />
            <InfoRow label="Status" value={<ActivityIndicator size="small" color="#535aff" />} />
          </View>
        </View>
      );
    }

    if (!cacheData?.Torrent) {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
            <InfoRow label="Size" value={formatBytes(torrentData.size)} />
            <InfoRow label="Status" value="Loading..." />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
          <InfoRow label="Size" value={formatBytes(torrentData.size)} />
          <InfoRow label="Status" value={cacheData.Torrent.stat_string} />
          <InfoRow label="Peers" value={cacheData.Torrent.total_peers} />
          <InfoRow label="Seeders" value={cacheData.Torrent.connected_seeders} />
          <InfoRow 
            label="Download Speed" 
            value={cacheData.Torrent?.download_speed > 0
              ? `${formatBytes(cacheData.Torrent.download_speed)}/s`
              : '0 KB/s'} 
          />
          <InfoRow label="Bytes Read" value={formatBytes(cacheData.Torrent?.bytes_read || 0)} />
          <InfoRow label="Bytes Written" value={formatBytes(cacheData.Torrent?.bytes_written || 0)} />
          <InfoRow label="Active Peers" value={cacheData.Torrent.active_peers} />
          <InfoRow label="Pending Peers" value={cacheData.Torrent.pending_peers} isLast />
        </View>
      </View>
    );
  });

  const InfoRow = ({ label, value, isLast = false }: { label: string, value: any, isLast?: boolean }) => (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container} ref={ref}>
      <StatusBar />
      <View style={[styles.content, {
        flexDirection: isLargeScreen ? 'row' : 'column',
        paddingTop: isLargeScreen ? 40 : 20
      }]}>
        {/* Poster Section */}
        <View style={isLargeScreen ? styles.posterSection : styles.posterSectionMobile}>
          <Image
            source={{ uri: torrentData.poster }}
            style={isLargeScreen ? styles.posterLarge : styles.posterMobile}
            resizeMode="cover"
          />
        </View>

        {/* Details Section */}
        <View style={isLargeScreen ? styles.infoSection : styles.infoSectionMobile}>
          <Text style={styles.title}>{torrentData.title}</Text>
          
          <CacheInfo cacheData={cacheData} cacheLoading={cacheLoading} />

          {/* Files Section */}
          {videoFiles.length > 0 && (
            <View style={styles.filesSection}>
              <Text style={styles.sectionTitle}>Files ({videoFiles.length})</Text>
              {videoFiles.map((file: any, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.fileCard}
                  onPress={() => handleFileLink(file)}
                  activeOpacity={0.7}
                >
                  <View style={styles.fileInfo}>
                    <Ionicons name="play-circle" size={20} color="#535aff" />
                    <Text style={styles.fileName} numberOfLines={2}>
                      {file.path}
                    </Text>
                  </View>
                  <Text style={styles.fileSize}>
                    {(file.length / (1024 ** 2)).toFixed(2)} MB
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.dropButton]}
              onPress={handleDrop}
              activeOpacity={0.8}
            >
              <Ionicons name="remove-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Drop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleWipe}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <BottomSpacing space={60} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 20,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  posterSection: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 30,
  },
  posterSectionMobile: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  posterLarge: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 2 / 3,
    borderRadius: 16,
  },
  posterMobile: {
    width: '70%',
    maxWidth: 250,
    aspectRatio: 2 / 3,
    borderRadius: 16,
  },
  infoSection: {
    flex: 2,
  },
  infoSectionMobile: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  filesSection: {
    marginBottom: 24,
  },
  fileCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 13,
    color: '#999',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  dropButton: {
    backgroundColor: '#535aff',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#999',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});

export default TorrentDetails;