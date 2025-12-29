import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, ActivityIndicator } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

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
    formatDate: (dateString: string) => string;
    formatSize: (bytes: string | number) => string;
    isStreaming?: boolean;
}

export const RSSResultCard: React.FC<RSSResultCardProps> = ({
    item,
    onStream,
    onAdd,
    formatDate,
    formatSize,
    isStreaming = false,
}) => {
    return (
        <View style={styles.card}>
            {/* Title */}
            <Text style={styles.title}>
                {item.title}
            </Text>

            {/* Description */}
            {item.description && (
                <Text style={styles.description}>
                    {item.description}
                </Text>
            )}

            {/* Metadata */}
            <View style={styles.metadata}>
                <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#8E8E93" />
                    <Text style={styles.metaText}>{formatDate(item.pubDate)}</Text>
                </View>
                {item.enclosure && (
                    <View style={styles.metaItem}>
                        <Ionicons name="document-outline" size={14} color="#8E8E93" />
                        <Text style={styles.metaText}>
                            {formatSize(item.enclosure.length)}
                        </Text>
                    </View>
                )}
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
                            <Text style={styles.streamButtonText}>Starting...</Text>
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
    title: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
        marginBottom: 8,
        lineHeight: 22,
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 20,
        marginBottom: 12,
    },
    metadata: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 13,
        color: '#8E8E93',
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