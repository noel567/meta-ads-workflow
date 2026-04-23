#!/usr/bin/env python3
"""
EasySignals Quote of the Day – Premium Design v3
Dark background, gold/white text, candlestick chart, glow curve
Cinzel + Playfair Display fonts
"""
import sys
import os
import math
import hashlib
from datetime import date
from PIL import Image, ImageDraw, ImageFont

SIZE = 1080

GOLD = (212, 175, 55)
GOLD_LIGHT = (255, 215, 80)
WHITE = (255, 255, 255)
BG_DARK = (5, 18, 12)
GREEN_GLOW = (0, 255, 100)

FONT_DIR = "/home/ubuntu/webdev-static-assets/fonts"
LOGO_PATH = "/home/ubuntu/webdev-static-assets/easysignals_logo_white.png"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Background variants (existing)
BG_VARIANTS = [
    os.path.join(SCRIPT_DIR, "quote_bg.png"),
    os.path.join(SCRIPT_DIR, "quote_bg_blue.png"),
    os.path.join(SCRIPT_DIR, "quote_bg_darkgreen.png"),
]

def get_daily_bg():
    today_str = date.today().isoformat()
    idx = int(hashlib.md5(today_str.encode()).hexdigest(), 16) % len(BG_VARIANTS)
    return BG_VARIANTS[idx]

