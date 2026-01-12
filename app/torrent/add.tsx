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
import { showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const categories = [
  { key: 'movie', label: 'Movie' },
  { key: 'tv', label: 'TV' },
  { key: 'music', label: 'Music' },
  { key: 'other', label: 'Other' },
];

const AddTorrentScreen = () => {
  const router = useRouter();
  const { magnet, title: titleParam, poster, hash: existingHash, action: actionParam } = useLocalSearchParams();
  const action = actionParam ? String(actionParam) : (existingHash ? 'set' : 'add');
  const isUpdateMode = action === 'set';
  const [input, setInput] = useState(magnet ? String(magnet) : (existingHash ? String(existingHash) : ''));
  const [title, setTitle] = useState(titleParam ? String(titleParam) : '');
  const [posterInput, setPosterInput] = useState(poster ? String(poster) : '');
  const [category, setCategory] = useState<'movie' | 'tv' | 'music' | 'other'>('movie');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(poster ? String(poster) : '');

  const extractImdbId = (text: string): string | null => {
    // Match IMDB ID patterns (tt followed by 7-8 digits)
    const imdbMatch = text.match(/tt\d{7,8}/i);
    return imdbMatch ? imdbMatch[0] : null;
  };

  const getFinalPosterUrl = (inputValue?: string): string => {
    const posterValue = inputValue || posterInput;
    if (!posterValue) return '';

    const imdbId = extractImdbId(posterValue);

    if (imdbId && posterValue.trim() === imdbId) {
      return `https://images.metahub.space/poster/medium/${imdbId}/img`;
    }

    if (imdbId && posterValue.includes('metahub.space')) {
      return `https://images.metahub.space/poster/medium/${imdbId}/img`;
    }
    console.log('Using custom poster URL:', posterValue);

    return posterValue;
  };

  const handleSubmit = async () => {
    // Validate action parameter
    if (action !== 'add' && action !== 'set') {
      showAlert('Invalid Action', 'Only "add" and "set" actions are allowed.');
      return;
    }

    const link = input.trim();

    if (!title || !link) {
      console.log('Title or link missing:', { title, link });
      showAlert('Missing fields', 'Please enter a title and a valid magnet link, torrent URL, or info hash.');
      return;
    }

    setSubmitting(true);

    try {
      const baseUrl = getTorrServerUrl();
      const finalPosterUrl = getFinalPosterUrl();

      const payload = {
        action,
        category,
        link: action === 'add' ? link : undefined,
        hash: action === 'set' ? String(existingHash).trim().toLowerCase() : undefined,
        poster: finalPosterUrl,
        save_to_db: true,
        title,
      };

      console.log('Submitting payload:', payload);

      const authHeader = getTorrServerAuthHeader();
      const response = await fetch(`${baseUrl}/torrents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader || {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert('Success', action === 'set' ? 'Torrent updated successfully.' : 'Torrent added successfully.');
      }
      setInput('');
      setTitle('');
      setPosterInput('');
      setCategory('movie');
      router.push("/(tabs)");
    } catch (err) {
      console.error(err);
      showAlert('Error', action === 'set' ? 'Failed to update torrent.' : 'Failed to add torrent.');
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

  useEffect(() => {
    // Initialize preview on mount if poster param exists (update mode)
    if (poster) {
      const posterStr = String(poster);
      const finalUrl = getFinalPosterUrl(posterStr);
      console.log('Initial poster URL:', finalUrl);
      setPreviewUrl(finalUrl);
    }
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
                <Text style={styles.headerTitle}>{isUpdateMode ? 'Update Torrent' : 'Add Torrent'}</Text>
                <Text style={styles.headerSubtitle}>
                  {isUpdateMode ? 'Update torrent information' : 'Add content to your library'}
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Magnet/Hash/Torrent URL Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Magnet Link, Torrent URL or Info Hash</Text>
                  <TextInput
                    style={[styles.input, isUpdateMode && styles.inputDisabled]}
                    value={input}
                    onChangeText={handleInputChange}
                    placeholder="magnet:?xt=... or https://... or hash"
                    autoCapitalize="none"
                    placeholderTextColor="#888"
                    submitBehavior="blurAndSubmit"
                    editable={!isUpdateMode}
                  />
                  {isUpdateMode && (
                    <Text style={styles.helperText}>
                      Hash cannot be changed in update mode
                    </Text>
                  )}
                </View>

                {/* Title Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="The Lion King (1994)"
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
                    onBlur={() => {
                      const finalUrl = getFinalPosterUrl();
                      console.log('Poster onBlur, loading URL:', finalUrl);
                      if (finalUrl) {
                        setPreviewUrl(finalUrl);
                      }
                    }}
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
                    {submitting
                      ? (isUpdateMode ? 'Updating...' : 'Adding Torrent...')
                      : (isUpdateMode ? 'Update Torrent' : 'Add Torrent')}
                  </Text>
                </TouchableOpacity>
              </View>
              <BottomSpacing space={100} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default AddTorrentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30
  },
  safeArea: {
    flex: 1,
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
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.35,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 6,
    fontWeight: '400',
    letterSpacing: -0.24,
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
    letterSpacing: -0.24,
  },
  optional: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  input: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    letterSpacing: -0.41,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
  },
  helperText: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
    letterSpacing: -0.08,
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
    borderRadius: 10,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryChipActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  categoryChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: -0.24,
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
    width: 150,
    height: 225,
    borderRadius: 12,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
  },
  submitButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
});