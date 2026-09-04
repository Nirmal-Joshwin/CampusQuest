import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { SpawnPoint, RarityTier } from './haversine';

// Dynamically determine the backend IP:
const getBackendBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }

  // Extract laptop's Wi-Fi / LAN IP from Expo host URI
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8000`;
    }
  }

  return Platform.OS === 'android' ? 'http://10.116.198.55:8000' : 'http://localhost:8000';
};

export const API_BASE_URL = getBackendBaseUrl();
console.log(`[CampusQuest] Backend API Base URL configured: ${API_BASE_URL}`);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 10 Canonical CIT Story Spawns (Fixed physical campus landmark locations)
 */
export const FALLBACK_CIT_SPAWNS: SpawnPoint[] = [
  { id: 'cit-story-1', name: 'CIT CyberDragon', rarity: 'LEGENDARY', latitude: 11.026820, longitude: 77.027450 },
  { id: 'cit-story-2', name: 'QuantumSprite', rarity: 'EPIC', latitude: 11.028050, longitude: 77.026720 },
  { id: 'cit-story-3', name: 'RoboGolem', rarity: 'EPIC', latitude: 11.027450, longitude: 77.026950 },
  { id: 'cit-story-4', name: 'CircuitPhoenix', rarity: 'RARE', latitude: 11.027150, longitude: 77.027550 },
  { id: 'cit-story-5', name: 'CodePhantom', rarity: 'RARE', latitude: 11.028640, longitude: 77.027850 },
  { id: 'cit-story-6', name: 'NeuralFox', rarity: 'RARE', latitude: 11.029210, longitude: 77.027050 },
  { id: 'cit-story-7', name: 'ByteFalcon', rarity: 'COMMON', latitude: 11.028420, longitude: 77.026510 },
  { id: 'cit-story-8', name: 'SiliconTitan', rarity: 'COMMON', latitude: 11.029350, longitude: 77.028640 },
  { id: 'cit-story-9', name: 'CampusOwl', rarity: 'COMMON', latitude: 11.026610, longitude: 77.028020 },
  { id: 'cit-story-10', name: 'AeroMech', rarity: 'COMMON', latitude: 11.026150, longitude: 77.027200 },
];

export interface LootCrateItem {
  id: string;
  name: string;
  reward_type: 'ENERGY' | 'COINS' | 'XP';
  reward_amount: number;
  campus_sector: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export const FALLBACK_LOOT_CRATES: LootCrateItem[] = [
  {
    id: 'cit-loot-1',
    name: 'CIT Canteen Supply Crate',
    reward_type: 'ENERGY',
    reward_amount: 50,
    campus_sector: 'Student Canteen & Food Court',
    latitude: 11.026950,
    longitude: 77.027750,
    is_active: true,
  },
  {
    id: 'cit-loot-2',
    name: 'Library Quantum Data Crystal',
    reward_type: 'COINS',
    reward_amount: 100,
    campus_sector: 'Central Library',
    latitude: 11.028150,
    longitude: 77.026850,
    is_active: true,
  },
  {
    id: 'cit-loot-3',
    name: 'Sports Stadium Energy Battery',
    reward_type: 'ENERGY',
    reward_amount: 40,
    campus_sector: 'Main Sports Pavilion',
    latitude: 11.029400,
    longitude: 77.028400,
    is_active: true,
  },
];

export interface BestiaryEntryData {
  creature_name: string;
  rarity: RarityTier;
  sector: string;
  discovered: boolean;
  captured_count: number;
  first_caught_at?: string;
  emoji: string;
  xp_reward: number;
}

/**
 * Fetches canonical story spawns from the FastAPI backend.
 */
export async function fetchSpawns(count = 10): Promise<SpawnPoint[]> {
  try {
    const response = await apiClient.get<SpawnPoint[]>(`/api/spawns?count=${count}`);
    return response.data;
  } catch (error) {
    console.warn(`[CampusQuest] Backend fetch failed at ${API_BASE_URL}/api/spawns, using CIT fallback story data.`, error);
    return FALLBACK_CIT_SPAWNS;
  }
}

/**
 * Fetches the player's Bestiary (Pokedex)
 */
export async function fetchBestiary(token?: string | null): Promise<{
  total_discovered: number;
  total_creatures: number;
  entries: BestiaryEntryData[];
}> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.get('/api/gameplay/bestiary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e) {
    console.warn('[Bestiary] Failed to fetch live bestiary:', e);
  }

  // Fallback local bestiary for guest/fresh cadet
  return {
    total_discovered: 0,
    total_creatures: FALLBACK_CIT_SPAWNS.length,
    entries: FALLBACK_CIT_SPAWNS.map((s) => ({
      creature_name: s.name,
      rarity: s.rarity || 'COMMON',
      sector: 'CIT Campus Landmark',
      discovered: false,
      captured_count: 0,
      emoji: '👾',
      xp_reward: 200,
    })),
  };
}

/**
 * Record a capture to award XP and update stats
 */
export async function recordCaptureApi(
  payload: {
    creature_name: string;
    rarity: string;
    campus_sector?: string;
    latitude: number;
    longitude: number;
  },
  token?: string | null
) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post('/api/gameplay/catch', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e) {
    console.warn('[Catch] API recording failed, using local offline calculation:', e);
  }
  return {
    success: true,
    message: `Captured ${payload.creature_name}!`,
    xp_gained: 250,
    level_up: false,
    new_level: 1,
    new_xp: 250,
    current_energy: 90,
  };
}

/**
 * Fetches collectible loot crates on campus
 */
export async function fetchLootCratesApi(): Promise<LootCrateItem[]> {
  try {
    const res = await apiClient.get<LootCrateItem[]>('/api/gameplay/loot');
    return res.data;
  } catch (e) {
    return FALLBACK_LOOT_CRATES;
  }
}

/**
 * Claim a loot crate reward
 */
export async function claimLootCrateApi(crateId: string, token?: string | null) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        '/api/gameplay/claim-loot',
        { crate_id: crateId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e) {
    console.warn('[Loot] Claim API failed:', e);
  }
  return {
    success: true,
    reward_type: 'ENERGY',
    reward_amount: 50,
    message: 'Claimed +50 Energy!',
    new_energy: 100,
    new_coins: 100,
    new_xp: 50,
  };
}

export interface ShopItemData {
  id: string;
  name: string;
  category: 'SUPPLIES' | 'BUFFS' | 'TITLES';
  description: string;
  icon: string;
  cost_coins: number;
  effect_type: string;
  effect_value: string;
}

export const FALLBACK_SHOP_ITEMS: ShopItemData[] = [
  {
    id: 'battery_50',
    name: 'Quantum Battery Pack',
    category: 'SUPPLIES',
    description: 'Recharges +50 Energy immediately to keep hunting campus anomalies.',
    icon: '⚡',
    cost_coins: 15,
    effect_type: 'ENERGY_RESTORE',
    effect_value: '50',
  },
  {
    id: 'battery_full',
    name: 'Overcharged Supercell',
    category: 'SUPPLIES',
    description: 'Fully overcharges your sensor suit to maximum 100 HP/Energy.',
    icon: '🔋',
    cost_coins: 25,
    effect_type: 'ENERGY_RESTORE',
    effect_value: '100',
  },
  {
    id: 'master_trap',
    name: 'CIT Master Containment Trap',
    category: 'SUPPLIES',
    description: 'Increases capture probability on Legendary and Epic anomalies by 50%.',
    icon: '🎯',
    cost_coins: 40,
    effect_type: 'BUFF',
    effect_value: 'CAPTURE_BOOST_50',
  },
  {
    id: 'radar_booster',
    name: 'CyberRadar Signal Amplifier',
    category: 'BUFFS',
    description: 'Doubles the radar sensor sweep range across CIT grounds for 30 minutes.',
    icon: '📡',
    cost_coins: 30,
    effect_type: 'BUFF',
    effect_value: 'RADAR_BOOST_30M',
  },
  {
    id: 'title_pioneer',
    name: 'Badge: CIT Cyber Pioneer',
    category: 'TITLES',
    description: 'Exclusive holographic badge shown on your Cadet Dossier & Radar.',
    icon: '🎖️',
    cost_coins: 50,
    effect_type: 'TITLE',
    effect_value: 'CIT Cyber Pioneer',
  },
  {
    id: 'title_legend',
    name: 'Badge: CIT Sovereign Legend',
    category: 'TITLES',
    description: 'Highest collegiate honor for master campus explorers & anomaly hunters.',
    icon: '👑',
    cost_coins: 100,
    effect_type: 'TITLE',
    effect_value: 'CIT Sovereign Legend',
  },
];

export async function fetchShopItemsApi(): Promise<ShopItemData[]> {
  try {
    const res = await apiClient.get<ShopItemData[]>('/api/shop/items');
    return res.data;
  } catch (e) {
    return FALLBACK_SHOP_ITEMS;
  }
}

export async function buyShopItemApi(itemId: string, token?: string | null) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        '/api/shop/buy',
        { item_id: itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e: any) {
    if (e.response?.data?.detail) {
      throw new Error(e.response.data.detail);
    }
    throw e;
  }
  return {
    success: true,
    message: 'Item redeemed successfully from Campus Armory!',
    item: FALLBACK_SHOP_ITEMS.find((i) => i.id === itemId),
  };
}

export interface AdminOverviewData {
  admin_username: string;
  total_cadets: number;
  total_captures: number;
  canonical_story_spawns: number;
  custom_active_spawns: number;
  active_loot_crates: number;
}

export async function fetchAdminOverviewApi(token?: string | null): Promise<AdminOverviewData> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.get('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e) {
    console.warn('[Admin] Overview fetch failed:', e);
  }
  return {
    admin_username: 'CIT Admin',
    total_cadets: 42,
    total_captures: 128,
    canonical_story_spawns: 10,
    custom_active_spawns: 2,
    active_loot_crates: 3,
  };
}

export async function adminCreateSpawnApi(
  payload: { name: string; rarity: string; latitude: number; longitude: number },
  token?: string | null
) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post('/api/admin/spawn', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e: any) {
    if (e.response?.data?.detail) {
      throw new Error(e.response.data.detail);
    }
    throw e;
  }
  return {
    success: true,
    message: `Deployed ${payload.name} (${payload.rarity}) to CIT Campus!`,
  };
}

export async function adminDeleteSpawnApi(spawnId: string, token?: string | null) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.delete(`/api/admin/spawn/${spawnId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e: any) {
    if (e.response?.data?.detail) {
      throw new Error(e.response.data.detail);
    }
    throw e;
  }
  return {
    success: true,
    message: 'Spawn removed from campus.',
  };
}

export async function adminCreateLootApi(
  payload: {
    name: string;
    reward_type: string;
    reward_amount: number;
    campus_sector: string;
    latitude: number;
    longitude: number;
  },
  token?: string | null
) {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post('/api/admin/loot', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e: any) {
    if (e.response?.data?.detail) {
      throw new Error(e.response.data.detail);
    }
    throw e;
  }
  return {
    success: true,
    message: `Dropped supply crate ${payload.name} at ${payload.campus_sector}!`,
  };
}


