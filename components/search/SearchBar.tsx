import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { View } from '@/components/Themed';

type SearchSource = 'prowlarr' | 'rss';

interface SearchBarProps {
    query: string;
    onQueryChange: (text: string) => void;
    onClear: () => void;
    onSubmit: () => void;
    searchSource: SearchSource;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    query,
    onQueryChange,
    onClear,
    onSubmit,
    searchSource,
}) => {
    return (
        <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={onQueryChange}
                placeholder={searchSource === 'prowlarr' ? "Movies, TV Shows, Music" : "Search in feed..."}
                autoCapitalize="none"
                placeholderTextColor="#8E8E93"
                returnKeyType="search"
                onSubmitEditing={onSubmit}
                submitBehavior="blurAndSubmit"
            />
            {query.length > 0 && (
                <TouchableOpacity onPress={onClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
        paddingHorizontal: 8,
        height: 44,
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 6,
        marginLeft: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        paddingVertical: 8,
        letterSpacing: -0.41,
    },
    clearButton: {
        padding: 2,
        marginLeft: 4,
    },
});
