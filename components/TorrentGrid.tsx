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
import Svg, { Rect, Polygon } from 'react-native-svg';

interface Torrent {
    hash: string;
    title: string;
    poster: string;
    size?: number;
    category?: string;
}

interface TorrentGridProps {
    list: Torrent[];
    onTorrentItemPress: (item: Torrent) => void;
}

// Film Tape Placeholder Component with iOS styling
const FilmTapePlaceholder = ({ width, height }: { width: number; height: number }) => (
    <Svg width={width} height={height} viewBox="0 0 500 750">
        {/* Background */}
        <Rect width="500" height="750" fill="#1C1C1E" />

        {/* Movie frame/screen */}
        <Rect x="100" y="220" width="300" height="220" fill="none" stroke="#48484A" strokeWidth="4" rx="10" />

        {/* Film strip on left */}
        <Rect x="100" y="220" width="20" height="220" fill="#48484A" />
        <Rect x="105" y="230" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="255" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="280" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="305" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="330" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="355" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="380" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="105" y="405" width="10" height="15" fill="#1C1C1E" rx="2" />

        {/* Film strip on right */}
        <Rect x="380" y="220" width="20" height="220" fill="#48484A" />
        <Rect x="385" y="230" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="255" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="280" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="305" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="330" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="355" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="380" width="10" height="15" fill="#1C1C1E" rx="2" />
        <Rect x="385" y="405" width="10" height="15" fill="#1C1C1E" rx="2" />

        {/* Play button triangle */}
        <Polygon points="220,300 220,360 270,330" fill="#48484A" />
    </Svg>
);

const TorrentGrid: React.FC<TorrentGridProps> = ({ list, onTorrentItemPress }) => {
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

    // Determine fixed number of columns (iOS standard grid layouts)
    const getNumColumns = () => {
        if (calculationWidth < 600) return isPortrait ? 3 : 5;  // Mobile
        if (calculationWidth < 1024) return 5;                  // Tablet
        return isPortrait ? 5 : 8;                              // Laptop/Desktop
    };

    const numColumns = getNumColumns();
    const itemSpacing = 16; // iOS standard spacing
    const horizontalPadding = 16; // iOS standard edge padding
    const totalSpacing = itemSpacing * (numColumns - 1) + (horizontalPadding * 2);

    // Adjust poster width to always fit screen width (using static dimensions)
    const posterWidth = (calculationWidth - totalSpacing) / numColumns;
    const posterHeight = posterWidth * 1.5;

    const TorrentItem = ({ item }: { item: Torrent }) => {
        const [imageError, setImageError] = useState(false);       

        // Check if poster exists and is valid
        const hasValidPoster = item.poster && item.poster.trim() !== '' && !imageError;

        return (
            <Pressable
                style={[styles.card, { width: posterWidth }]}
                onPress={() => onTorrentItemPress(item)}
                android_ripple={{ color: 'rgba(0, 122, 255, 0.2)' }}
            >
                {({ pressed }) => (
                    <>
                        <View style={[
                            styles.imageWrapper,
                            { width: posterWidth, height: posterHeight },
                            pressed && styles.imagePressed
                        ]}>
                            {hasValidPoster ? (
                                <Image
                                    source={{ uri: item.poster }}
                                    style={styles.posterImage}
                                    resizeMode="cover"
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <FilmTapePlaceholder width={posterWidth} height={posterHeight} />
                            )}
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
        paddingTop: 16,
        paddingBottom: 32,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        backgroundColor: 'transparent',
    },
    card: {
        marginBottom: 8,
    },
    imageWrapper: {
        borderRadius: 10, // iOS standard corner radius
        overflow: 'hidden',
        backgroundColor: '#1C1C1E', // iOS dark background
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    posterImage: {
        width: '100%',
        height: '100%',
    },
    imagePressed: {
        opacity: 0.75,
        transform: [{ scale: 0.97 }],
    },
    title: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '400', // iOS standard weight
        color: '#FFFFFF',
        lineHeight: 17,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
        backgroundColor: 'transparent',
    },
    emptyText: {
        fontSize: 17,
        color: '#8E8E93', // iOS secondary label color
        fontWeight: '400',
        textAlign: 'center',
    },
});

export default TorrentGrid;