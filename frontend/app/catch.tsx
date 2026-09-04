import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getRarityConfig,
  getCreatureEmoji,
  RarityTier,
} from '../utils/haversine';
import { getCreatureChallenge, CreatureChallenge } from '../constants/challenges';
import { useAuth } from '../context/AuthContext';
import { recordCaptureApi, apiClient } from '../utils/api';
import {
  createTagTeamRaidApi,
  completeTagTeamRaidApi,
  fetchActivePeersApi,
  RaidGroupData,
  PeerCadet,
} from '../utils/multiplayer';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticWarning, triggerHapticImpact } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCatchSound, playBattleSound } from '../utils/sound';

export default function CatchScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    rarity?: string;
    distance?: string;
  }>();

  const creatureName = params.name || 'Campus Monster';
  const rarity = (params.rarity as RarityTier) || 'COMMON';
  const rarityConfig = getRarityConfig(rarity);
  const creatureEmoji = getCreatureEmoji(creatureName);
  const challenge = getCreatureChallenge(creatureName);

  const [permission, requestPermission] = useCameraPermissions();
  const [caught, setCaught] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // QR Code Scavenger Mode state
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [scannedRecently, setScannedRecently] = useState(false);

  // Tag-Team Raid Strike Group state
  const [showRaidModal, setShowRaidModal] = useState<boolean>(false);
  const [raidData, setRaidData] = useState<RaidGroupData | null>(null);
  const [raidPeers, setRaidPeers] = useState<PeerCadet[]>([]);
  const [raidLoading, setRaidLoading] = useState<boolean>(false);

  // Challenge state: if there is a challenge, challengePassed starts as false
  const [challengePassed, setChallengePassed] = useState<boolean>(!challenge);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [challengeResult, setChallengeResult] = useState<'CORRECT' | 'WRONG' | null>(null);

  // Handle Challenge Option Selection
  const handleSelectOption = (index: number) => {
    if (!challenge || challengeResult === 'CORRECT') return;
    setSelectedOption(index);

    if (index === challenge.correctIndex) {
      setChallengeResult('CORRECT');
      triggerHapticSuccess();
      playCatchSound();
      setTimeout(() => {
        setChallengePassed(true);
      }, 1400);
    } else {
      setChallengeResult('WRONG');
      triggerHapticWarning();
      playBattleSound();
      Alert.alert(
        '⚠️ Quantum Shield Active',
        'Frequency mismatch! The encryption shield deflected your frequency pulse. Recalibrate and try again!',
        [{ text: 'Retry', style: 'default' }]
      );
    }
  };

  // Handle Open Cooperative Tag-Team Strike Group
  const handleOpenRaidGroup = async () => {
    setRaidLoading(true);
    try {
      const [peersList, raid] = await Promise.all([
        fetchActivePeersApi(),
        createTagTeamRaidApi(creatureName, challenge?.landmark || 'CIT Campus Sector', token),
      ]);
      setRaidPeers(peersList);
      setRaidData(raid);
      setShowRaidModal(true);
    } catch (e) {
      console.warn('Failed to open raid lobby:', e);
    } finally {
      setRaidLoading(false);
    }
  };

  // Handle Execute Cooperative Tag-Team Strike Assault
  const handleExecuteRaidAssault = async () => {
    if (!raidData || capturing) return;
    setCapturing(true);

    try {
      const [raidRes, capRes] = await Promise.all([
        completeTagTeamRaidApi(raidData.raid_id, token),
        recordCaptureApi(
          {
            creature_name: creatureName,
            rarity: rarity,
            campus_sector: challenge?.landmark || 'CIT Campus Landmark',
            latitude: 11.0278,
            longitude: 77.0282,
          },
          token
        ),
      ]);

      setCaught(true);
      setShowRaidModal(false);
      if (user) {
        updateProfile({});
      }

      Alert.alert(
        '🎉 TAG-TEAM BOSS VICTORY!',
        `${raidRes.message || 'Legendary Anomaly neutralized with your CIT Strike Team!'}\n\n+2000 Bonus Team XP\n+100 Data Credits (Armory Currency)\nBestiary updated with Boss Crest!`,
        [
          { text: 'View Bestiary', onPress: () => router.replace('/inventory') },
          { text: 'Back to Radar', onPress: () => router.back() },
        ],
        { cancelable: false }
      );
    } catch (e) {
      setCaught(true);
      setShowRaidModal(false);
      Alert.alert('🎉 Strike Team Victory!', `Boss ${creatureName} secured!`, [
        { text: 'Great!', onPress: () => router.back() },
      ]);
    } finally {
      setCapturing(false);
    }
  };

  // Handle QR barcode scan on physical campus posters
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRecently) return;
    setScannedRecently(true);
    try {
      const res = await apiClient.post(
        '/api/gameplay/qr-scan',
        { qr_code: data },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      Alert.alert(
        '📷 Campus QR Station Decoded!',
        `${res.data.message}\n\n+${res.data.reward_coins} Data Credits 💎\n+${res.data.reward_energy} Quantum Energy ⚡\n+${res.data.reward_xp} Exploration XP`,
        [{ text: 'Collect Cache', onPress: () => setIsScanningQr(false) }]
      );
      if (user) {
        updateProfile({});
      }
    } catch (e) {
      Alert.alert('📷 Campus Station Scanned', `Scanned Station ID: ${data}\n+50 Data Credits & +200 XP unlocked!`);
      setIsScanningQr(false);
    } finally {
      setTimeout(() => setScannedRecently(false), 3000);
    }
  };

  // Handle Creature Catch interaction
  const handleCatchCreature = async () => {
    if (caught || capturing) return;

    if (user && user.energy < 10) {
      triggerHapticWarning();
      Alert.alert(
        '⚠️ Low Battery Warning',
        'Insufficient energy! You need at least 10 Energy to capture. Visit the Canteen or Stadium on campus to recharge or use a battery from the Armory.',
        [{ text: 'Go to Armory', onPress: () => router.push('/shop') }, { text: 'Back', onPress: () => router.back() }]
      );
      return;
    }

    setCapturing(true);
    triggerHapticImpact('heavy');
    playBattleSound();

    try {
      const result = await recordCaptureApi(
        {
          creature_name: creatureName,
          rarity: rarity,
          campus_sector: challenge?.landmark || 'CIT Campus Landmark',
          latitude: 11.0278,
          longitude: 77.0282,
        },
        token
      );

      setCaught(true);
      triggerHapticSuccess();
      playCatchSound();

      // Update local profile state
      if (user) {
        updateProfile({});
      }

      const totalXp = rarityConfig.xpReward + (challenge ? challenge.bonusXp : 0);

      Alert.alert(
        `🎉 ${rarityConfig.icon} Captured!`,
        `${result.message || `You successfully captured ${creatureName} (${rarityConfig.label})!`}\n\n+${totalXp} XP earned ${challenge ? `(+${challenge.bonusXp} Challenge Bonus!)` : ''}\nEnergy: -10 HP\nAdded to your CIT Bestiary!`,
        [
          {
            text: 'View Bestiary',
            onPress: () => {
              router.replace('/inventory');
            },
          },
          {
            text: 'Back to Radar',
            onPress: () => {
              router.back();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (e: any) {
      console.warn('Capture error:', e);
      setCaught(true);
      Alert.alert('🎉 Captured!', `Secured ${creatureName}!`, [
        { text: 'Great!', onPress: () => router.back() },
      ]);
    } finally {
      setCapturing(false);
    }
  };

  // If permissions are still loading
  if (!permission) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.infoText}>Connecting Quantum Camera Sensor...</Text>
      </View>
    );
  }

  // If camera permission is not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={styles.permissionTitle}>AR Sensor Permission Required</Text>
          <Text style={styles.permissionDescription}>
            CampusQuest uses your device's camera to render{' '}
            <Text style={{ color: rarityConfig.color, fontWeight: 'bold' }}>{creatureName}</Text> in Augmented Reality on campus!
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Return to Map</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full-screen Camera View with AR and Physical Campus QR Scanner */}
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={isScanningQr ? { barcodeTypes: ['qr'] } : undefined}
        onBarcodeScanned={isScanningQr ? handleBarcodeScanned : undefined}
      >
        {/* Top Header HUD */}
        <SafeAreaView style={styles.topHud}>
          <View style={styles.hudBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>✕ Flee</Text>
            </TouchableOpacity>

            {/* QR Scavenger Toggle Button */}
            <TouchableOpacity
              style={[styles.qrToggleButton, isScanningQr && styles.qrToggleButtonActive]}
              onPress={() => setIsScanningQr(!isScanningQr)}
            >
              <Text style={styles.qrToggleText}>
                {isScanningQr ? '👾 AR Catch' : '📷 QR Station'}
              </Text>
            </TouchableOpacity>

            {/* Rarity & Encounter Badge */}
            <View
              style={[
                styles.targetBadge,
                { backgroundColor: rarityConfig.bgColor, borderColor: rarityConfig.borderColor },
              ]}
            >
              <Text style={[styles.targetBadgeText, { color: rarityConfig.color }]}>
                {rarityConfig.icon} {rarityConfig.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        {/* QR Scanner Mode Overlay */}
        {isScanningQr ? (
          <View style={styles.qrOverlayWrapper}>
            <View style={styles.qrReticle}>
              <View style={styles.qrCornerTL} />
              <View style={styles.qrCornerTR} />
              <View style={styles.qrCornerBL} />
              <View style={styles.qrCornerBR} />
              <Text style={styles.qrEmoji}>📷</Text>
            </View>
            <View style={styles.qrCard}>
              <Text style={styles.qrCardTitle}>PHYSICAL CAMPUS QR STATION</Text>
              <Text style={styles.qrCardDesc}>
                Point your sensor at any official CIT department noticeboard or lab QR poster to decode secret supply caches!
              </Text>
            </View>
          </View>
        ) : challenge && !challengePassed ? (
          <View style={styles.challengeOverlayWrapper}>
            <ScrollView contentContainerStyle={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeEmoji}>{creatureEmoji}</Text>
                <View style={styles.challengeHeaderTexts}>
                  <Text style={styles.challengeSubtitle}>
                    {challenge.landmark} • {challenge.department}
                  </Text>
                  <Text style={[styles.challengeTitle, { color: rarityConfig.color }]}>
                    {challenge.title}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.challengePromptText}>{challenge.prompt}</Text>

              {/* Multiple Choice Options */}
              <View style={styles.optionsContainer}>
                {challenge.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = isSelected && challengeResult === 'CORRECT';
                  const isWrong = isSelected && challengeResult === 'WRONG';

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.optionButton,
                        isSelected && styles.optionSelected,
                        isCorrect && styles.optionCorrect,
                        isWrong && styles.optionWrong,
                      ]}
                      onPress={() => handleSelectOption(idx)}
                      disabled={challengeResult === 'CORRECT'}
                    >
                      <View style={styles.optionLetterBadge}>
                        <Text style={styles.optionLetter}>
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          isCorrect && { color: '#86EFAC', fontWeight: 'bold' },
                          isWrong && { color: '#FCA5A5' },
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Status Banner */}
              {challengeResult === 'CORRECT' ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerTitle}>⚡ SHIELD DECRYPTED! ⚡</Text>
                  <Text style={styles.successBannerDesc}>
                    {challenge.explanation} (+{challenge.bonusXp} XP Bonus Unlocked)
                  </Text>
                </View>
              ) : (
                <View style={styles.hintBanner}>
                  <Text style={styles.hintBannerText}>
                    Solve the challenge to deactivate the quantum barrier and unlock capture!
                  </Text>
                </View>
              )}

              {/* Bypass button if student wants to try direct capture */}
              <TouchableOpacity
                style={styles.bypassButton}
                onPress={() => setChallengePassed(true)}
              >
                <Text style={styles.bypassButtonText}>Override Shield & Force Catch →</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          /* Normal AR Reticle Target: Creature Box & "Tap to Catch" */
          <>
            <View style={styles.centerTargetWrapper} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.creatureCard, caught && styles.creatureCardCaught]}
                activeOpacity={0.7}
                onPress={handleCatchCreature}
                disabled={capturing}
              >
                {/* AR Outer Reticle Circle */}
                <View
                  style={[
                    styles.reticleRing,
                    { borderColor: rarityConfig.color },
                  ]}
                >
                  <View style={[styles.innerReticleRing, { borderColor: rarityConfig.borderColor }]} />
                </View>

                {/* Avatar Circle with Dynamic Rarity Glow */}
                <View
                  style={[
                    styles.avatarBox,
                    {
                      backgroundColor: rarityConfig.bgColor,
                      borderColor: rarityConfig.color,
                      shadowColor: rarityConfig.color,
                    },
                  ]}
                >
                  {capturing ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.avatarEmoji}>{creatureEmoji}</Text>
                  )}
                </View>

                {/* Target Label */}
                <Text style={styles.creatureNameText}>{creatureName}</Text>

                {/* Rarity & XP Tag */}
                <View
                  style={[
                    styles.rarityTag,
                    { backgroundColor: rarityConfig.bgColor, borderColor: rarityConfig.borderColor },
                  ]}
                >
                  <Text style={[styles.rarityTagText, { color: rarityConfig.color }]}>
                    +{rarityConfig.xpReward + (challenge ? challenge.bonusXp : 0)} XP Reward • -10 Energy
                  </Text>
                </View>

                {/* Tap to Catch Action Badge */}
                <View
                  style={[
                    styles.tapToCatchBadge,
                    { backgroundColor: rarityConfig.color, borderColor: '#FFFFFF' },
                  ]}
                >
                  <Text style={styles.tapToCatchText}>
                    {capturing ? '⚡ CAPTURING...' : '✨ TAP TO CAPTURE ✨'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Bottom Catch & Tag-Team Controls */}
            <SafeAreaView style={styles.bottomHud}>
              {/* Co-op Tag-Team Strike Group Launch Button (Legendary & Epic Spawns) */}
              {(rarity === 'LEGENDARY' || rarity === 'EPIC') && (
                <TouchableOpacity
                  style={styles.raidLaunchButton}
                  activeOpacity={0.85}
                  onPress={handleOpenRaidGroup}
                  disabled={capturing || raidLoading}
                >
                  {raidLoading ? (
                    <ActivityIndicator size="small" color="#FDE047" />
                  ) : (
                    <>
                      <Text style={styles.raidLaunchIcon}>⚔️</Text>
                      <View style={styles.raidLaunchTextCol}>
                        <Text style={styles.raidLaunchMainText}>FORM TAG-TEAM STRIKE GROUP</Text>
                        <Text style={styles.raidLaunchSubText}>+2000 XP & +100 Data Credits Multiplier</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.throwCatchButton,
                  {
                    backgroundColor: rarityConfig.bgColor,
                    borderColor: rarityConfig.color,
                    shadowColor: rarityConfig.color,
                  },
                ]}
                activeOpacity={0.8}
                onPress={handleCatchCreature}
                disabled={capturing}
              >
                <Text style={styles.throwButtonIcon}>⚡</Text>
                <Text style={[styles.throwButtonText, { color: rarityConfig.color }]}>
                  {capturing ? 'DEPLOYING NANO-TRAP...' : `SOLO CAPTURE ${creatureName.toUpperCase()}`}
                </Text>
              </TouchableOpacity>
              <Text style={styles.arHintText}>Tap the creature, throw solo trap, or rally a campus strike team!</Text>
            </SafeAreaView>

            {/* Tag-Team Strike Group War Room Modal */}
            {showRaidModal && raidData && (
              <View style={styles.raidModalOverlay}>
                <View style={styles.raidModalCard}>
                  {/* Modal Header */}
                  <View style={styles.raidModalHeader}>
                    <View style={styles.raidHeaderTitleRow}>
                      <Text style={styles.raidHeaderIcon}>⚔️</Text>
                      <View>
                        <Text style={styles.raidModalTitle}>TAG-TEAM STRIKE ROOM</Text>
                        <Text style={styles.raidModalSubtitle}>
                          Lobby: {raidData.raid_id} • Sector: {challenge?.landmark || 'CIT Center'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.raidCloseButton}
                      onPress={() => setShowRaidModal(false)}
                    >
                      <Text style={styles.raidCloseButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.raidDivider} />

                  {/* Target Boss Summary */}
                  <View style={styles.raidBossBanner}>
                    <Text style={styles.raidBossEmoji}>{creatureEmoji}</Text>
                    <View style={styles.raidBossInfo}>
                      <Text style={styles.raidBossName}>{creatureName}</Text>
                      <Text style={[styles.raidBossRarity, { color: rarityConfig.color }]}>
                        {rarityConfig.label} CLASS THREAT • 50,000 HP
                      </Text>
                    </View>
                  </View>

                  {/* Connected Strike Group Cadets */}
                  <Text style={styles.raidRosterSectionTitle}>CAMPUS STRIKE CADETS (READY)</Text>
                  <View style={styles.raidCadetList}>
                    {/* Host User */}
                    <View style={styles.raidCadetRow}>
                      <Text style={styles.raidCadetAvatar}>👨‍💻</Text>
                      <View style={styles.raidCadetDetails}>
                        <Text style={styles.raidCadetName}>{user?.username || 'You (CIT Cadet)'} [HOST]</Text>
                        <Text style={styles.raidCadetMeta}>
                          Lvl {user?.level || 1} • {user?.department || 'CSE'}
                        </Text>
                      </View>
                      <View style={styles.raidReadyBadge}>
                        <Text style={styles.raidReadyText}>READY</Text>
                      </View>
                    </View>

                    {/* Nearby Active Teammates */}
                    {raidPeers.slice(0, 2).map((peer, idx) => (
                      <View key={idx} style={styles.raidCadetRow}>
                        <Text style={styles.raidCadetAvatar}>⚡</Text>
                        <View style={styles.raidCadetDetails}>
                          <Text style={styles.raidCadetName}>{peer.username}</Text>
                          <Text style={styles.raidCadetMeta}>
                            Lvl {peer.level} • {peer.department} • {peer.avatar_title}
                          </Text>
                        </View>
                        <View style={styles.raidReadyBadge}>
                          <Text style={styles.raidReadyText}>SYNCED</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Strike Multiplier Bonus Box */}
                  <View style={styles.raidMultiplierBox}>
                    <Text style={styles.raidMultiplierTitle}>💥 CO-OP POWER SURGE ACTIVE</Text>
                    <Text style={styles.raidMultiplierDesc}>
                      Strike Power: +250% | Shared Reward: +2,000 EXP & +100 Data Credits for each cadet!
                    </Text>
                  </View>

                  {/* Action Button */}
                  <TouchableOpacity
                    style={styles.raidExecuteButton}
                    activeOpacity={0.85}
                    onPress={handleExecuteRaidAssault}
                    disabled={capturing}
                  >
                    {capturing ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Text style={styles.raidExecuteIcon}>🚀</Text>
                        <Text style={styles.raidExecuteText}>LAUNCH STRIKE ASSAULT</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  topHud: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 20 : 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#64748B',
  },
  backButtonText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: 14,
  },
  targetBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  targetBadgeText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  // Challenge Modal Styles
  challengeOverlayWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    zIndex: 20,
  },
  challengeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  challengeHeaderTexts: {
    flex: 1,
  },
  challengeSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 14,
  },
  challengePromptText: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 14,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionSelected: {
    borderColor: '#38BDF8',
    backgroundColor: '#082F49',
  },
  optionCorrect: {
    borderColor: '#22C55E',
    backgroundColor: '#064E3B',
  },
  optionWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#450A0A',
  },
  optionLetterBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionLetter: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  optionText: {
    color: '#E2E8F0',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    padding: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  successBannerTitle: {
    color: '#86EFAC',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 4,
  },
  successBannerDesc: {
    color: '#D1FAE5',
    fontSize: 12,
    textAlign: 'center',
  },
  hintBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  hintBannerText: {
    color: '#38BDF8',
    fontSize: 11,
    textAlign: 'center',
  },
  bypassButton: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bypassButtonText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  // Center Reticle Styles
  centerTargetWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatureCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  creatureCardCaught: {
    opacity: 0.4,
  },
  reticleRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerReticleRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
  },
  avatarBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 10,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  creatureNameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  rarityTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  rarityTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tapToCatchBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tapToCatchText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  bottomHud: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  throwCatchButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 8,
  },
  throwButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  throwButtonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  arHintText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    color: '#38BDF8',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
    maxWidth: 360,
  },
  permissionEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDescription: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  grantButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  // Tag-Team Raid Strike Group Styles
  raidLaunchButton: {
    width: '100%',
    backgroundColor: '#854D0E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FDE047',
    marginBottom: 10,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  raidLaunchIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  raidLaunchTextCol: {
    alignItems: 'flex-start',
  },
  raidLaunchMainText: {
    color: '#FEF08A',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  raidLaunchSubText: {
    color: '#FEF9C3',
    fontSize: 10,
    fontWeight: '600',
  },
  raidModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 10, 25, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 50,
  },
  raidModalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#EAB308',
    padding: 20,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  raidModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  raidHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raidHeaderIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  raidModalTitle: {
    color: '#FEF08A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  raidModalSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  raidCloseButton: {
    backgroundColor: '#334155',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raidCloseButtonText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: 13,
  },
  raidDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  raidBossBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    marginBottom: 14,
  },
  raidBossEmoji: {
    fontSize: 34,
    marginRight: 12,
  },
  raidBossInfo: {
    flex: 1,
  },
  raidBossName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  raidBossRarity: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  raidRosterSectionTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  raidCadetList: {
    gap: 8,
    marginBottom: 14,
  },
  raidCadetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  raidCadetAvatar: {
    fontSize: 20,
    marginRight: 10,
  },
  raidCadetDetails: {
    flex: 1,
  },
  raidCadetName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  raidCadetMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  raidReadyBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22C55E',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  raidReadyText: {
    color: '#86EFAC',
    fontWeight: 'bold',
    fontSize: 10,
  },
  raidMultiplierBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EAB308',
    marginBottom: 16,
    alignItems: 'center',
  },
  raidMultiplierTitle: {
    color: '#FEF08A',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 2,
  },
  raidMultiplierDesc: {
    color: '#FDE047',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  raidExecuteButton: {
    backgroundColor: '#EAB308',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  raidExecuteIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  raidExecuteText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // QR Scavenger Mode Styles
  qrToggleButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  qrToggleButtonActive: {
    backgroundColor: '#0284C7',
    borderColor: '#FFFFFF',
  },
  qrToggleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  qrOverlayWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  qrReticle: {
    width: 260,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#38BDF8',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#38BDF8',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#38BDF8',
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#38BDF8',
  },
  qrEmoji: {
    fontSize: 48,
    opacity: 0.8,
  },
  qrCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    maxWidth: 360,
  },
  qrCardTitle: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  qrCardDesc: {
    color: '#CBD5E1',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
