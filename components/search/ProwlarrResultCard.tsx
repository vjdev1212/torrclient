import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, ActivityIndicator } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { ProwlarrSearchResult } from '@/clients/prowlarr';

interface ProwlarrResultCardProps {
    result: ProwlarrSearchResult;
    onStream: () => void;
    onAdd: () => void;
    getCategoryBadge: (categoryIds: any[]) => string;
    formatFileSize: (bytes: number) => string;
    formatAge: (ageMinutes: number) => string;
    isStreaming?: boolean;
}

export const ProwlarrResultCard: React.FC<ProwlarrResultCardProps> = ({
    result,
    onStream,
    onAdd,
    getCategoryBadge,
    formatFileSize,
    formatAge,
    isStreaming = false,
}) => {
    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>
                        {getCategoryBadge(result.categories || [])}
                    </Text>
                </View>
                <Text style={styles.indexer}>{result.indexer}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>
                {result.title}
            </Text>

            {/* Stats */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Ionicons name="arrow-up-circle" size={16} color="rgba(52, 199, 89, 0.75)" />
                    <Text style={styles.statValue}>{result.seeders || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="arrow-down-circle" size={16} color="rgba(255, 69, 58, 0.75)" />
                    <Text style={styles.statValue}>{result.leechers || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="document" size={16} color="#8E8E93" />
                    <Text style={styles.statValue}>{formatFileSize(result.size)}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="time" size={16} color="#8E8E93" />
                    <Text style={styles.statValue}>{formatAge(result.ageMinutes || 0)}</Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.button, styles.streamButton, isStreaming && styles.buttonDisabled]}
                    onPress={onStream}
                    activeOpacity={0.6}
                    disabled={isStreaming}
                >
                    {isStreaming ? (
                        <>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.streamButtonText}>Loading...</Text>
                        </>
                    ) : (
                        <>
                            <Ionicons name="play" size={18} color="#FFFFFF" />
                            <Text style={styles.streamButtonText}>Stream</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.addButton]}
                    onPress={onAdd}
                    activeOpacity={0.6}
                >
                    <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                    <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(84, 84, 88, 0.65)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryBadge: {
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#007AFF',
        letterSpacing: 0.5,
    },
    indexer: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    title: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
        marginBottom: 12,
        lineHeight: 22,
    },
    stats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        minHeight: 44,
    },
    streamButton: {
        backgroundColor: '#007AFF',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    streamButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    addButton: {
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#007AFF',
    },
});