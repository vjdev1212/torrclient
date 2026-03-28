import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';

type SearchSource = 'prowlarr' | 'rss';

interface SourceSelectorProps {
    selectedSource: SearchSource;
    onSourceChange: (source: SearchSource) => void;
    availableSources: SearchSource[];
}

const SOURCE_LABELS: Record<SearchSource, string> = {
    prowlarr: 'Prowlarr',
    rss: 'RSS Feeds',
};

export const SourceSelector: React.FC<SourceSelectorProps> = ({
    selectedSource,
    onSourceChange,
    availableSources,
}) => {
    const getSourceMenuActions = () =>
        availableSources.map(source => ({
            id: source,
            title: SOURCE_LABELS[source],
            state: selectedSource === source ? ('on' as const) : ('off' as const),
            titleColor: selectedSource === source ? '#007AFF' : undefined,
        }));

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
                    {SOURCE_LABELS[selectedSource]}
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