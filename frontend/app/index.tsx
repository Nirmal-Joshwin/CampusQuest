import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  calculateDistancesToSpawns,
  calculateHaversineDistance,
  calculateBearing,
  calculateRelativeAngle,
  calculateARProjection,
  formatDistance,
  getRarityConfig,
  getCreatureEmoji,
  SpawnPoint,
  SpawnWithDistance,
} from '../utils/haversine';
import {
  fetchSpawns,
  fetchLootCratesApi,
  claimLootCrateApi,
  fetchBestiary,
  LootCrateItem,
} from '../utils/api';
import { fetchActivePeersApi, PeerCadet } from '../utils/multiplayer';
import { fetchFriendsApi, FriendItem } from '../utils/friends';
import { fetchStrongholdsApi, CampusStronghold } from '../utils/turf';
import DuelModal from '../components/DuelModal';
import StrongholdModal from '../components/StrongholdModal';
import InteractiveLeafletMap from '../components/InteractiveLeafletMap';
import { useAuth } from '../context/AuthContext';
import { useVPSTracker } from '../utils/vps';
import { triggerHapticTap, triggerHapticImpact, triggerHapticSuccess, triggerHapticWarning } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCoinSound } from '../utils/sound';

const CIT_CENTER = {
  latitude: 11.0272,
  longitude: 77.0274,
};

const CATCH_PROXIMITY_THRESHOLD_METERS = 35;

