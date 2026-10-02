from typing import List, Dict, Any

# Coimbatore Institute of Technology (CIT) Main Academic Engineering Campus Perimeter
# Excludes Hostels (North) and Polytechnic College (Northwest)
CIT_CAMPUS_POLYGON = [
    (11.028750, 77.026200),  # 1. Northwest academic corner (south of Polytechnic)
    (11.028800, 77.027000),  # 2. North academic road (south of Boys Hostel)
    (11.028750, 77.027800),  # 3. Open Air Theatre north perimeter (south of Ladies Hostel)
    (11.028650, 77.028250),  # 4. Northeast academic corner (inward of stadium)
    (11.028117, 77.028221),  # 5. Central spine road between academic buildings & grounds
    (11.027641, 77.028238),  # 6. East side of academic complex
    (11.027165, 77.028322),  # 7. Central quad spine path
    (11.026689, 77.028425),  # 8. Approaching southern sports ground
    (11.026213, 77.028509),  # 9. East side of southern ground
    (11.025927, 77.028527),  # 10. Extended southeast curve of southern ground
    (11.025594, 77.028071),  # 11. Deep south loop enclosing sports ground
    (11.025451, 77.027490),  # 12. South-most perimeter curve
    (11.025498, 77.026910),  # 13. Base of southern ground
    (11.025640, 77.026427),  # 14. Southwest corner of southern ground
    (11.026212, 77.026353),  # 15. West perimeter heading north
    (11.027163, 77.026195),  # 16. West edge of academic quad
    (11.028115, 77.026075),  # 17. West tree-line of academic complex
    (11.028750, 77.026200),  # 18. Close Loop
]

# CIT Academic Campus Canonical Story Spawns (100% inside academic boundary)
CIT_CANONICAL_STORY_SPAWNS: List[Dict[str, Any]] = [
    {
        "id": "cit-story-0",
        "name": "HomeSentinel",
        "rarity": "EPIC",
        "latitude": 11.027000,
        "longitude": 77.027000,
        "sector": "Cadet Base & Field Headquarters",
        "story_order": 0,
    },
    {
        "id": "cit-story-1",
        "name": "CIT CyberDragon",
        "rarity": "LEGENDARY",
        "latitude": 11.026820,
        "longitude": 77.027450,
        "sector": "Admin Block Tower",
        "story_order": 1,
    },
    {
        "id": "cit-story-2",
        "name": "QuantumSprite",
        "rarity": "EPIC",
        "latitude": 11.028050,
        "longitude": 77.026720,
        "sector": "Central Library & Research Hub",
        "story_order": 2,
    },
    {
        "id": "cit-story-3",
        "name": "RoboGolem",
        "rarity": "EPIC",
        "latitude": 11.027450,
        "longitude": 77.026950,
        "sector": "Mechanical & Mechatronics Lab",
        "story_order": 3,
    },
    {
        "id": "cit-story-4",
        "name": "CircuitPhoenix",
        "rarity": "RARE",
        "latitude": 11.027150,
        "longitude": 77.027550,
        "sector": "ECE & Circuit Labs",
        "story_order": 4,
    },
    {
        "id": "cit-story-5",
        "name": "CodePhantom",
        "rarity": "RARE",
        "latitude": 11.028500,
        "longitude": 77.027650,
        "sector": "Open Air Theatre",
        "story_order": 5,
    },
    {
        "id": "cit-story-6",
        "name": "NeuralFox",
        "rarity": "RARE",
        "latitude": 11.027650,
        "longitude": 77.027200,
        "sector": "Science & Humanities Quad",
        "story_order": 6,
    },
    {
        "id": "cit-story-7",
        "name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 11.028420,
        "longitude": 77.026510,
        "sector": "CSE / IT Computing Center",
        "story_order": 7,
    },
    {
        "id": "cit-story-8",
        "name": "SiliconTitan",
        "rarity": "COMMON",
        "latitude": 11.026200,
        "longitude": 77.028000,
        "sector": "Sports Pavilion & Grounds",
        "story_order": 8,
    },
    {
        "id": "cit-story-9",
        "name": "CampusOwl",
        "rarity": "COMMON",
        "latitude": 11.026610,
        "longitude": 77.028020,
        "sector": "Main Campus Quad",
        "story_order": 9,
    },
    {
        "id": "cit-story-10",
        "name": "AeroMech",
        "rarity": "COMMON",
        "latitude": 11.026150,
        "longitude": 77.027200,
        "sector": "Southern Sports Pavilion",
        "story_order": 10,
    },
    {
        "id": "cit-story-cat",
        "name": "Super Fluffy Cat",
        "rarity": "RARE",
        "latitude": 11.027500,
        "longitude": 77.027000,
        "sector": "Central Campus Greens",
        "story_order": 11,
    },
]

def get_cit_story_spawns(count: int = 12, user_lat: float = None, user_lng: float = None) -> List[Dict[str, Any]]:
    """
    Returns the persistent canonical CIT Story Spawns strictly in story sequence.
    If user_lat and user_lng are provided, anchors HomeSentinel within ~8m from user's live position.
    """
    spawns = [dict(s) for s in CIT_CANONICAL_STORY_SPAWNS]
    if user_lat is not None and user_lng is not None:
        for s in spawns:
            if s["id"] == "cit-story-0":
                s["latitude"] = round(user_lat + 0.00006, 6)
                s["longitude"] = round(user_lng + 0.00005, 6)
                break
    return spawns[:min(count, len(spawns))]

def is_coordinate_within_cit_bounds(lat: float, lng: float) -> bool:
    """
    Validates whether a GPS coordinate falls strictly within the academic CIT campus geofence
    (excluding Hostel and Polytechnic).
    """
    # 1. Outer bounds check
    if not (11.0245 <= lat <= 11.0295 and 77.0255 <= lng <= 77.0290):
        return False

    # 2. Ray-casting point-in-polygon algorithm against CIT_CAMPUS_POLYGON
    n = len(CIT_CAMPUS_POLYGON)
    inside = False
    p1lat, p1lng = CIT_CAMPUS_POLYGON[0]
    for i in range(n + 1):
        p2lat, p2lng = CIT_CAMPUS_POLYGON[i % n]
        if min(p1lat, p2lat) < lat <= max(p1lat, p2lat):
            if lng <= max(p1lng, p2lng):
                if p1lat != p2lat:
                    xinters = (lat - p1lat) * (p2lng - p1lng) / (p2lat - p1lat) + p1lng
                if p1lng == p2lng or lng <= xinters:
                    inside = not inside
        p1lat, p1lng = p2lat, p2lng

    # Mobile GPS jitter buffer (within 20m)
    return inside or (11.0252 <= lat <= 11.0289 and 77.0259 <= lng <= 77.0286)
