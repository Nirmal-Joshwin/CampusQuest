import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  calculateDistancesToSpawns,
  calculateHaversineDistance,
  calculateARProjection,
  formatDistance,
  getRarityConfig,
  getCreatureEmoji,
  SpawnPoint,
  SpawnWithDistance,
} from '../utils/haversine';
import { fetchSpawns, fetchLootCratesApi, claimLootCrateApi, LootCrateItem } from '../utils/api';
import { fetchFriendsApi, FriendItem } from '../utils/friends';
import { fetchStrongholdsApi, CampusStronghold } from '../utils/turf';
import { useAuth } from '../context/AuthContext';

const CIT_CENTER = {
  latitude: 11.0275,
  longitude: 77.0275,
};

const CATCH_PROXIMITY_THRESHOLD_METERS = 35;

export default function WebARMainScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 11.0270,
    longitude: 77.0270,
  });
  const [heading, setHeading] = useState<number>(0);
  const [hasWebCam, setHasWebCam] = useState<boolean>(false);

  const [spawns, setSpawns] = useState<SpawnPoint[]>([]);
  const [sortedSpawns, setSortedSpawns] = useState<SpawnWithDistance[]>([]);
  const [lootCrates, setLootCrates] = useState<LootCrateItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [strongholds, setStrongholds] = useState<CampusStronghold[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  const activeSpawns: SpawnWithDistance[] =
    sortedSpawns.length > 0
      ? sortedSpawns
      : spawns.map((s) => ({
          ...s,
          distanceMeters: calculateHaversineDistance(userCoords, { latitude: s.latitude, longitude: s.longitude }),
          isWithinCatchRange: false,
        }));

  const loadGameData = async () => {
    try {
      setLoading(true);
      const [spawnData, lootData, friendsData, strongholdsData] = await Promise.all([
        fetchSpawns(10),
        fetchLootCratesApi(),
        fetchFriendsApi(token),
        fetchStrongholdsApi(),
      ]);
      setSpawns(spawnData);
      setLootCrates(lootData);
      setFriends(friendsData);
      setStrongholds(strongholdsData);
    } catch (err) {
      console.error('Error loading game data on web:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setHasWebCam(true);
          }
        })
        .catch(() => setHasWebCam(false));
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (lat >= 11.0 && lat <= 11.1 && lng >= 77.0 && lng <= 77.1) {
            setUserCoords({ latitude: lat, longitude: lng });
          }
        },
        () => {}
      );
    }

    loadGameData();
  }, []);

  useEffect(() => {
    if (userCoords && spawns.length > 0) {
      const computed = calculateDistancesToSpawns(userCoords, spawns);
      setSortedSpawns(computed);
    }
  }, [userCoords, spawns]);

  const arSpawns = activeSpawns.map((s) => ({
    ...s,
    ar: calculateARProjection(userCoords, { latitude: s.latitude, longitude: s.longitude }, heading),
  }));

  const visibleInViewSpawns = arSpawns
    .filter((item) => item.ar.inView && item.distanceMeters <= 90)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 2);

  const leftOutEntities = arSpawns
    .filter((item) => !item.ar.inView && item.ar.direction === 'left')
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const rightOutEntities = arSpawns
    .filter((item) => !item.ar.inView && item.ar.direction === 'right')
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const handleRotateCompass = (deltaDeg: number) => {
    setHeading((prev) => (prev + deltaDeg + 360) % 360);
  };

  const handleSimulateWalkToSpawn = (spawn: SpawnPoint) => {
    setUserCoords({
      latitude: spawn.latitude - 0.00003,
      longitude: spawn.longitude - 0.00003,
    });
  };

  const handleTriggerCatch = (spawnToCatch: SpawnWithDistance) => {
    if (spawnToCatch.distanceMeters > CATCH_PROXIMITY_THRESHOLD_METERS) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(
          `📡 Target Outside Radar\n\n${spawnToCatch.name} is ${formatDistance(spawnToCatch.distanceMeters)} away.\n\nRadar Catch Distance is 35m. Walk within radar range to engage in AR!`
        );
      }
      return;
    }

    router.push({
      pathname: '/catch',
      params: {
        id: spawnToCatch.id,
        name: spawnToCatch.name,
        rarity: spawnToCatch.rarity || 'COMMON',
        distance: Math.round(spawnToCatch.distanceMeters).toString(),
      },
    });
  };

  const handleClaimLoot = async (crate: LootCrateItem) => {
    const dist = calculateHaversineDistance(userCoords, { latitude: crate.latitude, longitude: crate.longitude });
    if (dist > CATCH_PROXIMITY_THRESHOLD_METERS) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`🧰 ${crate.name}\nWalk within 15m to harvest cache! (Currently ${formatDistance(dist)})`);
      }
      return;
    }
    try {
      const res = await claimLootCrateApi(crate.id, token);
      if (user) updateProfile({});
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`🎁 Cache Unlocked!\n${res.message}`);
      }
      loadGameData();
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`🎁 Cache Collected!\nClaimed ${crate.reward_amount} ${crate.reward_type}!`);
      }
      loadGameData();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Loading Campus AR Radar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasWebCam ? (
        <video
          ref={videoRef as any}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          autoPlay
          playsInline
          muted
        />
      ) : (
        <View style={styles.simulatedBg}>
          <Text style={styles.simulatedText}>⚡ CYBER AR VISION SENSOR (WEB SIMULATOR)</Text>
        </View>
      )}

      {/* CLEAN UNCLUTTERED AR FLOATING NODES */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {visibleInViewSpawns.map((spawn, index) => {
          const isNearby = spawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;
          const rConfig = getRarityConfig(spawn.rarity);
          const emoji = getCreatureEmoji(spawn.name);
          const topOffsetPercent = spawn.ar.screenYPercent + index * 12;

          return (
            <div
              key={spawn.id}
              style={{
                position: 'absolute',
                left: `${spawn.ar.screenXPercent}%`,
                top: `${topOffsetPercent}%`,
                transform: `scale(${spawn.ar.scale}) translate(-50%, -50%)`,
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                borderRadius: '14px',
                padding: '8px 12px',
                border: `2px solid ${isNearby ? '#22C55E' : rConfig.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.4)',
                zIndex: 100,
              }}
              onClick={() => {
                if (isNearby) handleTriggerCatch(spawn);
                else handleSimulateWalkToSpawn(spawn);
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  backgroundColor: rConfig.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                {emoji}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: '13px' }}>{spawn.name}</span>
                <span style={{ color: isNearby ? '#22C55E' : '#38BDF8', fontSize: '10px', fontWeight: '600' }}>
                  {formatDistance(spawn.distanceMeters)} {isNearby ? '⚡ CATCH!' : '• Click to Walk'}
                </span>
              </div>
            </div>
          );
        })}
      </View>

      {/* COMPACT DIRECTIONAL RADAR EDGE BADGES */}
      {leftOutEntities.length > 0 && (
        <View style={styles.edgeLeft}>
          <Text style={styles.edgeText}>⬅️ {leftOutEntities[0].name} ({formatDistance(leftOutEntities[0].distanceMeters)})</Text>
        </View>
      )}

      {rightOutEntities.length > 0 && (
        <View style={styles.edgeRight}>
          <Text style={styles.edgeText}>{rightOutEntities[0].name} ({formatDistance(rightOutEntities[0].distanceMeters)}) ➡️</Text>
        </View>
      )}

      {/* CENTER RETICLE */}
      <View style={styles.reticleWrapper} pointerEvents="none">
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />
        <View style={styles.outerRing} />
      </View>

      {/* TOP COMPASS HUD */}
      <View style={styles.topHud}>
        <View style={styles.compassRibbon}>
          <TouchableOpacity onPress={() => handleRotateCompass(-30)} style={styles.rotateBtn}>
            <Text style={styles.rotateBtnText}>↺ Rotate Left (-30°)</Text>
          </TouchableOpacity>

          <Text style={styles.compassTitle}>🧭 HEADING: {Math.round(heading)}°</Text>

          <TouchableOpacity onPress={() => handleRotateCompass(30)} style={styles.rotateBtn}>
            <Text style={styles.rotateBtnText}>Rotate Right (+30°) ↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* INSET MINI MAP */}
      <View style={styles.miniMapWrapper}>
        <View style={styles.miniHeader}>
          <Text style={styles.miniMapTitle}>📍 CIT MINI MAP</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setIsMapExpanded(true)}>
            <Text style={styles.expandBtnText}>⤢ FULL MAP</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.miniCanvas}>
          <View style={styles.radarCenterUser} />
          {activeSpawns.map((spawn) => {
            const minLat = 11.025;
            const maxLat = 11.030;
            const minLng = 77.025;
            const maxLng = 77.030;
            const topPct = Math.max(10, Math.min(90, (1 - (spawn.latitude - minLat) / (maxLat - minLat)) * 100));
            const leftPct = Math.max(10, Math.min(90, ((spawn.longitude - minLng) / (maxLng - minLng)) * 100));

            return (
              <View
                key={spawn.id}
                style={[
                  styles.miniDot,
                  { top: `${topPct}%`, left: `${leftPct}%` },
                  spawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS && styles.miniDotNearby,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* FULL MAP MODAL */}
      <Modal visible={isMapExpanded} animationType="slide">
        <View style={styles.fullMapModal}>
          <View style={styles.fullMapHeader}>
            <Text style={styles.fullMapTitle}>🗺️ CIT CAMPUS TACTICAL RADAR</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsMapExpanded(false)}>
              <Text style={styles.closeBtnText}>✕ Close Map</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fullMapGrid}>
            <Text style={styles.mapGridTitle}>CIT Campus Geofence (11.025° - 11.030° N, 77.025° - 77.030° E)</Text>
            <View style={styles.fullMapUserDot} />
            {activeSpawns.map((s) => {
              const minLat = 11.025;
              const maxLat = 11.030;
              const minLng = 77.025;
              const maxLng = 77.030;
              const topPct = Math.max(10, Math.min(90, (1 - (s.latitude - minLat) / (maxLat - minLat)) * 100));
              const leftPct = Math.max(10, Math.min(90, ((s.longitude - minLng) / (maxLng - minLng)) * 100));

              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.fullMapSpawnNode, { top: `${topPct}%`, left: `${leftPct}%` }]}
                  onPress={() => {
                    setIsMapExpanded(false);
                    if (s.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS) {
                      handleTriggerCatch(s);
                    } else {
                      handleSimulateWalkToSpawn(s);
                    }
                  }}
                >
                  <Text style={{ fontSize: 20 }}>👾</Text>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>{s.name} ({formatDistance(s.distanceMeters)})</Text>
                </TouchableOpacity>
              );
            })}

            {/* Loot Crates */}
            {lootCrates.filter((c) => c.is_active).map((c) => {
              const minLat = 11.025;
              const maxLat = 11.030;
              const minLng = 77.025;
              const maxLng = 77.030;
              const topPct = Math.max(10, Math.min(90, (1 - (c.latitude - minLat) / (maxLat - minLat)) * 100));
              const leftPct = Math.max(10, Math.min(90, ((c.longitude - minLng) / (maxLng - minLng)) * 100));
              const dist = calculateHaversineDistance(userCoords, { latitude: c.latitude, longitude: c.longitude });

              return (
                <TouchableOpacity
                  key={`crate-${c.id}`}
                  style={[styles.fullMapSpawnNode, { top: `${topPct}%`, left: `${leftPct}%`, borderColor: '#EAB308' }]}
                  onPress={() => {
                    setIsMapExpanded(false);
                    handleClaimLoot(c);
                  }}
                >
                  <Text style={{ fontSize: 20 }}>🧰</Text>
                  <Text style={{ color: '#FDE047', fontSize: 11, fontWeight: 'bold' }}>{c.name} ({formatDistance(dist)})</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  simulatedBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B1329',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatedText: {
    color: 'rgba(56, 189, 248, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  edgeLeft: {
    position: 'absolute',
    left: 12,
    top: '20%',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  edgeRight: {
    position: 'absolute',
    right: 12,
    top: '20%',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  edgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  reticleWrapper: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    marginLeft: -35,
    marginTop: -35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 24,
    height: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.8)',
  },
  crosshairV: {
    position: 'absolute',
    height: 24,
    width: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.8)',
  },
  outerRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderStyle: 'dashed',
  },
  topHud: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  compassRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rotateBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  rotateBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  compassTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  miniMapWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 180,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniMapTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  expandBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    cursor: 'pointer' as any,
  },
  expandBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  miniCanvas: {
    width: '100%',
    height: 135,
    backgroundColor: '#091228',
    borderRadius: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  radarCenterUser: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -6,
    marginTop: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  miniDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  miniDotNearby: {
    backgroundColor: '#22C55E',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fullMapModal: {
    flex: 1,
    backgroundColor: '#020617',
  },
  fullMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  fullMapTitle: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    cursor: 'pointer' as any,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fullMapGrid: {
    flex: 1,
    backgroundColor: '#091228',
    margin: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#38BDF8',
    position: 'relative',
  },
  mapGridTitle: {
    color: '#94A3B8',
    fontSize: 12,
    padding: 12,
    textAlign: 'center',
  },
  fullMapUserDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38BDF8',
    marginLeft: -8,
    marginTop: -8,
  },
  fullMapSpawnNode: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    cursor: 'pointer' as any,
  },
});