export default function ARMainScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const smoothedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Primary View Mode: MAP (OpenStreetMap) vs AR (Camera Viewport)
  const [activeView, setActiveView] = useState<'MAP' | 'AR'>('MAP');

  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [devicePitch, setDevicePitch] = useState<number>(0);

  // VPS Tracker
  const {
    anchor: vpsAnchor,
    projection: vpsProjection,
    mode: trackingMode,
    setMode: setTrackingMode,
    lockAnchorInFront,
    anchorToBearing,
  } = useVPSTracker({ defaultDepthMeters: 2.5, externalHeading: heading });

  // Camera Focus
  const [isFocused, setIsFocused] = useState<boolean>(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [spawns, setSpawns] = useState<SpawnPoint[]>([]);
  const [sortedSpawns, setSortedSpawns] = useState<SpawnWithDistance[]>([]);
  const [lootCrates, setLootCrates] = useState<LootCrateItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [peers, setPeers] = useState<PeerCadet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [strongholds, setStrongholds] = useState<CampusStronghold[]>([]);
  const [selectedStronghold, setSelectedStronghold] = useState<CampusStronghold | null>(null);
  const [showStrongholdModal, setShowStrongholdModal] = useState<boolean>(false);

  const [duelTarget, setDuelTarget] = useState<FriendItem | null>(null);
  const [showDuelModal, setShowDuelModal] = useState<boolean>(false);

  const currentCoords = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : { latitude: CIT_CENTER.latitude, longitude: CIT_CENTER.longitude };

  const activeSpawns: SpawnWithDistance[] =
    sortedSpawns.length > 0
      ? sortedSpawns
      : spawns.map((s) => ({
          ...s,
          distanceMeters: location
            ? calculateHaversineDistance(
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: s.latitude, longitude: s.longitude }
              )
            : 999,
          isWithinCatchRange: false,
        }));

  const closestSpawn = activeSpawns.length > 0 ? activeSpawns[0] : null;

  // Load Game Data
  const loadGameData = async (userCoords?: { latitude: number; longitude: number } | null) => {
    try {
      const activeCoords = userCoords || (location ? { latitude: location.latitude, longitude: location.longitude } : null);
      const [spawnData, lootData, bestiaryData, peersData, friendsData, strongholdsData] = await Promise.all([
        fetchSpawns(11, activeCoords),
        fetchLootCratesApi(),
        fetchBestiary(token),
        fetchActivePeersApi(),
        fetchFriendsApi(token),
        fetchStrongholdsApi(),
      ]);

      const capturedNames = new Set(
        bestiaryData.entries.filter((e) => e.discovered).map((e) => e.creature_name)
      );

      // HomeSentinel indoor testing anchor
      const processedSpawns = spawnData.map((s) => {
        if (s.name === 'HomeSentinel' && activeCoords) {
          return {
            ...s,
            latitude: Number((activeCoords.latitude + 0.00006).toFixed(6)),
            longitude: Number((activeCoords.longitude + 0.00005).toFixed(6)),
          };
        }
        return s;
      });

      const uncollectedSpawns = processedSpawns.filter((s) => !capturedNames.has(s.name));

      setSpawns(uncollectedSpawns);
      setLootCrates(lootData);
      setPeers(peersData);
      setFriends(friendsData);
      setStrongholds(strongholdsData);
    } catch (err) {
      console.error('Error loading game data:', err);
    } finally {
      setLoading(false);
    }
  };

  // GPS & Heading Listeners
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoading(false);
          loadGameData(CIT_CENTER);
          return;
        }

        try {
          const initialLoc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
          ]);
          if (initialLoc) {
            setLocation(initialLoc.coords);
            loadGameData(initialLoc.coords);
          } else {
            const lastLoc = await Location.getLastKnownPositionAsync();
            if (lastLoc) {
              setLocation(lastLoc.coords);
              loadGameData(lastLoc.coords);
            } else {
              const defaultCoords = {
                latitude: CIT_CENTER.latitude,
                longitude: CIT_CENTER.longitude,
                altitude: null,
                accuracy: 5,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              };
              setLocation(defaultCoords);
              loadGameData(defaultCoords);
            }
          }
        } catch (e) {
          const defaultCoords = {
            latitude: CIT_CENTER.latitude,
            longitude: CIT_CENTER.longitude,
            altitude: null,
            accuracy: 5,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          };
          setLocation(defaultCoords);
          loadGameData(defaultCoords);
        }

        let lastHeadingVal = 0;
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 1200, distanceInterval: 1 },
          (newLocation) => {
            const raw = newLocation.coords;
            // Ignore inaccurate noise bursts (> 35m uncertainty) when an accurate position is already tracked
            if (raw.accuracy && raw.accuracy > 35 && smoothedCoordsRef.current) return;

            if (!smoothedCoordsRef.current) {
              smoothedCoordsRef.current = { latitude: raw.latitude, longitude: raw.longitude };
              setLocation(raw);
            } else {
              const alpha = 0.25; // Smooth exponential moving average
              const smoothLat = smoothedCoordsRef.current.latitude + alpha * (raw.latitude - smoothedCoordsRef.current.latitude);
              const smoothLng = smoothedCoordsRef.current.longitude + alpha * (raw.longitude - smoothedCoordsRef.current.longitude);
              smoothedCoordsRef.current = { latitude: smoothLat, longitude: smoothLng };
              setLocation({
                ...raw,
                latitude: Number(smoothLat.toFixed(6)),
                longitude: Number(smoothLng.toFixed(6)),
              });
            }
          }
        );

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          const val = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
          if (val >= 0) {
            let diff = val - lastHeadingVal;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            // Deadband filter: ignore microscopic jitter < 1.2 deg
            if (Math.abs(diff) > 1.2) {
              const smoothed = (lastHeadingVal + diff * 0.22 + 360) % 360;
              lastHeadingVal = smoothed;
              setHeading(smoothed);
            }
          }
        });
      } catch (e) {
        console.warn('GPS setup error:', e);
        loadGameData(CIT_CENTER);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  // Device Pitch (Tilt) Listener for AR Perspective
  useEffect(() => {
    let accelSub: any = null;
    (async () => {
      const avail = await Accelerometer.isAvailableAsync().catch(() => false);
      if (avail) {
        Accelerometer.setUpdateInterval(32);
        accelSub = Accelerometer.addListener((data) => {
          // In portrait: positive = tilted down towards ground, negative = tilted up towards sky
          const pitchRad = Math.atan2(-data.z, -data.y);
          const pitchDeg = Math.round((pitchRad * 180) / Math.PI);
          setDevicePitch(pitchDeg);
        });
      }
    })();
    return () => {
      if (accelSub) accelSub.remove();
    };
  }, []);

  // Auto-sync VPS anchor with closest target when in VPS mode and viewing AR
  useEffect(() => {
    if (closestSpawn && trackingMode === 'VPS' && activeView === 'AR') {
      const bearing = calculateBearing(currentCoords, {
        latitude: closestSpawn.latitude,
        longitude: closestSpawn.longitude,
      });
      anchorToBearing(bearing, Math.max(2.5, Math.min(15, closestSpawn.distanceMeters)));
    }
  }, [closestSpawn?.id, trackingMode, activeView, anchorToBearing]);

  // Update distance sorting
  useEffect(() => {
    if (location && spawns.length > 0) {
      const computed = calculateDistancesToSpawns(
        { latitude: location.latitude, longitude: location.longitude },
        spawns
      );
      setSortedSpawns(computed);
    }
  }, [location, spawns]);

  // Handle Encounter - Strictly Enforces Radar Distance
  const handleTriggerCatch = (spawnToCatch: SpawnWithDistance | SpawnPoint) => {
    const dist = (spawnToCatch as SpawnWithDistance).distanceMeters ||
      calculateHaversineDistance(currentCoords, { latitude: spawnToCatch.latitude, longitude: spawnToCatch.longitude });

    if (dist > CATCH_PROXIMITY_THRESHOLD_METERS) {
      triggerHapticWarning();
      Alert.alert(
        '📡 Target Outside Radar',
        `${spawnToCatch.name} is ${formatDistance(dist)} away.\n\nRadar Catch Distance is 35m. Walk within radar range to engage in AR!`,
        [{ text: 'Understood' }]
      );
      return;
    }

    triggerHapticImpact('heavy');
    playSwooshSound();
    router.push({
      pathname: '/catch',
      params: {
        id: spawnToCatch.id,
        name: spawnToCatch.name,
        rarity: spawnToCatch.rarity || 'COMMON',
        distance: Math.round(dist).toString(),
      },
    });
  };

  // Handle Loot Crate Claim
  const handleClaimLoot = async (crate: LootCrateItem) => {
    const dist = location
      ? calculateHaversineDistance(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: crate.latitude, longitude: crate.longitude }
        )
      : 999;

    if (dist > CATCH_PROXIMITY_THRESHOLD_METERS) {
      triggerHapticWarning();
      Alert.alert(
        `🧰 ${crate.name}`,
        `Sector: ${crate.campus_sector}\nWalk within 25m to unlock! (Currently ${formatDistance(dist)})`
      );
      return;
    }

    try {
      const res = await claimLootCrateApi(crate.id, token);
      if (user) updateProfile({});
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('🎁 Cache Unlocked!', `${res.message}`);
      loadGameData();
    } catch (e) {
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('🎁 Cache Collected!', `Claimed ${crate.reward_amount} ${crate.reward_type}!`);
      loadGameData();
    }
  };

  // 1-Tap Indoor Test Anchor - Generates at random bearing within 25m Radar Boundary
  const handleAnchorHomeTarget = () => {
    const coords = location || CIT_CENTER;
    triggerHapticImpact('medium');
    playTapSound();

    // Spawns within radar range (8-12m away, offset by 25° to 55° from heading)
    const randomOffsetDeg = (Math.random() > 0.5 ? 1 : -1) * (25 + Math.random() * 30);
    const radHeading = ((heading + randomOffsetDeg) * Math.PI) / 180;
    const distanceMeters = 8 + Math.random() * 4; // 8m - 12m (within 25m radar!)
    const distanceOffsetKm = (distanceMeters / 1000) / 6371;

    const targetLat = coords.latitude + (distanceOffsetKm * Math.cos(radHeading) * 180) / Math.PI;
    const targetLng =
      coords.longitude +
      (distanceOffsetKm * Math.sin(radHeading) * 180) /
        (Math.PI * Math.cos((coords.latitude * Math.PI) / 180));

    const homeSentinel: SpawnPoint = {
      id: 'home-sentinel-test',
      name: 'HomeSentinel',
      rarity: 'EPIC',
      latitude: Number(targetLat.toFixed(6)),
      longitude: Number(targetLng.toFixed(6)),
    };

    setSpawns((prev) => [homeSentinel, ...prev.filter((s) => s.name !== 'HomeSentinel')]);

    Alert.alert(
      '🎯 Indoor Target Synced!',
      `HomeSentinel (Epic Anomaly) generated ${Math.round(distanceMeters)}m away in your radar! Turn toward it to capture in AR.`
    );
  };

  // AR Projection for Spawns
  const arSpawns = activeSpawns.map((s) => {
    if (
      trackingMode === 'VPS' &&
      vpsAnchor &&
      closestSpawn &&
      s.id === closestSpawn.id &&
      s.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS
    ) {
      return {
        ...s,
        ar: {
          inView: vpsProjection.inView,
          screenXPercent: vpsProjection.screenXPercent,
          screenYPercent: vpsProjection.screenYPercent,
          scale: vpsProjection.scale,
          distanceMeters: s.distanceMeters,
          direction: (vpsProjection.offScreenDirection === 'none'
            ? 'in_front'
            : vpsProjection.offScreenDirection) as any,
          relativeAngle: vpsProjection.angularDistanceDeg,
        },
      };
    }
    return {
      ...s,
      ar: calculateARProjection(
        currentCoords,
        { latitude: s.latitude, longitude: s.longitude },
        heading,
        devicePitch
      ),
    };
  });

  const visibleProximitySpawns = arSpawns
    .filter((item) => item.ar.inView && item.distanceMeters <= 35)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 1);

  // Proximity Target Off-Screen Direction Guide
  const closestTargetProjection = arSpawns.find(
    (item) => closestSpawn && item.id === closestSpawn.id && item.distanceMeters <= 35
  );
  const isClosestOffScreen = closestTargetProjection && !closestTargetProjection.ar.inView;

  // Directional guidance for nearest target in AR
  const closestAngle = closestSpawn
    ? calculateRelativeAngle(
        calculateBearing(currentCoords, { latitude: closestSpawn.latitude, longitude: closestSpawn.longitude }),
        heading
      )
    : 0;

  let turnHint = 'Ahead';
  let turnArrow = '⬆️';
  if (closestAngle < -45 && closestAngle >= -135) {
    turnHint = 'Turn Left';
    turnArrow = '⬅️';
  } else if (closestAngle > 45 && closestAngle <= 135) {
    turnHint = 'Turn Right';
    turnArrow = '➡️';
  } else if (Math.abs(closestAngle) > 135) {
    turnHint = 'Turn Around';
    turnArrow = '⬇️';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Syncing OpenStreetMap & CIT Satellites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ------------------------------------------------------------------ */}
      {/* VIEWPORT LAYER: OPENSTREETMAP (Full Screen) OR AR CAMERA VIEWPORT  */}
      {/* ------------------------------------------------------------------ */}
      {activeView === 'MAP' ? (
        <View style={StyleSheet.absoluteFill}>
          <InteractiveLeafletMap
            center={currentCoords}
            userLocation={location ? currentCoords : null}
            heading={heading}
            spawns={activeSpawns}
            lootCrates={lootCrates}
            strongholds={strongholds}
            peers={peers}
            friends={friends}
            onSelectSpawn={(spawn) => {
              handleTriggerCatch(spawn);
            }}
            onSelectLoot={(crate) => {
              handleClaimLoot(crate);
            }}
            onSelectStronghold={(sh) => {
              setSelectedStronghold(sh);
              setShowStrongholdModal(true);
            }}
            onSelectPeer={(peer) => {
              setDuelTarget({
                id: (peer as any).user_id || (peer as any).id,
                friend_id: (peer as any).user_id || (peer as any).id,
                username: peer.username,
                department: peer.department,
                level: peer.level,
                avatar_title: (peer as any).avatar_title || 'Cadet',
                status: 'ACCEPTED',
                is_online: true,
                campus_sector: 'CIT Campus Quad',
                latitude: peer.latitude || CIT_CENTER.latitude,
                longitude: peer.longitude || CIT_CENTER.longitude,
              });
              setShowDuelModal(true);
            }}
          />
        </View>
      ) : (
        /* AR CAMERA VIEWPORT */
        <View style={StyleSheet.absoluteFill}>
          {isFocused && cameraPermission?.granted ? (
            <CameraView style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <View style={styles.simulatedCameraBg}>
              <Text style={styles.simulatedCameraText}>⚡ CYBER AR OPTICAL SENSOR</Text>
              {!cameraPermission?.granted && (
                <TouchableOpacity style={styles.inlineEnableBtn} onPress={requestCameraPermission}>
                  <Text style={styles.inlineEnableBtnText}>📷 Grant Camera Access</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* AR Holographic Reticle */}
          <View style={styles.centerReticleWrapper} pointerEvents="none">
            <View style={styles.reticleCrosshairH} />
            <View style={styles.reticleCrosshairV} />
            <View style={styles.reticleRing} />
          </View>

          {/* Proximity AR Anomaly Node (Interactive Hologram in Room / Field) */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {visibleProximitySpawns.map((spawn) => {
              const isNearby = spawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;
              const rConfig = getRarityConfig(spawn.rarity);
              const emoji = getCreatureEmoji(spawn.name);

              return (
                <TouchableOpacity
                  key={spawn.id}
                  style={[
                    styles.arNodeCard,
                    {
                      left: `${spawn.ar.screenXPercent}%`,
                      top: `${spawn.ar.screenYPercent}%`,
                      transform: [
                        { translateX: -80 },
                        { translateY: -22 },
                        { scale: spawn.ar.scale },
                      ],
                      borderColor: isNearby ? '#22C55E' : rConfig.borderColor,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleTriggerCatch(spawn)}
                >
                  <View style={[styles.arNodeGlow, { backgroundColor: rConfig.bgColor }]}>
                    <Text style={styles.arNodeEmoji}>{emoji}</Text>
                  </View>
                  <View style={styles.arNodeBadge}>
                    <Text style={styles.arNodeName}>{spawn.name}</Text>
                    <Text style={[styles.arNodeDist, isNearby && styles.arNodeDistNearby]}>
                      {formatDistance(spawn.distanceMeters)} • {isNearby ? '⚡ CATCH NOW!' : 'Approach Target'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Off-screen direction guide arrow if nearest target is not currently in lens view */}
            {isClosestOffScreen && closestTargetProjection && (
              <View
                style={[
                  styles.arEdgeGuide,
                  closestTargetProjection.ar.relativeAngle < 0 ? styles.arEdgeGuideLeft : styles.arEdgeGuideRight,
                ]}
                pointerEvents="none"
              >
                <Text style={styles.arEdgeGuideText}>
                  {closestTargetProjection.ar.relativeAngle < 0
                    ? `◀ TURN LEFT (${Math.abs(closestTargetProjection.ar.relativeAngle)}°)`
                    : `TURN RIGHT (${Math.abs(closestTargetProjection.ar.relativeAngle)}°) ▶`}
                </Text>
                <Text style={styles.arEdgeGuideSub}>
                  {closestSpawn?.name} ({formatDistance(closestSpawn?.distanceMeters || 0)})
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TOP GAMIFIED HUD: PLAYER LEVEL, HP, VPS BADGE, AND QUICK ACTIONS  */}
      {/* ------------------------------------------------------------------ */}
      <SafeAreaView style={styles.topHudContainer} pointerEvents="box-none">
        <View style={styles.topHudBar}>
          {/* Cadet Profile & Energy Status */}
          <TouchableOpacity
            style={styles.playerBadge}
            activeOpacity={0.85}
            onPress={() => (user ? router.push('/profile') : router.push('/login'))}
          >
            <Text style={styles.playerAvatarIcon}>{user?.role === 'ADMIN' ? '🛡️' : '👨‍💻'}</Text>
            <View>
              <Text style={styles.playerNameText} numberOfLines={1}>
                {user?.username || 'CIT Cadet'}
              </Text>
              <Text style={styles.playerLevelText}>LVL {user?.level || 1} • {user?.department || 'CSE'}</Text>
            </View>
          </TouchableOpacity>

          {/* Quick HUD Metrics */}
          <View style={styles.hudPillsCluster}>
            <View style={styles.energyPill}>
              <Text style={styles.energyPillText}>⚡ {user?.energy || 100} HP</Text>
            </View>
            <TouchableOpacity
              style={styles.coinsPill}
              onPress={() => router.push('/shop')}
              activeOpacity={0.8}
            >
              <Text style={styles.coinsPillText}>💎 {user?.coins || 0}</Text>
            </TouchableOpacity>
          </View>

          {/* Action Cluster (Recenter / Bag / Shop) */}
          <View style={styles.topIconsCluster}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#0284C7' }]}
              onPress={handleAnchorHomeTarget}
            >
              <Text style={styles.iconBtnText}>🎯</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/inventory')}>
              <Text style={styles.iconBtnText}>🎒</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/shop')}>
              <Text style={styles.iconBtnText}>🏪</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/friends')}>
              <Text style={styles.iconBtnText}>👥</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Nearest Target Guidance Strip (in AR mode) */}
        {activeView === 'AR' && closestSpawn && (
          <View style={styles.targetBanner}>
            <Text style={styles.targetBannerText}>
              📡 Nearest: <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{closestSpawn.name}</Text> ({formatDistance(closestSpawn.distanceMeters)}) • {turnArrow} {turnHint}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM GAMIFIED SWITCHER: [ 🗺️ CAMPUS MAP ] <---> [ 📷 AR CAMERA ] */}
      {/* ------------------------------------------------------------------ */}
      <SafeAreaView style={styles.bottomHudContainer} pointerEvents="box-none">
        {/* Radar In-Range Proximity Anomaly Engagement Banner */}
        {closestSpawn && closestSpawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS && (
          <TouchableOpacity
            style={styles.engageProminentBtn}
            activeOpacity={0.85}
            onPress={() => handleTriggerCatch(closestSpawn)}
          >
            <Text style={styles.engageProminentIcon}>⚡</Text>
            <Text style={styles.engageProminentText}>
              RADAR ENGAGE: {closestSpawn.name.toUpperCase()} ({formatDistance(closestSpawn.distanceMeters)}) ➔
            </Text>
          </TouchableOpacity>
        )}

        {/* Gamified View Switcher Pill */}
        <View style={styles.navSwitcherPill}>
          <TouchableOpacity
            style={[styles.navSegment, activeView === 'MAP' && styles.navSegmentActive]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHapticTap();
              setActiveView('MAP');
            }}
          >
            <Text style={styles.navSegmentEmoji}>🗺️</Text>
            <Text style={[styles.navSegmentText, activeView === 'MAP' && styles.navSegmentTextActive]}>
              OPENSTREETMAP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navSegment, activeView === 'AR' && styles.navSegmentActive]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHapticTap();
              setActiveView('AR');
            }}
          >
            <Text style={styles.navSegmentEmoji}>📷</Text>
            <Text style={[styles.navSegmentText, activeView === 'AR' && styles.navSegmentTextActive]}>
              AR HUNT
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ------------------------------------------------------------------ */}
      {/* MODALS: TERRITORY STRONGHOLD & PVP DUEL                            */}
      {/* ------------------------------------------------------------------ */}
      {selectedStronghold && (
        <StrongholdModal
          visible={showStrongholdModal}
          stronghold={selectedStronghold}
          token={token}
          userDepartment={user?.department || 'CSE'}
          onClose={() => {
            setShowStrongholdModal(false);
            setSelectedStronghold(null);
          }}
          onDefended={loadGameData}
        />
      )}

      {duelTarget && (
        <DuelModal
          visible={showDuelModal}
          opponentId={duelTarget.friend_id || duelTarget.id}
          opponentName={duelTarget.username}
          opponentDepartment={duelTarget.department || 'CSE'}
          token={token}
          onClose={() => {
            setShowDuelModal(false);
            setDuelTarget(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
  },
  simulatedCameraBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#090E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatedCameraText: {
    color: 'rgba(56, 189, 248, 0.65)',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  inlineEnableBtn: {
    marginTop: 12,
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  inlineEnableBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },

  /* Reticle */
  centerReticleWrapper: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCrosshairH: {
    position: 'absolute',
    width: 16,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.7)',
  },
  reticleCrosshairV: {
    position: 'absolute',
    height: 16,
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.7)',
  },
  reticleRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderStyle: 'dashed',
  },

  /* Proximity Node */
  arNodeCard: {
    position: 'absolute',
    width: 160,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 14,
    padding: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  arEdgeGuide: {
    position: 'absolute',
    top: '46%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  arEdgeGuideLeft: {
    left: 12,
  },
  arEdgeGuideRight: {
    right: 12,
  },
  arEdgeGuideText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arEdgeGuideSub: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  arNodeGlow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  arNodeEmoji: {
    fontSize: 16,
  },
  arNodeBadge: {
    flexDirection: 'column',
  },
  arNodeName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  arNodeDist: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  arNodeDistNearby: {
    color: '#22C55E',
    fontWeight: '800',
  },

  /* Top HUD */
  topHudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  topHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.45)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  playerAvatarIcon: {
    fontSize: 18,
  },
  playerNameText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  playerLevelText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: 'bold',
  },
  hudPillsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energyPill: {
    backgroundColor: '#1E293B',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  energyPillText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
  },
  coinsPill: {
    backgroundColor: '#1E293B',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  coinsPillText: {
    color: '#FDE047',
    fontSize: 9,
    fontWeight: '800',
  },
  trackingPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  vpsActivePill: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22C55E',
  },
  gpsActivePill: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#38BDF8',
  },
  trackingPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  topIconsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconBtnText: {
    fontSize: 13,
  },

  /* Target Direction Banner */
  targetBanner: {
    marginTop: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  targetBannerText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Bottom Controls & Navigation */
  bottomHudContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 8,
  },
  engageProminentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.45)',
    gap: 6,
    width: '90%',
    justifyContent: 'center',
  },
  engageProminentIcon: {
    fontSize: 15,
  },
  engageProminentText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  navSwitcherPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1.2,
    borderColor: '#0284C7',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    width: '78%',
    justifyContent: 'space-between',
  },
  navSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 17,
    gap: 5,
  },
  navSegmentActive: {
    backgroundColor: '#0284C7',
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)',
  },
  navSegmentEmoji: {
    fontSize: 13,
  },
  navSegmentText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  navSegmentTextActive: {
    color: '#FFFFFF',
  },
});
