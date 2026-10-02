import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SpawnPoint } from '../utils/haversine';
import { LootCrateItem } from '../utils/api';
import { CampusStronghold } from '../utils/turf';
import { PeerCadet } from '../utils/multiplayer';
import { FriendItem } from '../utils/friends';

interface InteractiveLeafletMapProps {
  center: { latitude: number; longitude: number };
  userLocation: { latitude: number; longitude: number } | null;
  heading?: number;
  spawns: SpawnPoint[];
  lootCrates?: LootCrateItem[];
  strongholds?: CampusStronghold[];
  peers?: PeerCadet[];
  friends?: FriendItem[];
  onSelectSpawn?: (spawn: SpawnPoint) => void;
  onSelectLoot?: (crate: LootCrateItem) => void;
  onSelectStronghold?: (stronghold: CampusStronghold) => void;
  onSelectPeer?: (peer: PeerCadet | FriendItem) => void;
}

// CIT Academic Engineering Campus Boundary
// Strictly excludes North Hostels and Northwest Polytechnic
const CIT_CAMPUS_POLYGON = [
  [11.02875, 77.0262],
  [11.0288, 77.027],
  [11.02875, 77.0278],
  [11.02865, 77.02825],
  [11.028117, 77.028221],
  [11.027641, 77.028238],
  [11.027165, 77.028322],
  [11.026689, 77.028425],
  [11.026213, 77.028509],
  [11.025927, 77.028527],
  [11.025594, 77.028071],
  [11.025451, 77.02749],
  [11.025498, 77.02691],
  [11.02564, 77.026427],
  [11.026212, 77.026353],
  [11.027163, 77.026195],
  [11.028115, 77.026075],
  [11.02875, 77.0262],
];

