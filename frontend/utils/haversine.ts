/**
 * Haversine formula distance calculation and Rarity System Utilities
 */

export type RarityTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SpawnPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rarity?: RarityTier;
}

export interface SpawnWithDistance extends SpawnPoint {
  distanceMeters: number;
  isWithinCatchRange: boolean;
}

/**
 * Calculates the great-circle distance between two GPS points using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLng = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distances from user location to all spawn points and sorts ascending.
 */
export function calculateDistancesToSpawns(
  userLocation: Coordinates,
  spawns: SpawnPoint[],
  proximityThresholdMeters: number = 15
): SpawnWithDistance[] {
  return spawns
    .map((spawn) => {
      const distance = calculateHaversineDistance(userLocation, {
        latitude: spawn.latitude,
        longitude: spawn.longitude,
      });

      return {
        ...spawn,
        rarity: spawn.rarity || 'COMMON',
        distanceMeters: distance,
        isWithinCatchRange: distance <= proximityThresholdMeters,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Formats a distance in meters to a human-readable string (e.g. "8m" or "1.2km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Rarity Visual Theme Data
 */
export interface RarityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: string;
  xpReward: number;
}

export const RARITY_THEMES: Record<RarityTier, RarityConfig> = {
  COMMON: {
    label: 'Common',
    color: '#94A3B8',
    bgColor: '#1E293B',
    borderColor: '#64748B',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    icon: '⚪',
    xpReward: 100,
  },
  RARE: {
    label: 'Rare',
    color: '#38BDF8',
    bgColor: '#082F49',
    borderColor: '#0284C7',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    icon: '🔵',
    xpReward: 250,
  },
  EPIC: {
    label: 'Epic',
    color: '#C084FC',
    bgColor: '#3B0764',
    borderColor: '#9333EA',
    glowColor: 'rgba(192, 132, 252, 0.7)',
    icon: '🟣',
    xpReward: 600,
  },
  LEGENDARY: {
    label: 'Legendary',
    color: '#FBBF24',
    bgColor: '#451A03',
    borderColor: '#D97706',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    icon: '🟡',
    xpReward: 1500,
  },
};

export function getRarityConfig(rarity?: RarityTier): RarityConfig {
  return RARITY_THEMES[rarity || 'COMMON'];
}

export function getCreatureEmoji(name: string): string {
  const map: Record<string, string> = {
    'Super Fluffy Cat': '🐱',
    'HomeSentinel': '🛡️',
    'CIT CyberDragon': '🐉',
    'QuantumSprite': '✨',
    'RoboGolem': '🤖',
    'CircuitPhoenix': '🔥',
    'CodePhantom': '👻',
    'NeuralFox': '🦊',
    'ByteFalcon': '🦅',
    'SiliconTitan': '⚡',
    'CampusOwl': '🦉',
    'AeroMech': '🚀',
  };
  return map[name] || '👾';
}

/**
 * Calculates initial bearing in degrees (0..360) from origin to target coordinates.
 */
export function calculateBearing(origin: Coordinates, target: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(target.latitude);
  const dLng = toRad(target.longitude - origin.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculates relative angle (-180..+180) between target bearing and user heading.
 * 0 degrees means directly ahead in user's camera line-of-sight.
 */
export function calculateRelativeAngle(bearing: number, heading: number): number {
  return ((bearing - heading + 540) % 360) - 180;
}

export interface ARProjection {
  inView: boolean;
  screenXPercent: number; // 0 to 100%
  screenYPercent: number; // 15 to 80%
  scale: number; // 0.5 to 1.35
  distanceMeters: number;
  direction: 'in_front' | 'left' | 'right' | 'behind';
  relativeAngle: number;
}

/**
 * Projects a target GPS coordinate into 2D AR Viewport screen coordinates based on device heading, pitch, and distance.
 */
export function calculateARProjection(
  userLocation: Coordinates,
  targetLocation: Coordinates,
  heading: number,
  pitchDeg: number = 0,
  fovDegrees: number = 65
): ARProjection {
  const distanceMeters = calculateHaversineDistance(userLocation, targetLocation);
  const bearing = calculateBearing(userLocation, targetLocation);
  const relativeAngle = calculateRelativeAngle(bearing, heading);

  const halfFovX = fovDegrees / 2;
  const halfFovY = (fovDegrees * 1.33) / 2; // ~43 degrees vertical FOV

  // Normalized X: relativeAngle > 0 means target is to the right of camera center
  const normX = Math.max(-1.8, Math.min(1.8, relativeAngle / halfFovX));
  const screenXPercent = 50 + normX * 45;

  // Ground plane perspective based on distance (closer = lower on screen)
  const clampedDist = Math.max(2, Math.min(40, distanceMeters));
  const distFactor = (clampedDist - 2) / (40 - 2);
  const baseGroundY = 66 - distFactor * 22; // 66% at 2m down to 44% at 40m

  // Device pitch adjustment (pitchDeg in degrees):
  // pitchDeg > 0 = phone tilted down towards floor, target moves UP on screen
  // pitchDeg < 0 = phone tilted up towards ceiling/sky, target moves DOWN on screen
  const normPitch = Math.max(-1.5, Math.min(1.5, pitchDeg / halfFovY));
  const screenYPercent = Math.max(-20, Math.min(120, baseGroundY - normPitch * 42));

  const inView = Math.abs(relativeAngle) <= halfFovX * 0.95 && screenYPercent >= 10 && screenYPercent <= 90;

  // Scale: 1.35 at 2m down to 0.65 at 40m
  const scale = Math.max(0.65, Math.min(1.35, 1.35 - distFactor * 0.7));

  let direction: 'in_front' | 'left' | 'right' | 'behind' = 'in_front';
  if (relativeAngle < -halfFovX && relativeAngle >= -135) {
    direction = 'left';
  } else if (relativeAngle > halfFovX && relativeAngle <= 135) {
    direction = 'right';
  } else if (Math.abs(relativeAngle) > 135) {
    direction = 'behind';
  }

  return {
    inView,
    screenXPercent,
    screenYPercent,
    scale,
    distanceMeters,
    direction,
    relativeAngle: Math.round(relativeAngle),
  };
}

