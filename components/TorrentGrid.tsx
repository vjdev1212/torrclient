import React, { useState, useEffect } from 'react';
import {
    ScrollView,
    Image,
    StyleSheet,
    Pressable,
    useWindowDimensions,
    Keyboard,
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
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [staticDimensions, setStaticDimensions] = useState({ width, height });

    // Track keyboard visibility and maintain static dimensions
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        // Update static dimensions only when keyboard is not visible
        if (!keyboardVisible) {
            setStaticDimensions({ width, height });
        }

        return () => {
            keyboardDidShowListener?.remove();
            keyboardDidHideListener?.remove();
        };
    }, [width, height, keyboardVisible]);

    // Use static dimensions for calculations to prevent shrinking
    const calculationWidth = keyboardVisible ? staticDimensions.width : width;
    const calculationHeight = keyboardVisible ? staticDimensions.height : height;
    const isPortrait = calculationHeight >= calculationWidth;

    // Determine fixed number of columns
    const getNumColumns = () => {
        if (calculationWidth < 600) return isPortrait ? 3 : 5;  // Mobile
        if (calculationWidth < 1024) return 5;                  // Tablet
        return isPortrait ? 5 : 8;                              // Laptop/Desktop
    };

    const numColumns = getNumColumns();
    const itemSpacing = 12; // Tighter, more modern spacing
    const horizontalPadding = 20;
    const totalSpacing = itemSpacing * (numColumns - 1) + (horizontalPadding * 2);

    // Adjust poster width to always fit screen width (using static dimensions)
    const posterWidth = (calculationWidth - totalSpacing) / numColumns;
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
                style={[styles.card, { width: posterWidth }]}
                onPress={handlePress}
                android_ripple={{ color: 'rgba(83, 90, 255, 0.2)' }}
            >
                {({ pressed }) => (
                    <>
                        <View style={[
                            styles.imageWrapper,
                            { width: posterWidth, height: posterHeight },
                            pressed && styles.imagePressed
                        ]}>
                            <Image
                                source={{ uri: posterUri }}
                                style={styles.posterImage}
                                resizeMode="cover"
                            />
                            {/* Subtle overlay for depth */}
                            <View style={styles.imageOverlay} />
                        </View>
                        <Text 
                            numberOfLines={2} 
                            style={[styles.title, { width: posterWidth }]}
                        >
                            {item.title}
                        </Text>
                    </>
                )}
            </Pressable>
        );
    };

    if (!list || list.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No torrents available</Text>
            </View>
        );
    }

    return (
        <ScrollView 
            contentContainerStyle={[
                styles.scrollContent,
                { paddingHorizontal: horizontalPadding }
            ]} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <View style={[styles.grid, { gap: itemSpacing }]}>
                {list.map((item, index) => (
                    <TorrentItem key={item.hash || index.toString()} item={item} />
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        backgroundColor: 'transparent',
    },
    card: {
        marginBottom: 20,
    },
    imageWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        position: 'relative',
    },
    posterImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    imagePressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    title: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: 500,
        color: '#fff',
        lineHeight: 18,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '400',
    },
});

export default TorrentGrid;