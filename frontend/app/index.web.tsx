import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  calculateDistancesToSpawns,
  formatDistance,
  SpawnPoint,
  SpawnWithDistance,
} from '../utils/haversine';
import { fetchSpawns } from '../utils/api';

// CIT Campus Center
const CIT_CENTER = {
  latitude: 11.0275,
  longitude: 77.0275,
};

const CATCH_PROXIMITY_THRESHOLD_METERS = 15;

export default function WebMapScreen() {
  const router = useRouter();

  // Simulated or Browser Geolocation
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 11.0270,
    longitude: 77.0270,
  });
  const [spawns, setSpawns] = useState<SpawnPoint[]>([]);
  const [sortedSpawns, setSortedSpawns] = useState<SpawnWithDistance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const closestSpawn = sortedSpawns.length > 0 ? sortedSpawns[0] : null;
  const isWithinCatchRange =
    closestSpawn !== null && closestSpawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;

  const loadSpawns = async () => {
    try {
      setRefreshing(true);
      const data = await fetchSpawns(5);
      setSpawns(data);
    } catch (err) {
      console.error('Error loading spawns:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Attempt browser geolocation if available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // If browser is far from CIT, keep near CIT for campus quest experience
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (lat >= 11.0 && lat <= 11.1 && lng >= 77.0 && lng <= 77.1) {
            setUserCoords({ latitude: lat, longitude: lng });
          }
        },
        () => console.log('Using default CIT coordinates for demo.')
      );
    }
    loadSpawns();
  }, []);

  useEffect(() => {
    if (userCoords && spawns.length > 0) {
      const computed = calculateDistancesToSpawns(userCoords, spawns);
      setSortedSpawns(computed);
    }
  }, [userCoords, spawns]);

  const handleSimulateWalkToSpawn = (spawn: SpawnPoint) => {
    setUserCoords({
      latitude: spawn.latitude - 0.00003,
      longitude: spawn.longitude - 0.00003,
    });
  };

  const handleTriggerCatch = (spawnToCatch: SpawnWithDistance) => {
    router.push({
      pathname: '/catch',
      params: {
        id: spawnToCatch.id,
        name: spawnToCatch.name,
        distance: Math.round(spawnToCatch.distanceMeters).toString(),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Initializing CIT Campus Radar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header HUD */}
      <View style={styles.topHud}>
        <View style={styles.hudCard}>
          <View>
            <Text style={styles.hudTitle}>📍 CampusQuest Radar (Web Simulator)</Text>
            <Text style={styles.hudSubtitle}>
              Coimbatore Institute of Technology (CIT) • {spawns.length} active spawns
            </Text>
            {closestSpawn && (
              <Text style={styles.hudNearest}>
                Nearest: <Text style={styles.boldText}>{closestSpawn.name}</Text> (
                {formatDistance(closestSpawn.distanceMeters)})
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadSpawns}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>{refreshing ? '...' : '🔄 Refresh'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Radar Map Canvas Simulation Area */}
      <View style={styles.radarContainer}>
        <View style={styles.radarGrid}>
          {/* Radar Circles */}
          <View style={[styles.radarCircle, { width: 340, height: 340, borderRadius: 170 }]} />
          <View style={[styles.radarCircle, { width: 240, height: 240, borderRadius: 120 }]} />
          <View style={[styles.radarCircle, { width: 140, height: 140, borderRadius: 70 }]} />

          {/* Campus Boundary Badge */}
          <View style={styles.campusBoundaryBox}>
            <Text style={styles.campusBoundaryLabel}>CIT CAMPUS GEOFENCE (11.025° - 11.030° N, 77.025° - 77.030° E)</Text>
          </View>

          {/* User Location Marker (Center) */}
          <View style={styles.userMarkerWrapper}>
            <View style={styles.userMarkerPulse} />
            <View style={styles.userMarkerDot} />
            <Text style={styles.userMarkerText}>You</Text>
          </View>

          {/* Render Spawns positioned relative to CIT Bounds */}
          {sortedSpawns.map((spawn, index) => {
            // Normalize coordinates to 0..100% of the radar view
            const minLat = 11.0250;
            const maxLat = 11.0300;
            const minLng = 77.0250;
            const maxLng = 77.0300;

            const topPercent = Math.max(10, Math.min(90, (1 - (spawn.latitude - minLat) / (maxLat - minLat)) * 100));
            const leftPercent = Math.max(10, Math.min(90, ((spawn.longitude - minLng) / (maxLng - minLng)) * 100));

            const isNearby = spawn.distanceMeters <= CATCH_PROXIMITY_THRESHOLD_METERS;

            return (
              <TouchableOpacity
                key={spawn.id}
                style={[
                  styles.spawnNode,
                  { top: `${topPercent}%`, left: `${leftPercent}%` },
                  isNearby && styles.spawnNodeNearby,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (isNearby) {
                    handleTriggerCatch(spawn);
                  } else {
                    handleSimulateWalkToSpawn(spawn);
                  }
                }}
              >
                <View style={[styles.spawnBadge, isNearby && styles.spawnBadgeNearby]}>
                  <Text style={styles.spawnEmoji}>👾</Text>
                </View>
                <View style={styles.spawnBubble}>
                  <Text style={styles.spawnName}>{spawn.name}</Text>
                  <Text style={styles.spawnDistance}>
                    {formatDistance(spawn.distanceMeters)} {isNearby ? '⚡ IN RANGE!' : '• Tap to Walk'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Floating "Catch!" CTA Button */}
      {isWithinCatchRange && closestSpawn ? (
        <View style={styles.catchPromptContainer}>
          <TouchableOpacity
            style={styles.catchButton}
            activeOpacity={0.85}
            onPress={() => handleTriggerCatch(closestSpawn)}
          >
            <Text style={styles.catchButtonIcon}>⚡</Text>
            <View>
              <Text style={styles.catchButtonMainText}>Catch {closestSpawn.name}!</Text>
              <Text style={styles.catchButtonSubText}>
                Within {formatDistance(closestSpawn.distanceMeters)} • Click to enter AR Catch mode
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : closestSpawn ? (
        <View style={styles.bottomStatusBanner}>
          <Text style={styles.bottomStatusText}>
            Click any creature on the radar to walk to it! Nearest is {closestSpawn.name} (
            {formatDistance(closestSpawn.distanceMeters)})
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 18,
    marginTop: 16,
    fontWeight: 'bold',
  },
  topHud: {
    width: '100%',
    maxWidth: 600,
    zIndex: 10,
  },
  hudCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  hudTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hudSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  hudNearest: {
    color: '#38BDF8',
    fontSize: 13,
    marginTop: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#38BDF8',
  },
  refreshButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  radarContainer: {
    width: '100%',
    maxWidth: 600,
    height: 480,
    backgroundColor: '#020617',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 12,
  },
  radarGrid: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  campusBoundaryBox: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  campusBoundaryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  userMarkerWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userMarkerText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  spawnNode: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 6,
    transform: [{ translateX: -40 }, { translateY: -40 }],
    cursor: 'pointer' as any,
  },
  spawnNodeNearby: {
    transform: [{ translateX: -40 }, { translateY: -40 }, { scale: 1.15 }],
  },
  spawnBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  spawnBadgeNearby: {
    backgroundColor: '#16A34A',
    borderColor: '#86EFAC',
  },
  spawnEmoji: {
    fontSize: 18,
  },
  spawnBubble: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  spawnName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  spawnDistance: {
    color: '#38BDF8',
    fontSize: 10,
  },
  catchPromptContainer: {
    width: '100%',
    maxWidth: 600,
    zIndex: 20,
  },
  catchButton: {
    backgroundColor: '#16A34A',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#86EFAC',
    cursor: 'pointer' as any,
  },
  catchButtonIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  catchButtonMainText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  catchButtonSubText: {
    color: '#DCFCE7',
    fontSize: 12,
  },
  bottomStatusBanner: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bottomStatusText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
});

