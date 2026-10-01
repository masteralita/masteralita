"""Draws the 9-slice button art (prototype/img/btn_*.png) in the benchmark's bevelled style:
black outline, bright glowing rim, thin dark inner line, misty marbled fill.
Run from the repo root: python3 tools/gen_buttons.py  (needs Pillow + numpy)."""
from PIL import Image
import numpy as np

W, H, R = 192, 96, 12          # drawn at 2x; used with border-image slice 24 / width 12px
rng = np.random.default_rng(7)


def fbm(w, h, octaves=5):
    out, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for o in range(octaves):
        g = rng.random((2 ** o + 2, 2 ** (o + 1) + 1))
        out += amp * np.array(Image.fromarray((g * 255).astype('uint8')).resize((w, h), Image.BICUBIC)) / 255
        tot += amp
        amp *= .55
    return out / tot


def inside(w, h, r):
    """Distance (px) from the rounded-rect edge, positive inside."""
    y, x = np.mgrid[0:h, 0:w] + .5
    qx, qy = np.maximum(np.abs(x - w / 2) - (w / 2 - r), 0), np.maximum(np.abs(y - h / 2) - (h / 2 - r), 0)
    edge = np.minimum(w / 2 - np.abs(x - w / 2), h / 2 - np.abs(y - h / 2))
    return np.where((qx > 0) & (qy > 0), r - np.hypot(qx, qy), np.minimum(edge, r - np.hypot(qx, qy)))


def button(name, top, mid, bot, rim_a, rim_b, dark, glow):
    top, mid, bot, rim_a, rim_b, dark, glow = (np.array(c, float) for c in (top, mid, bot, rim_a, rim_b, dark, glow))
    d = inside(W, H, R)
    t = (np.mgrid[0:H, 0:W][0] / H)[..., None]
    body = np.where(t < .5, top + (mid - top) * (t / .5) ** 1.2, mid + (bot - mid) * ((t - .5) / .5))
    body = body * (.75 + .55 * fbm(W, H)[..., None])                              # cloudy marble
    body += (np.clip(fbm(W, H, 4) - .52, 0, 1) * 2.4)[..., None] * glow * .45    # light mist streaks
    ig = np.clip(1 - (d - 6) / 18, 0, 1)[..., None]                              # darker just inside the frame
    body *= 1.3 - ig * .4
    img = np.where((d < 6)[..., None], dark, body)
    img = np.where((d < 5)[..., None], rim_a + (rim_b - rim_a) * t, img)
    img = np.where((d < 2)[..., None], np.array([4., 8, 12]), img)
    alpha = np.clip(d + 1, 0, 1) * 255
    Image.fromarray(np.dstack([img.clip(0, 255), alpha]).astype('uint8'), 'RGBA').save(f'prototype/img/btn_{name}.png', optimize=True)


button('teal', (30, 140, 150), (6, 62, 72), (12, 104, 114), (170, 255, 255), (40, 220, 228), (2, 30, 36), (110, 240, 245))
button('red', (170, 40, 44), (70, 6, 12), (128, 18, 26), (255, 170, 160), (235, 52, 58), (40, 2, 6), (255, 110, 100))
button('steel', (74, 84, 104), (22, 28, 40), (46, 54, 70), (235, 240, 250), (140, 152, 170), (8, 12, 20), (160, 180, 210))
