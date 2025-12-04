import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    FlatList,
    Dimensions,
    TouchableOpacity,
    StyleSheet,
    ImageBackground,
} from 'react-native';
import { ActivityIndicator, Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface CarouselItem {
    id: string;
    title: string;
    poster: string;
    type: string;
}

interface PosterCarouselProps {
    filter: string;
    onItemPress?: (item: CarouselItem) => void;
    autoPlay?: boolean;
    autoPlayInterval?: number;
    carouselData: CarouselItem[];
}

export default function PosterCarousel({
    filter = 'all',
    onItemPress,
    autoPlay = true,
    autoPlayInterval = 5000,
    carouselData = [],
}: PosterCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [dimensions, setDimensions] = useState(() => {
        const { width, height } = Dimensions.get('window');
        return { width, height, isLandscape: width > height };
    });

    const flatListRef = useRef<FlatList>(null);
    const autoPlayRef = useRef<any>(null);

    // Handle orientation changes
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions({
                width: window.width,
                height: window.height,
                isLandscape: window.width > window.height
            });
        });

        return () => subscription?.remove();
    }, []);

    // Calculate responsive dimensions
    const getResponsiveDimensions = () => {
        const { width, height, isLandscape } = dimensions;

        return {
            screenWidth: width,
            screenHeight: height,
            carouselHeight: isLandscape ? height * 0.9 : height * 0.5,
            itemWidth: width,
            titleSize: isLandscape ? 34 : 28,
            contentPadding: 16, // iOS standard
            bottomPadding: isLandscape ? 32 : 40,
        };
    };

    const responsiveDims = getResponsiveDimensions();

    // Auto-play functionality with proper cleanup
    useEffect(() => {
        if (autoPlay) {
            autoPlayRef.current = setInterval(() => {
                setActiveIndex((prevIndex) => {
                    const nextIndex = (prevIndex + 1) % carouselData.length;
                    flatListRef.current?.scrollToIndex({
                        index: nextIndex,
                        animated: true
                    });
                    return nextIndex;
                });
            }, autoPlayInterval);
        }

        return () => {
            if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
            }
        };
    }, [autoPlay, autoPlayInterval, carouselData.length]);

    // Reset active index when data changes
    useEffect(() => {
        setActiveIndex(0);
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
    }, [carouselData]);

    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / responsiveDims.itemWidth);
        if (index !== activeIndex && index >= 0 && index < carouselData.length) {
            setActiveIndex(index);
        }
    };

    const handleItemPress = (item: CarouselItem) => {
        // Clear auto-play when user interacts
        if (autoPlayRef.current) {
            clearInterval(autoPlayRef.current);
            autoPlayRef.current = null;
        }
        onItemPress?.(item);
    };

    const scrollToIndex = (index: number) => {
        if (flatListRef.current && index >= 0 && index < carouselData.length) {
            flatListRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0
            });
            setActiveIndex(index);
            // Clear auto-play when user manually navigates
            if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
            }
        }
    };

    const renderCarouselItem = ({ item, index }: { item: CarouselItem; index: number }) => {
        const dims = responsiveDims;

        return (
            <View style={[styles.carouselItem, {
                width: dims.itemWidth,
                height: dims.carouselHeight
            }]}>
                <TouchableOpacity
                    style={styles.carouselTouchable}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.85}
                >
                    <ImageBackground
                        key={`${item.id}-${index}`}
                        source={{ uri: item.poster }}
                        style={styles.backdropImage}
                        resizeMode="cover"
                    >
                        {/* iOS-style gradient overlay */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
                            style={styles.gradient}
                        />

                        {/* Content container */}
                        <View style={[styles.contentContainer, {
                            paddingHorizontal: dims.contentPadding,
                            paddingBottom: dims.bottomPadding,
                        }]}>
                            <View style={styles.textContainer}>
                                <View style={styles.metaContainer}>
                                    <View style={styles.typeIndicator}>
                                        <Text style={styles.typeText}>
                                            {item.type.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.title, {
                                    fontSize: dims.titleSize
                                }]} numberOfLines={2}>
                                    {item.title}
                                </Text>
                            </View>
                        </View>
                    </ImageBackground>
                </TouchableOpacity>
            </View>
        );
    };

    const renderPaginationDot = (index: number) => (
        <TouchableOpacity
            key={`dot-${index}`}
            style={[
                styles.paginationDot,
                activeIndex === index && styles.paginationDotActive
            ]}
            onPress={() => scrollToIndex(index)}
            activeOpacity={0.7}
        />
    );

    if (!carouselData.length) {
        return (
            <View style={[styles.container, styles.loadingContainer, {
                height: responsiveDims.carouselHeight
            }]}>
                <ActivityIndicator color="#007AFF" size="large" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { height: responsiveDims.carouselHeight }]}>
            <FlatList
                ref={flatListRef}
                data={carouselData}
                renderItem={renderCarouselItem}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                decelerationRate="fast"
                snapToInterval={responsiveDims.itemWidth}
                snapToAlignment="start"
                style={styles.carousel}
                removeClippedSubviews={false}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                getItemLayout={(data, index) => ({
                    length: responsiveDims.itemWidth,
                    offset: responsiveDims.itemWidth * index,
                    index,
                })}
            />

            {/* iOS-style pagination dots */}
            <View style={[styles.paginationContainer, {
                bottom: dimensions.isLandscape ? 16 : 20,
            }]}>
                <BlurView intensity={30} tint="dark" style={styles.paginationBlur}>
                    <View style={styles.paginationDots}>
                        {carouselData.map((_, index) => renderPaginationDot(index))}
                    </View>
                </BlurView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        backgroundColor: '#000'
    },
    carousel: {
        flex: 1,
    },
    carouselItem: {
        overflow: 'hidden',
    },
    carouselTouchable: {
        flex: 1,
    },
    backdropImage: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    contentContainer: {
        alignItems: 'flex-start',
        zIndex: 1,
    },
    textContainer: {
        justifyContent: 'flex-end',
        maxWidth: '85%',
    },
    title: {
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 36,
        letterSpacing: 0.35,
        marginTop: 8,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeIndicator: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backdropFilter: 'blur(10px)',
    },
    typeText: {
        fontWeight: '600',
        color: '#FFFFFF',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 17,
        marginTop: 12,
        fontWeight: '400',
    },
    paginationContainer: {
        position: 'absolute',
        alignSelf: 'center',
        borderRadius: 16,
        overflow: 'hidden',
    },
    paginationBlur: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    paginationDots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    paginationDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    paginationDotActive: {
        backgroundColor: '#FFFFFF',
        width: 20,
        height: 7,
        borderRadius: 3.5,
    },
});