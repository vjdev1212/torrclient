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
            posterWidth: isLandscape ? 180 : 120,
            posterHeight: isLandscape ? 270 : 120,
            titleSize: isLandscape ? 28 : 26,
            subtitleSize: isLandscape ? 14 : 14,
            contentPadding: isLandscape ? 40 : 20,
            bottomPadding: isLandscape ? 40 : 40,
        };
    };

    const responsiveDims = getResponsiveDimensions();

    // Auto-play functionality with proper cleanup
    useEffect(() => {
        if (autoPlay && carouselData.length > 1) {
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
        if (flatListRef.current && carouselData.length > 0) {
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
                    activeOpacity={0.9}
                >
                    <ImageBackground
                        key={`${item.id}-${index}`}
                        source={{ uri: item.poster }}
                        style={styles.backdropImage}
                        resizeMode="cover"
                    >
                        {/* Gradient overlay */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                            style={styles.gradient}
                        />

                        {/* Content container */}
                        <View style={[styles.contentContainer, {
                            paddingHorizontal: dims.contentPadding,
                            paddingBottom: dims.bottomPadding,
                            flexDirection: dimensions.isLandscape ? 'row' : 'row',
                        }]}>

                            <View style={[styles.textContainer, {
                                flex: 1,
                            }]}>
                                <View style={[styles.metaContainer, {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    gap: 8,
                                    marginBottom: 12,
                                }]}>                                    
                                    <View style={styles.typeIndicator}>
                                        <Text style={[styles.typeText, {
                                            fontSize: dimensions.isLandscape ? 10 : 12,
                                        }]}>
                                            {item.type.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.title, {
                                    fontSize: dims.titleSize
                                }]} numberOfLines={1}>
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
        />
    );

    if (!carouselData.length) {
        return (
            <View style={[styles.container, styles.loadingContainer, {
                height: responsiveDims.carouselHeight
            }]}>
                <ActivityIndicator color="#535aff" />
                <Text style={styles.loadingText}>Loading carousel...</Text>
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

            {/* Pagination dots */}
            {carouselData.length > 1 && (
                <View style={[styles.paginationContainer, {
                    bottom: dimensions.isLandscape ? 15 : 20,
                    left: dimensions.isLandscape ? 35 : 20,
                }]}>
                    <BlurView intensity={20} style={[styles.paginationBlur]}>
                        <View style={styles.paginationDots}>
                            {carouselData.map((_, index) => renderPaginationDot(index))}
                        </View>
                    </BlurView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        backgroundColor: '#101010'
    },
    carousel: {
        flex: 1,
    },
    carouselItem: {
        marginBottom: 10
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
        alignItems: 'flex-end',
        zIndex: 1,
    },
    posterContainer: {
        position: 'relative',
    },
    posterImage: {
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    posterShadow: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: -8,
        bottom: -8,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        zIndex: -1,
    },
    textContainer: {
        justifyContent: 'flex-end',
        paddingBottom: 10,
    },
    title: {
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 22,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        maxWidth: 600
    },
    metaContainer: {
        marginTop: 0,
    },
    metaText: {
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    typeIndicator: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    typeText: {
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 1,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 12,
    },
    paginationContainer: {
        position: 'absolute',
        borderRadius: 20,
        overflow: 'hidden'
    },
    paginationBlur: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    paginationDots: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.4)',
        marginHorizontal: 4,
    },
    paginationDotActive: {
        backgroundColor: '#fff',
        width: 12,
        height: 8,
        borderRadius: 4,
    },
});