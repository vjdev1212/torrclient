import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { Text, View } from '@/components/Themed';

interface ProwlarrFiltersProps {
    indexers: any[];
    categories: any[];
    selectedIndexer: number | null;
    selectedCategory: number | null;
    selectedCategoryName: string;
    onIndexerSelect: (indexerId: string) => void;
    onCategorySelect: (categoryId: string) => void;
}

export const ProwlarrFilters: React.FC<ProwlarrFiltersProps> = ({
    indexers,
    categories,
    selectedIndexer,
    selectedCategory,
    selectedCategoryName,
    onIndexerSelect,
    onCategorySelect,
}) => {
    const getIndexerMenuActions = () => {
        return [
            {
                id: 'all',
                title: 'All Indexers',
                state: selectedIndexer === null ? ('on' as const) : ('off' as const),
                titleColor: selectedIndexer === null ? '#007AFF' : undefined,
            },
            ...indexers.map(indexer => ({
                id: indexer.id.toString(),
                title: indexer.name,
                state: selectedIndexer === indexer.id ? ('on' as const) : ('off' as const),
                titleColor: selectedIndexer === indexer.id ? '#007AFF' : undefined,
            })),
        ];
    };

    const getCategoryMenuActions = () => {
        return [
            {
                id: 'all',
                title: 'All Categories',
                state: selectedCategory === null ? ('on' as const) : ('off' as const),
                titleColor: selectedCategory === null ? '#007AFF' : undefined,
            },
            ...categories.map(category => ({
                id: category.id.toString(),
                title: `${category.name} (All)`,
                state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                subactions: [
                    {
                        id: category.id.toString(),
                        title: 'All',
                        state: selectedCategory === category.id ? ('on' as const) : ('off' as const),
                        titleColor: selectedCategory === category.id ? '#007AFF' : undefined,
                    },
                    ...category.subCategories.map((sub: any) => ({
                        id: sub.id.toString(),
                        title: sub.name.replace(`${category.name}/`, ''),
                        state: selectedCategory === sub.id ? ('on' as const) : ('off' as const),
                        titleColor: selectedCategory === sub.id ? '#007AFF' : undefined,
                    })),
                ],
            })),
        ];
    };

    const selectedIndexerName = selectedIndexer !== null
        ? indexers.find(i => i.id === selectedIndexer)?.name || 'All Indexers'
        : 'All Indexers';

    return (
        <View style={styles.filtersContainer}>
            <MenuView
                onPressAction={({ nativeEvent }) => {
                    onIndexerSelect(nativeEvent.event);
                }}
                actions={getIndexerMenuActions()}
                shouldOpenOnLongPress={false}
                themeVariant="dark"
            >
                <View style={styles.filterButton}>
                    <Ionicons name="server-outline" size={18} color="#8E8E93" />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                        {selectedIndexerName}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                </View>
            </MenuView>

            <MenuView
                onPressAction={({ nativeEvent }) => {
                    onCategorySelect(nativeEvent.event);
                }}
                actions={getCategoryMenuActions()}
                shouldOpenOnLongPress={false}
                themeVariant="dark"
            >
                <View style={styles.filterButton}>
                    <Ionicons name="film-outline" size={18} color="#8E8E93" />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                        {selectedCategoryName}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                </View>
            </MenuView>
        </View>
    );
};

const styles = StyleSheet.create({
    filtersContainer: {
        marginBottom: 20,
        backgroundColor: 'transparent',
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
        height: 44,
    },
    filterButtonText: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '400',
        letterSpacing: -0.41,
    },
});