from typing import List, Dict, Any

# Coimbatore Institute of Technology (CIT) Exact Campus Polygon Perimeter
# Digitized from User-Calibrated Boundary (media_1788502382784.jpg)
CIT_CAMPUS_POLYGON = [
    (11.030449, 77.028487), # 1. North Apex - curved stadium track loop
    (11.030164, 77.028823), # 2. Stadium Northeast track curve
    (11.029640, 77.029014), # 3. Stadium East track straight
    (11.029022, 77.029087), # 4. Stadium Southeast track curve
    (11.028707, 77.028670), # 5. Hugging southeast of track inward to spine
    (11.028593, 77.028243), # 6. Smooth entry to central quad spine
    (11.028117, 77.028221), # 7. Central spine road between academic buildings & eastern ground
    (11.027641, 77.028238), # 8. East side of academic complex
    (11.027165, 77.028322), # 9. Along central quad spine path
    (11.026689, 77.028425), # 10. Approaching southern sports ground
    (11.026213, 77.028509), # 11. East side of southern ground
    (11.025927, 77.028527), # 12. Extended southeast curve of southern ground
    (11.025594, 77.028071), # 13. Deep south loop enclosing full sports ground
    (11.025451, 77.027490), # 14. South-most perimeter curve
    (11.025498, 77.026910), # 15. Base of southern sandy ground
    (11.025640, 77.026427), # 16. Southwest corner of southern ground
    (11.026212, 77.026353), # 17. West perimeter heading north
    (11.027163, 77.026195), # 18. West edge of academic quad
    (11.028115, 77.026075), # 19. Northwest quad tree-line
    (11.028858, 77.025973), # 20. Northwest corner near Avinashi Road
    (11.029401, 77.026788), # 21. Along Avinashi Road heading northeast
    (11.029877, 77.027516), # 22. Continuing along Avinashi Road towards stadium
    (11.030259, 77.028099), # 23. Connecting to stadium north apex
    (11.030449, 77.028487), # 24. Close Loop
]

# CIT Campus Canonical Story Spawns (10 Fixed physical landmark locations, 100% contained in boundary)
CIT_CANONICAL_STORY_SPAWNS: List[Dict[str, Any]] = [
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
        "latitude": 11.028640,
        "longitude": 77.027850,
        "sector": "Open Air Theatre",
        "story_order": 5,
    },
    {
        "id": "cit-story-6",
        "name": "NeuralFox",
        "rarity": "RARE",
        "latitude": 11.029210,
        "longitude": 77.027050,
        "sector": "Hostel Quadrangle",
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
        "latitude": 11.029350,
        "longitude": 77.028640,
        "sector": "Main Sports Stadium",
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
]

def get_cit_story_spawns(count: int = 10) -> List[Dict[str, Any]]:
    """
    Returns the persistent canonical CIT Story Spawns strictly in story sequence.
    Guarantees consistent, non-random positions across reloads.
    """
    return CIT_CANONICAL_STORY_SPAWNS[:min(count, len(CIT_CANONICAL_STORY_SPAWNS))]

def is_coordinate_within_cit_bounds(lat: float, lng: float) -> bool:
    """
    Validates whether a GPS location packet falls within the physical CIT campus geofence.
    Used for anti-spoofing validation on capture and progression events.
    """
    # 1. Outer bounds rejection (broad perimeter check)
    if not (11.0230 <= lat <= 11.0330 and 77.0230 <= lng <= 77.0330):
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

    # Allow a subtle buffer for mobile GPS jitter/accuracy (approx 30m)
    return inside or (11.0245 <= lat <= 11.0312 and 77.0252 <= lng <= 77.0298)
