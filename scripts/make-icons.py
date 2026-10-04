#!/usr/bin/env python3
"""Regenerate icons/ from assets/icon-source.webp (needs Python 3, Pillow and numpy).

The source is a navy rounded square on a white background. This makes the background
transparent and writes the sizes the stores and browsers use:

  icon-16/32/48.png  tight crop, full bleed (toolbar, extensions page)
  icon-96.png        tight crop (Firefox high-DPI)
  icon-128.png       artwork at 96px centred in a 128px transparent canvas, which is what
                     the Chrome Web Store asks for

Run: python3 scripts/make-icons.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "icon-source.webp"
OUT = ROOT / "icons"
FULL_BLEED_SIZES = [16, 32, 48, 96]
STORE_CANVAS = 128
STORE_ART = 96
WHITE_FLOOR = 235  # a pixel counts as background white when all channels are at least this
EDGE_BAND = 4  # px beside the background that may be anti-aliased blends of navy and white


def fill_from_corners(allowed: np.ndarray) -> np.ndarray:
    """Pixels in `allowed` that are 4-connected to one of the image corners."""
    h, w = allowed.shape
    flat = allowed.ravel()
    seen = np.zeros(h * w, dtype=bool)
    stack = [i for i in (0, w - 1, (h - 1) * w, h * w - 1) if flat[i]]
    for i in stack:
        seen[i] = True
    while stack:
        i = stack.pop()
        x, y = i % w, i // w
        for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
            if ok and flat[j] and not seen[j]:
                seen[j] = True
                stack.append(j)
    return seen.reshape(h, w)


def remove_background(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(np.float64)
    h, w, _ = rgb.shape

    # 1. background = near-white pixels connected to a corner (the squircle outline is closed,
    #    so this cannot leak into the white lettering inside)
    near_white = rgb.min(axis=2) >= WHITE_FLOOR
    background = fill_from_corners(near_white)
    if background.mean() < 0.01:
        raise SystemExit("could not find a white background around the icon")

    # 2. the squircle's own colour, sampled well inside it
    navy = np.median(rgb[int(h * 0.15) : int(h * 0.17), int(w * 0.45) : int(w * 0.55)].reshape(-1, 3), axis=0)
    white = np.array([255.0, 255.0, 255.0])

    # 3. anti-aliased edge: a pixel near the background is navy blended with white, so its
    #    coverage is where it sits on the white-to-navy line; recolour it pure navy
    grown = Image.fromarray((background * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(2 * EDGE_BAND + 1))
    band = (np.asarray(grown) > 0) & ~background
    axis = white - navy
    coverage = np.clip(((white - rgb) @ axis) / float(axis @ axis), 0.0, 1.0)

    out = np.empty((h, w, 4), dtype=np.uint8)
    out[..., :3] = rgb.astype(np.uint8)
    out[..., 3] = 255
    out[background | band, :3] = navy.astype(np.uint8)
    out[background, 3] = 0
    out[band, 3] = (coverage[band] * 255).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def tight_square(img: Image.Image) -> Image.Image:
    left, top, right, bottom = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    side = max(right - left, bottom - top)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    half = side // 2
    return img.crop((cx - half, cy - half, cx - half + side, cy - half + side))


def main() -> None:
    OUT.mkdir(exist_ok=True)
    art = tight_square(remove_background(Image.open(SRC)))
    for size in FULL_BLEED_SIZES:
        art.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)
    canvas = Image.new("RGBA", (STORE_CANVAS, STORE_CANVAS), (0, 0, 0, 0))
    pad = (STORE_CANVAS - STORE_ART) // 2
    canvas.alpha_composite(art.resize((STORE_ART, STORE_ART), Image.LANCZOS), (pad, pad))
    canvas.save(OUT / f"icon-{STORE_CANVAS}.png", optimize=True)
    for f in sorted(OUT.glob("icon-*.png")):
        with Image.open(f) as im:
            print(f"{f.name}: {im.size[0]}x{im.size[1]} {im.mode}")


if __name__ == "__main__":
    main()
