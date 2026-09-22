import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCoinSound } from '../utils/sound';

const AVATAR_TITLES = [
  'CIT Campus Explorer',
  'Quantum Algorithm Specialist',
  'Legendary Beast Hunter',
  'Hardware Architect',
  'Autonomous Rover Engineer',
  'Cyberpunk Grandmaster',
];

const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'AI&DS'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || 'Cadet');
  const [department, setDepartment] = useState(user?.department || 'CSE');
  const [avatarTitle, setAvatarTitle] = useState(user?.avatar_title || 'CIT Campus Explorer');

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>No Cadet Logged In</Text>
          <Text style={styles.emptyText}>Please sign in to view and customize your CIT Player Profile.</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/login')}>
            <Text style={styles.signInButtonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate XP progress for current level
  const xpCurrent = user.xp % 1000;
  const xpNeeded = 1000;
  const xpPercent = Math.min(100, Math.round((xpCurrent / xpNeeded) * 100));

  const handleSaveProfile = async () => {
    const success = await updateProfile({
      username,
      department,
      avatar_title: avatarTitle,
    });
    if (success) {
      setIsEditing(false);
      triggerHapticSuccess();
      playCoinSound();
      Alert.alert('✅ Profile Updated', 'Your player ID credentials have been synchronized.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          triggerHapticTap();
          playSwooshSound();
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Bar */}
        <View style={styles.navBar}>
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
          <Text style={styles.navTitle}>CADET DOSSIER</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              triggerHapticTap();
              playTapSound();
              if (isEditing) handleSaveProfile();
              else setIsEditing(true);
            }}
          >
            <Text style={styles.editButtonText}>{isEditing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Cyberpunk ID Card */}
        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>
                {user.role === 'ADMIN' ? '🛡️' : '👨‍💻'}
              </Text>
            </View>
            <View style={styles.idInfo}>
              <View style={styles.roleBadgeRow}>
                <View
                  style={[
                    styles.roleBadge,
                    user.role === 'ADMIN' ? styles.adminBadge : styles.studentBadge,
                  ]}
                >
                  <Text style={styles.roleBadgeText}>
                    {user.role === 'ADMIN' ? '🛡️ CAMPUS ADMIN' : '🎓 CIT CADET'}
                  </Text>
                </View>
                <View style={styles.deptBadge}>
                  <Text style={styles.deptBadgeText}>{user.department}</Text>
                </View>
              </View>

              {isEditing ? (
                <TextInput
                  style={styles.editInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Player Callsign"
                  placeholderTextColor="#64748B"
                />
              ) : (
                <Text style={styles.userNameText}>{user.username}</Text>
              )}

              <Text style={styles.userTitleText}>{user.avatar_title}</Text>
              <Text style={styles.userEmailText}>{user.email}</Text>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.statsDivider} />

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>LEVEL</Text>
              <Text style={styles.statValue}>{user.level}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ENERGY</Text>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>
                {user.energy}/{user.max_energy}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TOTAL XP</Text>
              <Text style={[styles.statValue, { color: '#FBBF24' }]}>{user.xp}</Text>
            </View>
          </View>

          {/* EXP Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>LEVEL {user.level} PROGRESS</Text>
              <Text style={styles.progressPercent}>{xpPercent}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${xpPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Customization Options */}
        {isEditing && (
          <View style={styles.customSection}>
            <Text style={styles.sectionHeader}>SELECT AVATAR TITLE</Text>
            <View style={styles.titleOptionsGrid}>
              {AVATAR_TITLES.map((title) => (
                <TouchableOpacity
                  key={title}
                  style={[
                    styles.titleChip,
                    avatarTitle === title && styles.activeTitleChip,
                  ]}
                  onPress={() => {
                    triggerHapticTap();
                    playTapSound();
                    setAvatarTitle(title);
                  }}
                >
                  <Text
                    style={[
                      styles.titleChipText,
                      avatarTitle === title && styles.activeTitleChipText,
                    ]}
                  >
                    {title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 18 }]}>
              SELECT DEPARTMENT DIVISION
            </Text>
            <View style={styles.deptOptionsGrid}>
              {DEPARTMENTS.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.deptOptionChip,
                    department === dept && styles.activeDeptOptionChip,
                  ]}
                  onPress={() => {
                    triggerHapticTap();
                    playTapSound();
                    setDepartment(dept);
                  }}
                >
                  <Text
                    style={[
                      styles.deptOptionText,
                      department === dept && styles.activeDeptOptionText,
                    ]}
                  >
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.friendsNavButton}
            onPress={() => {
              triggerHapticTap();
              playSwooshSound();
              router.push('/friends');
            }}
          >
            <Text style={styles.friendsNavButtonText}>👥 My Campus Friends Radar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Sign Out of System</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  scrollContent: {
    padding: 18,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  navTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  editButton: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  idCard: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  idHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarEmoji: {
    fontSize: 34,
  },
  idInfo: {
    flex: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  studentBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  adminBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  roleBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deptBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deptBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  userTitleText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  userEmailText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 18,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressPercent: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  customSection: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    padding: 18,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
  },
  sectionHeader: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  titleOptionsGrid: {
    gap: 8,
  },
  titleChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  activeTitleChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.60)',
    borderTopColor: 'rgba(254, 243, 199, 0.85)',
  },
  titleChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTitleChipText: {
    color: '#FBBF24',
    fontWeight: 'bold',
  },
  deptOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deptOptionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  activeDeptOptionChip: {
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
  },
  deptOptionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeDeptOptionText: {
    color: '#FFFFFF',
  },
  actionsContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.20)',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.50)',
    borderTopColor: 'rgba(254, 202, 202, 0.75)',
  },
  friendsNavButton: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.55)',
    borderTopColor: 'rgba(209, 250, 229, 0.80)',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  friendsNavButtonText: {
    color: '#86EFAC',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  logoutButtonText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

