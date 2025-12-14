import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';

interface ProwlarrResultCardProps {
    result: any;
    onStream: () => void;
    onAdd: () => void;
    getCategoryBadge: (categories: number[]) => string;
    formatFileSize: (size: number) => string;
    formatAge: (minutes: number) => string;
}

export const ProwlarrResultCard: React.FC<ProwlarrResultCardProps> = ({
    result,
    onStream,
    onAdd,
    getCategoryBadge,
    formatFileSize,
    formatAge,
}) => {
    return (
        <View style={styles.resultCard}>
            <View style={styles.cardHeader}>
                <View style={styles.sourceBadge}>
                    <Ionicons name="server" size={10} color="#007AFF" />
                    <Text style={styles.sourceText}>PROWLARR</Text>
                </View>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>
                        {getCategoryBadge(result.categories)}
                    </Text>
                </View>
                <View style={styles.qualityBadge}>
                    <Ionicons name="arrow-up" size={11} color="#34C759" />
                    <Text style={styles.seedersText}>{result.seeders || 0}</Text>
                </View>
            </View>

            <Text style={styles.resultTitle}>{result.title}</Text>

            <View style={styles.metaContainer}>
                <View style={styles.metaChip}>
                    <Ionicons name="server" size={12} color="#8E8E93" />
                    <Text style={styles.metaChipText}>{result.indexer}</Text>
                </View>
                <View style={styles.metaChip}>
                    <Ionicons name="cube" size={12} color="#8E8E93" />
                    <Text style={styles.metaChipText}>
                        {formatFileSize(result.size)}
                    </Text>
                </View>
                <View style={styles.metaChip}>
                    <Ionicons name="time" size={12} color="#8E8E93" />
                    <Text style={styles.metaChipText}>
                        {formatAge(result.ageMinutes)}
                    </Text>
                </View>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.streamButton}
                    onPress={onStream}
                    activeOpacity={0.7}
                >
                    <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.streamButtonText}>Play</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={onAdd}
                    activeOpacity={0.7}
                >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    resultCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'transparent',
        gap: 8,
    },
    sourceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    sourceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#007AFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    categoryBadge: {
        flex: 1,
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    qualityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(52, 199, 89, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    seedersText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#34C759',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
        lineHeight: 22,
        letterSpacing: -0.41,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    metaChipText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'transparent',
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(142, 142, 147, 0.2)',
    },
    streamButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    streamButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
        letterSpacing: -0.24,
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
        letterSpacing: -0.24,
    },
});