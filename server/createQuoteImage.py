#!/usr/bin/env python3
"""
Erstellt ein EasySignals-Quote-Bild im Stil des Beispiels:
- Dunkler Hintergrund mit grünem Candlestick-Chart-Muster
- EasySignals Logo oben
- "QUOTE OF THE DAY" Titel
- Grosses Zitat in kursiv
- Autor darunter
"""

import sys
import math
import random
from PIL import Image, ImageDraw, ImageFont

# --- Konfiguration ---
WIDTH, HEIGHT = 1080, 1080
FONT_SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_SERIF_BOLD_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf"
FONT_SERIF_ITALIC = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
FONT_SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# Farben
BG_DARK = (8, 12, 20)
GREEN_BRIGHT = (0, 230, 118)
GREEN_DIM = (0, 120, 60)
GREEN_GLOW = (0, 180, 80)
TEAL = (0, 200, 150)
WHITE = (255, 255, 255)
GRAY = (160, 170, 180)
TITLE_BG = (15, 22, 35)

def draw_candlestick_bg(draw, width, height):
    """Zeichnet einen stilisierten Candlestick-Chart-Hintergrund."""
    random.seed(42)
    
    # Hintergrund-Gradient simulieren (dunkel oben, leicht heller unten)
    for y in range(height):
        alpha = int(8 + (y / height) * 6)
        draw.line([(0, y), (width, y)], fill=(alpha, alpha + 4, alpha + 12))
    
    # Grüner Glow-Effekt unten links
    for r in range(300, 0, -20):
        alpha = max(0, int(15 * (1 - r / 300)))
        draw.ellipse(
            [(-r + 50, height - 50 - r), (r + 50, height - 50 + r)],
            fill=(0, int(alpha * 2), int(alpha))
        )
    
    # Grüner Glow oben rechts
    for r in range(250, 0, -20):
        alpha = max(0, int(12 * (1 - r / 250)))
        draw.ellipse(
            [(width - r - 30, -r + 80), (width - 30 + r, 80 + r)],
            fill=(0, int(alpha * 1.5), int(alpha * 0.5))
        )
    
    # Candlesticks zeichnen
    num_candles = 22
    candle_width = int(width / (num_candles * 1.8))
    spacing = int(width / num_candles)
    
    # Simulierte OHLC-Daten
    prices = [100]
    for _ in range(num_candles - 1):
        change = random.uniform(-4, 5)
        prices.append(max(60, min(140, prices[-1] + change)))
    
    price_min = min(prices) - 10
    price_max = max(prices) + 10
    price_range = price_max - price_min
    
    chart_top = int(height * 0.55)
    chart_bottom = int(height * 0.98)
    chart_height = chart_bottom - chart_top
    
    def price_to_y(p):
        return chart_bottom - int((p - price_min) / price_range * chart_height)
    
    for i, price in enumerate(prices):
        x = int(spacing * 0.5 + i * spacing)
        open_p = price + random.uniform(-2, 2)
        close_p = price + random.uniform(-2, 2)
        high_p = max(open_p, close_p) + random.uniform(0.5, 3)
        low_p = min(open_p, close_p) - random.uniform(0.5, 3)
        
        y_open = price_to_y(open_p)
        y_close = price_to_y(close_p)
        y_high = price_to_y(high_p)
        y_low = price_to_y(low_p)
        
        is_green = close_p >= open_p
        
        # Opacity basierend auf Position (rechts heller)
        opacity = 0.3 + 0.7 * (i / num_candles)
        
        if is_green:
            color = (int(0 * opacity), int(200 * opacity), int(100 * opacity))
            wick_color = (int(0 * opacity), int(180 * opacity), int(80 * opacity))
        else:
            color = (int(0 * opacity), int(100 * opacity), int(50 * opacity))
            wick_color = (int(0 * opacity), int(80 * opacity), int(40 * opacity))
        
        # Docht
        draw.line([(x, y_high), (x, y_low)], fill=wick_color, width=2)
        
        # Körper
        body_top = min(y_open, y_close)
        body_bottom = max(y_open, y_close)
        if body_bottom - body_top < 2:
            body_bottom = body_top + 2
        
        draw.rectangle(
            [x - candle_width // 2, body_top, x + candle_width // 2, body_bottom],
            fill=color
        )

def wrap_text(text, font, max_width, draw):
    """Bricht Text in Zeilen um."""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines

def create_quote_image(quote_text, author, output_path):
    """Erstellt das Quote-Bild."""
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Hintergrund mit Candlesticks
    draw_candlestick_bg(draw, WIDTH, HEIGHT)
    
    # Fonts laden
    try:
        font_logo = ImageFont.truetype(FONT_SANS_BOLD, 38)
        font_title = ImageFont.truetype(FONT_SANS_BOLD, 42)
        font_quote = ImageFont.truetype(FONT_SERIF_BOLD_ITALIC, 52)
        font_author = ImageFont.truetype(FONT_SERIF_ITALIC, 40)
    except Exception as e:
        print(f"Font-Fehler: {e}")
        font_logo = ImageFont.load_default()
        font_title = font_logo
        font_quote = font_logo
        font_author = font_logo
    
    # --- Logo oben zentriert ---
    logo_y = 60
    arrow_symbol = "↗"
    logo_text = f"{arrow_symbol} EASYSIGNALS"
    bbox = draw.textbbox((0, 0), logo_text, font=font_logo)
    logo_w = bbox[2] - bbox[0]
    logo_x = (WIDTH - logo_w) // 2
    
    # Arrow in Grün, Text in Weiß
    arrow_bbox = draw.textbbox((0, 0), arrow_symbol + " ", font=font_logo)
    arrow_w = arrow_bbox[2] - arrow_bbox[0]
    draw.text((logo_x, logo_y), arrow_symbol, font=font_logo, fill=GREEN_BRIGHT)
    draw.text((logo_x + arrow_w, logo_y), "EASYSIGNALS", font=font_logo, fill=WHITE)
    
    # --- "QUOTE OF THE DAY" Titel-Box ---
    title_text = "QUOTE OF THE DAY"
    title_y = 155
    bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_w = bbox[2] - bbox[0]
    title_h = bbox[3] - bbox[1]
    
    padding_x, padding_y = 40, 16
    box_x1 = (WIDTH - title_w) // 2 - padding_x
    box_y1 = title_y - padding_y
    box_x2 = (WIDTH + title_w) // 2 + padding_x
    box_y2 = title_y + title_h + padding_y
    
    draw.rectangle([box_x1, box_y1, box_x2, box_y2], fill=TITLE_BG)
    draw.text(((WIDTH - title_w) // 2, title_y), title_text, font=font_title, fill=WHITE)
    
    # --- Zitat (gross, kursiv, zentriert) ---
    quote_margin = 80
    max_quote_width = WIDTH - 2 * quote_margin
    quote_lines = wrap_text(f'"{quote_text}"', font_quote, max_quote_width, draw)
    
    # Startposition berechnen (vertikal zentriert zwischen Titel und Autor)
    line_height = 68
    total_quote_height = len(quote_lines) * line_height
    quote_start_y = 310
    
    for i, line in enumerate(quote_lines):
        bbox = draw.textbbox((0, 0), line, font=font_quote)
        line_w = bbox[2] - bbox[0]
        x = (WIDTH - line_w) // 2
        y = quote_start_y + i * line_height
        draw.text((x, y), line, font=font_quote, fill=WHITE)
    
    # --- Trennlinie ---
    separator_y = quote_start_y + total_quote_height + 40
    sep_width = 120
    draw.line(
        [(WIDTH // 2 - sep_width, separator_y), (WIDTH // 2 + sep_width, separator_y)],
        fill=GREEN_BRIGHT, width=3
    )
    
    # --- Autor ---
    author_text = f"– {author}"
    author_y = separator_y + 30
    bbox = draw.textbbox((0, 0), author_text, font=font_author)
    author_w = bbox[2] - bbox[0]
    draw.text(((WIDTH - author_w) // 2, author_y), author_text, font=font_author, fill=GRAY)
    
    # Bild speichern
    img.save(output_path, 'PNG', quality=95)
    print(f"Bild gespeichert: {output_path}")

if __name__ == "__main__":
    quote = sys.argv[1] if len(sys.argv) > 1 else "The most important thing is to try and preserve capital and not to lose money."
    author = sys.argv[2] if len(sys.argv) > 2 else "Paul Tudor Jones"
    output = sys.argv[3] if len(sys.argv) > 3 else "/tmp/quote_test.png"
    create_quote_image(quote, author, output)
