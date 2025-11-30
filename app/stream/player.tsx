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

  useEffect(() => {
    if (url) {
      setVideoUrl(url as string);
      setIsLoading(false);
    } else {
      setError('No video URL provided');
      setIsLoading(false);
    }
  }, [url]);

  const handleBack = (event: BackEvent): void => {
    router.back();
  };

  const handleUpdateProgress = (event: UpdateProgressEvent): void => {
    // Progress tracking can be added here if needed
  };

  const handlePlaybackError = (event: PlaybackErrorEvent): void => {
    setError(event.error || 'Playback failed');
  };

  function getPlayer() {
    if (Platform.OS === "web") {
      return require("../../components/nativeplayer").MediaPlayer;
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
      videoUrl={videoUrl}
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