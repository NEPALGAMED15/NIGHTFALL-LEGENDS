#!/usr/bin/env python3
import os
import sys
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LOGO_PATH = os.path.join(ROOT, 'public/assets/aistudio/e5dddf8b-6f44-4ab6-b30c-f5f0b282b674_5747d5b4.png')
RES_DIR = os.path.join(ROOT, 'android/app/src/main/res')
BG_COLOR = (7, 9, 15, 255)  # #07090f


def make_square_icon_artwork(src: Image.Image, size: int, safe_scale: float = 1.0) -> Image.Image:
    """Frames the NIGHTFALL LEGENDS logo cleanly into a square icon without clipping Kael or title letters."""
    sw, sh = src.size
    # Crop horizontally centered region (1220x941 -> captures full NIGHTFALL LEGENDS emblem + Kael + Moon)
    crop_w = min(sw, int(sh * 1.32))
    left = max(0, (sw - crop_w) // 2)
    cropped = src.crop((left, 0, left + crop_w, sh))

    canvas = Image.new('RGBA', (size, size), BG_COLOR)
    inner = max(16, int(size * safe_scale))
    # Fit width inside inner square so full title stays crisp and unclipped
    ratio = inner / cropped.width
    target_w = inner
    target_h = max(1, int(cropped.height * ratio))
    if target_h > inner:
        ratio = inner / cropped.height
        target_h = inner
        target_w = max(1, int(cropped.width * ratio))

    resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (size - target_w) // 2
    y = (size - target_h) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def make_round_mask(img: Image.Image) -> Image.Image:
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def make_splash(src: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new('RGBA', (width, height), BG_COLOR)
    if width >= height:
        # Landscape: cover cleanly preserving aspect ratio
        fitted = ImageOps.fit(src, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        canvas.alpha_composite(fitted)
    else:
        # Portrait fallback: fit full 16:9 logo cleanly across width on dark backdrop
        target_w = width
        target_h = max(1, int(src.height * (width / src.width)))
        resized = src.resize((target_w, target_h), Image.Resampling.LANCZOS)
        canvas.alpha_composite(resized, (0, (height - target_h) // 2))
    return canvas


def main():
    if not os.path.exists(LOGO_PATH):
        print(f'ERROR: Logo file not found: {LOGO_PATH}', file=sys.stderr)
        sys.exit(1)
    if not os.path.isdir(RES_DIR):
        print(f'ERROR: Android res directory not found: {RES_DIR}', file=sys.stderr)
        sys.exit(1)

    src = Image.open(LOGO_PATH).convert('RGBA')

    icon_buckets = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    for folder, (legacy_px, fg_px) in icon_buckets.items():
        out_dir = os.path.join(RES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)

        legacy = make_square_icon_artwork(src, legacy_px, safe_scale=0.94)
        legacy.convert('RGB').save(os.path.join(out_dir, 'ic_launcher.png'), format='PNG', optimize=True)

        round_icon = make_round_mask(legacy)
        round_icon.save(os.path.join(out_dir, 'ic_launcher_round.png'), format='PNG', optimize=True)

        # Adaptive foreground uses ~68% safe zone so launcher circle/squircle never clips letters
        fg = make_square_icon_artwork(src, fg_px, safe_scale=0.68)
        fg.save(os.path.join(out_dir, 'ic_launcher_foreground.png'), format='PNG', optimize=True)

    # Play Store 512x512 icon
    play_icon = make_square_icon_artwork(src, 512, safe_scale=0.94)
    play_icon.convert('RGB').save(os.path.join(ROOT, 'android/play-store-icon-512.png'), format='PNG', optimize=True)

    # Splash screens across landscape & portrait buckets
    splash_targets = {
        'drawable': (1280, 720),
        'drawable-land-mdpi': (480, 320),
        'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720),
        'drawable-land-xxhdpi': (1920, 1080),
        'drawable-land-xxxhdpi': (1920, 1080),
        'drawable-port-mdpi': (320, 480),
        'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280),
        'drawable-port-xxhdpi': (1080, 1920),
        'drawable-port-xxxhdpi': (1080, 1920),
    }

    for folder, (sw, sh) in splash_targets.items():
        out_dir = os.path.join(RES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)
        old_png = os.path.join(out_dir, 'splash.png')
        if os.path.exists(old_png):
            os.remove(old_png)
        splash_img = make_splash(src, sw, sh).convert('RGB')
        splash_img.save(os.path.join(out_dir, 'splash.jpg'), format='JPEG', quality=90, optimize=True)

    # Ensure adaptive icon background color matches #07090f
    values_dir = os.path.join(RES_DIR, 'values')
    os.makedirs(values_dir, exist_ok=True)
    ic_bg_xml = os.path.join(values_dir, 'ic_launcher_background.xml')
    with open(ic_bg_xml, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#07090F</color>\n</resources>\n')

    print('Generated all Android launcher icons, adaptive foregrounds, Play Store icon, and splash screens.')


if __name__ == '__main__':
    main()
