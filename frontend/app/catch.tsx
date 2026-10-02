import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useVPSTracker } from '../utils/vps';
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
import ARCreatureModel from '../components/ARCreatureModel';

export default function CatchScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    rarity?: string;
    distance?: string;
    creature_lat?: string;
    creature_lng?: string;
    user_lat?: string;
    user_lng?: string;
  }>();

  const creatureName = params.name || 'Campus Monster';
  const rarity = (params.rarity as RarityTier) || 'COMMON';
  const rarityConfig = getRarityConfig(rarity);
  const creatureEmoji = getCreatureEmoji(creatureName);
  const challenge = getCreatureChallenge(creatureName);

  const [permission, requestPermission] = useCameraPermissions();
  const [isFocused, setIsFocused] = useState<boolean>(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );
  const [caught, setCaught] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Victory Celebration Modal state
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [victoryStats, setVictoryStats] = useState<{
    xpGained: number;
    coinsGained: number;
    levelUp: boolean;
    newLevel: number;
    message: string;
  } | null>(null);

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
  const [showChallengeModal, setShowChallengeModal] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [challengeResult, setChallengeResult] = useState<'CORRECT' | 'WRONG' | null>(null);

  // Visual Positioning System (VPS) Engine
  const {
    anchor,
    projection: vps,
    mode: trackingMode,
    setMode: setTrackingMode,
    lockAnchorInFront,
    anchorToBearing,
    spawnRandomAnchorInRadar,
    reanchorAtScreenTap,
  } = useVPSTracker({ defaultDepthMeters: 2.5 });

  const [vpsTapBanner, setVpsTapBanner] = useState<string | null>(null);

  useEffect(() => {
    if (params.creature_lat && params.creature_lng && params.user_lat && params.user_lng) {
      const userCoords = { latitude: parseFloat(params.user_lat), longitude: parseFloat(params.user_lng) };
      const creatureCoords = { latitude: parseFloat(params.creature_lat), longitude: parseFloat(params.creature_lng) };
      
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const toDeg = (rad: number) => (rad * 180) / Math.PI;
      const dLng = toRad(creatureCoords.longitude - userCoords.longitude);
      const y = Math.sin(dLng) * Math.cos(toRad(creatureCoords.latitude));
      const x = Math.cos(toRad(userCoords.latitude)) * Math.sin(toRad(creatureCoords.latitude)) - Math.sin(toRad(userCoords.latitude)) * Math.cos(toRad(creatureCoords.latitude)) * Math.cos(dLng);
      const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
      
      const distance = params.distance ? parseFloat(params.distance) : 2.5;
      
      anchorToBearing(bearing, distance);
    } else {
      lockAnchorInFront(creatureName, rarity, 2.5);
    }
  }, [creatureName, rarity, params.creature_lat, params.creature_lng, params.user_lat, params.user_lng, params.distance, anchorToBearing, lockAnchorInFront]);

  const handleScreenTapToPlace = (event: any) => {
    if (challenge && !challengePassed) return;
    const { locationX, locationY } = event.nativeEvent;
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const tapX = (locationX / screenWidth) * 100;
    const tapY = (locationY / screenHeight) * 100;
    triggerHapticTap();
    reanchorAtScreenTap(tapX, tapY);
    setVpsTapBanner('📍 VPS ANCHOR GROUNDED');
    setTimeout(() => setVpsTapBanner(null), 2000);
  };

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
        setShowChallengeModal(false);
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

      setVictoryStats({
        xpGained: 2000,
        coinsGained: 100,
        levelUp: false,
        newLevel: user ? user.level : 1,
        message: raidRes.message || 'Legendary Anomaly neutralized with your CIT Strike Team!',
      });
      setShowVictoryModal(true);
    } catch (e) {
      setCaught(true);
      setShowRaidModal(false);
      setVictoryStats({
        xpGained: 2000,
        coinsGained: 100,
        levelUp: false,
        newLevel: user ? user.level : 1,
        message: `Boss ${creatureName} secured with your CIT Strike Team!`,
      });
      setShowVictoryModal(true);
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

      const totalXp = (result?.xp_gained || rarityConfig.xpReward) + (challenge ? challenge.bonusXp : 0);

      setVictoryStats({
        xpGained: totalXp,
        coinsGained: 25,
        levelUp: !!result?.level_up,
        newLevel: result?.new_level || (user ? user.level : 1),
        message: result?.message || `Successfully captured ${creatureName}!`,
      });
      setCaught(true);
      setShowVictoryModal(true);
    } catch (e: any) {
      console.warn('Capture error:', e);
      setVictoryStats({
        xpGained: rarityConfig.xpReward,
        coinsGained: 25,
        levelUp: false,
        newLevel: user ? user.level : 1,
        message: `Captured ${creatureName}! Added to Bestiary.`,
      });
      setCaught(true);
      setShowVictoryModal(true);
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
      {isFocused && permission?.granted ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={isScanningQr ? { barcodeTypes: ['qr'] } : undefined}
          onBarcodeScanned={isScanningQr ? handleBarcodeScanned : undefined}
        />
      ) : (
        <View style={[styles.camera, { backgroundColor: '#0B1329', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: 'rgba(56, 189, 248, 0.6)', fontWeight: 'bold' }}>⚡ OPTICAL AR SENSOR</Text>
        </View>
      )}

      {/* Surface Tap-to-Place Gesture Layer */}
      {!isScanningQr && (!challenge || challengePassed) && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleScreenTapToPlace}
        />
      )}

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

        {/* Temporary Tap Confirmation Toast */}
        {vpsTapBanner && (
          <View style={styles.vpsToastBanner} pointerEvents="none">
            <Text style={styles.vpsToastText}>{vpsTapBanner}</Text>
          </View>
        )}

        {/* VPS Debug Telemetry Overlay */}
        <View style={{ position: 'absolute', top: 120, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 4 }} pointerEvents="none">
          <Text style={{ color: 'lime', fontSize: 10, fontFamily: 'monospace' }}>
            VPS: {vps.status} (FPS: {vps.fps})
          </Text>
          <Text style={{ color: 'lime', fontSize: 10, fontFamily: 'monospace' }}>
            Yaw: {anchor?.refYaw?.toFixed(2)} vs {vps.offScreenAngleDeg}°
          </Text>
          <Text style={{ color: 'lime', fontSize: 10, fontFamily: 'monospace' }}>
            ScrX: {vps.screenXPercent?.toFixed(1)}% | ScrY: {vps.screenYPercent?.toFixed(1)}%
          </Text>
          <Text style={{ color: 'cyan', fontSize: 10, fontFamily: 'monospace' }}>
            AR FIX UNVERIFIED - needs on-device test
          </Text>
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
        ) : (
          /* Normal AR Reticle Target: 3D Holographic Model & "Tap to Catch" */
          <>
            {/* Optional Campus Trivia Challenge Modal for Bonus XP */}
            {challenge && (
              <Modal
                visible={showChallengeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowChallengeModal(false)}
              >
                <View style={styles.challengeOverlayWrapper}>
                  <ScrollView
                    style={styles.challengeScroll}
                    contentContainerStyle={styles.challengeCard}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    <View style={styles.challengeHeader}>
                      <Text style={styles.challengeEmoji}>{creatureEmoji}</Text>
                      <View style={styles.challengeHeaderTexts}>
                        <Text style={styles.challengeSubtitle} numberOfLines={1}>
                          {challenge.landmark} • {challenge.department}
                        </Text>
                        <Text style={[styles.challengeTitle, { color: rarityConfig.color }]} numberOfLines={2}>
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
                          Solve the trivia challenge to earn +{challenge.bonusXp} Bonus XP upon capture!
                        </Text>
                      </View>
                    )}

                    {/* Close button to return to 3D AR viewfinder */}
                    <TouchableOpacity
                      style={styles.bypassButton}
                      onPress={() => setShowChallengeModal(false)}
                    >
                      <Text style={styles.bypassButtonText}>✕ Return to 3D View</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </Modal>
            )}

            {/* Non-intrusive Floating Challenge Pill in AR view */}
            {challenge && !challengePassed && (
              <TouchableOpacity
                style={styles.floatingChallengePill}
                activeOpacity={0.85}
                onPress={() => setShowChallengeModal(true)}
              >
                <Text style={styles.floatingChallengePillText}>
                  🧠 Campus Trivia: {challenge.title} (+{challenge.bonusXp} XP Bonus) ➔
                </Text>
              </TouchableOpacity>
            )}


            {/* Off-Screen Directional Indicator when looking away from anchor */}
            {trackingMode === 'VPS' && !vps.inView && (
              <View
                style={[
                  styles.offScreenGuideContainer,
                  vps.offScreenDirection === 'left' && styles.offScreenGuideLeft,
                  vps.offScreenDirection === 'right' && styles.offScreenGuideRight,
                  vps.offScreenDirection === 'up' && styles.offScreenGuideUp,
                  vps.offScreenDirection === 'down' && styles.offScreenGuideDown,
                ]}
                pointerEvents="none"
              >
                <Text style={styles.offScreenGuideEmoji}>
                  {vps.offScreenDirection === 'left'
                    ? '⬅️'
                    : vps.offScreenDirection === 'right'
                    ? '➡️'
                    : vps.offScreenDirection === 'up'
                    ? '⬆️'
                    : '⬇️'}
                </Text>
                <Text style={styles.offScreenGuideLabel}>
                  TURN {vps.offScreenDirection.toUpperCase()} ({vps.angularDistanceDeg}°)
                </Text>
                <Text style={styles.offScreenGuideSubLabel}>OPTICAL TARGET LOCKED</Text>
              </View>
            )}

            <View
              style={[
                styles.centerTargetWrapper,
                trackingMode === 'VPS' && {
                  position: 'absolute',
                  width: 300,
                  height: 390,
                  left: `${vps.screenXPercent}%`,
                  top: `${vps.screenYPercent}%`,
                  transform: [
                    { translateX: -150 },
                    { translateY: -185 },
                    { scale: Math.max(0.85, Math.min(1.25, vps.scale)) },
                  ],
                  opacity: 1,
                },
              ]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={[styles.creatureCard, caught && styles.creatureCardCaught]}
                activeOpacity={0.85}
                onPress={handleCatchCreature}
                disabled={capturing}
              >
                {/* 3D Holographic Animated AR Model */}
                <ARCreatureModel
                  creatureName={creatureName}
                  rarity={rarity}
                  creatureEmoji={creatureEmoji}
                  isCapturing={capturing}
                  onPress={handleCatchCreature}
                />

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

                {capturing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={{ color: '#38BDF8', fontWeight: 'bold', fontSize: 13, marginLeft: 6 }}>
                      ⚡ CAPTURING ANOMALY...
                    </Text>
                  </View>
                )}
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

              {capturing ? (
                <View style={styles.captureStatusBanner}>
                  <ActivityIndicator size="small" color={rarityConfig.color} />
                  <Text style={[styles.captureStatusText, { color: rarityConfig.color }]}>
                    ⚡ DEPLOYING QUANTUM NANO-TRAP...
                  </Text>
                </View>
              ) : (
                <View style={styles.arHintPill}>
                  <Text style={styles.arHintText}>
                    👆 Touch the 3D anomaly onscreen to capture!
                  </Text>
                </View>
              )}
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

      {/* Victory Celebration Modal */}
      {showVictoryModal && victoryStats && (
        <Modal
          visible={showVictoryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowVictoryModal(false);
            router.back();
          }}
        >
          <View style={styles.victoryModalOverlay}>
            <View style={styles.victoryCard}>
              <View
                style={[
                  styles.victoryGlowBadge,
                  { borderColor: rarityConfig.color, shadowColor: rarityConfig.color },
                ]}
              >
                <Text style={styles.victoryEmoji}>{creatureEmoji}</Text>
              </View>

              <Text style={styles.victoryHeaderTitle}>🎉 ANOMALY SECURED!</Text>
              <Text style={styles.victoryCreatureName}>{creatureName}</Text>
              <View
                style={[
                  styles.victoryRarityBadge,
                  { backgroundColor: rarityConfig.bgColor, borderColor: rarityConfig.borderColor },
                ]}
              >
                <Text style={[styles.victoryRarityText, { color: rarityConfig.color }]}>
                  {rarityConfig.icon} {rarityConfig.label.toUpperCase()} CLASSIFICATION
                </Text>
              </View>

              {/* Reward Row */}
              <View style={styles.rewardRow}>
                <View style={styles.rewardBox}>
                  <Text style={styles.rewardValue}>+{victoryStats.xpGained}</Text>
                  <Text style={styles.rewardLabel}>EXPERIENCE</Text>
                </View>
                <View style={styles.rewardBox}>
                  <Text style={[styles.rewardValue, { color: '#38BDF8' }]}>
                    +{victoryStats.coinsGained} 💎
                  </Text>
                  <Text style={styles.rewardLabel}>DATA CREDITS</Text>
                </View>
              </View>

              {/* Level Up Banner */}
              {victoryStats.levelUp && (
                <View style={styles.levelUpBanner}>
                  <Text style={styles.levelUpText}>
                    🆙 PROMOTION! YOU ARE NOW LEVEL {victoryStats.newLevel}!
                  </Text>
                </View>
              )}

              <Text style={styles.victoryFlavorText}>{victoryStats.message}</Text>

              {/* Action Buttons */}
              <View style={styles.victoryActionRow}>
                <TouchableOpacity
                  style={[styles.victoryPrimaryBtn, { backgroundColor: rarityConfig.color }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowVictoryModal(false);
                    router.replace('/inventory');
                  }}
                >
                  <Text style={styles.victoryPrimaryBtnText}>📖 VIEW IN BESTIARY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.victorySecondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowVictoryModal(false);
                    router.back();
                  }}
                >
                  <Text style={styles.victorySecondaryBtnText}>🗺️ RETURN TO RADAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFill,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 13, 30, 0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 36,
    zIndex: 50,
  },
  challengeScroll: {
    width: '100%',
    maxHeight: '94%',
  },
  challengeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 18,
    paddingBottom: 28,
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
    padding: 6,
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
  tapToGroundHint: {
    color: 'rgba(56, 189, 248, 0.75)',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  floatingChallengePill: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 68 : 88,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    zIndex: 25,
  },
  floatingChallengePillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  /* VPS Mode Toggle & Telemetry Styles */
  vpsModeTogglePill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpsPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  gpsPillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#64748B',
  },
  vpsModeToggleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  vpsTelemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  vpsTelemetryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  vpsLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  vpsTelemetryText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  vpsRecalibrateMiniBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  vpsRecalibrateMiniText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  vpsToastBanner: {
    alignSelf: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    elevation: 8,
  },
  vpsToastText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  /* VPS Holographic SLAM Scanning Grid */
  vpsScannerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  vpsFeaturePoint: {
    position: 'absolute',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpsCrosshair: {
    color: 'rgba(34, 197, 94, 0.55)',
    fontSize: 14,
    fontWeight: 'bold',
  },
  vpsFloorGridLine1: {
    position: 'absolute',
    bottom: '22%',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  vpsFloorGridLine2: {
    position: 'absolute',
    bottom: '12%',
    left: '5%',
    right: '5%',
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
  /* Off-Screen Target Direction Guide */
  offScreenGuideContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 8,
  },
  offScreenGuideLeft: {
    left: 12,
    top: '46%',
  },
  offScreenGuideRight: {
    right: 12,
    top: '46%',
  },
  offScreenGuideUp: {
    top: 80,
    alignSelf: 'center',
  },
  offScreenGuideDown: {
    bottom: 110,
    alignSelf: 'center',
  },
  offScreenGuideEmoji: {
    fontSize: 16,
    marginBottom: 1,
  },
  offScreenGuideLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  offScreenGuideSubLabel: {
    color: '#94A3B8',
    fontSize: 7,
    fontWeight: 'bold',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  captureStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginBottom: 8,
    gap: 8,
  },
  captureStatusText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  arHintPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    marginBottom: 8,
  },
  arHintText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  victoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 25, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  victoryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(56, 189, 248, 0.35)',
    elevation: 16,
  },
  victoryGlowBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
    elevation: 8,
  },
  victoryEmoji: {
    fontSize: 48,
  },
  victoryHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 0.8,
    marginTop: 14,
  },
  victoryCreatureName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  victoryRarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 16,
  },
  victoryRarityText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 14,
  },
  rewardBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22C55E',
  },
  rewardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  levelUpBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: '#EAB308',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  levelUpText: {
    color: '#FDE047',
    fontWeight: '900',
    fontSize: 12,
  },
  victoryFlavorText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  victoryActionRow: {
    width: '100%',
    gap: 10,
  },
  victoryPrimaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
    elevation: 4,
  },
  victoryPrimaryBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  victorySecondaryBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#475569',
  },
  victorySecondaryBtnText: {
    color: '#F1F5F9',
    fontWeight: '800',
    fontSize: 13,
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
