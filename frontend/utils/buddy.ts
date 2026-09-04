// In-memory & reactive companion buddy manager
let activeBuddyName: string = 'ByteFalcon';

export function getActiveBuddy(): string {
  return activeBuddyName;
}

export function setActiveBuddy(creatureName: string): void {
  activeBuddyName = creatureName;
}

