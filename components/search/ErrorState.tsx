import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';

interface ErrorStateProps {
    error: string;
    onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
    return (
        <View style={styles.centeredContainer}>
            <View style={styles.errorIcon}>
                <Ionicons name="server-outline" color="#FF3B30" size={48} />
            </View>
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <Text style={styles.errorHint}>
                Check your configuration in settings
            </Text>
            <TouchableOpacity 
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.7}
            >
                <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    errorIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.35,
    },
    errorSubtitle: {
        fontSize: 17,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '400',
        letterSpacing: -0.41,
        marginBottom: 8,
    },
    errorHint: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        fontWeight: '400',
        letterSpacing: -0.24,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 120,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '500',
        textAlign: 'center',
        letterSpacing: -0.41,
    },
});