import React, { useState, useEffect, useRef } from 'react';
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
import MapView, { Marker, Circle, Polygon, PROVIDER_DEFAULT, Camera } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  calculateDistancesToSpawns,
  calculateHaversineDistance,
  formatDistance,
  getRarityConfig,
  getCreatureEmoji,
  SpawnPoint,
  SpawnWithDistance,
} from '../utils/haversine';
import { fetchSpawns, fetchLootCratesApi, claimLootCrateApi, fetchBestiary, LootCrateItem } from '../utils/api';
import { fetchActivePeersApi, getRadarWebSocketUrl, PeerCadet } from '../utils/multiplayer';
import { fetchFriendsApi, pingFriendApi, FriendItem } from '../utils/friends';
import { fetchStrongholdsApi, CampusStronghold } from '../utils/turf';
import { getActiveBuddy } from '../utils/buddy';
import DuelModal from '../components/DuelModal';
import StrongholdModal from '../components/StrongholdModal';
import { useAuth } from '../context/AuthContext';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import {
  triggerHapticTap,
  triggerHapticImpact,
  triggerHapticSuccess,
  triggerHapticWarning,
} from '../utils/haptics';
import {
  playTapSound,
  playSwooshSound,
  playCatchSound,
  playCoinSound,
  playRadarSound,
} from '../utils/sound';

// Coimbatore Institute of Technology (CIT) Exact Campus Polygon Coordinates
// Fine-tuned along edges to match user calibration (media_1788502382784.jpg)
const CIT_CAMPUS_COORDS = [
  { latitude: 11.030449, longitude: 77.028487 }, // 1. North Apex - curved stadium track loop
  { latitude: 11.030164, longitude: 77.028823 }, // 2. Stadium Northeast track curve
  { latitude: 11.029640, longitude: 77.029014 }, // 3. Stadium East track straight
  { latitude: 11.029022, longitude: 77.029087 }, // 4. Stadium Southeast track curve
  { latitude: 11.028707, longitude: 77.028670 }, // 5. Hugging southeast of track inward to spine
  { latitude: 11.028593, longitude: 77.028243 }, // 6. Smooth entry to central quad spine
  { latitude: 11.028117, longitude: 77.028221 }, // 7. Central spine road between academic buildings & eastern ground
  { latitude: 11.027641, longitude: 77.028238 }, // 8. East side of academic complex
  { latitude: 11.027165, longitude: 77.028322 }, // 9. Along central quad spine path
  { latitude: 11.026689, longitude: 77.028425 }, // 10. Approaching southern sports ground
  { latitude: 11.026213, longitude: 77.028509 }, // 11. East side of southern ground
  { latitude: 11.025927, longitude: 77.028527 }, // 12. Extended southeast curve of southern ground
  { latitude: 11.025594, longitude: 77.028071 }, // 13. Deep south loop enclosing full sports ground
  { latitude: 11.025451, longitude: 77.027490 }, // 14. South-most perimeter curve
  { latitude: 11.025498, longitude: 77.026910 }, // 15. Base of southern sandy ground
  { latitude: 11.025640, longitude: 77.026427 }, // 16. Southwest corner of southern ground
  { latitude: 11.026212, longitude: 77.026353 }, // 17. West perimeter heading north
  { latitude: 11.027163, longitude: 77.026195 }, // 18. West edge of academic quad
  { latitude: 11.028115, longitude: 77.026075 }, // 19. Northwest quad tree-line
  { latitude: 11.028858, longitude: 77.025973 }, // 20. Northwest corner near Avinashi Road
  { latitude: 11.029401, longitude: 77.026788 }, // 21. Along Avinashi Road heading northeast
  { latitude: 11.029877, longitude: 77.027516 }, // 22. Continuing along Avinashi Road towards stadium
  { latitude: 11.030259, longitude: 77.028099 }, // 23. Connecting to stadium north apex
];

// CIT Campus Center
const CIT_CENTER = {
  latitude: 11.0272,
  longitude: 77.0274,
  latitudeDelta: 0.007,
  longitudeDelta: 0.007,
};

