import React from 'react';
import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar, Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const SettingsScreen = () => {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version;

  const preferencesList: { title: string, route: string, icon: keyof typeof Ionicons.glyphMap, description?: string }[] = [
    { title: 'TorrServer', route: '/settings/torrserver', icon: 'server-outline', description: 'Configure server connection' },
    { title: 'Media Player', route: '/settings/mediaplayer', icon: 'play-circle-outline', description: 'Select the preferred media player' },
  ];

  const integrationsList: { title: string, route: string, icon: keyof typeof Ionicons.glyphMap, description?: string }[] = [
    { title: 'Prowlarr', route: '/settings/prowlarr', icon: 'search-outline', description: 'Manage Prowlarr configurations' },
    { title: 'RSS Feeds', route: '/settings/rss', icon: 'logo-rss', description: 'Configure your RSS Feeds' },
  ];

  // SettingItem Component
  const SettingItem = ({
    title,
    icon,
    description,
    onPress
  }: {
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    description?: string,
    onPress: () => void
  }) => {
    const iconColor = '#007AFF';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.settingItem,
          pressed && styles.settingItemPressed
        ]}
        onPress={onPress}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingText}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
      </Pressable>
    );
  };

  const onSettingsItemPress = async (item: any) => {
    router.push({ pathname: item.route });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GENERAL</Text>
          <View style={styles.settingsGroup}>
            {preferencesList.map((item, index) => (
              <React.Fragment key={index}>
                <SettingItem
                  title={item.title}
                  icon={item.icon}
                  description={item.description}
                  onPress={() => onSettingsItemPress(item)}
                />
                {index < preferencesList.length - 1 && (
                  <View style={styles.separator} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INTEGRATIONS</Text>
          <View style={styles.settingsGroup}>
            {integrationsList.map((item, index) => (
              <React.Fragment key={index}>
                <SettingItem
                  title={item.title}
                  icon={item.icon}
                  description={item.description}
                  onPress={() => onSettingsItemPress(item)}
                />
                {index < integrationsList.length - 1 && (
                  <View style={styles.separator} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{appVersion}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    margin: 'auto',
    maxWidth: 780
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.35,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 36,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 10,
    paddingHorizontal: 2,
    textTransform: 'uppercase',
  },
  settingsGroup: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  settingItemPressed: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  settingText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.41,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 1,
    fontWeight: '400',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(84, 84, 88, 0.65)',
    marginLeft: 60,
  },
  infoCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  infoValue: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '400',
    letterSpacing: -0.41,
  },
});

export default SettingsScreen;