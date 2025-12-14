import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';

type SearchSource = 'prowlarr' | 'rss';

interface SourceSelectorProps {
    selectedSource: SearchSource;
    onSourceChange: (source: SearchSource) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
    selectedSource,
    onSourceChange,
}) => {
    const getSourceMenuActions = () => [
        {
            id: 'prowlarr',
            title: 'Prowlarr',
            state: selectedSource === 'prowlarr' ? ('on' as const) : ('off' as const),
            titleColor: selectedSource === 'prowlarr' ? '#007AFF' : undefined,
        },
        {
            id: 'rss',
            title: 'RSS Feeds',
            state: selectedSource === 'rss' ? ('on' as const) : ('off' as const),
            titleColor: selectedSource === 'rss' ? '#007AFF' : undefined,
        },
    ];

    return (
        <MenuView
            onPressAction={({ nativeEvent }) => {
                onSourceChange(nativeEvent.event as SearchSource);
            }}
            actions={getSourceMenuActions()}
            shouldOpenOnLongPress={false}
            themeVariant="dark"
        >
            <View style={styles.sourceSelector}>
                <Ionicons name="layers-outline" size={18} color="#8E8E93" />
                <Text style={styles.sourceSelectorText} numberOfLines={1}>
                    {selectedSource === 'prowlarr' ? 'Prowlarr' : 'RSS Feeds'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#8E8E93" />
            </View>
        </MenuView>
    );
};

const styles = StyleSheet.create({
    sourceSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
        marginBottom: 12,
    },
    sourceSelectorText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
        letterSpacing: -0.41,
    },
});
