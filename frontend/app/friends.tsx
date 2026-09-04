import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  fetchFriendsApi,
  addFriendApi,
  removeFriendApi,
  searchCadetsApi,
  pingFriendApi,
  FriendItem,
  CadetSearchResult,
} from '../utils/friends';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticWarning } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCoinSound, playRadarSound } from '../utils/sound';

export default function FriendsScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CadetSearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [addUsernameInput, setAddUsernameInput] = useState<string>('');
  const [addingFriend, setAddingFriend] = useState<boolean>(false);

  const loadFriends = async () => {
    try {
      setRefreshing(true);
      const list = await fetchFriendsApi(token);
      setFriends(list);
    } catch (e) {
      console.warn('Error loading friends:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [token]);

  // Handle Search Cadets
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchCadetsApi(text, token);
      setSearchResults(results);
    } catch (e) {
      console.warn('Error searching:', e);
    } finally {
      setSearching(false);
    }
  };

  // Add friend
  const handleAddFriend = async (targetUsername: string) => {
    if (!targetUsername.trim()) return;
    setAddingFriend(true);
    try {
      const res = await addFriendApi(targetUsername, token);
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('🤝 Friend Added!', res.message);
      setAddUsernameInput('');
      setSearchQuery('');
      setSearchResults([]);
      loadFriends();
    } catch (e: any) {
      triggerHapticWarning();
      Alert.alert('⚠️ Could Not Add', e.message || 'Error adding friend.');
    } finally {
      setAddingFriend(false);
    }
  };

  // Remove friend
  const handleRemoveFriend = (friend: FriendItem) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.username} from your campus friend radar?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            triggerHapticTap();
            await removeFriendApi(friend.friend_id || friend.id, token);
            setFriends((prev) => prev.filter((f) => f.id !== friend.id));
          },
        },
      ]
    );
  };

  // Radar Ping
  const handlePingFriend = async (friend: FriendItem) => {
    try {
      const res = await pingFriendApi(friend.friend_id || friend.id, token);
      triggerHapticSuccess();
      playRadarSound();
      Alert.alert(
        `📡 Radar Ping Transmitted!`,
        `${res.message}\n\n${friend.username} is currently stationed around: ${friend.campus_sector}.\nReturn to map to view their live ping beacon!`,
        [
          { text: 'View on Map', onPress: () => {
            triggerHapticTap();
            playSwooshSound();
            router.push('/');
          }},
          { text: 'Close', style: 'default' },
        ]
      );
    } catch (e) {
      triggerHapticSuccess();
      playRadarSound();
      Alert.alert('📡 Ping Sent', `Transmitted radar wave to ${friend.username}!`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.backButtonText}>← Map</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>👥 Campus Friends</Text>
          <Text style={styles.headerSubtitle}>
            {friends.length} Active Study Buddies on Radar
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            triggerHapticTap();
            playTapSound();
            loadFriends();
          }}
        >
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Add Bar */}
      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>ADD NEW CAMPUS FRIEND</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter cadet username or dept..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddFriend(searchQuery)}
              disabled={addingFriend}
            >
              {addingFriend ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addButtonText}>+ Add</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsBox}>
            <Text style={styles.searchResultHeader}>MATCHING CIT CADETS:</Text>
            {searchResults.map((cadet) => (
              <View key={cadet.id} style={styles.searchResultRow}>
                <View>
                  <Text style={styles.searchCadetName}>{cadet.username}</Text>
                  <Text style={styles.searchCadetMeta}>
                    {cadet.department} • Lvl {cadet.level} • {cadet.avatar_title}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallAddButton}
                  onPress={() => handleAddFriend(cadet.username)}
                >
                  <Text style={styles.smallAddButtonText}>+ Add Buddy</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Friends List */}
      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>MY FRIEND RADAR ({friends.length})</Text>
          <Text style={styles.infoBadge}>Showing on Map</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Scanning Friend Frequencies...</Text>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={styles.emptyTitle}>No Friends on Radar Yet</Text>
            <Text style={styles.emptyDesc}>
              Add your CIT classmates above to see their live beacons and team up on campus!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={loadFriends}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.friendCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatarBubble}>
                    <Text style={styles.avatarEmoji}>👨‍💻</Text>
                    {item.is_online && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.cadetInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.cadetUsername}>{item.username}</Text>
                      <View style={styles.deptPill}>
                        <Text style={styles.deptPillText}>{item.department}</Text>
                      </View>
                      <View style={styles.levelPill}>
                        <Text style={styles.levelPillText}>Lvl {item.level}</Text>
                      </View>
                    </View>
                    <Text style={styles.cadetTitle}>{item.avatar_title}</Text>
                    <Text style={styles.sectorText}>
                      📍 <Text style={styles.sectorHighlight}>{item.campus_sector}</Text>
                    </Text>
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.pingButton}
                    onPress={() => handlePingFriend(item)}
                  >
                    <Text style={styles.pingButtonText}>📡 Ping on Map Radar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveFriend(item)}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.50)',
  },
  backButtonText: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.50)',
  },
  refreshButtonText: {
    fontSize: 14,
  },
  addSection: {
    padding: 16,
    backgroundColor: GLASS_COLORS.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  addButton: {
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  searchResultsBox: {
    marginTop: 10,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  searchResultHeader: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchCadetName: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 13,
  },
  searchCadetMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  smallAddButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  smallAddButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    padding: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#86EFAC',
    borderColor: '#22C55E',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  friendCard: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderTopColor: 'rgba(209, 250, 229, 0.75)',
    borderBottomColor: 'rgba(16, 185, 129, 0.15)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderTopColor: 'rgba(209, 250, 229, 0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0A1226',
  },
  cadetInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cadetUsername: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  deptPill: {
    backgroundColor: 'rgba(14, 116, 144, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  deptPillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  levelPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  levelPillText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cadetTitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
  },
  sectorText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  sectorHighlight: {
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pingButton: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.60)',
    borderTopColor: 'rgba(209, 250, 229, 0.85)',
  },
  pingButtonText: {
    color: '#86EFAC',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  deleteButtonText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#38BDF8',
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

