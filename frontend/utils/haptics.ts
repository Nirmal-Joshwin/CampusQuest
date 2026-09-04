import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Tactical Haptics Engine for CampusQuest
 * Provides physical feedback vibrations for map actions, menu taps,
 * creature catches, and turf battles.
 */

export const triggerHapticTap = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Graceful fallback if haptics hardware is unavailable
  }
};

export const triggerHapticImpact = async (style: 'medium' | 'heavy' = 'medium') => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(
        style === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium
      );
    }
  } catch {}
};

export const triggerHapticSuccess = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {}
};

export const triggerHapticWarning = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {}
};

export const triggerHapticSelection = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
  } catch {}
};

