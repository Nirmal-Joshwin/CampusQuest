import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ARCreatureModel from '../components/ARCreatureModel';
import { getCreatureEmoji, getRarityConfig, RarityTier } from '../utils/haversine';
import { useAuth } from '../context/AuthContext';
import { recordCaptureApi } from '../utils/api';

export default function WebCatchScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    rarity?: string;
    distance?: string;
  }>();

  const creatureName = params.name || 'Super Fluffy Cat';
  const rarity = (params.rarity as RarityTier) || 'RARE';
  const rarityConfig = getRarityConfig(rarity);
  const creatureEmoji = getCreatureEmoji(creatureName);

  const [caught, setCaught] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const handleCatchCreature = async () => {
    if (caught || capturing) return;
    setCapturing(true);

    try {
      if (token) {
        await recordCaptureApi(
          {
            creature_name: creatureName,
            rarity: rarity,
            campus_sector: 'CIT Campus Landmark',
            latitude: 11.0278,
            longitude: 77.0282,
          },
          token
        );
      }
      setCaught(true);
      if (user) {
        updateProfile({});
      }

      const msg = `🎉 Caught! You successfully captured ${creatureName} in 3D AR! Added to your Campus Bestiary.`;
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(msg);
        router.back();
      } else {
        Alert.alert('🎉 Caught!', msg, [{ text: 'Great!', onPress: () => router.back() }]);
      }
    } catch (e) {
      setCaught(true);
      const fallbackMsg = `🎉 Caught! ${creatureName} added to your collection!`;
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(fallbackMsg);
        router.back();
      } else {
        Alert.alert('🎉 Caught!', fallbackMsg, [{ text: 'Great!', onPress: () => router.back() }]);
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHud}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>✕ Escape to Radar</Text>
        </TouchableOpacity>
        <View style={[styles.targetBadge, { borderColor: rarityConfig.color }]}>
          <Text style={styles.targetBadgeText}>⚡ 3D AR HUNT ENCOUNTER</Text>
        </View>
      </View>

      {/* AR Viewport */}
      <View style={styles.viewport}>
        {/* Animated Reticle Ring */}
        <View style={styles.reticleRing} pointerEvents="none">
          <View style={[styles.innerReticleRing, { borderColor: rarityConfig.color }]} />
        </View>

        {/* 3D Model: Super Fluffy Cat */}
        <ARCreatureModel
          creatureName={creatureName}
          rarity={rarity}
          creatureEmoji={creatureEmoji}
          isCapturing={capturing}
          onPress={handleCatchCreature}
        />

        {/* Target Details Badge */}
        <View style={styles.metaBadge}>
          <Text style={styles.creatureNameText}>{creatureName}</Text>
          <Text style={[styles.rarityText, { color: rarityConfig.color }]}>
            {rarity} TIER • +{rarityConfig.xpReward} XP REWARD
          </Text>
        </View>
      </View>

      {/* Bottom Hint */}
      <View style={styles.bottomHud}>
        <Text style={styles.hintText}>👆 Touch the 3D creature onscreen to capture!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  topHud: {
    width: '100%',
    maxWidth: 600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: 'bold',
  },
  targetBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  targetBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  viewport: {
    width: '100%',
    maxWidth: 520,
    height: 480,
    borderRadius: 24,
    backgroundColor: '#090E24',
    borderWidth: 2,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  reticleRing: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerReticleRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderStyle: 'dotted',
    opacity: 0.4,
  },
  metaBadge: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  creatureNameText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  bottomHud: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
