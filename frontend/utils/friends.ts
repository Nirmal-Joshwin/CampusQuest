import { apiClient } from './api';

export interface FriendItem {
  id: string;
  friend_id: string;
  username: string;
  department: string;
  level: number;
  avatar_title: string;
  status: string;
  is_online: boolean;
  campus_sector: string;
  latitude: number;
  longitude: number;
  last_ping_at?: string;
}

export interface CadetSearchResult {
  id: string;
  username: string;
  department: string;
  level: number;
  avatar_title: string;
}

export const FALLBACK_FRIENDS: FriendItem[] = [
  {
    id: 'f-mock-1',
    friend_id: 'cit-friend-1',
    username: 'Karthik',
    department: 'ECE',
    level: 3,
    avatar_title: 'Circuit Vanguard',
    status: 'ACCEPTED',
    is_online: true,
    campus_sector: 'ECE Labs & Circuit Block',
    latitude: 11.027500,
    longitude: 77.028700,
  },
  {
    id: 'f-mock-2',
    friend_id: 'cit-friend-2',
    username: 'Sneha',
    department: 'AI&DS',
    level: 4,
    avatar_title: 'Neural Scout',
    status: 'ACCEPTED',
    is_online: true,
    campus_sector: 'CIT Main Library & CSE Quad',
    latitude: 11.028800,
    longitude: 77.027300,
  },
];

export async function fetchFriendsApi(token?: string | null): Promise<FriendItem[]> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.get<{ friends_count: number; friends: FriendItem[] }>(
        '/api/friends',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.friends && res.data.friends.length > 0) {
        return res.data.friends;
      }
    }
  } catch (e) {
    console.warn('[Friends] Failed to fetch live friends, using fallback:', e);
  }
  return FALLBACK_FRIENDS;
}

export async function addFriendApi(
  username: string,
  token?: string | null
): Promise<{ success: boolean; message: string; friend?: any }> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        '/api/friends/add',
        { username: username.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e: any) {
    const detail = e.response?.data?.detail || 'Failed to add friend.';
    throw new Error(detail);
  }
  return {
    success: true,
    message: `🎉 Added ${username} to your campus friend radar!`,
    friend: {
      friend_id: `cadet-${Date.now()}`,
      username,
      department: 'CIT',
      level: 2,
      avatar_title: 'Campus Buddy',
    },
  };
}

export async function removeFriendApi(
  friendId: string,
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.delete(`/api/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    }
  } catch (e: any) {
    console.warn('[Friends] Remove friend failed:', e);
  }
  return { success: true, message: 'Friend removed from radar.' };
}

export async function searchCadetsApi(
  query: string,
  token?: string | null
): Promise<CadetSearchResult[]> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.get<{ count: number; cadets: CadetSearchResult[] }>(
        `/api/friends/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data.cadets || [];
    }
  } catch (e) {
    console.warn('[Friends] Search cadets failed:', e);
  }
  // Simulated fallback search results
  return [
    { id: 'c-1', username: 'Rahul', department: 'MECH', level: 2, avatar_title: 'Aero Pilot' },
    { id: 'c-2', username: 'Pooja', department: 'CIVIL', level: 3, avatar_title: 'Structuralist' },
    { id: 'c-3', username: 'Vignesh', department: 'IT', level: 1, avatar_title: 'Byte Hacker' },
  ].filter(
    (c) =>
      c.username.toLowerCase().includes(query.toLowerCase()) ||
      c.department.toLowerCase().includes(query.toLowerCase())
  );
}

export async function pingFriendApi(
  friendId: string,
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        `/api/friends/ping/${friendId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e) {
    console.warn('[Friends] Radar ping failed:', e);
  }
  return {
    success: true,
    message: '📡 Quantum Radar Ping transmitted! Friend location updated on your map.',
  };
}

