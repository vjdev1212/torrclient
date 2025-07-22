import React from 'react';
import {
    ScrollView,
    Image,
    StyleSheet,
    Pressable,
    useWindowDimensions,
    View as RNView,
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
    const isPortrait = height >= width;

    // Determine fixed number of columns
    const getNumColumns = () => {
        if (width < 600) return isPortrait ? 3 : 5;  // Mobile
        if (width < 1024) return 5;                  // Tablet
        return isPortrait ? 5 : 8;                   // Laptop/Desktop
    };

    const numColumns = getNumColumns();
    const itemSpacing = 16; // 8px margin on both sides
    const totalSpacing = itemSpacing * (numColumns + 1);

    // Adjust poster width to always fit screen width
    const posterWidth = (width - totalSpacing) / numColumns;
    const posterHeight = posterWidth * 1.5;

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

        const posterUri =
            item.poster?.trim() !== ''
                ? item.poster
                : 'https://via.placeholder.com/150x225?text=No+Image';

        return (
            <Pressable
                style={[styles.posterContainer, { width: posterWidth, marginHorizontal: itemSpacing / 2.2 }]}
                onPress={handlePress}
            >
                <Image
                    source={{ uri: posterUri }}
                    style={[styles.posterImage, { width: posterWidth, height: posterHeight }]}
                    resizeMode="cover"
                />
                <Text numberOfLines={1} style={[styles.posterTitle, { width: posterWidth }]}>
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
        marginVertical: 8,
        alignItems: 'center',
    },
    posterImage: {
        borderRadius: 8,
        backgroundColor: '#ccc',
    },
    posterTitle: {
        marginTop: 10,
        fontSize: 14,
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
