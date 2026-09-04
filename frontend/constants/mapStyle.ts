/**
 * CIT Campus Tactical Map Style
 * - Lush green ground textures for campus grounds, sports fields & parks
 * - Realistic asphalt road textures with cyber blue borders
 * - Vibrant location indicator labels for all campus landmarks (Stadium, Library, OAT, Labs)
 */
export const CYBERPUNK_MAP_STYLE = [
  // Base background / Land geometry (Rich campus green ground)
  {
    elementType: 'geometry',
    stylers: [{ color: '#0d2818' }], // Lush dark campus base
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#86efac' }], // Bright glowing text
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#051f10' }, { weight: 3 }],
  },
  // Landscape & Campus Ground Textures (Rich Emerald Greens)
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#13351e' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#1a4329' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{ color: '#12301c' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2d6a4f' }, { weight: 1.5 }],
  },
  // Parks & Sports Fields (Vibrant Green Turf)
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2d6a4f' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1b4332' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry.fill',
    stylers: [{ color: '#13351e' }],
  },
  // POI & Campus Landmark Labels (Brought back and enhanced!)
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a7f3d0' }, { visibility: 'on' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#051f10' }, { weight: 3 }, { visibility: 'on' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }], // hide generic third-party clutter icons, keep clean readable text labels
  },
  // Road Textures (Real Dark Asphalt with Crisp Markings)
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1f2421' }], // Dark asphalt tarmac
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#38bdf8' }, { weight: 1.5 }], // Cyan cyber border
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e2e8f0' }, { visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0f172a' }, { weight: 2 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [{ color: '#262d28' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0284c7' }, { weight: 2 }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1f2421' }],
  },
  // Transit lines & Stations
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }, { visibility: 'on' }],
  },
  // Water Bodies & Reservoirs (Deep Cyber Blue)
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0369a1' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
];
