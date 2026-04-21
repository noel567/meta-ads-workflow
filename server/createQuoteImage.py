#!/usr/bin/env python3
"""
EasySignals Quote of the Day – Bild-Generator
Design exakt nach den Beispielbildern:
- Sehr dunkler Hintergrund (fast schwarz, leicht blau-gruen getoent)
- Grosser gruener Candlestick-Chart rechts oben (aufsteigend, teal/gruen)
- Kleiner gedimmter Candlestick-Chart links unten
- Geschwungene Kurve im Hintergrund (gruen, halbtransparent)
- Gruene Glow-Effekte (rechts oben + links unten)
- EasySignals Logo oben zentriert (Pfeil + EASYSIGNALS)
- "QUOTE OF THE DAY" Titel-Box (dunkles Rechteck, weisser Text)
- Grosses fett-kursives Zitat (linksbündig, weiss, sehr gross)
- Autor darunter (zentriert, mittelgross, weiss)
"""

import sys
import math
import random
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1080, 1080

FONT_SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_SERIF_BOLD_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf"
FONT_SERIF_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"

BG = (5, 10, 18)
GREEN_BRIGHT = (0, 230, 120)
WHITE = (255, 255, 255)
TITLE_BG = (12, 18, 30)


def draw_background(draw):
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(5 + t * 3)
        g = int(10 + t * 5)
        b = int(18 + t * 8)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def draw_glow(draw, cx, cy, radius, color, alpha_max=55, steps=18):
    r, g, b = color
    for i in range(steps, 0, -1):
        rc = int(radius * i / steps)
        alpha = int(alpha_max * (1 - i / steps) ** 1.5)
        # Simuliere Glow durch ueberlagerte Ellipsen mit abnehmender Helligkeit
        fill = (
            min(255, int(r * alpha / 255)),
            min(255, int(g * alpha / 255)),
            min(255, int(b * alpha / 255)),
        )
        draw.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=fill)


def draw_sine_curve(draw):
    """Geschwungene Kurve von links-mitte nach rechts-oben."""
    points = []
    for i in range(201):
        t = i / 200
        x = int(t * WIDTH * 1.1 - WIDTH * 0.05)
        base_y = HEIGHT * 0.75 - t * HEIGHT * 0.55
        wave = math.sin(t * math.pi * 2.5) * HEIGHT * 0.04
        y = int(base_y + wave)
        points.append((x, y))

    for width_px, brightness in [(5, 12), (3, 22), (1, 45)]:
        for i in range(len(points) - 1):
            t = i / len(points)
            g = int(140 + t * 80)
            b2 = int(110 - t * 50)
            draw.line([points[i], points[i + 1]], fill=(0, g, b2), width=width_px)


