import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text } from '@/components/Themed';
import * as Haptics from 'expo-haptics';
import { getOriginalPlatform, isHapticsSupported, showAlert } from '@/utils/platform';
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
            showAlert('Preload started', 'Torrent file is now preloading.');
          } catch {
            showAlert('Preload failed', 'Unable to start preload.');
          }
        }

        if (index === 1) {
          setTimeout(() => {
            const playUrl = `${streamUrl}&play`;
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
          label: 'External',
          url: `${streamUrl}`,
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
          showAlert('Copied', 'Stream link copied to clipboard.');
          return;
        }

        if (selected.url === 'share') {
          try {
            await Share.share({ message: streamUrl, url: streamUrl, title: 'Open Stream' });
          } catch {
            showAlert('Unable to share', 'Please copy and open the stream manually.');
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
          {isLargeScreen ? (
            <View style={styles.statsGrid}>
              <StatCard label="Category" value={getFormattedCategory(torrentData.category)} icon="folder-outline" />
              <StatCard label="Size" value={formatBytes(torrentData.size)} icon="archive-outline" />
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#535aff" />
                </View>
                <Text style={styles.statLabel}>Status</Text>
                <ActivityIndicator size="small" color="#535aff" style={{ marginTop: 4 }} />
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
              <InfoRow label="Size" value={formatBytes(torrentData.size)} />
              <InfoRow label="Status" value={<ActivityIndicator size="small" color="#535aff" />} />
            </View>
          )}
        </View>
      );
    }

    if (!cacheData?.Torrent) {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          {isLargeScreen ? (
            <View style={styles.statsGrid}>
              <StatCard label="Category" value={getFormattedCategory(torrentData.category)} icon="folder-outline" />
              <StatCard label="Size" value={formatBytes(torrentData.size)} icon="archive-outline" />
              <StatCard label="Status" value="Loading..." icon="information-circle-outline" />
            </View>
          ) : (
            <View style={styles.infoCard}>
              <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
              <InfoRow label="Size" value={formatBytes(torrentData.size)} />
              <InfoRow label="Status" value="Loading..." />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Details</Text>
        {isLargeScreen ? (
          <View style={styles.statsGrid}>
            <StatCard label="Category" value={getFormattedCategory(torrentData.category)} icon="folder-outline" />
            <StatCard label="Size" value={formatBytes(torrentData.size)} icon="archive-outline" />
            <StatCard label="Status" value={cacheData.Torrent.stat_string} icon="information-circle-outline" />
            <StatCard label="Peers" value={cacheData.Torrent.total_peers} icon="people-outline" />
            <StatCard label="Seeders" value={cacheData.Torrent.connected_seeders} icon="cloud-upload-outline" />
            <StatCard
              label="Download"
              value={cacheData.Torrent?.download_speed > 0
                ? `${formatBytes(cacheData.Torrent.download_speed)}/s`
                : '0 KB/s'}
              icon="download-outline"
            />
            <StatCard label="Read" value={formatBytes(cacheData.Torrent?.bytes_read || 0)} icon="analytics-outline" />
            <StatCard label="Written" value={formatBytes(cacheData.Torrent?.bytes_written || 0)} icon="create-outline" />
            <StatCard label="Active" value={cacheData.Torrent.active_peers} icon="pulse-outline" />
            <StatCard label="Pending" value={cacheData.Torrent.pending_peers} icon="time-outline" />
          </View>
        ) : (
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
        )}
      </View>
    );
  });

  const StatCard = ({ label, value, icon }: { label: string, value: any, icon: any }) => (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon} size={20} color="#535aff" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );

  const InfoRow = ({ label, value, isLast = false }: { label: string, value: any, isLast?: boolean }) => (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const contentPadding = isLargeScreen ? 32 : 0;

  return (
    <View style={styles.container}>
      <StatusBar />

      {/* Hero Poster Section - Mobile Only */}
      {!isLargeScreen && (
        <View style={styles.heroPosterContainer}>
          <Image
            source={{ uri: torrentData.poster }}
            style={styles.heroPosterImage}
            resizeMode="cover"
          />
          <View style={styles.heroPosterOverlay} />
          <View style={styles.heroPosterContent}>
            <Text style={styles.heroTitle}>{torrentData.title}</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: contentPadding }}
        ref={ref}
      >
        <View style={[styles.content, { flexDirection: isLargeScreen ? 'row' : 'column', gap: isLargeScreen ? 32 : 0 }]}>

          {/* Poster Section - Desktop Only */}
          {isLargeScreen && (
            <View style={styles.posterSection}>
              <View style={styles.posterContainer}>
                <Image
                  source={{ uri: torrentData.poster }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
                <View style={styles.posterOverlay} />
              </View>

              <View style={styles.actionsContainerDesktop}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dropButton]}
                  onPress={handleDrop}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove-circle-outline" size={22} color="#fff" />
                  <Text style={styles.actionButtonText}>Drop Torrent</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleWipe}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Info Section */}
          <View style={isLargeScreen ? styles.infoSection : styles.infoSectionMobile}>
            {isLargeScreen && (
              <View style={styles.headerSection}>
                <Text style={styles.title}>{torrentData.title}</Text>
              </View>
            )}

            <CacheInfo cacheData={cacheData} cacheLoading={cacheLoading} />

            {/* Files Section */}
            {videoFiles.length > 0 && (
              <View style={styles.filesSection}>
                <View style={styles.filesSectionHeader}>
                  <Text style={styles.sectionTitle}>Files</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{videoFiles.length}</Text>
                  </View>
                </View>
                {videoFiles.map((file: any, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.fileCard}
                    onPress={() => handleFileLink(file)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.fileIconContainer}>
                      <Ionicons name="play-circle" size={24} color="#535aff" />
                    </View>
                    <View style={styles.fileContent}>
                      <Text style={styles.fileName} numberOfLines={2}>
                        {file.path}
                      </Text>
                      <Text style={styles.fileSize}>
                        {(file.length / (1024 ** 2)).toFixed(2)} MB
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action Buttons - Mobile Only */}
            {!isLargeScreen && (
              <View style={styles.actionsContainerMobile}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dropButton]}
                  onPress={handleDrop}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove-circle-outline" size={22} color="#fff" />
                  <Text style={styles.actionButtonText}>Drop</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleWipe}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <BottomSpacing space={40} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    width: '100%',
  },

  // Hero Poster - Mobile
  heroPosterContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
  },
  heroPosterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  heroPosterContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 34,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  // Poster Section - Desktop
  posterSection: {
    width: 320,
    flexShrink: 0,
  },
  posterContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  posterImage: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  // Info Section
  infoSection: {
    flex: 1,
    minWidth: 0,
  },
  infoSectionMobile: {
    width: '100%',
    padding: 20,
    paddingTop: 24,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 38,
  },

  // Details Section
  detailsSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 500,
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Info Card - Mobile
  infoCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    flex: 1,
    fontWeight: 500,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 500,
    flex: 1,
    textAlign: 'right',
  },

  // Stats Grid - Desktop
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    flex: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderColor: '#222',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(83, 90, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
    fontWeight: 500,
  },
  statValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 500,
    letterSpacing: -0.2,
  },

  // Files Section
  filesSection: {
    marginBottom: 28,
  },
  filesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  badge: {
    backgroundColor: '#535aff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,    
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
  },
  fileCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    gap: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(83, 90, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileContent: {
    flex: 1,
    gap: 4,
  },
  fileName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: 500,
    lineHeight: 20,
  },
  fileSize: {
    fontSize: 13,
    color: '#999',
    fontWeight: 500,
  },

  // Action Buttons
  actionsContainerDesktop: {
    marginTop: 20,
    gap: 12,
  },
  actionsContainerMobile: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    flex: 1,
  },
  dropButton: {
    backgroundColor: '#535aff',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: -0.2,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#999',
    fontWeight: 500,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 500,
  },
});

export default TorrentDetails;