/**
 * Creature Encounter Challenges & Campus Lore Mini-Games
 * Mapped to CIT landmarks, departments, and rarity tiers.
 */

export interface CreatureChallenge {
  creatureName: string;
  landmark: string;
  department: string;
  challengeType: 'TRIVIA' | 'CYBER_DECODE';
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  bonusXp: number;
  bonusCatchRate: number; // e.g. 0.25 = +25%
}

export const CREATURE_CHALLENGES: Record<string, CreatureChallenge> = {
  'CIT CyberDragon': {
    creatureName: 'CIT CyberDragon',
    landmark: 'Admin Block & Tower',
    department: 'CIT Autonomous Heritage',
    challengeType: 'TRIVIA',
    title: '👑 Sovereign Heritage Protocol',
    prompt: 'At the CIT Administrative Tower, ancient foundation seals resonate. In what historic year was Coimbatore Institute of Technology established by the V. Rangasamy Naidu Educational Trust?',
    options: ['1956', '1972', '1984'],
    correctIndex: 0,
    explanation: 'Access Granted! CIT was founded in 1956 as one of Tamil Nadu’s premier autonomous institutions.',
    bonusXp: 200,
    bonusCatchRate: 0.35,
  },
  'QuantumSprite': {
    creatureName: 'QuantumSprite',
    landmark: 'CIT Central Library & Repository',
    department: 'Science & Research',
    challengeType: 'TRIVIA',
    title: '📚 Central Archive Decryption',
    prompt: 'In the CIT Digital Library database, what international technical body powers our primary research literature (IEEE)?',
    options: [
      'Institute of Electrical and Electronics Engineers',
      'International Educational & Engineering Enterprise',
      'Indian Electronic Engineering Exchange',
    ],
    correctIndex: 0,
    explanation: 'Access Granted! IEEE standards power CIT academic archives.',
    bonusXp: 120,
    bonusCatchRate: 0.25,
  },
  'RoboGolem': {
    creatureName: 'RoboGolem',
    landmark: 'Mechanical & CAD Automation Lab',
    department: 'Mechanical Engineering',
    challengeType: 'TRIVIA',
    title: '⚙️ Torque Transmission Shield',
    prompt: 'At the Mechanical Mechatronics Lab: In gear train engineering, what fundamental physical quantity is multiplied when shaft speed is stepped down?',
    options: ['Torque', 'Capacitance', 'Viscosity'],
    correctIndex: 0,
    explanation: 'Access Granted! Mechanical torque multiplies inversely with angular velocity.',
    bonusXp: 120,
    bonusCatchRate: 0.25,
  },
  'CircuitPhoenix': {
    creatureName: 'CircuitPhoenix',
    landmark: 'ECE & Embedded Systems Wing',
    department: 'ECE',
    challengeType: 'TRIVIA',
    title: '⚡ Ohm’s Resonance Lock',
    prompt: 'At the ECE Circuit Lab: What is the fundamental formula relating Voltage (V), Current (I), and Resistance (R)?',
    options: ['V = I × R', 'V = I / R', 'V = R / I'],
    correctIndex: 0,
    explanation: 'Access Granted! Ohm’s Law: V = I × R verified.',
    bonusXp: 80,
    bonusCatchRate: 0.20,
  },
  'CodePhantom': {
    creatureName: 'CodePhantom',
    landmark: 'Open Air Theatre (OAT) & CSE',
    department: 'Computer Science',
    challengeType: 'TRIVIA',
    title: '💻 Algorithm Complexity Matrix',
    prompt: 'At the CIT Open Air Theatre hacking terminal: What is the worst-case time complexity of searching a sorted array using Binary Search?',
    options: ['O(log n)', 'O(n²)', 'O(n!)'],
    correctIndex: 0,
    explanation: 'Access Granted! Binary Search operates in logarithmic O(log n) time.',
    bonusXp: 80,
    bonusCatchRate: 0.20,
  },
  'NeuralFox': {
    creatureName: 'NeuralFox',
    landmark: 'Hostels Quadrangle Node',
    department: 'AI & Data Science',
    challengeType: 'TRIVIA',
    title: '🧠 Neural Activation Firewall',
    prompt: 'In artificial neural network architecture, which classic activation function squashes any real-valued input strictly between 0 and 1?',
    options: ['Sigmoid Function', 'ReLU Function', 'Linear Step'],
    correctIndex: 0,
    explanation: 'Access Granted! The Sigmoid function normalizes inputs into a (0, 1) probability space.',
    bonusXp: 80,
    bonusCatchRate: 0.20,
  },
};

export function getCreatureChallenge(creatureName: string): CreatureChallenge | null {
  return CREATURE_CHALLENGES[creatureName] || null;
}

