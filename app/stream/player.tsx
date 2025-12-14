import { Subtitle } from "@/components/coreplayer/models";
import { StorageKeys, storageService } from "@/utils/StorageService";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet, StatusBar, Linking } from "react-native";
import OpenSubtitlesClient, { SubtitleResult } from "@/clients/opensubtitles";
import { getLanguageName } from "@/utils/Helpers";
import * as ScreenOrientation from 'expo-screen-orientation';


interface BackEvent {
  message: string;
  code?: string;
  progress: number;
  player: "native" | "vlc",
}
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
  const { url, title, progress: watchHistoryProgress } = useLocalSearchParams();

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(true);
  const [openSubtitlesClient, setOpenSubtitlesClient] = useState<OpenSubtitlesClient | null>(null);
  const [progress, setProgress] = useState(watchHistoryProgress || 0);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(true);
  const [defaultMediaPlayer, setDefaultMediaPlayer] = useState<string>('default');
  const [shouldManageOrientation, setShouldManageOrientation] = useState<boolean>(false);

  // Player fallback state
  const [currentPlayerType, setCurrentPlayerType] = useState<"native" | "vlc">("native");
  const [hasTriedNative, setHasTriedNative] = useState(false);

  // Check if player is internal/default
  const isInternalPlayer = (playerType: string | null): boolean => {
    if (!playerType) return true;
    const normalizedPlayer = playerType.toLowerCase().trim();
    return normalizedPlayer === 'default' || normalizedPlayer === 'ask';
  };

  // Orientation setup/cleanup
  const setupOrientation = async () => {
    if (Platform.OS !== 'web') {
      try {
        console.log('Setting up orientation - locking to landscape');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        StatusBar.setHidden(true);
      } catch (error) {
        console.warn("Failed to set orientation:", error);
      }
    }
  };

  const cleanupOrientation = async () => {
    if (Platform.OS !== 'web') {
      try {
        console.log('Cleaning up orientation - restoring default');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
        StatusBar.setHidden(false);
      } catch (error) {
        console.warn("Failed to cleanup orientation:", error);
      }
    }
  };

  // Route to external player if needed
  const routeToExternalPlayer = (playerType: string, streamUrl: string) => {
    console.log('Routing to external player:', playerType, streamUrl);
    const normalizedPlayer = playerType.toLowerCase().trim();
    
    switch (normalizedPlayer) {
      case 'infuse':
        Linking.openURL(`infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}`);
        router.back();
        break;
      case 'vidhub':
        Linking.openURL(`open-vidhub://x-callback-url/open?url=${encodeURIComponent(streamUrl)}`);
        router.back();
        break;
      case 'vlc':
        Linking.openURL(`vlc://${streamUrl}`);
        router.back();
        break;
      case 'external':
        Linking.openURL(streamUrl);
        router.back();
        break;
      case 'newwindow':
        Linking.openURL(streamUrl);
        router.back();
        break;
      default:
        // Use internal player (native or vlc)
        return false;
    }
    return true;
  };

  // Handle orientation based on player selection
  useEffect(() => {
    const handlePlayerAndOrientation = async () => {
      const savedPlayer = storageService.getItem(StorageKeys.DEFAULT_MEDIA_PLAYER_KEY);
      console.log('Player selection effect - Saved Player:', savedPlayer);
      
      const useInternalPlayer = isInternalPlayer(savedPlayer as string);
      console.log('Will use internal player:', useInternalPlayer);
      
      setShouldManageOrientation(useInternalPlayer);
      
      if (useInternalPlayer) {
        await setupOrientation();
      }
    };

    handlePlayerAndOrientation();

    return () => {
      if (shouldManageOrientation) {
        cleanupOrientation();
      }
    };
  }, []);

  useEffect(() => {
    console.log('URL Effect - URL:', url);
    
    if (!url) {
      initializeClient();
      return;
    }

    // Get default media player preference
    const savedPlayer = storageService.getItem(StorageKeys.DEFAULT_MEDIA_PLAYER_KEY);
    console.log('URL Effect - Saved Player:', savedPlayer);
    
    if (savedPlayer) {
      setDefaultMediaPlayer(savedPlayer);
      
      // Check if we should route to external player
      if (!isInternalPlayer(savedPlayer)) {
        console.log('Routing to external player:', savedPlayer);
        const routedExternally = routeToExternalPlayer(savedPlayer, url as string);
        if (routedExternally) {
          // External player opened, don't continue loading
          return;
        }
      }
    }
    
    console.log('Using internal player, setting video URL');
    setVideoUrl(url as string);
    setIsLoadingStream(false);
    initializeClient();
  }, [url]);

  useEffect(() => {
    if (openSubtitlesClient) {
      fetchSubtitles();
    }
  }, [openSubtitlesClient]);

  useEffect(() => {
    if (currentPlayerType === "vlc" && hasTriedNative) {
      console.log('Switching to VLC player');
      setIsLoadingStream(false);
    }
  }, [currentPlayerType, hasTriedNative]);

  const handlePlaybackError = (event: PlaybackErrorEvent) => {
    console.log('Playback error:', event);

    // Only attempt VLC fallback for format errors on non-web platforms
    if (
      currentPlayerType === "native" &&
      !hasTriedNative &&
      Platform.OS !== "web"
    ) {
      console.log('Native player failed, falling back to VLC');

      setHasTriedNative(true);
      setCurrentPlayerType("vlc");
      setTimeout(() => {
        // Trigger re-load with current video URL
        // The player will re-render as VLC due to currentPlayerType change
        console.log('VLC player ready, video URL:', videoUrl);
      }, 100);

    } else {
      // Show error - either VLC also failed or no fallback available
      const errorMessage = currentPlayerType === "vlc"
        ? 'VLC player was unable to play this format. The video codec may not be supported.'
        : (event.error || 'Playback failed');

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

      const response = await openSubtitlesClient.searchByFileName(
        title as string,
        ['en'],
        {
          format: 'srt',
          ai_translated: 'include',
          machine_translated: 'include',
          trusted_sources: 'include',
          hearing_impaired: 'include'
        }
      );

      if (response.success) {
        if (response.data.length === 0) {
          setSubtitles([]);
          setIsLoadingSubtitles(false);
          return;
        }
        const sortedData = response.data.sort((a, b) => b.download_count - a.download_count);

        const transformedSubtitles: Subtitle[] = sortedData.map((subtitle: SubtitleResult) => ({
          fileId: subtitle.file_id,
          language: subtitle.language,
          url: subtitle.url,
          label: `${getLanguageName(subtitle.language)} - ${subtitle.name}`
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
        history = history.filter(item =>
          !(item.title === title &&
            item.videoUrl === videoUrl)
        );
        storageService.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
        return;
      }

      const historyItem: WatchHistoryItem = {
        title: title as string,
        videoUrl: videoUrl as string,
        progress: progress,
        timestamp: Date.now()
      };

      const existingIndex = history.findIndex(item =>
        item.title === title &&
        item.videoUrl === videoUrl
      );

      if (existingIndex !== -1) {
        history[existingIndex] = {
          ...history[existingIndex],
          videoUrl: videoUrl as string,
          progress: progress,
          timestamp: Date.now()
        };

        const [updatedItem] = history.splice(existingIndex, 1);
        history.unshift(updatedItem);
      } else {
        history.unshift(historyItem);
      }

      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
      }

      storageService.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save watch history:', error);
    }
  };

  const handleBack = async (): Promise<void> => {
    // Cleanup orientation before going back
    if (shouldManageOrientation) {
      await cleanupOrientation();
    }
    router.back();
  };

  const handleUpdateProgress = async (event: UpdateProgressEvent): Promise<void> => {
    if (event.progress <= 1)
      return;

    const progressPercentage = Math.floor(event.progress);
    setProgress(progressPercentage);

    saveToWatchHistory(progressPercentage);
  };

  function getPlayer() {
    if (Platform.OS === "web") {
      return require("../../components/nativeplayer").MediaPlayer;
    }

    if (currentPlayerType === "vlc") {
      return require("../../components/vlcplayer").MediaPlayer;
    }

    return require("../../components/vlcplayer").MediaPlayer;
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
      title={title}      
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
    alignItems: 'center'
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
    fontWeight: 500,
  },
});

export default MediaPlayerScreen;