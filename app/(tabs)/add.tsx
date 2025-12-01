import React, { useState, useEffect } from 'react';
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  const { magnet } = useLocalSearchParams();
  const [input, setInput] = useState(magnet ? String(magnet) : '');
  const [title, setTitle] = useState('');
  const [posterInput, setPosterInput] = useState('');
  const [category, setCategory] = useState<'movie' | 'tv' | 'music' | 'other'>('movie');
  const [submitting, setSubmitting] = useState(false);

  const extractImdbId = (text: string): string | null => {
    // Match IMDB ID patterns (tt followed by 7-8 digits)
    const imdbMatch = text.match(/tt\d{7,8}/i);
    return imdbMatch ? imdbMatch[0] : null;
  };

  const getFinalPosterUrl = (): string => {
    if (!posterInput) return '';
    
    const imdbId = extractImdbId(posterInput);
    
    if (imdbId && posterInput.trim() === imdbId) {
      return `https://images.metahub.space/poster/medium/${imdbId}/img`;
    }
    
    if (imdbId && posterInput.includes('metahub.space')) {
      return `https://images.metahub.space/poster/medium/${imdbId}/img`;
    }
    
    return posterInput;
  };

  const handleSubmit = async () => {
    let hash = '';
    let link = '';

    if (/^[a-fA-F0-9]{40}$/.test(input.trim())) {
      hash = input.trim().toLowerCase();
    } else {
      link = input.trim();
    }

    if (!title || (!link && !hash)) {
      showAlert('Missing fields', 'Please enter a title and a valid magnet link or info hash.');
      return;
    }

    if (isHapticsSupported()) await Haptics.selectionAsync();
    setSubmitting(true);

    try {
      const baseUrl = getTorrServerUrl();
      const finalPosterUrl = getFinalPosterUrl();
      
      const payload = {
        action: 'add',
        category,
        data: '',
        hash,
        link,
        poster: finalPosterUrl,
        save_to_db: true,
        title,
      };

      const authHeader = getTorrServerAuthHeader();
      const response = await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      showAlert('Success', 'Torrent added successfully.');
      setInput('');
      setTitle('');
      setPosterInput('');
      setCategory('movie');
      router.push("/(tabs)");
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to add torrent.');
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

  const previewUrl = getFinalPosterUrl();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                  placeholderTextColor="#888"
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
                  placeholderTextColor="#888"
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

              {/* Poster Input (IMDB ID or URL) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Poster <Text style={styles.optional}>(IMDB ID or URL)</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={posterInput}
                  onChangeText={setPosterInput}
                  placeholder="tt0133093 or https://example.com/poster.jpg"
                  autoCapitalize="none"
                  placeholderTextColor="#888"
                  submitBehavior="blurAndSubmit"
                />
                {posterInput && (
                  <Text style={styles.helperText}>
                    {extractImdbId(posterInput) 
                      ? `Using IMDB ID: ${extractImdbId(posterInput)}`
                      : 'Using custom URL'}
                  </Text>
                )}
              </View>

              {/* Poster Preview */}
              {previewUrl ? (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: previewUrl }}
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
            <BottomSpacing space={100} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddTorrentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 780,
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
    fontWeight: 500,
    color: '#ccc',
    marginBottom: 10,
  },
  optional: {
    fontSize: 14,
    fontWeight: 400,
    color: '#888',
  },
  input: {
    backgroundColor: '#101010',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#202020',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  categoryChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#202020',
  },
  categoryChipActive: {
    backgroundColor: '#535aff',
    borderColor: '#535aff',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: 500,
    color: '#aaa',
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
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    maxWidth: 150,
    margin: 'auto'
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 500,
  },
});