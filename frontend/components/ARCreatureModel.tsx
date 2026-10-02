import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getRarityConfig, RarityTier } from '../utils/haversine';

interface ARCreatureModelProps {
  creatureName?: string;
  rarity?: string;
  creatureEmoji?: string;
  isCapturing?: boolean;
  onPress?: () => void;
}

export default function ARCreatureModel({
  creatureName = 'HomeSentinel',
  rarity = 'EPIC',
  creatureEmoji = '🐱',
  isCapturing = false,
  onPress,
}: ARCreatureModelProps) {
  const rarityConfig = getRarityConfig(rarity as RarityTier);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Animation values for capture collapse and ambient levitation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Smooth vertical levitation / hover physics
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    // Safety timeout to show 3D canvas
    const timer = setTimeout(() => setModelLoaded(true), 1200);

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      clearTimeout(timer);
    };
  }, []);

  // Capture vortex collapse animation
  useEffect(() => {
    if (isCapturing) {
      Animated.sequence([
        Animated.timing(captureScale, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(captureScale, {
          toValue: 0.05,
          duration: 500,
          easing: Easing.back(2),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      captureScale.setValue(1);
    }
  }, [isCapturing]);

  // Generates 100% transparent Three.js WebGL HTML string tailored to the creature
  const creatureHtml = useMemo(() => {
    const hexTheme = rarityConfig.color.replace('#', '0x');
    const safeName = creatureName.replace(/[^a-zA-Z0-9]/g, '');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    overflow: hidden;
    background: transparent !important;
    background-color: transparent !important;
  }
  #canvas-container {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: transparent !important;
    background-color: transparent !important;
    cursor: pointer;
  }
  canvas {
    width: 100% !important; height: 100% !important;
    display: block;
    background: transparent !important;
    background-color: transparent !important;
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
<div id="canvas-container"></div>
<script>
  let scene, camera, renderer, rootGroup, tailNodes = [], orbitRing1, orbitRing2, particles, groundRing;
  let isPointerDown = false, prevX = 0, rotVelY = 0;
  const creatureType = "${safeName}";
  const themeColor = ${hexTheme};

  function init() {
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 340;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 100);
    camera.position.set(0, 0.25, 4.2);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Dynamic Studio Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(amb);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.3);
    keyLight.position.set(3, 4, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(themeColor, 1.8);
    rimLight.position.set(-3.5, 2, -3);
    scene.add(rimLight);

    const bottomGlow = new THREE.PointLight(themeColor, 1.2, 5);
    bottomGlow.position.set(0, -1.2, 0.5);
    scene.add(bottomGlow);

    // Root Creature Assembly Group
    rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Build the specific 3D model
    buildCreature(creatureType, themeColor);

    // Build Holographic Ground Ring Beacon
    buildGroundBeacon(themeColor);

    // Build Quantum Sparkle Cloud
    buildParticles(themeColor);

    // Interactive Touch & Swipe Gestures
    container.addEventListener('pointerdown', (e) => {
      isPointerDown = true;
      prevX = e.clientX;
      rotVelY = 0;
    });

    window.addEventListener('pointermove', (e) => {
      if (isPointerDown) {
        const delta = e.clientX - prevX;
        rootGroup.rotation.y += delta * 0.02;
        rotVelY = delta * 0.01;
        prevX = e.clientX;
      }
    });

    window.addEventListener('pointerup', () => {
      isPointerDown = false;
    });

    // Touch-to-Catch Handler
    container.addEventListener('click', () => {
      // Trigger a celebratory energy spin
      rotVelY += 0.25;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CATCH_TAP' }));
      }
    });

    // Signal ready
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
    }

    animate();
  }

  function buildCreature(type, theme) {
    // Common High-Tech Materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.35,
      roughness: 0.25,
    });

    const neonMat = new THREE.MeshStandardMaterial({
      color: theme,
      emissive: theme,
      emissiveIntensity: 1.6,
      roughness: 0.1,
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: theme,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    });

    if (type.includes('Dragon')) {
      buildDragon(bodyMat, armorMat, neonMat, eyeMat);
    } else if (type.includes('Golem') || type.includes('Titan')) {
      buildGolem(bodyMat, armorMat, neonMat, eyeMat);
    } else if (type.includes('Sprite') || type.includes('Phantom')) {
      buildSprite(neonMat, eyeMat, goldMat);
    } else if (type.includes('Falcon') || type.includes('Phoenix') || type.includes('Owl')) {
      buildAvian(bodyMat, armorMat, neonMat, eyeMat);
    } else {
      // Default / HomeSentinel / Cyber Feline Sentinel
      buildCyberSentinel(bodyMat, armorMat, neonMat, eyeMat, goldMat);
    }

    // Concentric Holographic Gyro Orbit Rings
    orbitRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.022, 8, 48),
      new THREE.MeshBasicMaterial({ color: theme, wireframe: false, transparent: true, opacity: 0.75 })
    );
    orbitRing1.rotation.x = Math.PI / 3;
    orbitRing1.rotation.y = Math.PI / 6;
    rootGroup.add(orbitRing1);

    orbitRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.018, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    orbitRing2.rotation.x = -Math.PI / 4;
    orbitRing2.rotation.z = Math.PI / 4;
    rootGroup.add(orbitRing2);

    // Orbiting Power Satellites on Rings
    for (let i = 0; i < 3; i++) {
      const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), neonMat);
      const angle = (i * Math.PI * 2) / 3;
      sat.position.set(Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, 0);
      orbitRing1.add(sat);
    }
  }

  // 1. CYBER MECHA SENTINEL (HomeSentinel, NeuralFox, Felines)
  function buildCyberSentinel(bodyMat, armorMat, neonMat, eyeMat, goldMat) {
    const creature = new THREE.Group();
    rootGroup.add(creature);

    // Torso (Sleek aerodynamic egg with dark carbon underside)
    const bodyGeo = new THREE.SphereGeometry(0.78, 32, 24);
    bodyGeo.scale(0.95, 1.05, 1.25);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, -0.05, 0);
    creature.add(body);

    // Chest Armor Breastplate
    const chestArmorGeo = new THREE.SphereGeometry(0.79, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.45);
    chestArmorGeo.scale(0.96, 1.04, 1.22);
    const chestArmor = new THREE.Mesh(chestArmorGeo, armorMat);
    chestArmor.position.set(0, -0.05, 0.02);
    creature.add(chestArmor);

    // Chest Glowing Reactor Core
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), neonMat);
    core.position.set(0, 0.08, 0.88);
    creature.add(core);

    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 24), armorMat);
    coreRing.position.set(0, 0.08, 0.86);
    creature.add(coreRing);

    // Sculpted Cyber Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0.28);
    creature.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.62, 32, 24);
    headGeo.scale(1.08, 0.94, 1.0);
    const head = new THREE.Mesh(headGeo, bodyMat);
    headGroup.add(head);

    // Pointed Cybernetic Ears with Neon Insets
    const earGeo = new THREE.ConeGeometry(0.28, 0.58, 16);
    const earL = new THREE.Mesh(earGeo, armorMat);
    earL.position.set(-0.42, 0.56, -0.02);
    earL.rotation.set(-0.08, 0, 0.35);
    headGroup.add(earL);

    const inEarL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 16), neonMat);
    inEarL.position.set(-0.41, 0.54, 0.05);
    inEarL.rotation.set(-0.08, 0, 0.35);
    headGroup.add(inEarL);

    const earR = new THREE.Mesh(earGeo, armorMat);
    earR.position.set(0.42, 0.56, -0.02);
    earR.rotation.set(-0.08, 0, -0.35);
    headGroup.add(earR);

    const inEarR = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 16), neonMat);
    inEarR.position.set(0.41, 0.54, 0.05);
    inEarR.rotation.set(-0.08, 0, -0.35);
    headGroup.add(inEarR);

    // Expressive Almond Cyber Eyes
    const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    eyeGeo.scale(1.2, 0.7, 0.5);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.24, 0.06, 0.58);
    eyeL.rotation.set(0.05, 0.25, -0.15);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.24, 0.06, 0.58);
    eyeR.rotation.set(0.05, -0.25, 0.15);
    headGroup.add(eyeR);

    // Eye Specular Highlight Dots
    const hiDotL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hiDotL.position.set(-0.22, 0.09, 0.64);
    headGroup.add(hiDotL);

    const hiDotR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hiDotR.position.set(0.26, 0.09, 0.64);
    headGroup.add(hiDotR);

    // Forehead Floating Cyber Crystal
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), neonMat);
    gem.position.set(0, 0.38, 0.54);
    headGroup.add(gem);

    // Cute Cyber Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), neonMat);
    snout.position.set(0, -0.08, 0.68);
    headGroup.add(snout);

    // High-Tech Collar & Medallion
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.065, 12, 32), armorMat);
    collar.position.set(0, 0.24, 0.15);
    collar.rotation.x = Math.PI / 2.3;
    creature.add(collar);

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), goldMat);
    bell.position.set(0, 0.14, 0.68);
    creature.add(bell);

    // Front Paws with Armor Caps
    const pawGeo = new THREE.SphereGeometry(0.18, 16, 16);
    pawGeo.scale(1.0, 0.65, 1.35);

    const pawL = new THREE.Mesh(pawGeo, bodyMat);
    pawL.position.set(-0.35, -0.72, 0.42);
    creature.add(pawL);

    const pawCapL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), armorMat);
    pawCapL.position.set(-0.35, -0.66, 0.42);
    creature.add(pawCapL);

    const pawR = new THREE.Mesh(pawGeo, bodyMat);
    pawR.position.set(0.35, -0.72, 0.42);
    creature.add(pawR);

    const pawCapR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), armorMat);
    pawCapR.position.set(0.35, -0.66, 0.42);
    creature.add(pawCapR);

    // Rear Haunches
    const haunchL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), armorMat);
    haunchL.position.set(-0.48, -0.35, -0.35);
    creature.add(haunchL);

    const haunchR = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), armorMat);
    haunchR.position.set(0.48, -0.35, -0.35);
    creature.add(haunchR);

    // Articulated 7-Segment Cyber-Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, -0.32, -0.72);
    creature.add(tailGroup);

    tailNodes = [];
    for (let i = 0; i < 7; i++) {
      const radius = 0.15 - i * 0.014;
      const segMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 12),
        i % 2 === 0 ? bodyMat : armorMat
      );
      segMesh.position.set(0, Math.sin(i * 0.35) * 0.22, -i * 0.2);
      tailGroup.add(segMesh);
      tailNodes.push(segMesh);
    }

    // Glowing Energy Crystal Tail Tip
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 8), neonMat);
    tailTip.position.set(0, Math.sin(7 * 0.35) * 0.22, -7 * 0.2 - 0.08);
    tailTip.rotation.x = -Math.PI / 2;
    tailGroup.add(tailTip);
    tailNodes.push(tailTip);
  }

  // 2. CYBER DRAGON
  function buildDragon(bodyMat, armorMat, neonMat, eyeMat) {
    const dGroup = new THREE.Group();
    rootGroup.add(dGroup);

    // Serpentine Body
    const dBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 16), armorMat);
    dBody.rotation.x = Math.PI / 3;
    dGroup.add(dBody);

    // Glowing Chest Core
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), neonMat);
    core.position.set(0, 0.2, 0.55);
    dGroup.add(core);

    // Dragon Head with Horns
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8), bodyMat);
    head.position.set(0, 0.75, 0.55);
    head.rotation.x = Math.PI / 3;
    dGroup.add(head);

    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 8), neonMat);
    hornL.position.set(-0.35, 1.15, 0.2);
    hornL.rotation.set(-0.4, 0, -0.3);
    dGroup.add(hornL);

    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 8), neonMat);
    hornR.position.set(0.35, 1.15, 0.2);
    hornR.rotation.set(-0.4, 0, 0.3);
    dGroup.add(hornR);

    // Swept-Back Cyber Wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.7), armorMat);
    wingL.position.set(-1.0, 0.4, -0.1);
    wingL.rotation.set(0.3, 0.4, 0.35);
    dGroup.add(wingL);

    const wingEdgeL = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.1), neonMat);
    wingEdgeL.position.set(-1.0, 0.4, 0.25);
    wingEdgeL.rotation.set(0.3, 0.4, 0.35);
    dGroup.add(wingEdgeL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.7), armorMat);
    wingR.position.set(1.0, 0.4, -0.1);
    wingR.rotation.set(0.3, -0.4, -0.35);
    dGroup.add(wingR);

    const wingEdgeR = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.1), neonMat);
    wingEdgeR.position.set(1.0, 0.4, 0.25);
    wingEdgeR.rotation.set(0.3, -0.4, -0.35);
    dGroup.add(wingEdgeR);
  }

  // 3. ROBO GOLEM / SILICON TITAN
  function buildGolem(bodyMat, armorMat, neonMat, eyeMat) {
    const gGroup = new THREE.Group();
    rootGroup.add(gGroup);

    // Heavy Torso
    const gBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), armorMat);
    gGroup.add(gBody);

    // Glowing Reactor Core
    const gCore = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), neonMat);
    gCore.position.set(0, 0.05, 0.45);
    gGroup.add(gCore);

    // Armored Head with Visor Slit
    const gHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), bodyMat);
    gHead.position.set(0, 0.85, 0.05);
    gGroup.add(gHead);

    const gVisor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.1), eyeMat);
    gVisor.position.set(0, 0.85, 0.32);
    gGroup.add(gVisor);

    // Bulky Shoulder Pauldrons
    const shL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), armorMat);
    shL.position.set(-0.95, 0.5, 0);
    gGroup.add(shL);

    const shR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), armorMat);
    shR.position.set(0.95, 0.5, 0);
    gGroup.add(shR);
  }

  // 4. QUANTUM SPRITE / CODE PHANTOM
  function buildSprite(neonMat, eyeMat, goldMat) {
    const sGroup = new THREE.Group();
    rootGroup.add(sGroup);

    // Polyhedral Energy Core
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), neonMat);
    sGroup.add(ico);

    const wireIco = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 1),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 })
    );
    sGroup.add(wireIco);

    // Floating Rune Satellites
    for (let i = 0; i < 4; i++) {
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), goldMat);
      const angle = (i * Math.PI) / 2;
      rune.position.set(Math.cos(angle) * 1.3, Math.sin(angle) * 0.4, Math.sin(angle) * 1.3);
      sGroup.add(rune);
    }
  }

  // 5. CYBER AVIAN (Falcon / Phoenix / Owl)
  function buildAvian(bodyMat, armorMat, neonMat, eyeMat) {
    const aGroup = new THREE.Group();
    rootGroup.add(aGroup);

    // Aerodynamic Fuselage Body
    const aBody = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.4, 16), bodyMat);
    aBody.rotation.x = -Math.PI / 3;
    aGroup.add(aBody);

    // Outstretched Wings
    const aWingL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.6), armorMat);
    aWingL.position.set(-0.95, 0.2, 0);
    aWingL.rotation.set(0.2, 0.3, 0.2);
    aGroup.add(aWingL);

    const aWingR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.6), armorMat);
    aWingR.position.set(0.95, 0.2, 0);
    aWingR.rotation.set(0.2, -0.3, -0.2);
    aGroup.add(aWingR);

    // Glowing Beak & Optics
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), neonMat);
    beak.position.set(0, 0.65, 0.65);
    beak.rotation.x = Math.PI / 3;
    aGroup.add(beak);
  }

  // Holographic Ground Floor Beacon
  function buildGroundBeacon(theme) {
    const gGeo = new THREE.RingGeometry(0.65, 1.35, 32);
    const gMat = new THREE.MeshBasicMaterial({
      color: theme,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    groundRing = new THREE.Mesh(gGeo, gMat);
    groundRing.position.set(0, -1.35, 0);
    groundRing.rotation.x = Math.PI / 2;
    scene.add(groundRing);
  }

  // Floating Quantum Sparkle Particle Cloud
  function buildParticles(theme) {
    const pCount = 35;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3.2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: theme,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
    });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
  }

  // Animation Loop
  let clock = 0;
  function animate() {
    requestAnimationFrame(animate);
    clock += 0.035;

    // Inertial swipe rotation dampening
    if (!isPointerDown) {
      rootGroup.rotation.y += rotVelY;
      rotVelY *= 0.92;
    }

    // Gentle hover & breathing physics
    rootGroup.position.y = Math.sin(clock * 1.5) * 0.08;

    // Swishing animated tail nodes
    if (tailNodes && tailNodes.length > 0) {
      tailNodes.forEach((node, idx) => {
        node.rotation.y = Math.sin(clock * 2.4 + idx * 0.4) * 0.25;
        node.rotation.z = Math.cos(clock * 1.8 + idx * 0.3) * 0.15;
      });
    }

    // Rotating Gyro Orbit Rings
    if (orbitRing1) {
      orbitRing1.rotation.z += 0.016;
    }
    if (orbitRing2) {
      orbitRing2.rotation.y -= 0.018;
    }

    // Rotating Floor Beacon
    if (groundRing) {
      groundRing.rotation.z += 0.008;
    }

    // Floating Quantum Sparkle Rotation
    if (particles) {
      particles.rotation.y += 0.005;
    }

    renderer.render(scene, camera);
  }

  window.onload = init;
