import React from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';

type SearchSource = 'prowlarr' | 'rss';

interface LoadingStateProps {
    searchSource: SearchSource;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ searchSource }) => {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
                {searchSource === 'prowlarr' ? 'Searching...' : 'Loading feed...'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'transparent',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#8E8E93',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
});