def draw_candlesticks_right(draw):
    """Grosse Candlesticks rechts oben, aufsteigend, teal/gruen."""
    random.seed(7)
    num = 14
    ax1, ax2 = 570, 1055
    ay1, ay2 = 25, 530
    aw = ax2 - ax1
    ah = ay2 - ay1
    spacing = aw // num
    cw = max(6, int(spacing * 0.42))

    prices = [40.0]
    for _ in range(num - 1):
        prices.append(min(95, prices[-1] + random.uniform(1.5, 7)))

    p_min = min(prices) - 5
    p_max = max(prices) + 5
    p_range = p_max - p_min

    def py(p):
        return ay2 - int((p - p_min) / p_range * ah)

    for i, price in enumerate(prices):
        x = ax1 + int(spacing * 0.5 + i * spacing)
        op = price + random.uniform(-2, 1)
        cl = price + random.uniform(0, 3)
        hi = max(op, cl) + random.uniform(1, 4)
        lo = min(op, cl) - random.uniform(0.5, 2)

        inten = 0.35 + 0.65 * (i / num)
        g = int((185 + 45 * inten) * inten)
        b2 = int((155 + 35 * inten) * inten)
        color = (0, g, b2)
        wick = (0, max(0, g - 30), max(0, b2 - 30))

        draw.line([(x, py(hi)), (x, py(lo))], fill=wick, width=2)
        bt = min(py(op), py(cl))
        bb = max(py(op), py(cl))
        if bb - bt < 3:
            bb = bt + 3
        draw.rectangle([x - cw // 2, bt, x + cw // 2, bb], fill=color)
        draw.rectangle([x - cw // 2, bt, x + cw // 2, bb], outline=wick, width=1)


def draw_candlesticks_left(draw):
    """Kleine gedimmte Candlesticks links unten."""
    random.seed(13)
    num = 12
    ax1, ax2 = 25, 385
    ay1, ay2 = 745, 1055
    aw = ax2 - ax1
    ah = ay2 - ay1
    spacing = aw // num
    cw = max(4, int(spacing * 0.38))

    prices = [50.0]
    for _ in range(num - 1):
        prices.append(max(30, min(70, prices[-1] + random.uniform(-3, 4))))

    p_min = min(prices) - 5
    p_max = max(prices) + 5
    p_range = p_max - p_min

    def py(p):
        return ay2 - int((p - p_min) / p_range * ah)

    for i, price in enumerate(prices):
        x = ax1 + int(spacing * 0.5 + i * spacing)
        op = price + random.uniform(-1.5, 1.5)
        cl = price + random.uniform(-1.5, 1.5)
        hi = max(op, cl) + random.uniform(0.5, 2)
        lo = min(op, cl) - random.uniform(0.5, 2)

        inten = 0.22 + 0.12 * (i / num)
        g = int(110 * inten)
        b2 = int(90 * inten)
        color = (0, g, b2)
        wick = (0, max(0, g - 15), max(0, b2 - 15))

        draw.line([(x, py(hi)), (x, py(lo))], fill=wick, width=1)
        bt = min(py(op), py(cl))
        bb = max(py(op), py(cl))
        if bb - bt < 2:
            bb = bt + 2
        draw.rectangle([x - cw // 2, bt, x + cw // 2, bb], fill=color)


def wrap_text_left(text, font, max_width, draw):
    words = text.split()
    lines = []
    cur = []
    for word in words:
        test = ' '.join(cur + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            cur.append(word)
        else:
            if cur:
                lines.append(' '.join(cur))
            cur = [word]
    if cur:
        lines.append(' '.join(cur))
    return lines


def create_quote_image(quote_text, author, output_path):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    # Hintergrund-Gradient
    draw_background(draw)

    # Glow-Effekte
    draw_glow(draw, WIDTH - 70, 70, 400, (0, 170, 90), alpha_max=55)
    draw_glow(draw, 70, HEIGHT - 70, 310, (0, 110, 90), alpha_max=45)

    # Kurve + Candlesticks
    draw_sine_curve(draw)
    draw_candlesticks_right(draw)
    draw_candlesticks_left(draw)

    # Fonts
    try:
        font_logo = ImageFont.truetype(FONT_SANS_BOLD, 44)
        font_title = ImageFont.truetype(FONT_SANS_BOLD, 46)
        font_quote = ImageFont.truetype(FONT_SERIF_BOLD_ITALIC, 76)
        font_author = ImageFont.truetype(FONT_SERIF_ITALIC, 48)
    except Exception as e:
        print(f"Font-Fehler: {e}", file=sys.stderr)
        font_logo = font_title = font_quote = font_author = ImageFont.load_default()

    # Logo oben zentriert: Pfeil (gruen) + EASYSIGNALS (weiss)
    logo_y = 68
    arrow = "\u2197 "
    name = "EASYSIGNALS"
    ab = draw.textbbox((0, 0), arrow, font=font_logo)
    nb = draw.textbbox((0, 0), name, font=font_logo)
    total_w = (ab[2] - ab[0]) + (nb[2] - nb[0])
    lx = (WIDTH - total_w) // 2
    draw.text((lx, logo_y), arrow, font=font_logo, fill=GREEN_BRIGHT)
    draw.text((lx + ab[2] - ab[0], logo_y), name, font=font_logo, fill=WHITE)

    # "QUOTE OF THE DAY" Titelbox
    title = "QUOTE OF THE DAY"
    title_y = 162
    tb = draw.textbbox((0, 0), title, font=font_title)
    tw = tb[2] - tb[0]
    th = tb[3] - tb[1]
    px, py2 = 38, 15
    bx1 = (WIDTH - tw) // 2 - px
    by1 = title_y - py2
    bx2 = (WIDTH + tw) // 2 + px
    by2 = title_y + th + py2
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=14, fill=TITLE_BG)
    draw.text(((WIDTH - tw) // 2, title_y), title, font=font_title, fill=WHITE)

    # Zitat: gross, fett-kursiv, linksbündig
    margin = 62
    max_w = WIDTH - 2 * margin
    lines = wrap_text_left(quote_text, font_quote, max_w, draw)
    lh = 90
    q_start_y = 290
    for i, line in enumerate(lines):
        draw.text((margin, q_start_y + i * lh), line, font=font_quote, fill=WHITE)

    total_q_h = len(lines) * lh

    # Autor zentriert
    author_text = f"- {author}"
    author_y = q_start_y + total_q_h + 55
    ab2 = draw.textbbox((0, 0), author_text, font=font_author)
    aw2 = ab2[2] - ab2[0]
    draw.text(((WIDTH - aw2) // 2, author_y), author_text, font=font_author, fill=WHITE)

    img.save(output_path, "PNG", quality=95)
    print(f"Bild gespeichert: {output_path}")


if __name__ == "__main__":
    quote = sys.argv[1] if len(sys.argv) > 1 else "The trend is your friend until the end when it bends."
    author = sys.argv[2] if len(sys.argv) > 2 else "Ed Seykota"
    output = sys.argv[3] if len(sys.argv) > 3 else "/tmp/quote_test.png"
    create_quote_image(quote, author, output)
