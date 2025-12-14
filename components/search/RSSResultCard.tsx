import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';

interface RSSItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    guid: string;
    enclosure?: {
        url: string;
        type: string;
        length: string;
    };
}

interface RSSResultCardProps {
    item: RSSItem;
    onStream: () => void;
    onAdd: () => void;
    formatDate: (date: string) => string;
    formatSize: (bytes: string) => string;
}

export const RSSResultCard: React.FC<RSSResultCardProps> = ({
    item,
    onStream,
    onAdd,
    formatDate,
    formatSize,
}) => {
    return (
        <View style={styles.resultCard}>
            <View style={styles.cardHeader}>
                <View style={styles.sourceBadge}>
                    <Ionicons name="newspaper" size={10} color="#FF9500" />
                    <Text style={styles.sourceText}>RSS</Text>
                </View>
                <View style={styles.itemDateBadge}>
                    <Ionicons name="time-outline" size={12} color="#8E8E93" />
                    <Text style={styles.itemDate}>
                        {formatDate(item.pubDate)}
                    </Text>
                </View>
                {item.enclosure && (
                    <View style={styles.sizeBadge}>
                        <Ionicons name="cube-outline" size={12} color="#8E8E93" />
                        <Text style={styles.sizeText}>
                            {formatSize(item.enclosure.length)}
                        </Text>
                    </View>
                )}
            </View>

            <Text style={styles.resultTitle}>{item.title}</Text>

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
        backgroundColor: 'rgba(255, 149, 0, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    sourceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FF9500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemDateBadge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    itemDate: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    sizeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    sizeText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
        lineHeight: 22,
        letterSpacing: -0.41,
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