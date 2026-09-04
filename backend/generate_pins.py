import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ASSETS_DIR = r"c:\Users\Joshwin\Documents\CampusQuest\frontend\assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

def create_smokey_base(size=128):
    """Creates a transparent RGBA image for compositing."""
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))

def add_ground_shadow(img, size=128, radius=28):
    """Draws a soft, weathered ground shadow underneath the indicator."""
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    cx, cy = size // 2, int(size * 0.82)
    s_draw.ellipse(
        [(cx - radius, cy - int(radius * 0.35)), (cx + radius, cy + int(radius * 0.35))],
        fill=(10, 12, 18, 160)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=6))
    img.alpha_composite(shadow)

def add_smoke_orb(img, cx, cy, tint_rgb, intensity=1.0, size=128, radius=38):
    """
    Renders an organic, circular RDR2-styled atmospheric smoke aura/orb with:
    - Symmetrical radial vapor puffs swirling in a circular perimeter
    - Soft, wispy smoke clouds with Gaussian blur
    - Glowing center core
    - Perfectly circular silhouette (NO teardrop shape!)
    """
    smoke_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(smoke_layer)
    
    # 1. Broad outer ambient circular mist
    s_draw.ellipse(
        [(cx - radius, cy - radius), (cx + radius, cy + radius)],
        fill=tint_rgb + (int(55 * intensity),)
    )
    
    # 2. Concentric radial swirling puffs around the circle (8 directions)
    num_puffs = 8
    orbit_r = int(radius * 0.45)
    puff_r = int(radius * 0.42)
    for i in range(num_puffs):
        angle = i * (2 * math.pi / num_puffs)
        px = cx + orbit_r * math.cos(angle)
        py = cy + orbit_r * math.sin(angle)
        alpha = int(110 * intensity)
        s_draw.ellipse(
            [(px - puff_r, py - puff_r), (px + puff_r, py + puff_r)],
            fill=tint_rgb + (alpha,)
        )

    # 3. Inner bright core puff
    core_r = int(radius * 0.5)
    s_draw.ellipse(
        [(cx - core_r, cy - core_r), (cx + core_r, cy + core_r)],
        fill=(255, 255, 255, int(150 * intensity))
    )

    # 4. Filter with Gaussian blur to give soft, wispy ethereal smoke look
    smoke_layer = smoke_layer.filter(ImageFilter.GaussianBlur(radius=5))
    img.alpha_composite(smoke_layer)

def add_brush_strokes(img, cx, cy, color, size=128, angle_deg=-15):
    """
    Renders NBA Mobile athletic dry-brush slashes with energetic edges.
    """
    brush_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(brush_layer)
    
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    
    # Main dynamic athletic stroke
    stroke_len = 38
    for w_offset, alpha in [(-3, 120), (0, 240), (3, 160), (-6, 70), (6, 90)]:
        x1 = cx - stroke_len * cos_a + w_offset * sin_a
        y1 = cy - stroke_len * sin_a - w_offset * cos_a
        x2 = cx + stroke_len * cos_a + w_offset * sin_a
        y2 = cy + stroke_len * sin_a - w_offset * cos_a
        b_draw.line([(x1, y1), (x2, y2)], fill=color + (alpha,), width=7)
        
    # Paint splatter dots around edges
    splatters = [
        (cx - 28, cy - 14, 2),
        (cx + 30, cy + 12, 3),
        (cx + 22, cy - 20, 2),
        (cx - 18, cy + 22, 2.5),
        (cx + 34, cy - 6, 1.5),
    ]
    for sx, sy, sr in splatters:
        b_draw.ellipse([(sx - sr, sy - sr), (sx + sr, sy + sr)], fill=color + (200,))
        
    img.alpha_composite(brush_layer)

def draw_centered_symbol(img, symbol, cx, cy, font_size, color=(255, 255, 255), glow_color=None):
    """Draws a crisp glyph with subtle drop-shadow or glow."""
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()
            
    bbox = draw.textbbox((0, 0), symbol, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    gx = cx - tw / 2
    gy = cy - th / 2 - 2
    
    # Ambient glow
    if glow_color:
        glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glow)
        for offset in [(-2, -2), (2, -2), (-2, 2), (2, 2), (0, 0)]:
            g_draw.text((gx + offset[0], gy + offset[1]), symbol, fill=glow_color + (140,), font=font)
        glow = glow.filter(ImageFilter.GaussianBlur(radius=3))
        img.alpha_composite(glow)
        
    # Charcoal shadow
    draw.text((gx + 1.5, gy + 2), symbol, fill=(10, 15, 20, 210), font=font)
    # Main symbol
    draw.text((gx, gy), symbol, fill=color + (255,), font=font)

