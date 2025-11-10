import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from '@/components/Themed';
import TorrentGrid from '@/components/TorrentGrid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTorrServerAuthHeader, getTorrServerUrl } from '@/utils/TorrServer';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';

const HomeScreen = () => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Movies', 'TV', 'Other'];

  const handleCategoryPress = async (category: string) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setSelectedCategory(category);
    
    if (category === 'All') {
      setFilteredData(data);
    } else {
      const filtered = data.filter((item: any) => {
        const itemCategory = item.category?.toLowerCase() || 'other';
        
        switch (category) {
          case 'Movies':
            return itemCategory === 'movie';
          case 'TV':
            return itemCategory === 'tv';
          case 'Other':
            return itemCategory !== 'movie' && itemCategory !== 'tv';
          default:
            return true;
        }
      });
      setFilteredData(filtered);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchTorrents = async () => {
        setLoading(true);
        try {
          const baseUrl = await getTorrServerUrl();
          const authHeader = await getTorrServerAuthHeader();
          const response = await fetch(`${baseUrl}/torrents`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authHeader || {}),
            },
            body: JSON.stringify({ action: 'list' }),
          });

          const torrents = await response.json();
          const list = Array.isArray(torrents) ? torrents : Object.values(torrents || {});

          const parsed = list.map((item: any) => ({
            hash: item.hash,
            title: item.title || 'Untitled',
            poster: item.poster || 'https://via.placeholder.com/150x225?text=No+Image',
            size: item.torrent_size,
            category: item.category,
          }));

          setData(parsed);
          
          // Apply current filter to new data
          if (selectedCategory === 'All') {
            setFilteredData(parsed);
          } else {
            const filtered = parsed.filter((item: any) => {
              const itemCategory = item.category?.toLowerCase() || 'other';
              
              switch (selectedCategory) {
                case 'Movies':
                  return itemCategory === 'movie';
                case 'TV':
                  return itemCategory === 'tv';
                case 'Other':
                  return itemCategory !== 'movie' && itemCategory !== 'tv';
                default:
                  return true;
              }
            });
            setFilteredData(filtered);
          }
        } catch (error) {
          console.log('Error fetching torrents:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchTorrents();
    }, [selectedCategory])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Category Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterButton,
                selectedCategory === category && styles.filterButtonActive
              ]}
              onPress={() => handleCategoryPress(category)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedCategory === category && styles.filterButtonTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#535aff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <TorrentGrid list={filteredData} />
      )}
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30,
  },
  filterContainer: {
    paddingVertical: 15,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#101010',
    minWidth: 70,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#535aff',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ccc',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});