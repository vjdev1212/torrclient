import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from '@/components/Themed';
import TorrentGrid from '@/components/TorrentGrid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTorrServerUrl } from '@/utils/TorrServer';
import { useFocusEffect } from 'expo-router';

const HomeScreen = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchTorrents = async () => {
        setLoading(true);
        try {
          const baseUrl = await getTorrServerUrl();
          const response = await fetch(`${baseUrl}/torrents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        } catch (error) {
          console.error('Error fetching torrents:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchTorrents();
    }, [])
  );
  
  return (
    <View style={{ flex: 1, marginTop: 50 }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#535aff" />
          <Text style={{ marginTop: 10 }}>Loading...</Text>
        </View>
      ) : (
        <TorrentGrid list={data} />
      )}
    </View>
  );
};

export default HomeScreen;