</script>
</body>
</html>`;
  }, [creatureName, rarityConfig.color]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'READY') {
        setModelLoaded(true);
      } else if (data.type === 'CATCH_TAP' && onPress) {
        onPress();
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  return (
    <View style={styles.container}>
      {/* Levitating 3D Viewport with Pulsing Capture Vortex */}
      <Animated.View
        style={[
          styles.modelWrapper,
          {
            transform: [
              { translateY: floatAnim },
              { scale: captureScale },
            ],
          },
        ]}
      >
        {/* Soft Ambient Rarity Halo Glow behind the creature */}
        <Animated.View
          style={[
            styles.auraGlow,
            {
              backgroundColor: rarityConfig.color,
              transform: [{ scale: pulseAnim }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Pure 100% Transparent Three.js WebGL Viewport */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          style={styles.touchableModelFrame}
        >
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={creatureHtml}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'transparent',
              }}
              title="3D AR Creature"
              onLoad={() => setModelLoaded(true)}
            />
          ) : (
            <WebView
              source={{ html: creatureHtml, baseUrl: 'https://cdnjs.cloudflare.com' }}
              style={styles.webView}
              containerStyle={styles.webViewContainer}
              opaque={false}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              bounces={false}
              androidLayerType="hardware"
              onMessage={handleWebViewMessage}
              onLoadEnd={() => setModelLoaded(true)}
            />
          )}

          {/* Instant Holographic Silhouette (Shown during initial 1-second load) */}
          {!modelLoaded && (
            <View style={styles.instantSilhouette} pointerEvents="none">
              <Text style={styles.instantEmoji}>{creatureEmoji}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  modelWrapper: {
    width: 320,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  auraGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.22,
    alignSelf: 'center',
  },
  touchableModelFrame: {
    width: 320,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  webView: {
    width: 320,
    height: 330,
    backgroundColor: 'transparent',
  },
  webViewContainer: {
    backgroundColor: 'transparent',
  },
  instantSilhouette: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  instantEmoji: {
    fontSize: 72,
    textShadowColor: 'rgba(56, 189, 248, 0.75)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
});
