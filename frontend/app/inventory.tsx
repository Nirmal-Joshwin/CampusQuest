import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { fetchBestiary, BestiaryEntryData } from '../utils/api';
import { getRarityConfig, getCreatureEmoji } from '../utils/haversine';
import { getActiveBuddy, setActiveBuddy } from '../utils/buddy';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticImpact } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCatchSound, playCoinSound } from '../utils/sound';

export default function InventoryScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'BESTIARY' | 'BACKPACK'>('BESTIARY');
  const [bestiary, setBestiary] = useState<BestiaryEntryData[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentBuddy, setCurrentBuddy] = useState<string>(getActiveBuddy());

  // Backpack items inventory
  const [backpack, setBackpack] = useState({
    energyCells: 3, // Each restores 50 Energy
    captureTraps: 8,
    dataCoins: user?.coins || 50,
    supplyCrates: 1,
  });

  const loadBestiary = async () => {
    try {
      setLoading(true);
      const data = await fetchBestiary(token);
      setBestiary(data.entries);
      setDiscoveredCount(data.total_discovered);
    } catch (e) {
      console.warn('Failed to load bestiary:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBestiary();
  }, []);

  const handleUseEnergyCell = () => {
    if (backpack.energyCells <= 0) {
      triggerHapticTap();
      Alert.alert('No Energy Cells', 'Find energy caches on campus to recharge your battery!');
      return;
    }

    setBackpack((prev) => ({
      ...prev,
      energyCells: prev.energyCells - 1,
    }));

    if (user) {
      updateProfile({});
    }

    triggerHapticSuccess();
    playCatchSound();
    Alert.alert('⚡ Energy Restored', 'Consumed 1 Quantum Battery Cell! Restored +50 Energy.');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            triggerHapticTap();
            playSwooshSound();
            router.back();
          }}
        >
          <Text style={styles.backButtonText}>← Map</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EQUIPMENT & LORE</Text>
        <View style={styles.headerCoinBadge}>
          <Text style={styles.coinBadgeText}>💎 {backpack.dataCoins}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'BESTIARY' && styles.activeTabButton]}
          onPress={() => {
            triggerHapticTap();
            playTapSound();
            setActiveTab('BESTIARY');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'BESTIARY' && styles.activeTabText]}>
            📖 CIT BESTIARY ({discoveredCount}/10)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'BACKPACK' && styles.activeTabButton]}
          onPress={() => {
            triggerHapticTap();
            playTapSound();
            setActiveTab('BACKPACK');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'BACKPACK' && styles.activeTabText]}>
            🎒 CADET BACKPACK
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'BESTIARY' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.bestiaryHeaderCard}>
            <View style={styles.bestiaryHeaderLeft}>
              <Text style={styles.bestiaryHeaderTitle}>🎓 Campus Discovery Log</Text>
              <Text style={styles.bestiaryHeaderSubtitle}>
                {discoveredCount === 10
                  ? '🎉 All CIT Campus Legends Cataloged!'
                  : `${10 - discoveredCount} Anomalies Remaining to be Discovered`}
              </Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressCircleText}>
                {Math.round((discoveredCount / 10) * 100)}%
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.creatureGrid}>
              {bestiary.map((entry, index) => {
                const rarityConfig = getRarityConfig(entry.rarity);
                const emoji = getCreatureEmoji(entry.creature_name);

                return (
                  <View
                    key={entry.creature_name}
                    style={[
                      styles.creatureCard,
                      {
                        borderColor: entry.discovered ? rarityConfig.borderColor : '#1E293B',
                        backgroundColor: entry.discovered ? 'rgba(15, 23, 42, 0.95)' : 'rgba(11, 19, 41, 0.7)',
                      },
                    ]}
                  >
                    {/* Top Rarity Tag */}
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.rarityPill,
                          {
                            backgroundColor: entry.discovered ? rarityConfig.bgColor : '#1E293B',
                            borderColor: entry.discovered ? rarityConfig.borderColor : '#334155',
                          },
                        ]}
                      >
                        <Text style={[styles.rarityPillText, { color: rarityConfig.color }]}>
                          {rarityConfig.icon} {rarityConfig.label}
                        </Text>
                      </View>
                      <Text style={styles.cardIndex}>#{index + 1}</Text>
                    </View>

                    {/* Creature Mascot / Silhouette */}
                    <View
                      style={[
                        styles.mascotCircle,
                        {
                          borderColor: entry.discovered ? rarityConfig.color : '#334155',
                          backgroundColor: entry.discovered ? rarityConfig.bgColor : '#0F172A',
                        },
                      ]}
                    >
                      <Text style={[styles.mascotEmoji, !entry.discovered && { opacity: 0.3 }]}>
                        {entry.discovered ? emoji : '🔒'}
                      </Text>
                    </View>

                    {/* Info */}
                    <Text
                      style={[
                        styles.creatureName,
                        { color: entry.discovered ? '#FFFFFF' : '#64748B' },
                      ]}
                      numberOfLines={1}
                    >
                      {entry.discovered ? entry.creature_name : 'Undiscovered'}
                    </Text>

                    <Text style={styles.sectorText} numberOfLines={1}>
                      📍 {entry.sector}
                    </Text>

                    {entry.discovered ? (
                      <View style={styles.cardActionsCol}>
                        <View style={styles.capturedBadge}>
                          <Text style={styles.capturedBadgeText}>✓ COLLECTED</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.buddyButton,
                            currentBuddy === entry.creature_name && styles.buddyButtonActive,
                          ]}
                          onPress={() => {
                            triggerHapticSuccess();
                            playCoinSound();
                            setActiveBuddy(entry.creature_name);
                            setCurrentBuddy(entry.creature_name);
                            Alert.alert('🐾 Companion Set!', `${entry.creature_name} is now walking alongside you on campus!`);
                          }}
                        >
                          <Text
                            style={[
                              styles.buddyButtonText,
                              currentBuddy === entry.creature_name && styles.buddyButtonTextActive,
                            ]}
                          >
                            {currentBuddy === entry.creature_name ? '🐾 BUDDY' : '🐾 Set Buddy'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.undiscoveredBadge}>
                        <Text style={styles.undiscoveredBadgeText}>+ {rarityConfig.xpReward} XP</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        /* Backpack Items Tab */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.backpackGrid}>
            {/* Item 1: Energy Battery */}
            <View style={styles.itemCard}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#052E16', borderColor: '#22C55E' }]}>
                <Text style={styles.itemEmoji}>⚡</Text>
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>Quantum Battery Cell</Text>
                  <Text style={styles.itemQuantity}>x{backpack.energyCells}</Text>
                </View>
                <Text style={styles.itemDescription}>
                  Overclocks cadet power grid. Restores +50 Energy for campus captures.
                </Text>
                <TouchableOpacity style={styles.useButton} onPress={handleUseEnergyCell}>
                  <Text style={styles.useButtonText}>Use Battery</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Item 2: Nano Traps */}
            <View style={styles.itemCard}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#1E1B4B', borderColor: '#818CF8' }]}>
                <Text style={styles.itemEmoji}>🎯</Text>
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>CIT Nano-Trap Orbs</Text>
                  <Text style={styles.itemQuantity}>x{backpack.captureTraps}</Text>
                </View>
                <Text style={styles.itemDescription}>
                  Electromagnetic field traps used in AR Catch mode to secure wild campus anomalies.
                </Text>
              </View>
            </View>

            {/* Item 3: Data Credits */}
            <View style={styles.itemCard}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#451A03', borderColor: '#F59E0B' }]}>
                <Text style={styles.itemEmoji}>💎</Text>
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>Campus Data Credits</Text>
                  <Text style={styles.itemQuantity}>{backpack.dataCoins}</Text>
                </View>
                <Text style={styles.itemDescription}>
                  Encrypted campus currency earned from opening loot crates and rare creature captures.
                </Text>
              </View>
            </View>

            {/* Item 4: Supply Crates */}
            <View style={styles.itemCard}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#082F49', borderColor: '#38BDF8' }]}>
                <Text style={styles.itemEmoji}>🧰</Text>
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>CIT Supply Crate</Text>
                  <Text style={styles.itemQuantity}>x{backpack.supplyCrates}</Text>
                </View>
                <Text style={styles.itemDescription}>
                  Crate discovered at the Student Canteen. Contains random battery cells and bonus XP.
                </Text>
              </View>
            </View>

            {/* Shop Navigation Banner */}
            <TouchableOpacity
              style={styles.shopBannerButton}
              onPress={() => router.push('/shop')}
            >
              <Text style={styles.shopBannerIcon}>🏪</Text>
              <View style={styles.shopBannerTextCol}>
                <Text style={styles.shopBannerTitle}>CIT Campus Armory & Reward Shop</Text>
                <Text style={styles.shopBannerSubtitle}>
                  Spend Data Credits on batteries, trap buffs & badges →
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 10,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerCoinBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.50)',
    borderTopColor: 'rgba(254, 243, 199, 0.75)',
  },
  coinBadgeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 9999,
    padding: 4,
    borderWidth: 1.2,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9999,
  },
  activeTabButton: {
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  bestiaryHeaderCard: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 16,
  },
  bestiaryHeaderLeft: {
    flex: 1,
  },
  bestiaryHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bestiaryHeaderSubtitle: {
    color: '#38BDF8',
    fontSize: 12,
    marginTop: 2,
  },
  progressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(14, 116, 144, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderTopColor: 'rgba(186, 230, 253, 0.8)',
  },
  progressCircleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  creatureCard: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rarityPillText: {
    fontSize: 9,
    fontWeight: '900',
  },
  cardIndex: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mascotCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginVertical: 8,
  },
  mascotEmoji: {
    fontSize: 30,
  },
  creatureName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 2,
  },
  sectorText: {
    color: '#94A3B8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  capturedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  capturedBadgeText: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: 'bold',
  },
  undiscoveredBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  undiscoveredBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
  },
  backpackGrid: {
    gap: 14,
  },
  itemCard: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  itemIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginRight: 14,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
  },
  itemEmoji: {
    fontSize: 26,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemQuantity: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '900',
  },
  itemDescription: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  useButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.6)',
    borderTopColor: 'rgba(167, 243, 208, 0.8)',
  },
  useButtonText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '900',
  },
  shopBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginTop: 8,
  },
  shopBannerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  shopBannerTextCol: {
    flex: 1,
  },
  shopBannerTitle: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: 'bold',
  },
  shopBannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  cardActionsCol: {
    width: '100%',
    gap: 4,
  },
  buddyButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  buddyButtonActive: {
    backgroundColor: '#854D0E',
    borderColor: '#FBBF24',
  },
  buddyButtonText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  buddyButtonTextActive: {
    color: '#FEF08A',
    fontWeight: '900',
  },
});