export default function InteractiveLeafletMap({
  center,
  userLocation,
  heading = 0,
  spawns,
  lootCrates = [],
  strongholds = [],
  peers = [],
  friends = [],
  onSelectSpawn,
  onSelectLoot,
  onSelectStronghold,
  onSelectPeer,
}: InteractiveLeafletMapProps) {
  const webViewRef = useRef<WebView | null>(null);
  const isWebViewLoadedRef = useRef<boolean>(false);

  const initialLat = center.latitude;
  const initialLng = center.longitude;

  const staticHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>OpenStreetMap Live Map</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      margin: 0;
      padding: 0;
    }
    html, body {
      height: 100%;
      width: 100%;
      background: #020617;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      touch-action: none;
    }
    #map {
      height: 100%;
      width: 100%;
      background: #020617;
    }

    /* Top Status Ribbon */
    .top-ribbon {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    .status-badge {
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid #0284C7;
      border-radius: 16px;
      padding: 4px 10px;
      color: #38BDF8;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 5px;
      pointer-events: auto;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      background: #22C55E;
      border-radius: 50%;
      box-shadow: 0 0 6px #22C55E;
    }
    .osm-tag {
      background: rgba(2, 132, 199, 0.85);
      border: 1px solid #38BDF8;
      border-radius: 16px;
      padding: 4px 10px;
      color: #FFFFFF;
      font-size: 9px;
      font-weight: 800;
      pointer-events: auto;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
    }

    /* Recenter Button */
    .recenter-btn {
      position: absolute;
      bottom: 20px;
      right: 14px;
      width: 38px;
      height: 38px;
      border-radius: 19px;
      background: rgba(15, 23, 42, 0.95);
      border: 1.5px solid #0284C7;
      color: #38BDF8;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .recenter-btn:active {
      background: #0284C7;
      color: #FFFFFF;
      transform: scale(0.92);
    }

    /* Compact User Beacon & Refined Vision Cone */
    .user-beacon-container {
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-vision-cone {
      position: absolute;
      top: -18px;
      left: 4px;
      width: 16px;
      height: 28px;
      pointer-events: none;
      transform-origin: 8px 28px;
      transition: transform 0.12s linear;
    }
    .user-cone-triangle {
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 24px solid rgba(56, 189, 248, 0.35);
    }
    .user-beacon-dot {
      width: 14px;
      height: 14px;
      border-radius: 7px;
      background: #0284C7;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 10px #38BDF8;
      z-index: 10;
    }

    /* Sleek, Non-Wonky Circular Entity Tokens */
    .entity-circle-pin {
      width: 30px;
      height: 30px;
      border-radius: 15px;
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid #38BDF8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.6);
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .entity-circle-pin:active {
      transform: scale(1.15);
    }
    .entity-pin-epic {
      border-color: #A855F7;
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.7);
      background: rgba(88, 28, 135, 0.9);
    }
    .entity-pin-legendary {
      border-color: #FACC15;
      box-shadow: 0 0 12px rgba(250, 204, 21, 0.85);
      background: rgba(113, 63, 18, 0.9);
    }
    .entity-pin-loot {
      border-color: #F59E0B;
      background: rgba(120, 53, 15, 0.9);
    }
    .entity-pin-stronghold {
      border-color: #0284C7;
      background: rgba(14, 116, 144, 0.9);
    }

    /* Subtle Landmark Badges */
    .landmark-label {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 6px;
      padding: 2px 5px;
      font-size: 9px;
      font-weight: 700;
      color: #E0F2FE;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }

    /* Popup Styling */
    .leaflet-popup-content-wrapper {
      background: rgba(15, 23, 42, 0.98);
      color: #F8FAFC;
      border: 1.5px solid #0284C7;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(2, 132, 199, 0.4);
      padding: 0;
    }
    .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.3;
    }
    .leaflet-popup-tip {
      background: #0F172A;
      border: 1px solid #0284C7;
    }
    .popup-title {
      font-size: 13px;
      font-weight: 800;
      color: #38BDF8;
      margin-bottom: 2px;
    }
    .popup-desc {
      font-size: 10px;
      color: #94A3B8;
      margin-bottom: 6px;
    }
    .popup-dist {
      font-size: 10px;
      font-weight: bold;
      color: #22C55E;
      margin-bottom: 6px;
    }
    .popup-dist-far {
      color: #F59E0B;
    }
    .popup-btn {
      background: #22C55E;
      color: #000000;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-weight: 900;
      font-size: 11px;
      cursor: pointer;
      width: 100%;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .popup-btn:active {
      transform: scale(0.97);
    }
    .popup-btn-disabled {
      background: #334155;
      color: #94A3B8;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="top-ribbon">
    <div class="status-badge">
      <div class="pulse-dot"></div>
      <span>OPENSTREETMAP LIVE</span>
    </div>
    <div class="osm-tag">CIT ACADEMIC ZONE</div>
  </div>

  <div id="map"></div>

  <div class="recenter-btn" onclick="recenterCadet()">🎯</div>

  <script>
    const campusCoords = ${JSON.stringify(CIT_CAMPUS_POLYGON)};
    let map = null;
    let userMarker = null;
    let userRadiusCircle = null;
    let currentCadetCoords = [${initialLat}, ${initialLng}];

    const markersLayer = L.layerGroup();

    function sendAction(type, id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, id: id }));
      }
    }

    // Helper: Haversine distance in meters
    function calcDist(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    function initMap() {
      try {
        map = L.map('map', {
          center: [${initialLat}, ${initialLng}],
          zoom: 17,
          maxZoom: 19,
          minZoom: 15,
          zoomControl: false,
        });

        // 1. OpenStreetMap Standard (Primary)
        const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: 'OpenStreetMap',
          crossOrigin: true
        });

        // 2. Esri World Imagery (Satellite)
        const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Esri Satellite'
        });

        // 3. CartoDB Dark Matter
        const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
          attribution: 'CartoDB'
        });

        osmLayer.addTo(map);

        const baseMaps = {
          "🗺️ OpenStreetMap": osmLayer,
          "🛰️ Esri Satellite": esriLayer,
          "🌌 Cyber Dark": cartoLayer
        };
        L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
        markersLayer.addTo(map);

        // CIT Academic Campus Boundary Polygon
        L.polygon(campusCoords, {
          color: '#0284C7',
          weight: 2.5,
          fillColor: '#38BDF8',
          fillOpacity: 0.14
        }).addTo(map);

        // Subtle Landmark Labels
        const landmarks = [
          { name: '🏛️ Main Admin Tower', lat: 11.02682, lng: 77.02745 },
          { name: '📚 Central Library', lat: 11.02805, lng: 77.02672 },
          { name: '💻 CSE Computing Center', lat: 11.02842, lng: 77.02651 },
          { name: '⚙️ Mechanical Labs', lat: 11.02745, lng: 77.02695 },
          { name: '☕ Canteen Food Court', lat: 11.02695, lng: 77.02775 },
          { name: '🏟️ Sports Pavilion', lat: 11.02615, lng: 77.02720 },
        ];

        landmarks.forEach(function(lm) {
          const landmarkIcon = L.divIcon({
            className: 'landmark-icon',
            html: '<div class="landmark-label">' + lm.name + '</div>',
            iconSize: [80, 16],
            iconAnchor: [40, 8]
          });
          L.marker([lm.lat, lm.lng], { icon: landmarkIcon }).addTo(map);
        });

        // Compact User Beacon
        const userHtml = 
          '<div class="user-beacon-container">' +
            '<div class="user-vision-cone" id="coneElem">' +
              '<div class="user-cone-triangle"></div>' +
            '</div>' +
            '<div class="user-beacon-dot"></div>' +
          '</div>';

        const userIcon = L.divIcon({
          className: 'user-icon',
          html: userHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        userMarker = L.marker([${initialLat}, ${initialLng}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

        userRadiusCircle = L.circle([${initialLat}, ${initialLng}], {
          radius: 35,
          color: '#22C55E',
          weight: 1.5,
          fillColor: '#16A34A',
          fillOpacity: 0.16,
          dashArray: '4, 5'
        }).addTo(map);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
        }
      } catch (err) {
        console.warn('Map initialization error:', err);
      }
    }

    // Telemetry Update via JS injection (60 FPS, No Reload)
    window.updateTelemetry = function(data) {
      if (!map) return;
      if (data.userLat && data.userLng) {
        currentCadetCoords = [data.userLat, data.userLng];
        if (userMarker) {
          userMarker.setLatLng(currentCadetCoords);
        }
        if (userRadiusCircle) {
          userRadiusCircle.setLatLng(currentCadetCoords);
        }
      }
      if (typeof data.heading === 'number') {
        const cone = document.getElementById('coneElem');
        if (cone) {
          cone.style.transform = 'rotate(' + data.heading + 'deg)';
        }
      }
    };

    // Entity Marker Rendering (Compact Circular Tokens & Proximity Check)
    window.updateEntities = function(data) {
      if (!map) return;
      markersLayer.clearLayers();

      const emojiMap = {
        'HomeSentinel': '🛡️',
        'CIT CyberDragon': '🐉',
        'QuantumSprite': '✨',
        'RoboGolem': '🤖',
        'CircuitPhoenix': '🔥',
        'CodePhantom': '👻',
        'NeuralFox': '🦊',
        'ByteFalcon': '🦅',
        'SiliconTitan': '⚡',
        'CampusOwl': '🦉',
        'AeroMech': '🚀',
      };

      if (data.spawns) {
        data.spawns.forEach(function(s) {
          const emoji = emojiMap[s.name] || '👾';
          let pinClass = 'entity-circle-pin';
          if (s.rarity === 'EPIC') pinClass += ' entity-pin-epic';
          if (s.rarity === 'LEGENDARY') pinClass += ' entity-pin-legendary';

          const icon = L.divIcon({
            className: 'spawn-pin-icon',
            html: '<div class="' + pinClass + '">' + emoji + '</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          const m = L.marker([s.lat, s.lng], { icon: icon }).addTo(markersLayer);

          m.on('click', function() {
            const dist = calcDist(currentCadetCoords[0], currentCadetCoords[1], s.lat, s.lng);
            const inRange = dist <= 35;

            const buttonHtml = inRange
              ? '<button class="popup-btn" onclick="sendAction(\\'SPAWN\\', \\'' + s.id + '\\')">⚡ ENGAGE IN AR (' + dist + 'm)</button>'
              : '<button class="popup-btn popup-btn-disabled" onclick="alert(\\'Target is ' + dist + 'm away! Walk within 35m radar range to capture.\\')">📡 OUT OF RADAR (' + dist + 'm)</button>';

            const popupContent = 
              '<div class="popup-title">' + emoji + ' ' + s.name + '</div>' +
              '<div class="popup-desc">Tier: ' + s.rarity + '</div>' +
              '<div class="popup-dist ' + (inRange ? '' : 'popup-dist-far') + '">' + (inRange ? '⚡ IN RADAR RANGE' : '🚶 ' + dist + 'm AWAY') + '</div>' +
              buttonHtml;

            m.bindPopup(popupContent).openPopup();
          });
        });
      }

      if (data.lootCrates) {
        data.lootCrates.forEach(function(c) {
          const icon = L.divIcon({
            className: 'loot-pin-icon',
            html: '<div class="entity-circle-pin entity-pin-loot">🧰</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          const m = L.marker([c.lat, c.lng], { icon: icon }).addTo(markersLayer);
          m.on('click', function() {
            const dist = calcDist(currentCadetCoords[0], currentCadetCoords[1], c.lat, c.lng);
            const inRange = dist <= 35;

            const buttonHtml = inRange
              ? '<button class="popup-btn" onclick="sendAction(\\'LOOT\\', \\'' + c.id + '\\')">🎁 HARVEST CACHE</button>'
              : '<button class="popup-btn popup-btn-disabled" onclick="alert(\\'Cache is ' + dist + 'm away. Walk within 35m to harvest.\\')">🔒 LOCKED (' + dist + 'm)</button>';

            const popupContent =
              '<div class="popup-title">🧰 ' + c.name + '</div>' +
              '<div class="popup-desc">' + c.reward + '</div>' +
              buttonHtml;

            m.bindPopup(popupContent).openPopup();
          });
        });
      }

      if (data.strongholds) {
        data.strongholds.forEach(function(sh) {
          const icon = L.divIcon({
            className: 'sh-pin-icon',
            html: '<div class="entity-circle-pin entity-pin-stronghold">🏛️</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          const m = L.marker([sh.lat, sh.lng], { icon: icon }).addTo(markersLayer);
          m.bindPopup(
            '<div class="popup-title">🏛️ ' + sh.name + '</div>' +
            '<div class="popup-desc">Held by: ' + sh.dept + ' (Score: ' + sh.score + ')</div>' +
            '<button class="popup-btn" onclick="sendAction(\\'STRONGHOLD\\', \\'' + sh.id + '\\')">⚔️ DEFEND / ATTACK</button>'
          );
        });
      }
    };

    function recenterCadet() {
      if (map && currentCadetCoords) {
        map.setView(currentCadetCoords, 17.5, { animate: true });
      }
    }

    if (typeof L !== 'undefined') {
      initMap();
    } else {
      window.onload = initMap;
    }
  </script>
</body>
</html>
    `;
  }, []);

  useEffect(() => {
    if (!webViewRef.current || !isWebViewLoadedRef.current) return;
    const telemetry = {
      userLat: userLocation?.latitude || null,
      userLng: userLocation?.longitude || null,
      heading: heading,
    };
    webViewRef.current.injectJavaScript(
      `if (window.updateTelemetry) { window.updateTelemetry(${JSON.stringify(telemetry)}); } true;`
    );
  }, [userLocation?.latitude, userLocation?.longitude, heading]);

  const updateEntitiesInMap = () => {
    if (!webViewRef.current || !isWebViewLoadedRef.current) return;
    const payload = {
      spawns: spawns.map((s) => ({
        id: s.id,
        name: s.name,
        rarity: s.rarity || 'COMMON',
        lat: s.latitude,
        lng: s.longitude,
      })),
      lootCrates: lootCrates
        .filter((c) => c.is_active)
        .map((c) => ({
          id: c.id,
          name: c.name,
          reward: `+${c.reward_amount} ${c.reward_type}`,
          lat: c.latitude,
          lng: c.longitude,
        })),
      strongholds: strongholds.map((sh) => ({
        id: sh.id,
        name: sh.name,
        dept: sh.controlling_department,
        score: sh.defense_score,
        lat: sh.latitude,
        lng: sh.longitude,
      })),
    };
    webViewRef.current.injectJavaScript(
      `if (window.updateEntities) { window.updateEntities(${JSON.stringify(payload)}); } true;`
    );
  };

  useEffect(() => {
    updateEntitiesInMap();
  }, [spawns, lootCrates, strongholds]);

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'READY') {
        isWebViewLoadedRef.current = true;
        updateEntitiesInMap();
        if (userLocation) {
          webViewRef.current?.injectJavaScript(
            `if (window.updateTelemetry) { window.updateTelemetry(${JSON.stringify({
              userLat: userLocation.latitude,
              userLng: userLocation.longitude,
              heading: heading,
            })}); } true;`
          );
        }
      } else if (payload.type === 'SPAWN') {
        const found = spawns.find((s) => s.id === payload.id);
        if (found && onSelectSpawn) onSelectSpawn(found);
      } else if (payload.type === 'LOOT') {
        const found = lootCrates.find((c) => c.id === payload.id);
        if (found && onSelectLoot) onSelectLoot(found);
      } else if (payload.type === 'STRONGHOLD') {
        const found = strongholds.find((sh) => sh.id === payload.id);
        if (found && onSelectStronghold) onSelectStronghold(found);
      } else if (payload.type === 'PEER') {
        const found = peers.find((p) => String(p.user_id) === String(payload.id));
        if (found && onSelectPeer) onSelectPeer(found);
      }
    } catch (e) {
      console.warn('Map message parse error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: staticHtml, baseUrl: 'https://cdnjs.cloudflare.com' }}
        style={styles.webView}
        userAgent="CampusQuest-CIT/1.0 (Android; Mobile)"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        mixedContentMode="always"
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    flex: 1,
    backgroundColor: '#020617',
  },
  webView: {
    width: '100%',
    height: '100%',
    flex: 1,
    backgroundColor: '#020617',
  },
});
