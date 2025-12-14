import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export const SearchHeader: React.FC = () => {
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Search</Text>
            <Text style={styles.headerSubtitle}>
                Find content from multiple sources
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.35,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '400',
    },
});