def load_font(name, size):
    path = os.path.join(FONT_DIR, name)
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    # Fallback to system fonts
    for fallback in ["/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
                     "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(fallback):
            return ImageFont.truetype(fallback, size)
    return ImageFont.load_default()

def draw_glow_curve(img):
    """Glowing green curve on the right side"""
    overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    points = []
    for i in range(300):
        t = i / 299
        x = int(SIZE * 0.28 + SIZE * 0.72 * t)
        y = int(SIZE * 0.98 - SIZE * 0.88 * (t ** 1.3))
        points.append((x, y))
    for width, alpha, color in [
        (22, 20, (0, 255, 100)),
        (14, 45, (0, 255, 120)),
        (6, 130, (80, 255, 150)),
        (2, 220, (200, 255, 220)),
    ]:
        for i in range(len(points) - 1):
            draw.line([points[i], points[i+1]], fill=(*color, alpha), width=width)
    img.paste(overlay, (0, 0), overlay)

def draw_candlesticks(img):
    overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # Left side (smaller)
    for i, (x, top, bt, bb, green) in enumerate([
        (55, 830, 790, 750, True), (100, 790, 750, 710, False),
        (145, 760, 715, 670, True), (190, 720, 670, 620, True),
        (235, 680, 625, 575, False), (280, 640, 580, 530, True),
    ]):
        c = (0, 180, 80, 70) if green else (200, 60, 60, 70)
        draw.line([(x, top), (x, max(bt,bb) + 40)], fill=c, width=2)
        draw.rectangle([x-7, min(bt,bb), x+7, max(bt,bb)], fill=c)
    # Right side (larger)
    for x, top, bt, bb, green in [
        (820, 620, 420, 510, True), (870, 490, 300, 390, True),
        (920, 370, 190, 280, False), (965, 280, 110, 200, True),
        (1010, 200, 50, 130, True),
    ]:
        c = (0, 220, 100, 110) if green else (220, 80, 80, 110)
        draw.line([(x, top), (x, max(bt,bb) + 40)], fill=c, width=3)
        draw.rectangle([x-13, min(bt,bb), x+13, max(bt,bb)], fill=c)
    img.paste(overlay, (0, 0), overlay)

def draw_logo(img):
    logo_path = LOGO_PATH
    if not os.path.exists(logo_path):
        # Try script dir
        logo_path = os.path.join(SCRIPT_DIR, "easysignals_logo.png")
    if not os.path.exists(logo_path):
        return
    logo = Image.open(logo_path).convert("RGBA")
    logo_w = 300
    logo_h = int(logo.height * logo_w / logo.width)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    x = (SIZE - logo_w) // 2
    img.paste(logo, (x, 48), logo)

def wrap_text_lines(text, font, max_width, draw):
    words = text.split()
    lines = []
    cur = []
    for word in words:
        test = ' '.join(cur + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width and cur:
            cur.append(word)
        elif not cur:
            cur.append(word)
        else:
            lines.append(' '.join(cur))
            cur = [word]
    if cur:
        lines.append(' '.join(cur))
    return lines

def create_quote_image(quote: str, author: str, output_path: str):
    # Background
    bg_path = get_daily_bg()
    if os.path.exists(bg_path):
        img = Image.open(bg_path).convert("RGBA")
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
        # Darken slightly for text readability
        dark = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 60))
        img.alpha_composite(dark)
    else:
        img = Image.new('RGBA', (SIZE, SIZE), (*BG_DARK, 255))
        # Simple gradient
        draw_tmp = ImageDraw.Draw(img)
        for y in range(SIZE):
            t = y / SIZE
            r = int(5 + 8 * t); g = int(18 + 20 * t); b = int(12 + 10 * t)
            draw_tmp.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

    # Candlesticks + glow
    draw_candlesticks(img)
    draw_glow_curve(img)

    # Logo
    draw_logo(img)

    # Fonts
    f_cinzel_badge  = load_font("Cinzel.ttf", 30)
    f_cinzel_author = load_font("Cinzel.ttf", 34)
    f_play_lg       = load_font("PlayfairDisplay.ttf", 90)
    f_play_md       = load_font("PlayfairDisplay.ttf", 74)
    f_play_sm       = load_font("PlayfairDisplay.ttf", 58)
    f_play_italic   = load_font("PlayfairDisplay-Italic.ttf", 78)
    f_play_italic_sm= load_font("PlayfairDisplay-Italic.ttf", 62)
    f_play_qmark    = load_font("PlayfairDisplay.ttf", 130)

    draw = ImageDraw.Draw(img)

    # ── TITLE BADGE ───────────────────────────────────────────────────────────
    badge_text = "QUOTE OF THE DAY"
    bb = draw.textbbox((0, 0), badge_text, font=f_cinzel_badge)
    bw, bh = bb[2]-bb[0], bb[3]-bb[1]
    px, py = 38, 14
    badge_x = (SIZE - bw) // 2 - px
    badge_y = 152
    badge_rect = [badge_x, badge_y, badge_x + bw + px*2, badge_y + bh + py*2]

    # Badge background + border
    badge_overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge_overlay)
    bd.rounded_rectangle(badge_rect, radius=6, fill=(5, 15, 10, 210), outline=(*GOLD, 255), width=2)
    # Corner diamonds
    for cx, cy in [(badge_x, badge_y), (badge_x + bw + px*2, badge_y),
                   (badge_x, badge_y + bh + py*2), (badge_x + bw + px*2, badge_y + bh + py*2)]:
        bd.polygon([(cx, cy-6), (cx+6, cy), (cx, cy+6), (cx-6, cy)], fill=(*GOLD, 200))
    # Side lines
    mid_y = badge_y + (bh + py*2) // 2
    bd.line([(badge_x - 70, mid_y), (badge_x - 8, mid_y)], fill=(*GOLD, 140), width=1)
    bd.line([(badge_x + bw + px*2 + 8, mid_y), (badge_x + bw + px*2 + 70, mid_y)], fill=(*GOLD, 140), width=1)
    img.alpha_composite(badge_overlay)
    draw = ImageDraw.Draw(img)
    draw.text(((SIZE - bw) // 2, badge_y + py), badge_text, font=f_cinzel_badge, fill=GOLD)

    # ── OPENING QUOTE MARK ────────────────────────────────────────────────────
    qm_y = 230
    qm_bb = draw.textbbox((0, 0), "\u201c", font=f_play_qmark)
    qm_w = qm_bb[2] - qm_bb[0]
    draw.text(((SIZE - qm_w) // 2, qm_y), "\u201c", font=f_play_qmark, fill=GOLD)

    # Decorative lines beside quote mark
    line_y = qm_y + 55
    draw.line([(70, line_y), (SIZE//2 - 90, line_y)], fill=(*GOLD, 100), width=1)
    draw.line([(SIZE//2 + 90, line_y), (SIZE - 70, line_y)], fill=(*GOLD, 100), width=1)

    # ── QUOTE TEXT ────────────────────────────────────────────────────────────
    margin = 72
    max_w = SIZE - 2 * margin
    words = quote.split()

    # Split: last ~30% of words get italic gold treatment
    italic_count = max(2, len(words) // 3)
    main_words = words[:-italic_count] if len(words) > italic_count + 2 else words
    italic_words = words[-italic_count:] if len(words) > italic_count + 2 else []

    main_text = ' '.join(main_words).upper()
    italic_text = ' '.join(italic_words)

    # Choose font size based on length
    total_chars = len(quote)
    if total_chars <= 60:
        f_main, f_ital, lh = f_play_lg, f_play_italic, 105
    elif total_chars <= 100:
        f_main, f_ital, lh = f_play_md, f_play_italic, 88
    else:
        f_main, f_ital, lh = f_play_sm, f_play_italic_sm, 72

    main_lines = wrap_text_lines(main_text, f_main, max_w, draw)
    italic_lines = wrap_text_lines(italic_text, f_ital, max_w, draw) if italic_text else []

    total_lines = len(main_lines) + len(italic_lines)
    text_start_y = 310
    available = 840 - text_start_y
    total_h = total_lines * lh
    y = text_start_y + max(0, (available - total_h) // 2)

    # Draw main lines – alternating white / gold
    for i, line in enumerate(main_lines):
        color = GOLD if i % 2 == 1 else WHITE
        bb2 = draw.textbbox((0, 0), line, font=f_main)
        w = bb2[2] - bb2[0]
        x = (SIZE - w) // 2
        # Shadow
        draw.text((x+3, y+3), line, font=f_main, fill=(0, 0, 0))
        draw.text((x, y), line, font=f_main, fill=color)
        y += lh

    # Draw italic lines in gold
    for line in italic_lines:
        bb3 = draw.textbbox((0, 0), line, font=f_ital)
        w = bb3[2] - bb3[0]
        x = (SIZE - w) // 2
        draw.text((x+3, y+3), line, font=f_ital, fill=(0, 0, 0))
        draw.text((x, y), line, font=f_ital, fill=GOLD_LIGHT)
        y += lh

    # ── CLOSING QUOTE MARK ────────────────────────────────────────────────────
    cqm_bb = draw.textbbox((0, 0), "\u201d", font=f_play_qmark)
    cqm_w = cqm_bb[2] - cqm_bb[0]
    draw.text(((SIZE - cqm_w) // 2, y + 5), "\u201d", font=f_play_qmark, fill=GOLD)

    # ── AUTHOR ────────────────────────────────────────────────────────────────
    author_y = y + 75
    cx = SIZE // 2
    draw.line([(cx - 130, author_y), (cx + 130, author_y)], fill=(*GOLD, 160), width=1)

    author_str = f"\u2013 {author.upper()}"
    ab = draw.textbbox((0, 0), author_str, font=f_cinzel_author)
    aw = ab[2] - ab[0]
    draw.text(((SIZE - aw) // 2 + 2, author_y + 18 + 2), author_str, font=f_cinzel_author, fill=(0, 0, 0))
    draw.text(((SIZE - aw) // 2, author_y + 18), author_str, font=f_cinzel_author, fill=WHITE)

    # Save
    final = img.convert("RGB")
    final.save(output_path, "PNG", quality=95)
    print(f"✅ Quote image saved: {output_path}")

if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else "The most important thing in making money is not letting your losses get out of hand."
    a = sys.argv[2] if len(sys.argv) > 2 else "Marty Schwartz"
    o = sys.argv[3] if len(sys.argv) > 3 else "/tmp/quote_test_v3.png"
    create_quote_image(q, a, o)
