import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  fetchAdminOverviewApi,
  adminCreateSpawnApi,
  adminCreateLootApi,
  AdminOverviewData,
} from '../utils/api';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import {
  triggerHapticTap,
  triggerHapticSuccess,
  triggerHapticWarning,
  triggerHapticSelection,
} from '../utils/haptics';
import {
  playTapSound,
  playSwooshSound,
  playCatchSound,
  playCoinSound,
  playBattleSound,
} from '../utils/sound';

const CIT_LANDMARKS = [
  { label: 'Admin Tower / Entrance', lat: 11.026820, lng: 77.027450 },
  { label: 'Central Library & CSE', lat: 11.028050, lng: 77.026720 },
  { label: 'Mechanical & Robotics Lab', lat: 11.027450, lng: 77.026950 },
  { label: 'ECE & Embedded Systems', lat: 11.027150, lng: 77.027550 },
  { label: 'Open Air Theatre (OAT)', lat: 11.028640, lng: 77.027850 },
  { label: 'Hostel Quadrangle', lat: 11.029210, lng: 77.027050 },
  { label: 'Sports Stadium Pavilion', lat: 11.029350, lng: 77.028640 },
  { label: 'Student Canteen & Food Court', lat: 11.026950, lng: 77.027750 },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'SPAWN' | 'LOOT' | 'STATS'>('SPAWN');

  // Spawn Form State
  const [creatureName, setCreatureName] = useState('');
  const [rarity, setRarity] = useState<'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'>('RARE');
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Loot Form State
  const [crateName, setCrateName] = useState('');
  const [rewardType, setRewardType] = useState<'ENERGY' | 'COINS' | 'XP'>('ENERGY');
  const [rewardAmount, setRewardAmount] = useState('50');
  const [lootLandmarkIdx, setLootLandmarkIdx] = useState(0);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminOverviewApi(token);
      setOverview(data);
    } catch (e) {
      console.error('Failed to load admin overview:', e);
    } finally {
      setLoading(false);
    }
  };

  // If user is not Admin
  if (user?.role !== 'ADMIN') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.unauthWrapper}>
          <View style={styles.unauthCard}>
            <Text style={styles.unauthEmoji}>🛡️</Text>
            <Text style={styles.unauthTitle}>Administrator Clearance Required</Text>
            <Text style={styles.unauthSubtitle}>
              This control terminal is restricted to CIT Campus Game Masters & Faculty Administrators.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                triggerHapticTap();
                playTapSound();
                router.push('/login');
              }}
            >
              <Text style={styles.primaryButtonText}>Switch to Admin Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                router.back();
              }}
            >
              <Text style={styles.secondaryButtonText}>Return to Radar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const handleDeployCreature = async () => {
    if (!creatureName.trim()) {
      triggerHapticWarning();
      Alert.alert('Missing Name', 'Please enter a name for the custom anomaly.');
      return;
    }

    const landmark = CIT_LANDMARKS[selectedLandmarkIdx];
    setSubmitting(true);
    triggerHapticTap();

    try {
      const res = await adminCreateSpawnApi(
        {
          name: creatureName.trim(),
          rarity,
          latitude: landmark.lat,
          longitude: landmark.lng,
        },
        token
      );

      playBattleSound();
      triggerHapticSuccess();
      Alert.alert('⚡ Anomaly Deployed!', `${res.message}\nSpawned at ${landmark.label}.`);
      setCreatureName('');
      loadOverview();
    } catch (e: any) {
      triggerHapticWarning();
      Alert.alert('Error', e.message || 'Could not deploy spawn.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeployLoot = async () => {
    if (!crateName.trim()) {
      triggerHapticWarning();
      Alert.alert('Missing Name', 'Please enter a name for the supply crate.');
      return;
    }

    const landmark = CIT_LANDMARKS[lootLandmarkIdx];
    setSubmitting(true);
    triggerHapticTap();

    try {
      const res = await adminCreateLootApi(
        {
          name: crateName.trim(),
          reward_type: rewardType,
          reward_amount: parseInt(rewardAmount, 10) || 50,
          campus_sector: landmark.label,
          latitude: landmark.lat,
          longitude: landmark.lng,
        },
        token
      );

      playCoinSound();
      triggerHapticSuccess();
      Alert.alert('🎁 Supply Cache Dropped!', `${res.message}\nLocation: ${landmark.label}`);
      setCrateName('');
      loadOverview();
    } catch (e: any) {
      triggerHapticWarning();
      Alert.alert('Error', e.message || 'Could not drop loot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
            <Text style={styles.backButtonText}>← Radar</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>🛡️ CIT Command CMS</Text>
            <Text style={styles.headerSubtitle}>Live Anomaly & Content Spawner</Text>
          </View>
        </View>

        {/* Overview Stat Cards */}
        {overview && (
          <View style={[liquidGlass.card, styles.statsCard]}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CADETS</Text>
              <Text style={styles.statValue}>{overview.total_cadets}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CAPTURES</Text>
              <Text style={styles.statValue}>{overview.total_captures}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>STORY SPAWNS</Text>
              <Text style={styles.statValue}>{overview.canonical_story_spawns}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CACHES</Text>
              <Text style={styles.statValue}>{overview.active_loot_crates}</Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'SPAWN' && styles.tabButtonActive]}
            onPress={() => {
              triggerHapticSelection();
              playTapSound();
              setActiveTab('SPAWN');
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'SPAWN' && styles.tabButtonTextActive]}>
              👾 Spawn Anomaly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'LOOT' && styles.tabButtonActive]}
            onPress={() => {
              triggerHapticSelection();
              playTapSound();
              setActiveTab('LOOT');
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'LOOT' && styles.tabButtonTextActive]}>
              🧰 Drop Supply
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'STATS' && styles.tabButtonActive]}
            onPress={() => {
              triggerHapticSelection();
              playTapSound();
              setActiveTab('STATS');
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'STATS' && styles.tabButtonTextActive]}>
              📊 Telemetry
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Tabs */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollContainer}>
          {activeTab === 'SPAWN' && (
            <View style={[liquidGlass.card, styles.formCard]}>
              <Text style={styles.formTitle}>⚡ Deploy Custom Event Anomaly</Text>
              <Text style={styles.formSubtitle}>
                Place a temporary boss or special event creature at any CIT landmark.
              </Text>

              {/* Creature Name */}
              <Text style={styles.inputLabel}>CREATURE NAME</Text>
              <TextInput
                style={[liquidGlass.input, styles.textInput]}
                placeholder="e.g. CIT Megatron Prime"
                placeholderTextColor="#64748B"
                value={creatureName}
                onChangeText={setCreatureName}
              />

              {/* Rarity Selector */}
              <Text style={styles.inputLabel}>RARITY TIER</Text>
              <View style={styles.rarityRow}>
                {(['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.rarityOption,
                      rarity === r && styles.rarityOptionActive,
                      rarity === r && {
                        borderColor:
                          r === 'LEGENDARY'
                            ? '#F59E0B'
                            : r === 'EPIC'
                            ? '#A855F7'
                            : r === 'RARE'
                            ? '#38BDF8'
                            : '#22C55E',
                      },
                    ]}
                    onPress={() => {
                      triggerHapticTap();
                      playTapSound();
                      setRarity(r);
                    }}
                  >
                    <Text
                      style={[
                        styles.rarityOptionText,
                        rarity === r && {
                          color:
                            r === 'LEGENDARY'
                              ? '#FBBF24'
                              : r === 'EPIC'
                              ? '#C084FC'
                              : r === 'RARE'
                              ? '#38BDF8'
                              : '#86EFAC',
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      {r === 'LEGENDARY'
                        ? '🟡 Leg'
                        : r === 'EPIC'
                        ? '🟣 Epic'
                        : r === 'RARE'
                        ? '🔵 Rare'
                        : '⚪ Com'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Landmark Selector */}
              <Text style={styles.inputLabel}>CAMPUS LANDMARK LOCATION</Text>
              <View style={styles.landmarkList}>
                {CIT_LANDMARKS.map((lm, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.landmarkButton,
                      selectedLandmarkIdx === idx && styles.landmarkButtonActive,
                    ]}
                    onPress={() => {
                      triggerHapticTap();
                      playTapSound();
                      setSelectedLandmarkIdx(idx);
                    }}
                  >
                    <Text
                      style={[
                        styles.landmarkText,
                        selectedLandmarkIdx === idx && styles.landmarkTextActive,
                      ]}
                    >
                      📍 {lm.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[liquidGlass.button, liquidGlass.buttonCyan, styles.deployButton, submitting && styles.buttonDisabled]}
                onPress={handleDeployCreature}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deployButtonText}>⚡ DEPLOY ANOMALY TO CIT MAP</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'LOOT' && (
            <View style={[liquidGlass.card, styles.formCard]}>
              <Text style={styles.formTitle}>🎁 Drop Campus Supply Cache</Text>
              <Text style={styles.formSubtitle}>
                Scatter energy batteries or data credits for exploring cadets.
              </Text>

              {/* Crate Name */}
              <Text style={styles.inputLabel}>SUPPLY CRATE NAME</Text>
              <TextInput
                style={[liquidGlass.input, styles.textInput]}
                placeholder="e.g. Quadrangle Battery Cache"
                placeholderTextColor="#64748B"
                value={crateName}
                onChangeText={setCrateName}
              />

              {/* Reward Type */}
              <Text style={styles.inputLabel}>REWARD TYPE</Text>
              <View style={styles.rarityRow}>
                {(['ENERGY', 'COINS', 'XP'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.rarityOption,
                      rewardType === type && styles.rarityOptionActive,
                      rewardType === type && { borderColor: '#F59E0B' },
                    ]}
                    onPress={() => {
                      triggerHapticTap();
                      playTapSound();
                      setRewardType(type);
                    }}
                  >
                    <Text
                      style={[
                        styles.rarityOptionText,
                        rewardType === type && { color: '#FBBF24', fontWeight: 'bold' },
                      ]}
                    >
                      {type === 'ENERGY' ? '⚡ Energy' : type === 'COINS' ? '💎 Credits' : '📈 XP'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reward Amount */}
              <Text style={styles.inputLabel}>REWARD AMOUNT</Text>
              <TextInput
                style={[liquidGlass.input, styles.textInput]}
                placeholder="50"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={rewardAmount}
                onChangeText={setRewardAmount}
              />

              {/* Location */}
              <Text style={styles.inputLabel}>CAMPUS LANDMARK LOCATION</Text>
              <View style={styles.landmarkList}>
                {CIT_LANDMARKS.map((lm, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.landmarkButton,
                      lootLandmarkIdx === idx && styles.landmarkButtonActive,
                    ]}
                    onPress={() => {
                      triggerHapticTap();
                      playTapSound();
                      setLootLandmarkIdx(idx);
                    }}
                  >
                    <Text
                      style={[
                        styles.landmarkText,
                        lootLandmarkIdx === idx && styles.landmarkTextActive,
                      ]}
                    >
                      📍 {lm.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[liquidGlass.button, liquidGlass.buttonAmber, styles.deployButton, submitting && styles.buttonDisabled]}
                onPress={handleDeployLoot}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deployButtonText}>🎁 DROP SUPPLY CACHE</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'STATS' && (
            <View style={[liquidGlass.card, styles.formCard]}>
              <Text style={styles.formTitle}>📊 Campus Anomaly Telemetry</Text>
              <Text style={styles.formSubtitle}>
                Live breakdown of Coimbatore Institute of Technology active game entities.
              </Text>

              <View style={styles.telemetryBox}>
                <Text style={styles.telemetryRow}>🏛️ <Text style={styles.telemetryBold}>CIT Geofence:</Text> Active (Exact 17-Point User-Calibrated Perimeter)</Text>
                <Text style={styles.telemetryRow}>🐉 <Text style={styles.telemetryBold}>Legendary Boss:</Text> CIT CyberDragon (Admin Tower)</Text>
                <Text style={styles.telemetryRow}>📡 <Text style={styles.telemetryBold}>Proximity Radius:</Text> 15.0 meters trigger threshold</Text>
                <Text style={styles.telemetryRow}>⚡ <Text style={styles.telemetryBold}>Catch Energy Cost:</Text> -10 HP per AR containment</Text>
                <Text style={styles.telemetryRow}>🏪 <Text style={styles.telemetryBold}>Campus Armory:</Text> 6 items online in catalog</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    backgroundColor: GLASS_COLORS.bgMedium,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    marginRight: 12,
  },
  backButtonText: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
    paddingVertical: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statValue: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '900',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 9999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContainer: {
    paddingBottom: 24,
  },
  formCard: {
    marginBottom: 16,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  formSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    marginBottom: 4,
  },
  rarityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rarityOption: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  rarityOptionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  rarityOptionText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  landmarkList: {
    gap: 6,
    marginBottom: 16,
  },
  landmarkButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  landmarkButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38BDF8',
  },
  landmarkText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  landmarkTextActive: {
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  deployButton: {
    marginTop: 10,
  },
  deployButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  telemetryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  telemetryRow: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  telemetryBold: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  unauthWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unauthCard: {
    ...liquidGlass.modalCard,
    width: '100%',
    alignItems: 'center',
  },
  unauthEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  unauthTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  unauthSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    ...liquidGlass.button,
    ...liquidGlass.buttonCyan,
    width: '100%',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryButton: {
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 13,
  },
});

