import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { Text, View, StatusBar } from '@/components/Themed';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { confirmAction, getOriginalPlatform, isHapticsSupported, showAlert } from '@/utils/platform';
import BottomSpacing from '@/components/BottomSpacing';
import { Players } from '@/utils/MediaPlayer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StorageKeys, storageService } from '@/utils/StorageService';


interface PlayerConfig {
    name: string;
    scheme: string;
    encodeUrl: boolean;
    isDefault: boolean;
}

const DEFAULT_MEDIA_PLAYER_KEY = StorageKeys.DEFAULT_MEDIA_PLAYER_KEY;

const MediaPlayerConfigScreen = () => {
    const [players, setPlayers] = useState<PlayerConfig[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPlayerConfig();
    }, []);

    const getPlatformSpecificPlayers = (): PlayerConfig[] => {
        const baseConfig = (name: string, scheme: string, encodeUrl: boolean): PlayerConfig => ({
            name,
            scheme,
            encodeUrl,
            isDefault: false
        });

        if (getOriginalPlatform() === 'android') {
            return [
                baseConfig(Players.Default, 'STREAMURL', false),
                baseConfig(Players.VLC, 'vlc://STREAMURL', false),
                baseConfig(Players.External, 'STREAMURL', false),
            ];
        } else if (getOriginalPlatform() === 'ios') {
            return [
                baseConfig(Players.Default, 'STREAMURL', false),
                baseConfig(Players.External, 'STREAMURL', false),
                baseConfig(Players.VLC, 'vlc://STREAMURL', false),
                baseConfig(Players.Infuse, 'infuse://x-callback-url/play?url=STREAMURL', true),
                baseConfig(Players.VidHub, 'open-vidhub://x-callback-url/open?url=STREAMURL', true),
                baseConfig(Players.Outplayer, 'outplayer://STREAMURL', false),
            ];
        } else if (getOriginalPlatform() === 'web') {
            return [
                baseConfig(Players.Default, 'STREAMURL', false),
                baseConfig(Players.External, 'STREAMURL', false)
            ];
        } else if (getOriginalPlatform() === 'windows') {
            return [
                baseConfig(Players.Default, 'STREAMURL', false),
                baseConfig(Players.External, 'STREAMURL', false),
            ];
        } else if (getOriginalPlatform() === 'macos') {
            return [
                baseConfig(Players.Default, 'STREAMURL', false),
                baseConfig(Players.External, 'STREAMURL', false),
                baseConfig(Players.VLC, 'vlc://STREAMURL', false),
                baseConfig(Players.Infuse, 'infuse://x-callback-url/play?url=STREAMURL', true),
                baseConfig(Players.VidHub, 'open-vidhub://x-callback-url/open?url=STREAMURL', true),
            ];
        }
        return [];
    };

    const loadPlayerConfig = async () => {
        try {
            const platformPlayers = getPlatformSpecificPlayers();

            // Load saved default player
            const savedDefault = storageService.getItem(DEFAULT_MEDIA_PLAYER_KEY);

            if (savedDefault) {
                const defaultPlayerName = savedDefault;
                setSelectedPlayer(defaultPlayerName);

                // Mark the default player
                const updatedPlayers = platformPlayers.map(player => ({
                    ...player,
                    isDefault: player.name === defaultPlayerName
                }));
                setPlayers(updatedPlayers);
            } else {
                // No saved default, use first player as default
                setPlayers(platformPlayers);
                if (platformPlayers.length > 0) {
                    setSelectedPlayer(platformPlayers[0].name);
                }
            }
        } catch (error) {
            console.error('Error loading player config:', error);
            showAlert('Error', 'Failed to load player configuration');
            setPlayers(getPlatformSpecificPlayers());
        } finally {
            setLoading(false);
        }
    };

    const handlePlayerSelect = async (playerName: string) => {
        if (isHapticsSupported()) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setSelectedPlayer(playerName);
    };

    const savePlayerConfig = async () => {
        if (!selectedPlayer) {
            showAlert('Error', 'Please select a media player');
            return;
        }

        setSaving(true);

        try {
            storageService.setItem(DEFAULT_MEDIA_PLAYER_KEY, selectedPlayer);

            if (isHapticsSupported()) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            showAlert('Success', 'Default media player saved successfully');
        } catch (error) {
            console.error('Error saving player config:', error);
            showAlert('Error', 'Failed to save player configuration');
        } finally {
            setSaving(false);
        }
    };

    const resetToDefault = async () => {
        const confirmed = await confirmAction(
            'Reset to Default',
            'Are you sure you want to reset to the default media player?',
            'Reset'
        );
        if (!confirmed) {
            return;
        }
        try {
            storageService.removeItem(DEFAULT_MEDIA_PLAYER_KEY);
            const platformPlayers = getPlatformSpecificPlayers();
            setPlayers(platformPlayers);
            if (platformPlayers.length > 0) {
                setSelectedPlayer(platformPlayers[0].name);
            }

            if (isHapticsSupported()) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            showAlert('Success', 'Player configuration reset to default');
        } catch (error) {
            console.error('Error resetting player config:', error);
            showAlert('Error', 'Failed to reset player configuration');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar />
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Media Player</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Section Header */}
                <View style={styles.sectionHeaderContainer}>
                    <Text style={styles.sectionHeader}>DEFAULT PLAYER</Text>
                </View>

                {/* Players List */}
                <View style={styles.playersContainer}>
                    {players.map((player, index) => (
                        <React.Fragment key={player.name}>
                            {index > 0 && <View style={styles.separator} />}
                            <Pressable
                                style={({ pressed }) => [
                                    styles.playerRow,
                                    pressed && styles.playerRowPressed
                                ]}
                                onPress={() => handlePlayerSelect(player.name)}
                            >
                                <Text style={styles.playerName}>{player.name}</Text>
                                {selectedPlayer === player.name && (
                                    <MaterialIcons
                                        name="check"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                )}
                            </Pressable>
                        </React.Fragment>
                    ))}
                </View>

                {/* Footer Text */}
                <Text style={styles.footerText}>
                    Choose your preferred media player for streaming content. Some players may require additional apps to be installed.
                </Text>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            pressed && !saving && styles.saveButtonPressed,
                            saving && styles.saveButtonDisabled
                        ]}
                        onPress={savePlayerConfig}
                        disabled={saving}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? 'Saving...' : 'Save'}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.resetButton,
                            pressed && styles.resetButtonPressed
                        ]}
                        onPress={resetToDefault}
                    >
                        <Text style={styles.resetButtonText}>Reset to Default</Text>
                    </Pressable>
                </View>

                <BottomSpacing space={30} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    centeredContainer: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        fontSize: 17,
        color: '#8E8E93',
        letterSpacing: -0.41,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: '#000000',
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.37,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    sectionHeaderContainer: {
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 6,
        backgroundColor: '#000000',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '400',
        color: '#8E8E93',
        letterSpacing: -0.08,
    },
    playersContainer: {
        backgroundColor: '#1C1C1E',
        marginHorizontal: 20,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 8,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        paddingHorizontal: 16,
        minHeight: 44,
    },
    playerRowPressed: {
        backgroundColor: '#2C2C2E',
    },
    playerName: {
        fontSize: 17,
        fontWeight: '400',
        color: '#FFFFFF',
        letterSpacing: -0.41,
    },
    separator: {
        height: 0.5,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    footerText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
        paddingHorizontal: 36,
        paddingTop: 8,
        paddingBottom: 24,
        textAlign: 'left',
        letterSpacing: -0.08,
    },
    buttonContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    saveButton: {
        backgroundColor: '#0A84FF',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveButtonPressed: {
        backgroundColor: '#0066CC',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.41,
    },
    resetButton: {
        backgroundColor: '#1C1C1E',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    resetButtonPressed: {
        backgroundColor: '#2C2C2E',
    },
    resetButtonText: {
        color: '#0A84FF',
        fontSize: 17,
        fontWeight: '400',
        letterSpacing: -0.41,
    },
});

export default MediaPlayerConfigScreen;