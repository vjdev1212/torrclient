import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Themed';

interface ResultsHeaderProps {
    count: number;
}

export const ResultsHeader: React.FC<ResultsHeaderProps> = ({ count }) => {
    return (
        <Text style={styles.resultsHeader}>
            {count.toLocaleString()} {count === 1 ? 'RESULT' : 'RESULTS'}
        </Text>
    );
};

const styles = StyleSheet.create({
    resultsHeader: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 12,
    },
});
