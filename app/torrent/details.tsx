import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Linking, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StatusBar, Text } from '@/components/Themed';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { extractFileName, formatBytes, getTorrServerAuthHeader, getTorrServerUrl, preloadOnly, streamTorrentFile } from '@/utils/TorrServer';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { MenuView } from '@react-native-menu/menu';
import { LinearGradient } from 'expo-linear-gradient';

const TorrentDetails = () => {
  const { hash } = useLocalSearchParams();
  const [torrentData, setTorrentData] = useState<any>(null);
  const [cacheData, setCacheData] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [preloadingFiles, setPreloadingFiles] = useState<Set<number>>(new Set());
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const ref = useRef<ScrollView | null>(null);

  useEffect(() => {
    let interval: any;

    const loadBaseUrl = async () => {
      const url = getTorrServerUrl();
      setBaseUrl(url);
      return url;
    };

    const fetchDetails = async (baseUrl: string) => {
      try {
        const authHeader = getTorrServerAuthHeader();
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

        const torrentInfo = {
          title: torrentResult.title || 'Untitled',
          poster: torrentResult.poster,
          category: torrentResult.category || 'unknown',
          size: torrentResult.torrent_size,
          magnet: torrentResult.magnet || '',
          hash: torrentResult.hash || hash,
          files,
        };

        setTorrentData(torrentInfo);
      } catch (error) {
        console.error('Error fetching torrent details:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCache = async (baseUrl: string) => {
      try {
        const authHeader = getTorrServerAuthHeader();
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
          interval = setInterval(() => fetchCache(url), 1000);
        });
      });
    }

    return () => clearInterval(interval);
  }, [hash]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
    await streamTorrentFile({
      hash: torrentData.hash,
      fileId: file.id,
      filePath: file.path,
      title: torrentData.title,
      fileTitle: extractFileName(file.path),
      category: torrentData.category,
      onPreloadStart: () => setPreloadingFiles(prev => new Set(prev).add(file.id)),
      onPreloadEnd: () => setPreloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      }),
    });
  };

  const handleMenuAction = async (file: any, actionId: string) => {
    if (actionId === 'play') {
      await streamTorrentFile({
        hash: torrentData.hash,
        fileId: file.id,
        filePath: file.path,
        title: torrentData.title,
        fileTitle: extractFileName(file.path),
        category: torrentData.category,
        onPreloadStart: () => setPreloadingFiles(prev => new Set(prev).add(file.id)),
        onPreloadEnd: () => setPreloadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.id);
          return newSet;
        }),
      });
    } else if (actionId === 'preload') {
      await preloadOnly({
        hash: torrentData.hash,
        fileId: file.id,
        filePath: file.path,
        title: torrentData.title,
      });
    }
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

  const handleEdit = async () => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(ImpactFeedbackStyle.Light);
    }

    router.push({
      pathname: '/torrent/add',
      params: {
        action: 'set',
        hash: torrentData.hash,
        magnet: torrentData.magnet,
        title: torrentData.title,
        poster: torrentData.poster,
        category: torrentData.category,
      },
    });
  };

  const handleDrop = async () => {
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Light);
      }
      const confirmed = await confirmAction(
        'Confirm Drop',
        'Are you sure you want to drop this torrent?',
        'Drop'
      );
      if (!confirmed) return;
      const authHeader = getTorrServerAuthHeader();
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify({ action: 'drop', hash }),
      });
      showAlert('Success', 'Torrent has been dropped.');
    } catch (error) {
      console.error('Drop failed:', error);
      showAlert('Error', 'Failed to drop torrent.');
    }
  };

  const handleWipe = async () => {
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(ImpactFeedbackStyle.Light);
      }
      const confirmed = await confirmAction(
        'Confirm Delete',
        'Are you sure you want to permanently delete this torrent?',
        'Delete'
      );
      if (!confirmed) return;
      const authHeader = getTorrServerAuthHeader();
      await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify({ action: 'rem', hash }),
      });
      showAlert('Success', 'Torrent has been deleted.');
      router.back();
    } catch (error) {
      console.error('Delete failed:', error);
      showAlert('Error', 'Failed to delete torrent.');
    }
  };

  const CacheInfo = React.memo(({ cacheData, cacheLoading }: { cacheData: any, cacheLoading: boolean }) => {
    if (cacheLoading) {
      return (
        <View style={styles.infoGroup}>
          <View style={styles.infoCard}>
            <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
            <View style={styles.separator} />
            <InfoRow label="Size" value={torrentData.size ? formatBytes(torrentData.size) : 'Unknown'} />
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          </View>
        </View>
      );
    }

    if (!cacheData?.Torrent) {
      return (
        <View style={styles.infoGroup}>
          <View style={styles.infoCard}>
            <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
            <View style={styles.separator} />
            <InfoRow label="Size" value={torrentData.size ? formatBytes(torrentData.size) : 'Unknown'} />
            <View style={styles.separator} />
            <InfoRow label="Status" value="Loading..." />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.infoGroup}>
        <Text style={styles.groupTitle}>TORRENT DETAILS</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Category" value={getFormattedCategory(torrentData.category)} />
          <View style={styles.separator} />
          <InfoRow label="Size" value={torrentData.size ? formatBytes(torrentData.size) : 'Unknown'} />
          <View style={styles.separator} />
          <InfoRow label="Status" value={cacheData.Torrent.stat_string} />
        </View>

        <Text style={styles.groupTitle}>NETWORK</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Peers" value={cacheData.Torrent.total_peers || 0} />
          <View style={styles.separator} />
          <InfoRow label="Seeders" value={cacheData.Torrent.connected_seeders || 0} />
          <View style={styles.separator} />
          <InfoRow
            label="Download Speed"
            value={cacheData.Torrent?.download_speed > 0
              ? `${formatBytes(cacheData.Torrent.download_speed)}/s`
              : '0 KB/s'}
          />
          <View style={styles.separator} />
          <InfoRow label="Active Peers" value={cacheData.Torrent.active_peers || 0} />
          <View style={styles.separator} />
          <InfoRow label="Pending Peers" value={cacheData.Torrent.pending_peers || 0} />
        </View>

        <Text style={styles.groupTitle}>DATA TRANSFER</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Bytes Read" value={formatBytes(cacheData.Torrent?.bytes_read || 0)} />
          <View style={styles.separator} />
          <InfoRow label="Bytes Written" value={formatBytes(cacheData.Torrent?.bytes_written || 0)} />
        </View>
      </View>
    );
  });


  const InfoRow = ({ label, value }: { label: string, value: any }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );

  const getFileActions = () => {
    return [
      {
        id: 'play',
        title: 'Play',
        image: Platform.select({
          ios: 'play',
          android: 'ic_media_play',
        }),
        imageColor: '#ffffff',
      },
      {
        id: 'preload',
        title: 'Preload',
        image: Platform.select({
          ios: 'arrow.triangle.2.circlepath',
          android: 'ic_popup_sync',
        }),
        imageColor: '#ffffff',
      },
    ];
  }


  return (
    <View style={styles.container}>
      <StatusBar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ref={ref}
      >
        {/* Hero Poster Section - Portrait Only */}
        {isPortrait && (
          <View style={styles.heroPosterContainer}>
            {torrentData.poster ? (
              <ImageBackground
                source={{ uri: torrentData.poster }}
                style={styles.heroPosterImage}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.9)']}
                  style={styles.gradient}
                />
              </ImageBackground>
            ) : (
              <View style={styles.heroPosterFallback}>
                <Ionicons name="film-outline" size={80} color="#3A3A3C" />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.2)']}
              style={styles.heroPosterGradient}
            />

            {/* Title Overlay on Poster */}
            <View style={styles.heroTitleContainer}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {torrentData.title}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.content, !isPortrait && styles.contentLandscape]}>

          {/* Poster Section - Landscape Only */}
          {!isPortrait && (
            <View style={styles.posterSection}>
              <View style={styles.posterContainer}>
                {torrentData.poster ? (
                  <ImageBackground
                    source={{ uri: torrentData.poster }}
                    style={styles.posterImage}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
                      style={styles.gradient}
                    />
                  </ImageBackground>
                ) : (
                  <View style={styles.posterFallback}>
                    <Ionicons name="film-outline" size={60} color="#3A3A3C" />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Info Section */}
          <View style={!isPortrait ? styles.infoSectionLandscape : styles.infoSectionPortrait}>
            {/* Title - Only show in landscape */}
            {!isPortrait && (
              <View style={styles.titleSection}>
                <Text style={styles.title}>{torrentData.title}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleEdit}
                activeOpacity={0.6}
              >
                <Ionicons name="pencil" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDrop}
                activeOpacity={0.6}
              >
                <Ionicons name="pause-circle" size={20} color="#FF9500" />
                <Text style={[styles.actionButtonText, { color: '#FF9500' }]}>Drop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleWipe}
                activeOpacity={0.6}
              >
                <Ionicons name="trash" size={20} color="#FF3B30" />
                <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Delete</Text>
              </TouchableOpacity>
            </View>

            {/* Files Section */}
            {videoFiles.length > 0 && (
              <View style={styles.infoGroup}>
                <Text style={styles.groupTitle}>FILES ({videoFiles.length})</Text>
                <View style={styles.infoCard}>
                  {videoFiles.map((file: any, index: number) => (
                    <React.Fragment key={index}>
                      {index > 0 && <View style={styles.separator} />}
                      <MenuView
                        title="Actions"
                        onPressAction={({ nativeEvent }) => {
                          handleMenuAction(file, nativeEvent.event);
                        }}
                        themeVariant="dark"
                        actions={getFileActions()}
                        shouldOpenOnLongPress={false}
                      >
                        <TouchableOpacity
                          style={styles.fileRow}
                          onPress={() => handleFileLink(file)}
                          activeOpacity={0.6}
                          disabled={preloadingFiles.has(file.id)}
                        >
                          <View style={styles.fileIconContainer}>
                            {preloadingFiles.has(file.id) ? (
                              <ActivityIndicator size="small" color="#007AFF" />
                            ) : (
                              <Ionicons name="play-circle" size={24} color="#007AFF" />
                            )}
                          </View>
                          <View style={styles.fileContent}>
                            <Text style={[
                              styles.fileName,
                              preloadingFiles.has(file.id) && styles.fileNameLoading
                            ]}>
                              {file.path}
                            </Text>
                            <Text style={styles.fileSize}>
                              {preloadingFiles.has(file.id)
                                ? 'Loading. Please wait...'
                                : `${(file.length / (1024 ** 2)).toFixed(2)} MB`
                              }
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={preloadingFiles.has(file.id) ? '#3A3A3C' : '#C7C7CC'}
                          />
                        </TouchableOpacity>
                      </MenuView>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}
            <CacheInfo cacheData={cacheData} cacheLoading={cacheLoading} />
          </View>
        </View>
        <BottomSpacing space={50} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
  },
  contentLandscape: {
    flexDirection: 'row',
    gap: 32,
    padding: 32,
  },

  // Hero Poster - Portrait
  heroPosterContainer: {
    width: '100%',
    height: 420,
    position: 'relative',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
  },
  heroPosterFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPosterGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  heroTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40,
    zIndex: 2,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.35,
    lineHeight: 40,
  },

  // Poster Section - Landscape
  posterSection: {
    width: 280,
    flexShrink: 0,
  },
  posterContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  posterImage: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  posterFallback: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  // Info Section
  infoSectionLandscape: {
    flex: 1,
    minWidth: 0,
  },
  infoSectionPortrait: {
    width: '100%',
  },

  // Title
  titleSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.35,
    lineHeight: 34,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },

  // Info Groups (iOS Settings style)
  infoGroup: {
    marginTop: 10,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 20,
    paddingBottom: 10,
  },
  infoCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  infoLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'right',
    marginLeft: 16,
    flexShrink: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(84, 84, 88, 0.65)',
    marginLeft: 16,
  },

  // Files
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 60,
    gap: 12,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileContent: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  fileNameLoading: {
    color: '#8E8E93',
  },
  fileSize: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default TorrentDetails;