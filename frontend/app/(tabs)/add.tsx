import React, { useState } from 'react';
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';

const categories = [
  { key: 'movie', label: 'Movie' },
  { key: 'tv', label: 'Series' },
  { key: 'music', label: 'Music' },
  { key: 'other', label: 'Other' },
];

const AddTorrentScreen = () => {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [poster, setPoster] = useState('');
  const [category, setCategory] = useState<'movie' | 'tv' | 'music' | 'other'>('movie');
  const [submitting, setSubmitting] = useState(false);
  const [imdbId, setImdbId] = useState('');

  const handleSubmit = async () => {
    let hash = '';
    let link = '';

    if (/^[a-fA-F0-9]{40}$/.test(input.trim())) {
      hash = input.trim().toLowerCase();
    } else {
      link = input.trim();
    }

    if (!title || (!link && !hash)) {
      Alert.alert('Missing fields', 'Please enter a title and a valid magnet link or info hash.');
      return;
    }

    if (isHapticsSupported()) await Haptics.selectionAsync();
    setSubmitting(true);

    try {
      const baseUrl = await getTorrServerUrl();
      const payload = {
        action: 'add',
        category,
        data: '',
        hash,
        link,
        poster: poster || (imdbId ? `https://live.metahub.space/poster/medium/${imdbId}/img` : ''),
        save_to_db: true,
        title,
      };

      const authHeader = await getTorrServerAuthHeader();
      const response = await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      Alert.alert('Success', 'Torrent added successfully.');
      setInput('');
      setTitle('');
      setPoster('');
      setImdbId('');
      setCategory('movie');
      router.push("/(tabs)");
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add torrent.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);

    // Only try to auto-fill if it's a magnet link
    if (text.startsWith('magnet:')) {
      const match = text.match(/dn=([^&]+)/);
      const decodedTitle = match ? decodeURIComponent(match[1]) : '';

      if (decodedTitle && !title) {
        setTitle(decodedTitle);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Torrent</Text>
            <Text style={styles.headerSubtitle}>
              Add content to your library
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Magnet/Hash Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Magnet Link or Info Hash</Text>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={handleInputChange}
                placeholder="magnet:?xt=urn:btih:... or hash"
                autoCapitalize="none"
                placeholderTextColor="#666"
                submitBehavior="blurAndSubmit"
              />
            </View>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter title"
                placeholderTextColor="#666"
                submitBehavior="blurAndSubmit"
              />
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryContainer}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.categoryChip,
                      category === c.key && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      setCategory(c.key as any);
                      if (isHapticsSupported()) Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === c.key && styles.categoryChipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* IMDB ID Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>IMDb ID <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={imdbId}
                onChangeText={setImdbId}
                placeholder="tt0133093"
                autoCapitalize="none"
                placeholderTextColor="#666"
                submitBehavior="blurAndSubmit"
              />
            </View>

            {/* Poster URL Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Poster URL <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={poster}
                onChangeText={(text) => {
                  setPoster(text);
                  if (text) setImdbId('');
                }}
                placeholder="https://example.com/poster.jpg"
                autoCapitalize="none"
                placeholderTextColor="#666"
                submitBehavior="blurAndSubmit"
              />
            </View>

            {/* Poster Preview */}
            {(poster || imdbId) ? (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: poster || `https://live.metahub.space/poster/medium/${imdbId}/img` }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Adding Torrent...' : 'Add Torrent'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <BottomSpacing space={50} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddTorrentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#999',
    marginTop: 6,
  },
  form: {
    backgroundColor: 'transparent',
  },
  inputGroup: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  optional: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  categoryChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  categoryChipActive: {
    backgroundColor: '#535aff',
    borderColor: '#535aff',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  previewContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  previewImage: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  submitButton: {
    backgroundColor: '#535aff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});