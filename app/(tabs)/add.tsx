import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Alert,
  ScrollView,
} from 'react-native';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';

const categories = [
  { key: 'movie', label: 'Movie' },
  { key: 'tv', label: 'Series' },
  { key: 'music', label: 'Music' },
  { key: 'other', label: 'Other' },
];

const extractHash = (input: string): string => {
  try {
    if (/^[a-fA-F0-9]{40}$/.test(input)) {
      return input.toLowerCase(); // plain hash
    } else if (input.startsWith('magnet:')) {
      const match = input.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
      return match?.[1]?.toLowerCase() || '';
    } else if (input.startsWith('http') && input.endsWith('.torrent')) {
      // You could optionally fetch the .torrent file and extract infoHash here
      return ''; // requires server-side or advanced parsing
    }
  } catch (e) {
    console.warn('Failed to extract hash:', e);
  }
  return '';
};

const AddTorrentScreen = () => {
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [poster, setPoster] = useState('');
  const [category, setCategory] = useState<'movie' | 'tv' | 'music' | 'other'>('movie');
  const [submitting, setSubmitting] = useState(false);

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
        poster,
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
      setCategory('movie');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add torrent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.centeredWrapper}>
        <Text style={styles.headerTitle}>Add new Torrent</Text>

        <Text style={styles.label}>Magnet/Info Hash/Torrent URL</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Magnet, InfoHash, or .torrent URL"
          autoCapitalize="none"
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Custom Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Poster URL</Text>
        <TextInput
          style={styles.input}
          value={poster}
          onChangeText={setPoster}
          placeholder="Poster URL"
          autoCapitalize="none"
          placeholderTextColor="#aaa"
        />

        {poster ? (
          <Image source={{ uri: poster }} style={styles.previewImage} resizeMode="cover" />
        ) : null}

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.categoryItem,
                category === c.key && styles.categorySelected,
              ]}
              onPress={() => {
                setCategory(c.key as any);
                if (isHapticsSupported()) Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === c.key && styles.categoryTextSelected,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting...' : 'Add Torrent'}
          </Text>
        </TouchableOpacity>
        <BottomSpacing space={100} />
      </View>
    </ScrollView>
  );
};

export default AddTorrentScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 50,
    flex: 1
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  centeredWrapper: {
    width: '100%',
    maxWidth: 780,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 18,
    marginVertical: 15,
    color: '#ffffff',
    fontWeight: 500
  },
  label: {
    marginBottom: 10,
    marginTop: 16,
    color: '#ffffff',
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#101010',
    color: '#fff',
    marginVertical: 5
  },
  previewImage: {
    width: 150,
    height: 225,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  categoryItem: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: '#101010',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categorySelected: {
    backgroundColor: '#535aff',
  },
  categoryText: {
    color: '#aaa',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  button: {
    marginTop: 30,
    backgroundColor: '#535aff',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
