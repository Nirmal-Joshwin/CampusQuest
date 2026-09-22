import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import {
  triggerHapticTap,
  triggerHapticSuccess,
  triggerHapticWarning,
  triggerHapticSelection,
} from '../utils/haptics';
import {
  playTapSound,
  playSwooshSound,
  playCoinSound,
  playCatchSound,
} from '../utils/sound';

const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'AI&DS'];

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, isLoading } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [department, setDepartment] = useState('CSE');

  const handleSubmit = async () => {
    if (!email || !password) {
      triggerHapticWarning();
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    if (isRegister) {
      if (!username) {
        triggerHapticWarning();
        Alert.alert('Callsign Required', 'Please choose a player username callsign.');
        return;
      }
      triggerHapticTap();
      const success = await register(email, username, password, role, department);
      if (success) {
        triggerHapticSuccess();
        playCatchSound();
        Alert.alert('🎉 Welcome Cadet!', `Account registered successfully as ${role}.`, [
          { text: 'Start Quest', onPress: () => router.replace('/') },
        ]);
      } else {
        triggerHapticWarning();
      }
    } else {
      triggerHapticTap();
      const success = await login(email, password);
      if (success) {
        triggerHapticSuccess();
        playCoinSound();
        router.replace('/');
      } else {
        triggerHapticWarning();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoEmoji}>⚡</Text>
            <Text style={styles.appTitle}>CIT CAMPUSQUEST</Text>
            <Text style={styles.appSubtitle}>Augmented Reality Campus Odyssey</Text>
          </View>

          {/* Form Card */}
          <View style={[liquidGlass.card, styles.card]}>
            {/* Mode Switcher */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, !isRegister && styles.activeTab]}
                onPress={() => {
                  triggerHapticSelection();
                  playTapSound();
                  setIsRegister(false);
                }}
              >
                <Text style={[styles.tabText, !isRegister && styles.activeTabText]}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, isRegister && styles.activeTab]}
                onPress={() => {
                  triggerHapticSelection();
                  playTapSound();
                  setIsRegister(true);
                }}
              >
                <Text style={[styles.tabText, isRegister && styles.activeTabText]}>REGISTER CADET</Text>
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PLAYER CALLSIGN / USERNAME</Text>
                <TextInput
                  style={[liquidGlass.input, styles.input]}
                  placeholder="e.g. CyberKnight"
                  placeholderTextColor="#64748B"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CAMPUS EMAIL</Text>
              <TextInput
                style={[liquidGlass.input, styles.input]}
                placeholder="e.g. student@cit.edu.in"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SECURITY ACCESS CODE (PASSWORD)</Text>
              <TextInput
                style={[liquidGlass.input, styles.input]}
                placeholder="••••••••"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {isRegister && (
              <>
                {/* Role Toggle */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CLEARANCE ROLE</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.roleChip, role === 'STUDENT' && styles.activeRoleChip]}
                      onPress={() => {
                        triggerHapticTap();
                        playTapSound();
                        setRole('STUDENT');
                      }}
                    >
                      <Text style={[styles.chipText, role === 'STUDENT' && styles.activeChipText]}>
                        🎓 Student Cadet
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleChip, role === 'ADMIN' && styles.activeRoleChip]}
                      onPress={() => {
                        triggerHapticTap();
                        playTapSound();
                        setRole('ADMIN');
                      }}
                    >
                      <Text style={[styles.chipText, role === 'ADMIN' && styles.activeChipText]}>
                        🛡️ Campus Admin
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Department Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT DIVISION</Text>
                  <View style={styles.deptGrid}>
                    {DEPARTMENTS.map((dept) => (
                      <TouchableOpacity
                        key={dept}
                        style={[styles.deptChip, department === dept && styles.activeDeptChip]}
                        onPress={() => {
                          triggerHapticTap();
                          playTapSound();
                          setDepartment(dept);
                        }}
                      >
                        <Text style={[styles.deptText, department === dept && styles.activeDeptText]}>
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[liquidGlass.button, liquidGlass.buttonCyan, styles.submitButton]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isRegister ? '⚡ ENLIST IN CAMPUSQUEST' : '🚀 INITIALIZE RADAR ACCESS'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Guest Bypass */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                router.replace('/');
              }}
            >
              <Text style={styles.guestButtonText}>Continue as Guest Cadet ➔</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 18,
  },
  logoEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  appTitle: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  appSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: 24,
    borderRadius: 28,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 9999,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9999,
  },
  activeTab: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  activeRoleChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.20)',
    borderColor: '#38BDF8',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeChipText: {
    color: '#38BDF8',
  },
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  activeDeptChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38BDF8',
  },
  deptText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  activeDeptText: {
    color: '#FFFFFF',
  },
  submitButton: {
    marginTop: 12,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  guestButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  guestButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
});

