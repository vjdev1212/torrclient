import { Subtitle } from "@/components/coreplayer/models";
import { StorageKeys, storageService } from "@/utils/StorageService";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet, StatusBar, Linking } from "react-native";
import OpenSubtitlesClient, { SubtitleResult } from "@/clients/opensubtitles";
import * as ScreenOrientation from 'expo-screen-orientation';

interface UpdateProgressEvent {
  progress: number
}

interface PlaybackErrorEvent {
  error: string;
}

interface WatchHistoryItem {
  title: string;
  videoUrl: string;
  progress: number;
  timestamp: number;
}

const WATCH_HISTORY_KEY = StorageKeys.WATCH_HISTORY_KEY;
const MAX_HISTORY_ITEMS = 30;

const MediaPlayerScreen: React.FC = () => {
  const router = useRouter();
  const { url, title, fileTitle, category, progress: watchHistoryProgress } = useLocalSearchParams();

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(true);
  const [openSubtitlesClient, setOpenSubtitlesClient] = useState<OpenSubtitlesClient | null>(null);
  const [progress, setProgress] = useState(watchHistoryProgress || 0);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(true);
  const [defaultMediaPlayer, setDefaultMediaPlayer] = useState<string>('default');

  // iOS prefers ksplayer; Android/web start with native
  const [currentPlayerType, setCurrentPlayerType] = useState<"native" | "ksplayer">(
    Platform.OS === "ios" ? "ksplayer" : "native"
  );
  const [hasTriedPrimary, setHasTriedPrimary] = useState(false);

  const isInternalPlayer = (playerType: string | null): boolean => {
    if (!playerType) return true;
    const normalizedPlayer = playerType.toLowerCase().trim();
    return normalizedPlayer === 'default' || normalizedPlayer === 'ask';
  };

  // Orientation setup — mirrors doc 8: unlock first, small delay, then lock landscape
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (Platform.OS !== 'web') {
        try {
          await ScreenOrientation.unlockAsync();
          await new Promise(r => setTimeout(r, 100));
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          StatusBar.setHidden(true, 'slide');
        } catch (e) {
          console.warn('Orientation lock failed:', e);
        }
      }

      if (cancelled) return;

      if (!url) {
        initializeClient();
        return;
      }

      const savedPlayer = storageService.getItem(StorageKeys.DEFAULT_MEDIA_PLAYER_KEY);
      if (savedPlayer) {
        setDefaultMediaPlayer(savedPlayer);
        if (!isInternalPlayer(savedPlayer)) {
          const routedExternally = routeToExternalPlayer(savedPlayer, url as string);
          if (routedExternally) return;
        }
      }

      console.log('Using internal player, setting video URL');
      setVideoUrl(url as string);
      setIsLoadingStream(false);
      initializeClient();
    };

    init();

    return () => {
      cancelled = true;
      (async () => {
        try {
          await ScreenOrientation.unlockAsync();
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          StatusBar.setHidden(false, 'slide');
        } catch { }
      })();
    };
  }, []);

  useEffect(() => {
    if (openSubtitlesClient) fetchSubtitles();
  }, [openSubtitlesClient]);

  // When fallback player is set, clear error and allow render
  useEffect(() => {
    if (hasTriedPrimary) {
      console.log(`Switched to ${currentPlayerType} player, video URL:`, videoUrl);
      setIsLoadingStream(false);
    }
  }, [currentPlayerType, hasTriedPrimary]);

  const routeToExternalPlayer = (playerType: string, streamUrl: string): boolean => {
    const normalizedPlayer = playerType.toLowerCase().trim();
    switch (normalizedPlayer) {
      case 'infuse':
        Linking.openURL(`infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}`);
        router.back();
        return true;
      case 'vidhub':
        Linking.openURL(`open-vidhub://x-callback-url/open?url=${encodeURIComponent(streamUrl)}`);
        router.back();
        return true;
      case 'vlc':
        Linking.openURL(`vlc://${streamUrl}`);
        router.back();
        return true;
      case 'external':
      case 'newwindow':
        Linking.openURL(streamUrl);
        router.back();
        return true;
      default:
        return false;
    }
  };

  const handlePlaybackError = (event: PlaybackErrorEvent) => {
    console.log('Playback error:', event);

    if (Platform.OS === 'web') {
      console.log('Final playback error (web):', event.error);
      return;
    }

    if (!hasTriedPrimary) {
      // First failure: switch to the other player
      const fallback = currentPlayerType === "ksplayer" ? "native" : "ksplayer";
      console.log(`${currentPlayerType} failed, falling back to ${fallback}`);
      setHasTriedPrimary(true);
      setCurrentPlayerType(fallback);
    } else {
      // Both players failed
      const errorMessage = event.error || 'Playback failed. The video codec may not be supported.';
      console.log('Final playback error:', errorMessage);
      setIsLoadingStream(false);
    }
  };

  const initializeClient = async () => {
    try {
      const client = new OpenSubtitlesClient();
      setOpenSubtitlesClient(client);
    } catch (error) {
      console.error('Failed to initialize OpenSubtitles client:', error);
      setOpenSubtitlesClient(null);
      setSubtitles([]);
      setIsLoadingSubtitles(false);
    }
  };

  const fetchSubtitles = async () => {
    if (!openSubtitlesClient) {
      setIsLoadingSubtitles(false);
      return;
    }

    try {
      setIsLoadingSubtitles(true);
      const subtitleQuery = category === 'movie' ? title : fileTitle;
      const response = await openSubtitlesClient.searchByFileName(
        subtitleQuery as string,
        ['en'],
        {
          format: 'srt',
          ai_translated: 'include',
          machine_translated: 'include',
          trusted_sources: 'include',
          hearing_impaired: 'include',
        }
      );

      if (response.success) {
        if (response.data.length === 0) {
          setSubtitles([]);
          return;
        }
        const sortedData = response.data.sort((a: SubtitleResult, b: SubtitleResult) => b.download_count - a.download_count);
        const transformedSubtitles: Subtitle[] = sortedData.map((subtitle: SubtitleResult) => ({
          fileId: subtitle.file_id,
          language: subtitle.language,
          url: subtitle.url,
          label: subtitle.name,
        }));
        setSubtitles(transformedSubtitles);
      } else {
        console.error('Failed to fetch subtitles:', response.error);
        setSubtitles([]);
      }
    } catch (error) {
      console.error('Error fetching subtitles:', error);
      setSubtitles([]);
    } finally {
      setIsLoadingSubtitles(false);
    }
  };

  const saveToWatchHistory = (progress: number) => {
    const minProgressAsWatched = 95;
    try {
      const existingHistoryJson = storageService.getItem(WATCH_HISTORY_KEY);
      let history: WatchHistoryItem[] = existingHistoryJson ? JSON.parse(existingHistoryJson) : [];

      if (progress >= minProgressAsWatched) {
        history = history.filter(item => !(item.title === title && item.videoUrl === videoUrl));
        storageService.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
        return;
      }

      const historyItem: WatchHistoryItem = {
        title: title as string,
        videoUrl: videoUrl as string,
        progress,
        timestamp: Date.now(),
      };

      const existingIndex = history.findIndex(item => item.title === title && item.videoUrl === videoUrl);
      if (existingIndex !== -1) {
        history[existingIndex] = { ...history[existingIndex], videoUrl: videoUrl as string, progress, timestamp: Date.now() };
        const [updatedItem] = history.splice(existingIndex, 1);
        history.unshift(updatedItem);
      } else {
        history.unshift(historyItem);
      }

      if (history.length > MAX_HISTORY_ITEMS) history = history.slice(0, MAX_HISTORY_ITEMS);

      storageService.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save watch history:', error);
    }
  };

  const handleBack = async (): Promise<void> => {
    router.back();
  };

  const handleUpdateProgress = async (event: UpdateProgressEvent): Promise<void> => {
    if (event.progress <= 1) return;
    const progressPercentage = Math.floor(event.progress);
    setProgress(progressPercentage);
    saveToWatchHistory(progressPercentage);
  };

  function getPlayer() {
    if (Platform.OS === "web") {
      return require("../../components/nativeplayer").MediaPlayer;
    }
    if (currentPlayerType === "ksplayer") {
      return require("../../components/ksplayer").MediaPlayer;
    }
    return require("../../components/nativeplayer").MediaPlayer;
  }

  const Player = getPlayer();

  if (isLoadingStream) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Loading stream. Please wait...</Text>
        </View>
      </View>
    );
  }

  return (
    <Player
      videoUrl={videoUrl}
      back={handleBack}
      title={fileTitle}
      subtitles={subtitles}
      openSubtitlesClient={openSubtitlesClient}
      isLoadingSubtitles={isLoadingSubtitles}
      updateProgress={handleUpdateProgress}
      onPlaybackError={handlePlaybackError}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MediaPlayerScreen;