import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BlurGradientBackgroundProps {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    colors?: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    borderRadius?: number;
}

export default function BlurGradientBackground({
    intensity = 40,
    tint = 'dark',
    colors,
    start = { x: 0, y: 0 },
    end = { x: 0, y: 1 },
    borderRadius = 0,
}: BlurGradientBackgroundProps) {
    const gradientColors = colors ?? ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'];

    return (
        <View
            pointerEvents="none"
            style={[
                StyleSheet.absoluteFill,
                {
                    overflow: 'hidden',
                    borderRadius,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.5,
                    shadowRadius: 24,
                    elevation: 12,
                },
            ]}
        >           
            <LinearGradient
                colors={[gradientColors[0], gradientColors[1], gradientColors[2]]}
                start={start}
                end={end}
                style={StyleSheet.absoluteFill}
            />
            <LinearGradient
                colors={[gradientColors[0], 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}