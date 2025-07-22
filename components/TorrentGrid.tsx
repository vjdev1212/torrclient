import React from 'react';
import {
    ScrollView,
    Image,
    StyleSheet,
    Pressable,
    View as RNView,
    useWindowDimensions,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';

interface Torrent {
    hash: string;
    title: string;
    poster: string;
    size?: number;
    category?: string;
}

interface TorrentGridProps {
    list: Torrent[];
}

const TorrentGrid: React.FC<TorrentGridProps> = ({ list }) => {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const isPortrait = height > width;

    const posterWidth = isPortrait ? 100 : 150;
    const posterHeight = isPortrait ? 150 : 225;

    const TorrentItem = ({ item }: { item: Torrent }) => {
        const handlePress = async () => {
            if (isHapticsSupported()) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            }

            router.push({
                pathname: '/torrent/details',
                params: { hash: item.hash },
            });
        };

        const posterUri = item.poster && item.poster.trim() !== ''
            ? item.poster
            : 'https://via.placeholder.com/150x225?text=No+Image';

        return (
            <Pressable style={styles.posterContainer} onPress={handlePress}>
                <Image
                    source={{ uri: posterUri }}
                    style={[styles.posterImage, { width: posterWidth, height: posterHeight }]}
                />
                <Text numberOfLines={1} style={styles.posterTitle}>
                    {item.title}
                </Text>
            </Pressable>
        );
    };

    if (!list || list.length === 0) {
        return (
            <View style={styles.centeredContainer}>
                <Text style={styles.centeredText}>No torrents available.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
            <RNView style={styles.moviesGrid}>
                {list.map((item, index) => (
                    <TorrentItem key={index.toString()} item={item} />
                ))}
            </RNView>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollViewContent: {
        paddingVertical: 20,
        paddingHorizontal: 10,
    },
    moviesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    posterContainer: {
        margin: 8,
    },
    posterImage: {
        borderRadius: 8,
    },
    posterTitle: {
        marginTop: 10,
        fontSize: 14,
        maxWidth: 100,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    centeredText: {
        fontSize: 18,
        textAlign: 'center',
        color: '#888',
    },
});

export default TorrentGrid;
