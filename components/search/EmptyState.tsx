import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';

type SearchSource = 'prowlarr' | 'rss';

interface EmptyStateProps {
    searchSource: SearchSource;
    rssFeeds: any[];
    searched: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    searchSource,
    rssFeeds,
    searched,
}) => {
    const getEmptyStateContent = () => {
        if (searched) {
            return {
                icon: 'search-outline' as const,
                title: 'No Results',
                subtitle: 'Try adjusting your search or filters',
            };
        }

        if (searchSource === 'prowlarr') {
            return {
                icon: 'search-outline' as const,
                title: 'Search Torrents',
                subtitle: 'Enter a movie or TV show name to search',
            };
        }

        return {
            icon: 'newspaper-outline' as const,
            title: 'Select RSS Feed',
            subtitle: rssFeeds.length === 0
                ? 'No RSS feeds configured. Add feeds in settings.'
                : 'Choose a feed from the selector above',
        };
    };

    const content = getEmptyStateContent();

    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
                <Ionicons name={content.icon} size={48} color="#007AFF" />
            </View>
            <Text style={styles.emptyStateTitle}>{content.title}</Text>
            <Text style={styles.emptyStateSubtext}>{content.subtitle}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 22,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: 0.35,
    },
    emptyStateSubtext: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
        paddingHorizontal: 20,
        fontWeight: '400',
        letterSpacing: -0.41,
        lineHeight: 22,
    },
});