def generate_rdr2_stranger(size=128):
    """
    RDR2 Stranger Mystery Anomaly:
    - Ground ash shadow
    - Circular atmospheric smoke orb (NO teardrop shape)
    - Luminous mystical '?' in the center
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=24)
    add_smoke_orb(img, cx, cy, tint_rgb=(235, 240, 248), intensity=1.1, radius=38)
    
    # Subtle warm ember ring at center
    ember = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    e_draw = ImageDraw.Draw(ember)
    e_draw.ellipse([(cx - 12, cy - 12), (cx + 12, cy + 12)], fill=(255, 180, 50, 110))
    ember = ember.filter(ImageFilter.GaussianBlur(radius=3))
    img.alpha_composite(ember)
    
    # Crisp mystic question mark
    draw_centered_symbol(img, "?", cx, cy, font_size=38, color=(255, 255, 255), glow_color=(200, 225, 255))
    
    path = os.path.join(ASSETS_DIR, "pin_stranger.png")
    img.save(path, "PNG")
    print(f"Generated Circular RDR2 Stranger Pin: {path}")

def generate_nba_user(size=128):
    """
    NBA Mobile Styled User Cadet Location Indicator:
    - Directional athletic paint-brush pointer / diamond arrowhead
    - High-contrast street cyan & electric volt accents
    - Energetic brush slash wake
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=22)
    add_brush_strokes(img, cx, cy + 4, color=(6, 182, 212), size=size, angle_deg=-30)
    
    # Athletic diamond pointer
    draw = ImageDraw.Draw(img)
    points_outer = [
        (cx, cy - 28),
        (cx + 20, cy + 14),
        (cx, cy + 6),
        (cx - 20, cy + 14),
    ]
    draw.polygon(points_outer, fill=(15, 23, 42, 255), outline=(255, 255, 255, 240))
    
    points_inner = [
        (cx, cy - 23),
        (cx + 15, cy + 10),
        (cx, cy + 4),
        (cx - 15, cy + 10),
    ]
    draw.polygon(points_inner, fill=(6, 182, 212, 255))
    draw.ellipse([(cx - 4, cy - 6), (cx + 4, cy + 2)], fill=(250, 204, 21, 255))
    
    path = os.path.join(ASSETS_DIR, "pin_user.png")
    img.save(path, "PNG")
    print(f"Generated NBA User Pin: {path}")

def generate_friend_beacon(size=128):
    """
    RDR2/NBA Hybrid Friend Beacon:
    - Circular emerald green smoke orb
    - Scout compass star (no clumsy text)
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=22)
    add_smoke_orb(img, cx, cy, tint_rgb=(52, 211, 153), intensity=0.95, radius=36)
    
    draw = ImageDraw.Draw(img)
    draw.ellipse([(cx - 18, cy - 18), (cx + 18, cy + 18)], fill=(16, 185, 129, 235), outline=(248, 250, 252, 240), width=3)
    
    # Scout Compass Star
    star_pts = [
        (cx, cy - 12),
        (cx + 3, cy - 3),
        (cx + 12, cy),
        (cx + 3, cy + 3),
        (cx, cy + 12),
        (cx - 3, cy + 3),
        (cx - 12, cy),
        (cx - 3, cy - 3),
    ]
    draw.polygon(star_pts, fill=(254, 240, 138, 255))
    
    path = os.path.join(ASSETS_DIR, "pin_friend.png")
    img.save(path, "PNG")
    print(f"Generated Friend Beacon: {path}")

def generate_buddy_companion(size=128):
    """
    Companion Buddy Spirit Pin:
    - Circular warm golden amber smoke orb
    - Sleek spirit animal paw crest
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=20)
    add_smoke_orb(img, cx, cy, tint_rgb=(251, 191, 36), intensity=1.0, radius=36)
    
    draw = ImageDraw.Draw(img)
    draw.ellipse([(cx - 18, cy - 18), (cx + 18, cy + 18)], fill=(245, 158, 11, 240), outline=(255, 255, 255, 240), width=3)
    
    # Paw Print icon
    draw.ellipse([(cx - 9, cy - 2), (cx + 9, cy + 11)], fill=(255, 255, 255, 255))
    draw.ellipse([(cx - 9, cy - 11), (cx - 4, cy - 5)], fill=(255, 255, 255, 255))
    draw.ellipse([(cx - 3, cy - 14), (cx + 3, cy - 7)], fill=(255, 255, 255, 255))
    draw.ellipse([(cx + 4, cy - 11), (cx + 9, cy - 5)], fill=(255, 255, 255, 255))
    
    path = os.path.join(ASSETS_DIR, "pin_buddy.png")
    img.save(path, "PNG")
    print(f"Generated Buddy Pin: {path}")

