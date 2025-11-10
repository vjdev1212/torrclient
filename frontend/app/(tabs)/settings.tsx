import React from 'react';
import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar, Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { isHapticsSupported } from '@/utils/platform';
import { SafeAreaView } from 'react-native-safe-area-context';

const SettingsScreen = () => {
  const showContactList = process.env.EXPO_PUBLIC_SHOW_CONTACT === 'true';
  const router = useRouter();

  const preferencesList: { title: string, route: string, icon: keyof typeof Ionicons.glyphMap, description?: string }[] = [
    { title: 'TorrServer', route: '/settings/torrserver', icon: 'server-outline', description: 'Configure server connection' },
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
    const iconColor = '#535aff';
    return (
      <Pressable 
        style={({ pressed }) => [
          styles.settingItem,
          pressed && styles.settingItemPressed
        ]} 
        onPress={onPress}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingText}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#666" />
      </Pressable>
    );
  };

  const onSettingsItemPress = async (item: any) => {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
    router.push({ pathname: item.route });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />
      
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your preferences</Text>
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

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
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
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingsGroup: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  settingItemPressed: {
    backgroundColor: 'rgba(83, 90, 255, 0.08)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(83, 90, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginLeft: 64,
  },
  infoCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});

export default SettingsScreen;