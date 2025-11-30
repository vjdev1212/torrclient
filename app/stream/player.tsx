import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet } from "react-native";

interface BackEvent {
  progress: number;
}

interface UpdateProgressEvent {
  progress: number;
}

interface PlaybackErrorEvent {
  error: string;
}

const MediaPlayerScreen: React.FC = () => {
  const router = useRouter();
  const { url, title } = useLocalSearchParams();
  
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Player fallback state
  const [currentPlayerType, setCurrentPlayerType] = useState<"native" | "vlc">("native");
  const [hasTriedNative, setHasTriedNative] = useState(false);

  useEffect(() => {
    if (url) {
      setVideoUrl(url as string);
      setIsLoading(false);
    } else {
      setError('No video URL provided');
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (currentPlayerType === "vlc" && hasTriedNative) {
      console.log('Switching to VLC player');
      setError('');
      setIsLoading(false);
    }
  }, [currentPlayerType, hasTriedNative]);

  const handleBack = (event: BackEvent): void => {
    router.back();
  };

  const handleUpdateProgress = (event: UpdateProgressEvent): void => {
    // Progress tracking can be added here if needed
  };

  const handlePlaybackError = (event: PlaybackErrorEvent): void => {
    console.log('Playback error:', event);

    if (
      currentPlayerType === "native" &&
      !hasTriedNative &&
      Platform.OS !== "web"
    ) {
      console.log('Native player failed, falling back to VLC');

      setHasTriedNative(true);
      setError('');
      setCurrentPlayerType("vlc");
      setTimeout(() => {
        console.log('VLC player ready, video URL:', videoUrl);
      }, 100);

    } else {
      const errorMessage = currentPlayerType === "vlc"
        ? 'VLC player was unable to play this format. The video codec may not be supported.'
        : (event.error || 'Playback failed');

      console.log('Final playback error:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#535aff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <Player
      videoUrl={encodeURI(videoUrl)}
      title={title as string}
      back={handleBack}
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
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});

export default MediaPlayerScreen;