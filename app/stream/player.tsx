import { Subtitle } from "@/components/coreplayer/models";
import { StorageKeys, storageService } from "@/utils/StorageService";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet } from "react-native";
import OpenSubtitlesClient, { SubtitleResult } from "@/clients/opensubtitles";
import { getLanguageName } from "@/utils/Helpers";

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

  // Player fallback state
  const [currentPlayerType, setCurrentPlayerType] = useState<"native" | "vlc">("native");
  const [hasTriedNative, setHasTriedNative] = useState(false);

  useEffect(() => {
    // Check if we have a direct video URL (continue watching scenario)
    if (url) {
      setVideoUrl(url as string);
      setIsLoadingStream(false);
      initializeClient();
      return;
    }
    initializeClient();
  }, []);

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

    return require("../../components/nativeplayer").MediaPlayer;
  }

  const Player = getPlayer();

  if (isLoadingStream) {
    return (
        <View style={styles.loadingContainer}>          
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#535aff" />
            <Text style={styles.loadingText}>Loading stream. Please wait...</Text>
          </View>
        </View>
    );
  }

  return (
      <Player
        videoUrl={videoUrl}
        back={handleBack}
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