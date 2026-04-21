#!/usr/bin/env python3
"""
EasySignals Quote of the Day – Bild-Generator v2
Verwendet KI-generierten Hintergrund als Basis.
Pillow legt Logo, Titel-Box, Zitat und Autor darüber.
"""

import sys
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH, HEIGHT = 1080, 1080

# Pfad zum KI-Hintergrundbild (1:1, 2048x2048, wird auf 1080x1080 skaliert)
# Das Bild wird beim ersten Aufruf von der CDN-URL heruntergeladen und gecacht
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BG_IMAGE_PATH = os.path.join(SCRIPT_DIR, "quote_bg.png")
BG_IMAGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663565941002/4xE4vZJFvFwZj547EifVzi/quote_bg_v2-KR2h6WjdCkjtasGzUMqVzG.png"

# Fonts
FONT_SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_SERIF_BOLD_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf"
FONT_SERIF_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"

WHITE = (255, 255, 255)
GREEN_BRIGHT = (0, 230, 120)
TITLE_BG = (10, 16, 26, 210)  # RGBA: sehr dunkles Blau, leicht transparent


def load_fonts():
    try:
        return {
            "logo": ImageFont.truetype(FONT_SANS_BOLD, 46),
            "title": ImageFont.truetype(FONT_SANS_BOLD, 50),
            "quote": ImageFont.truetype(FONT_SERIF_BOLD_ITALIC, 80),
            "author": ImageFont.truetype(FONT_SERIF_ITALIC, 52),
        }
    except Exception as e:
        print(f"Font-Fehler: {e}", file=sys.stderr)
        d = ImageFont.load_default()
        return {"logo": d, "title": d, "quote": d, "author": d}


def wrap_text(text, font, max_width, draw):
    """Zeilenumbruch: Wörter aufteilen bis max_width erreicht."""
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


def draw_rounded_rect_rgba(img, xy, radius, fill_rgba):
    """Zeichnet ein abgerundetes Rechteck mit RGBA-Farbe (mit Alpha) auf ein RGBA-Bild."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle(xy, radius=radius, fill=fill_rgba)
    img.alpha_composite(overlay)


def create_quote_image(quote_text, author, output_path):
    # Hintergrund laden und auf 1080x1080 skalieren
    # Wenn lokal nicht vorhanden: von CDN herunterladen und cachen
    if not os.path.exists(BG_IMAGE_PATH):
        try:
            import urllib.request
            print(f"Lade Hintergrundbild von CDN...", file=sys.stderr)
            urllib.request.urlretrieve(BG_IMAGE_URL, BG_IMAGE_PATH)
            print(f"Hintergrundbild gecacht: {BG_IMAGE_PATH}", file=sys.stderr)
        except Exception as e:
            print(f"Download fehlgeschlagen: {e}", file=sys.stderr)

    if os.path.exists(BG_IMAGE_PATH):
        bg = Image.open(BG_IMAGE_PATH).convert("RGBA")
        bg = bg.resize((WIDTH, HEIGHT), Image.LANCZOS)
    else:
        # Fallback: einfacher dunkler Hintergrund
        bg = Image.new("RGBA", (WIDTH, HEIGHT), (5, 10, 18, 255))

    # Leichte Abdunkelung der Mitte für bessere Lesbarkeit
    darken = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d_dark = ImageDraw.Draw(darken)
    # Gradient-Overlay: Mitte leicht abdunkeln
    for y in range(HEIGHT):
        t = abs(y - HEIGHT * 0.5) / (HEIGHT * 0.5)
        alpha = int(30 * (1 - t))
        d_dark.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, alpha))
    bg.alpha_composite(darken)

    fonts = load_fonts()
    draw = ImageDraw.Draw(bg)

    # ── LOGO ──────────────────────────────────────────────────────────────────
    logo_y = 72
    arrow = "\u2197 "
    name = "EASYSIGNALS"
    ab = draw.textbbox((0, 0), arrow, font=fonts["logo"])
    nb = draw.textbbox((0, 0), name, font=fonts["logo"])
    total_w = (ab[2] - ab[0]) + (nb[2] - nb[0])
    lx = (WIDTH - total_w) // 2
    draw.text((lx, logo_y), arrow, font=fonts["logo"], fill=GREEN_BRIGHT)
    draw.text((lx + ab[2] - ab[0], logo_y), name, font=fonts["logo"], fill=WHITE)

    # ── TITEL-BOX "QUOTE OF THE DAY" ─────────────────────────────────────────
    title = "QUOTE OF THE DAY"
    title_y = 168
    tb = draw.textbbox((0, 0), title, font=fonts["title"])
    tw = tb[2] - tb[0]
    th = tb[3] - tb[1]
    px, py2 = 44, 16
    bx1 = (WIDTH - tw) // 2 - px
    by1 = title_y - py2
    bx2 = (WIDTH + tw) // 2 + px
    by2 = title_y + th + py2
    draw_rounded_rect_rgba(bg, [bx1, by1, bx2, by2], radius=14, fill_rgba=TITLE_BG)
    draw = ImageDraw.Draw(bg)  # Nach alpha_composite neu erstellen
    draw.text(((WIDTH - tw) // 2, title_y), title, font=fonts["title"], fill=WHITE)

    # ── ZITAT ─────────────────────────────────────────────────────────────────
    margin = 60
    max_w = WIDTH - 2 * margin
    lines = wrap_text(quote_text, fonts["quote"], max_w, draw)
    line_height = 96
    q_start_y = 298

    # Schatten für bessere Lesbarkeit
    for i, line in enumerate(lines):
        y = q_start_y + i * line_height
        # Schatten
        draw.text((margin + 3, y + 3), line, font=fonts["quote"], fill=(0, 0, 0, 160))
        # Text
        draw.text((margin, y), line, font=fonts["quote"], fill=WHITE)

    total_q_h = len(lines) * line_height

    # ── AUTOR ─────────────────────────────────────────────────────────────────
    author_text = f"- {author}"
    author_y = q_start_y + total_q_h + 60
    ab2 = draw.textbbox((0, 0), author_text, font=fonts["author"])
    aw2 = ab2[2] - ab2[0]
    draw.text(((WIDTH - aw2) // 2 + 3, author_y + 3), author_text, font=fonts["author"], fill=(0, 0, 0, 140))
    draw.text(((WIDTH - aw2) // 2, author_y), author_text, font=fonts["author"], fill=WHITE)

    # Als RGB speichern
    final = bg.convert("RGB")
    final.save(output_path, "PNG", quality=95)
    print(f"Bild gespeichert: {output_path}")


if __name__ == "__main__":
    quote = sys.argv[1] if len(sys.argv) > 1 else "The most important thing in making money is not letting your losses get out of hand."
    author = sys.argv[2] if len(sys.argv) > 2 else "Marty Schwartz"
    output = sys.argv[3] if len(sys.argv) > 3 else "/tmp/quote_test_v2.png"
    create_quote_image(quote, author, output)