// Clean Map Style hiding default Google Maps POIs and transit icons
const CLEAN_MAP_STYLE = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.school',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
];

const CATCH_PROXIMITY_THRESHOLD_METERS = 15; // 15 meters physical proximity trigger

// High-resolution native Android & iOS PNG pin assets
const PIN_IMAGES: Record<string, any> = {
  STRANGER: require('../assets/pin_stranger.png'), // Plain white ? symbol for distant anomalies (>15m)
  LEGENDARY: require('../assets/pin_legendary.png'),
  EPIC: require('../assets/pin_epic.png'),
  RARE: require('../assets/pin_rare.png'),
  COMMON: require('../assets/pin_common.png'),
  NEARBY: require('../assets/pin_nearby.png'),
  LOOT: require('../assets/pin_loot.png'),
  USER: require('../assets/pin_user.png'), // Custom cadet profile location marker
  FRIEND: require('../assets/pin_friend.png'), // Verified Campus Buddy Radar Pin
  PEER: require('../assets/pin_peer.png'), // Real-time multiplayer campus cadets
  STRONGHOLD: require('../assets/pin_stronghold.png'), // Department Fortress Crest
  BUDDY: require('../assets/pin_buddy.png'), // Walking Companion Pet Token
};

export default function MapScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [spawns, setSpawns] = useState<SpawnPoint[]>([]);
  const [sortedSpawns, setSortedSpawns] = useState<SpawnWithDistance[]>([]);
  const [lootCrates, setLootCrates] = useState<LootCrateItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [peers, setPeers] = useState<PeerCadet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Department Turf Wars & Strongholds state
  const [strongholds, setStrongholds] = useState<CampusStronghold[]>([]);
  const [selectedStronghold, setSelectedStronghold] = useState<CampusStronghold | null>(null);
  const [showStrongholdModal, setShowStrongholdModal] = useState<boolean>(false);

  // Companion Buddy System state
  const [activeBuddyName, setActiveBuddyName] = useState<string | null>(null);
  const [accumulatedMeters, setAccumulatedMeters] = useState<number>(0);
  const [lastCoord, setLastCoord] = useState<{ latitude: number; longitude: number } | null>(null);

  // Cadet PvP Tactical Duel state
  const [duelTarget, setDuelTarget] = useState<FriendItem | null>(null);
  const [showDuelModal, setShowDuelModal] = useState<boolean>(false);

  // Dynamic Coimbatore IST Day/Night calculation (18:30 to 06:00 is Night Patrol)
  const isNightPatrol = (() => {
    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const istHours = (utcHours + 5.5) % 24;
    return istHours >= 18.5 || istHours < 6.0;
  })();

  // Active spawns with immediate fallback even before GPS lock
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

  // Closest spawn calculation
  const closestSpawn = activeSpawns.length > 0 ? activeSpawns[0] : null;
  const isWithinCatchRange =
    closestSpawn !== null && closestSpawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;

  // 1. Fetch spawns, campus loot, strongholds, and multiplayer peers
  const loadGameData = async () => {
    try {
      setRefreshing(true);
      const [spawnData, lootData, bestiaryData, peersData, friendsData, strongholdsData, currentBuddy] = await Promise.all([
        fetchSpawns(10),
        fetchLootCratesApi(),
        fetchBestiary(token),
        fetchActivePeersApi(),
        fetchFriendsApi(token),
        fetchStrongholdsApi(),
        getActiveBuddy(),
      ]);

      // Remove creatures already registered in player's bestiary (fixed 1-time canonical encounters)
      const capturedNames = new Set(
        bestiaryData.entries.filter((e) => e.discovered).map((e) => e.creature_name)
      );
      const uncollectedSpawns = spawnData.filter((s) => !capturedNames.has(s.name));

      setSpawns(uncollectedSpawns);
      setLootCrates(lootData);
      setPeers(peersData);
      setFriends(friendsData);
      setStrongholds(strongholdsData);
      setActiveBuddyName(currentBuddy);
    } catch (err) {
      console.error('Error loading game data:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // 2. Request GPS permissions and subscribe to physical movement
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('GPS Required', 'Location permission is required to play CampusQuest.');
          setLoading(false);
          return;
        }

        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(initialLoc.coords);

        // Center map on user location with 3D perspective
        if (mapRef.current) {
          mapRef.current.animateCamera(
            {
              center: {
                latitude: initialLoc.coords.latitude,
                longitude: initialLoc.coords.longitude,
              },
              pitch: 55,
              heading: initialLoc.coords.heading || 0,
              altitude: 380,
              zoom: 18.5,
            },
            { duration: 1000 }
          );
        }

        // Live GPS position watcher (updates as user physically walks around CIT)
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1500,
            distanceInterval: 1, // trigger recalculation every 1 meter moved
          },
          (newLocation) => {
            setLocation(newLocation.coords);

            // Accumulate physical walking distance for Companion Buddy rewards
            setLastCoord((prevCoord) => {
              if (prevCoord) {
                const stepDist = calculateHaversineDistance(
                  prevCoord,
                  { latitude: newLocation.coords.latitude, longitude: newLocation.coords.longitude }
                );
                if (stepDist > 0.5 && stepDist < 40) {
                  setAccumulatedMeters((prevM) => {
                    const nextM = prevM + stepDist;
                    if (nextM >= 100) {
                      Alert.alert(
                        '🐾 Companion Buddy Discovery!',
                        `Your buddy explored 100 meters with you across campus and uncovered an Energizer Battery (+25 HP & +50 EXP)!`
                      );
                      return 0;
                    }
                    return nextM;
                  });
                }
              }
              return { latitude: newLocation.coords.latitude, longitude: newLocation.coords.longitude };
            });
          }
        );
      } catch (e: any) {
        console.warn('GPS initialization warning:', e);
        setLocation({
          latitude: CIT_CENTER.latitude,
          longitude: CIT_CENTER.longitude,
          altitude: null,
          accuracy: 5,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        });
      } finally {
        setLoading(false);
      }
    })();

    loadGameData();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // 3. Continuously compute Haversine distances on physical movement
  useEffect(() => {
    if (location && spawns.length > 0) {
      const computed = calculateDistancesToSpawns(
        { latitude: location.latitude, longitude: location.longitude },
        spawns
      );
      setSortedSpawns(computed);
    }
  }, [location, spawns]);

  // 3b. Radar Pulse Haptics & SFX: Escalating pulse and sonar ping when closing in on Stranger signals
  const lastHapticRef = useRef<number>(0);
  useEffect(() => {
    if (!closestSpawn) return;
    const dist = closestSpawn.distanceMeters;
    const now = Date.now();

    if (dist <= 30 && now - lastHapticRef.current > 4000) {
      lastHapticRef.current = now;
      if (dist <= 15) {
        triggerHapticWarning();
        playRadarSound();
      } else {
        triggerHapticTap();
      }
    }
  }, [closestSpawn?.distanceMeters]);

  // 4. Real-time Multiplayer WebSocket Radar
  useEffect(() => {
    if (!user || !user.id) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        const wsUrl = getRadarWebSocketUrl(user.id);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (location && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'POSITION_UPDATE',
                latitude: location.latitude,
                longitude: location.longitude,
                username: user.username,
                department: user.department || 'CSE',
                level: user.level || 1,
                avatar_title: user.avatar_title || 'Cadet',
              })
            );
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'PEERS_UPDATE' && Array.isArray(data.peers)) {
              // Exclude current user from peer markers
              const otherPeers = data.peers.filter((p: PeerCadet) => p.user_id !== user.id);
              setPeers(otherPeers);
            }
          } catch (err) {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          // Fallback gracefully to polling if WebSocket drops
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 8000);
        };
      } catch (err) {
        // Fallback gracefully
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [user?.id]);



  // Center map on user in 3D perspective
  const handleCenterOnUser = () => {
    if (mapRef.current) {
      const targetLat = location ? location.latitude : CIT_CENTER.latitude;
      const targetLng = location ? location.longitude : CIT_CENTER.longitude;
      mapRef.current.animateCamera(
        {
          center: { latitude: targetLat, longitude: targetLng },
          pitch: 55,
          heading: location?.heading || 0,
          altitude: 380,
          zoom: 18.5,
        },
        { duration: 700 }
      );
    }
  };

  // Center on entire CIT Campus in 3D perspective
  const handleCenterOnCIT = () => {
    if (mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: { latitude: CIT_CENTER.latitude, longitude: CIT_CENTER.longitude },
          pitch: 50,
          heading: 0,
          altitude: 650,
          zoom: 17,
        },
        { duration: 800 }
      );
    }
  };

  // Claim loot crate
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
        `Location: ${crate.campus_sector}\nDistance: ${formatDistance(dist)}\n\nWalk within 15 meters to unlock and collect this campus supply cache!`,
        [{ text: 'Understood', style: 'default' }]
      );
      return;
    }

    try {
      const res = await claimLootCrateApi(crate.id, token);
      if (user) {
        updateProfile({});
      }
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('🎁 Cache Unlocked!', `${res.message}\n+${crate.reward_amount} ${crate.reward_type} added to backpack!`);
    } catch (e) {
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('🎁 Cache Collected!', `Claimed ${crate.reward_amount} ${crate.reward_type}!`);
    }
  };

  // Navigate to AR Catch screen
  const handleTriggerCatch = (spawnToCatch: SpawnWithDistance) => {
    triggerHapticImpact('heavy');
    playSwooshSound();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Initializing CIT Cyber Radar...</Text>
        <Text style={styles.loadingSubtext}>Scanning Campus Quantum Frequencies</Text>
      </View>
    );
  }

  // Native 3D Isometric MMORPG Camera Configuration (55° tilt angle, 380m altitude)
  const initialCamera: Camera = {
    center: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : { latitude: CIT_CENTER.latitude, longitude: CIT_CENTER.longitude },
    pitch: 55,
    heading: location?.heading || 0,
    altitude: 380,
    zoom: 18.5,
  };

  const closestRarityConfig = closestSpawn ? getRarityConfig(closestSpawn.rarity) : null;

  return (
    <View style={styles.container}>
      {/* 3D Hybrid Satellite Campus MapView with Extruded 3D Buildings */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialCamera={initialCamera}
        mapType="hybrid"
        showsBuildings={true}
        pitchEnabled={true}
        rotateEnabled={true}
        showsUserLocation={false}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsPointsOfInterests={false}
        customMapStyle={CLEAN_MAP_STYLE}
      >
        {/* CIT Campus Geofence Boundary (User-Marked Blue Perimeter with Liquid Glass Cyan Glow) */}
        <Polygon
          coordinates={CIT_CAMPUS_COORDS}
          strokeColor="#38BDF8"
          fillColor="rgba(56, 189, 248, 0.16)"
          strokeWidth={3.5}
          zIndex={1}
        />

        {/* 15-meter Physical Catch Proximity Ring around user */}
        {location && (
          <Circle
            center={{ latitude: location.latitude, longitude: location.longitude }}
            radius={CATCH_PROXIMITY_THRESHOLD_METERS}
            strokeColor={isWithinCatchRange ? '#22C55E' : '#38BDF8'}
            fillColor={isWithinCatchRange ? 'rgba(34, 197, 94, 0.3)' : 'rgba(56, 189, 248, 0.15)'}
            strokeWidth={3}
            zIndex={2}
          />
        )}

        {/* Custom Student User Location Profile Marker */}
        {location && (
          <Marker
            key="user-cadet-marker"
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            image={PIN_IMAGES.USER}
            title={user?.username || 'You (CIT Cadet)'}
            description={`Rank: Lvl ${user?.level || 1} • ${user?.department || 'CSE'} • ${user?.avatar_title || 'Campus Explorer'}`}
            zIndex={100}
          />
        )}

        {/* Companion Buddy Marker (Walks along Cadet with physical distance rewards) */}
        {location && activeBuddyName && (
          <Marker
            key="companion-buddy-marker"
            coordinate={{
              latitude: location.latitude + 0.00007,
              longitude: location.longitude + 0.00007,
            }}
            image={PIN_IMAGES.BUDDY}
            title={`🐾 Companion: ${activeBuddyName}`}
            description={`Walking Distance: ${Math.round(accumulatedMeters)}/100m • Tap to inspect`}
            zIndex={95}
            onPress={() => {
              Alert.alert(
                `🐾 Companion: ${activeBuddyName}`,
                `Your companion walks the CIT campus by your side!\n\n🚶 Distance walked: ${Math.round(accumulatedMeters)}/100m\n🎁 Next reward at 100m: Energizer Battery (+25 HP & +50 EXP)`,
                [
                  { text: 'Switch Buddy', onPress: () => router.push('/inventory') },
                  { text: 'Good Buddy! ✨', style: 'default' },
                ]
              );
            }}
          />
        )}

        {/* Note: Landmark/Stronghold indicators removed from map as requested; will be updated when user provides custom block names & locations */}

        {/* Real-time Verified Friends Radar Markers (ONLY Friends Shown on Map) */}
        {friends.map((friend) => (
          <Marker
            key={friend.id || friend.friend_id}
            coordinate={{
              latitude: friend.latitude,
              longitude: friend.longitude,
            }}
            image={PIN_IMAGES.FRIEND}
            title={`🤝 ${friend.username} (${friend.department})`}
            description={`Buddy • Lvl ${friend.level} • 📍 ${friend.campus_sector} • Tap to Interact`}
            zIndex={30}
            onPress={() => {
              Alert.alert(
                `🤝 Campus Buddy: ${friend.username}`,
                `Department: ${friend.department}\nLevel: Lvl ${friend.level}\nTitle: ${friend.avatar_title}\nSector: ${friend.campus_sector}\nStatus: ${friend.is_online ? '🟢 Live on Radar' : '⚪ Last Known Sector'}`,
                [
                  {
                    text: '⚔️ Challenge to Duel',
                    onPress: () => {
                      setDuelTarget(friend);
                      setShowDuelModal(true);
                    },
                  },
                  {
                    text: '📡 Send Radar Ping',
                    onPress: async () => {
                      await pingFriendApi(friend.friend_id || friend.id, token);
                      Alert.alert('📡 Ping Sent', `Ping signal sent to ${friend.username}!`);
                    },
                  },
                  {
                    text: '👥 Friends Hub',
                    onPress: () => router.push('/friends'),
                  },
                  { text: 'Close', style: 'cancel' },
                ]
              );
            }}
          />
        ))}

        {/* Campus Collectible Loot Crates */}
        {lootCrates.map((crate) => (
          <Marker
            key={crate.id}
            coordinate={{
              latitude: crate.latitude,
              longitude: crate.longitude,
            }}
            image={PIN_IMAGES.LOOT}
            title={crate.name}
            description={`Sector: ${crate.campus_sector} • +${crate.reward_amount} ${crate.reward_type}`}
            zIndex={15}
            onPress={() => handleClaimLoot(crate)}
          />
        ))}

        {/* CIT Spawn Markers: Plain White Stranger '?' when distant (>15m), Rarity revealed only when near (<=15m) */}
        {activeSpawns.map((spawn) => {
          const isNearby = spawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;
          const rarityConfig = getRarityConfig(spawn.rarity);
          // Distant = Plain White Stranger symbol; Nearby = Revealed colorful rarity badge
          const pinImage = isNearby
            ? (PIN_IMAGES[spawn.rarity || 'COMMON'] || PIN_IMAGES.NEARBY)
            : PIN_IMAGES.STRANGER;

          return (
            <Marker
              key={spawn.id}
              coordinate={{
                latitude: spawn.latitude,
                longitude: spawn.longitude,
              }}
              image={pinImage}
              title={isNearby ? spawn.name : '💨 Mysterious Smoke Plume'}
              description={
                isNearby
                  ? `✨ ${rarityConfig.label} Spirit Unlocked! Tap to capture!`
                  : `Distance: ${formatDistance(spawn.distanceMeters)} • Approach within 15m to decode smoke plume!`
              }
              zIndex={isNearby ? 35 : 10}
              onPress={() => {
                if (isNearby) {
                  handleTriggerCatch(spawn);
                } else {
                  Alert.alert(
                    '💨 Mysterious Smoke Plume',
                    `An atmospheric smoke plume rises ${formatDistance(spawn.distanceMeters)} away.\n\nApproach within 15 meters to reveal its spirit identity and rarity!`,
                    [{ text: 'Ride Out 🐎', style: 'default' }]
                  );
                }
              }}
            />
          );
        })}
      </MapView>

      {/* Liquid Glass Top Navigation Bar */}
      <SafeAreaView style={styles.topHud}>
        <View style={styles.topBarContainer}>
          {/* Left: Liquid Glass Status Pills (HP, Night Patrol, Buddy) */}
          <View style={styles.statusPillsRow}>
            <View style={styles.energyPill}>
              <Text style={styles.energyPillText}>⚡ {user?.energy || 100} HP</Text>
            </View>

            {isNightPatrol && (
              <View style={styles.nightPill}>
                <Text style={styles.nightPillText}>🌙 Night</Text>
              </View>
            )}

            {activeBuddyName && (
              <TouchableOpacity
                style={styles.buddyPill}
                onPress={() => {
                  triggerHapticTap();
                  playSwooshSound();
                  router.push('/inventory');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buddyPillText}>🐾 {Math.round(accumulatedMeters)}m</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right: Liquid Glass Action Icons Cluster */}
          <View style={styles.topActionsCluster}>
            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                router.push('/friends');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIconText}>👥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                router.push('/inventory');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIconText}>🎒</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                router.push('/shop');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIconText}>🏪</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionIconButton, styles.profileIconButton]}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                if (user) router.push('/profile');
                else router.push('/login');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIconText}>{user?.role === 'ADMIN' ? '🛡️' : '👤'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Floating Map Navigation Controls (Liquid Glass Discs) */}
      <View style={[styles.floatingControls, isWithinCatchRange && styles.floatingControlsLifted]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            triggerHapticTap();
            playTapSound();
            handleCenterOnUser();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.controlButtonText}>🎯</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.strongholdButton]}
          onPress={() => {
            triggerHapticImpact('medium');
            playSwooshSound();
            if (strongholds.length > 0) {
              setSelectedStronghold(strongholds[0]);
              setShowStrongholdModal(true);
            } else {
              Alert.alert('🏰 Strongholds', 'Scanning campus territories...');
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.controlButtonText}>🏰</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.citButton]}
          onPress={() => {
            triggerHapticTap();
            playTapSound();
            handleCenterOnCIT();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.citButtonText}>🏛️</Text>
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <TouchableOpacity
            style={[styles.controlButton, styles.adminButton]}
            onPress={() => {
              triggerHapticImpact('medium');
              playSwooshSound();
              router.push('/admin');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.controlButtonText}>🛡️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dynamic Liquid Glass Catch Prompt */}
      {isWithinCatchRange && closestSpawn && closestRarityConfig ? (
        <View style={styles.catchPromptContainer}>
          <TouchableOpacity
            style={[
              styles.catchBrushBanner,
              {
                borderColor: closestRarityConfig.color,
                shadowColor: closestRarityConfig.color,
              },
            ]}
            activeOpacity={0.88}
            onPress={() => {
              triggerHapticImpact('heavy');
              playSwooshSound();
              handleTriggerCatch(closestSpawn);
            }}
          >
            <View style={styles.catchBrushContent}>
              <View
                style={[
                  styles.catchBadgeSlash,
                  { backgroundColor: closestRarityConfig.bgColor, borderColor: closestRarityConfig.color },
                ]}
              >
                <Text style={styles.catchIconEmoji}>{getCreatureEmoji(closestSpawn.name)}</Text>
              </View>

              <View style={styles.catchTextGroup}>
                <View style={styles.catchTitleRow}>
                  <Text style={styles.catchMainText}>CATCH {closestSpawn.name.toUpperCase()}!</Text>
                  <View
                    style={[
                      styles.inlineRarityTag,
                      { backgroundColor: closestRarityConfig.color },
                    ]}
                  >
                    <Text style={styles.inlineRarityTagText}>
                      {closestRarityConfig.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.catchSubText}>
                  Within {formatDistance(closestSpawn.distanceMeters)} • +{closestRarityConfig.xpReward} XP • -10 HP
                </Text>
              </View>

              <Text style={styles.catchActionArrow}>⚡</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        /* Minimalist Liquid Glass Smoke Plume Discovery Ribbon */
        closestSpawn && closestRarityConfig && (
          <View style={styles.bottomStatusBanner}>
            <Text style={styles.bottomStatusText}>
              💨 <Text style={{ color: closestRarityConfig.color, fontWeight: 'bold' }}>{closestRarityConfig.label} Smoke Plume</Text> active {formatDistance(closestSpawn.distanceMeters)} away • Walk within 15m to decode
            </Text>
          </View>
        )
      )}

      {/* 3-Turn Tactical Cadet Duel Modal */}
      {duelTarget && (
        <DuelModal
          visible={showDuelModal}
          opponentId={duelTarget.friend_id || duelTarget.id}
          opponentName={duelTarget.username}
          opponentDepartment={duelTarget.department}
          playerCreature={activeBuddyName || 'ByteFalcon'}
          token={token}
          onClose={() => {
            setShowDuelModal(false);
            setDuelTarget(null);
          }}
          onDuelCompleted={() => {
            loadGameData();
          }}
        />
      )}

      {/* CIT Department Turf War Stronghold Modal */}
      {selectedStronghold && (
        <StrongholdModal
          visible={showStrongholdModal}
          stronghold={selectedStronghold}
          userDepartment={user?.department || 'CSE'}
          token={token}
          onClose={() => {
            setShowStrongholdModal(false);
            setSelectedStronghold(null);
          }}
          onDefended={(updated) => {
            setStrongholds((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
            loadGameData();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0C10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#06B6D4',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: 1,
  },
  loadingSubtext: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
  },
  topHud: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 32 : 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  energyPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderTopColor: 'rgba(167, 243, 208, 0.7)',
  },
  energyPillText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '800',
  },
  nightPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: 'rgba(129, 140, 248, 0.5)',
    borderTopColor: 'rgba(199, 210, 254, 0.7)',
  },
  nightPillText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  buddyPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderTopColor: 'rgba(254, 243, 199, 0.7)',
  },
  buddyPillText: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topActionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.50)',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  profileIconButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    borderColor: 'rgba(245, 158, 11, 0.50)',
    borderTopColor: 'rgba(254, 243, 199, 0.75)',
  },
  actionIconText: {
    fontSize: 15,
  },
  floatingControls: {
    position: 'absolute',
    right: 14,
    bottom: 75,
    zIndex: 15,
    alignItems: 'center',
    gap: 10,
  },
  floatingControlsLifted: {
    bottom: 115,
  },
  controlButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: GLASS_COLORS.bgDark,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  controlButtonText: {
    fontSize: 18,
  },
  citButton: {
    shadowColor: '#F59E0B',
    borderTopColor: 'rgba(254, 243, 199, 0.65)',
  },
  citButtonText: {
    fontSize: 16,
  },
  strongholdButton: {
    shadowColor: '#818CF8',
    borderTopColor: 'rgba(199, 210, 254, 0.65)',
  },
  adminButton: {
    shadowColor: '#EF4444',
    borderTopColor: 'rgba(254, 202, 202, 0.65)',
  },
  catchPromptContainer: {
    position: 'absolute',
    bottom: 18,
    left: 12,
    right: 12,
    zIndex: 25,
  },
  catchBrushBanner: {
    backgroundColor: 'rgba(12, 18, 36, 0.90)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  catchBrushContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catchBadgeSlash: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
  },
  catchIconEmoji: {
    fontSize: 24,
  },
  catchTextGroup: {
    flex: 1,
  },
  catchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catchMainText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  inlineRarityTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  inlineRarityTagText: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  catchSubText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  catchActionArrow: {
    fontSize: 20,
    color: '#FACC15',
    marginLeft: 6,
  },
  bottomStatusBanner: {
    position: 'absolute',
    bottom: 18,
    left: 14,
    right: 14,
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 9999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomStatusText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
