import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';

interface RSSFeedConfig {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    refreshInterval: number;
}

interface RSSFiltersProps {
    feeds: RSSFeedConfig[];
    selectedFeed: RSSFeedConfig | null;
    onFeedSelect: (feedId: string) => void;
}

export const RSSFilters: React.FC<RSSFiltersProps> = ({
    feeds,
    selectedFeed,
    onFeedSelect,
}) => {
    const getRssFeedMenuActions = () => {
        return feeds.map(feed => ({
            id: feed.id,
            title: feed.name || 'Unnamed Feed',
            state: selectedFeed?.id === feed.id ? ('on' as const) : ('off' as const),
            titleColor: selectedFeed?.id === feed.id ? '#007AFF' : undefined,
        }));
    };

    if (feeds.length === 0) return null;

    return (
        <View style={styles.filtersContainer}>
            <MenuView
                onPressAction={({ nativeEvent }) => {
                    onFeedSelect(nativeEvent.event);
                }}
                actions={getRssFeedMenuActions()}
                shouldOpenOnLongPress={false}
                themeVariant="dark"
            >
                <View style={styles.filterButton}>
                    <Ionicons name="newspaper-outline" size={18} color="#8E8E93" />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                        {selectedFeed?.name || 'Select Feed'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                </View>
            </MenuView>
        </View>
    );
};

const styles = StyleSheet.create({
    filtersContainer: {
        marginBottom: 10,
        backgroundColor: 'transparent',
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
    },
    filterButtonText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
});