def generate_stronghold_crest(size=128):
    """
    Department Stronghold:
    - Circular weathered ink-wash & crimson smoke orb
    - Citadel fortress battlements emblem
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=24)
    add_smoke_orb(img, cx, cy, tint_rgb=(129, 140, 248), intensity=0.95, radius=38)
    
    draw = ImageDraw.Draw(img)
    draw.ellipse([(cx - 20, cy - 20), (cx + 20, cy + 20)], fill=(30, 27, 75, 245), outline=(129, 140, 248, 240), width=3)
    
    # Fortress Tower Battlements
    draw.rectangle([(cx - 11, cy - 4), (cx + 11, cy + 11)], fill=(255, 255, 255, 255))
    draw.rectangle([(cx - 11, cy - 12), (cx - 5, cy - 4)], fill=(255, 255, 255, 255))
    draw.rectangle([(cx - 3, cy - 12), (cx + 3, cy - 4)], fill=(255, 255, 255, 255))
    draw.rectangle([(cx + 5, cy - 12), (cx + 11, cy - 4)], fill=(255, 255, 255, 255))
    draw.arc([(cx - 4, cy + 3), (cx + 4, cy + 13)], start=180, end=0, fill=(30, 27, 75, 255), width=4)
    
    path = os.path.join(ASSETS_DIR, "pin_stronghold.png")
    img.save(path, "PNG")
    print(f"Generated Stronghold Pin: {path}")

def generate_loot_cache(size=128):
    """
    Loot Cache:
    - Circular golden smoke orb with supply chest
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=22)
    add_smoke_orb(img, cx, cy, tint_rgb=(245, 158, 11), intensity=0.9, radius=36)
    
    draw = ImageDraw.Draw(img)
    draw.rectangle([(cx - 16, cy - 8), (cx + 16, cy + 12)], fill=(217, 119, 6, 250), outline=(254, 240, 138, 255), width=2)
    draw.ellipse([(cx - 16, cy - 16), (cx + 16, cy - 2)], fill=(245, 158, 11, 250), outline=(254, 240, 138, 255), width=2)
    draw.rectangle([(cx - 3, cy - 6), (cx + 3, cy + 2)], fill=(254, 240, 138, 255))
    draw.ellipse([(cx - 2, cy - 3), (cx + 2, cy + 1)], fill=(69, 26, 3, 255))
    
    path = os.path.join(ASSETS_DIR, "pin_loot.png")
    img.save(path, "PNG")
    print(f"Generated Loot Pin: {path}")

def generate_rarity_pin(filename, tint_rgb, symbol, size=128):
    """
    Revealed Anomaly Rarity Pin (<15m):
    - Circular vibrant spirit smoke orb
    - Crisp high-contrast emblem
    """
    img = create_smokey_base(size)
    cx, cy = size // 2, size // 2
    
    add_ground_shadow(img, size, radius=22)
    add_smoke_orb(img, cx, cy, tint_rgb=tint_rgb, intensity=1.1, radius=36)
    
    draw = ImageDraw.Draw(img)
    draw.ellipse([(cx - 18, cy - 18), (cx + 18, cy + 18)], fill=tint_rgb + (235,), outline=(255, 255, 255, 240), width=3)
    draw_centered_symbol(img, symbol, cx, cy, font_size=20, color=(255, 255, 255))
    
    path = os.path.join(ASSETS_DIR, filename)
    img.save(path, "PNG")
    print(f"Generated Rarity Pin ({filename}): {path}")

def generate_all():
    generate_rdr2_stranger()
    generate_nba_user()
    generate_friend_beacon()
    generate_buddy_companion()
    generate_stronghold_crest()
    generate_loot_cache()
    
    generate_rarity_pin("pin_common.png", (34, 197, 94), "C")
    generate_rarity_pin("pin_nearby.png", (34, 197, 94), "!")
    generate_rarity_pin("pin_rare.png", (14, 165, 233), "R")
    generate_rarity_pin("pin_epic.png", (168, 85, 247), "E")
    generate_rarity_pin("pin_legendary.png", (245, 158, 11), "★")
    generate_rarity_pin("pin_peer.png", (71, 85, 105), "•")

if __name__ == "__main__":
    generate_all()
    print("All RDR2 smokey & NBA paint-brush pin assets generated successfully!")

