'use strict';
/* ==========================================================================
   Pixel-art planets (도트 행성): every planet is rendered on a small grid with
   banded shading + ordered dithering, then scaled up with smoothing off.
   One renderer serves the battle canvas (rotating) and the HTML orbs (still).
   ========================================================================== */
const PX_N = 32;                                   // planet diameter in art pixels
const PX_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - .47);
const PX_LIGHT = (() => { const l = [-.55, -.5, .67], m = Math.hypot(...l); return l.map(v => v / m); })();

const pxHex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const pxMix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const pxRgb = s => s.split(',').map(Number);
const pxToHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
// 6-step ramp dark → light from the three look colours
function pxRamp(c1, c2, c3) {
  const [a, b, c] = [c1, c2, c3].map(pxHex);
  return [pxMix(c, [0, 0, 8], .45), c, pxMix(c, b, .5), b, pxMix(b, a, .5), a];
}

// wrapping value noise on a (lon, lat) grid
function pxNoise(seed) {
  const R = 64, g = new Float32Array(R * R);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
  const at = (x, y) => g[((y % R + R) % R) * R + ((x % R + R) % R)];
  const sm = v => v * v * (3 - 2 * v);
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  // period p in lon so the map wraps around the sphere
  return (u, v, oct = 4) => { let f = 0, amp = .5, fr = 1, tot = 0;
    for (let o = 0; o < oct; o++) { const p = 8 * fr; f += amp * n(u * p, v * p); tot += amp; amp *= .5; fr *= 2; }
    return f / tot; };
}

function pxSpec(kind, look) {
  if (kind === 'earth') return { kind, ramp: null, glow: '80,150,255', seed: 3 };
  if (kind === 'sun') return { kind: 'star', ramp: pxRamp('#fffbe0', '#ffb02e', '#d8461a'), glow: '255,160,40', seed: 5 };
  if (kind === 'moon') return { kind: 'rock', ramp: pxRamp('#f6f6fa', '#a6a9bb', '#3e4156'), glow: '200,205,235', seed: 7 };
  const c = look.c || ['#ccc', '#888', '#333'];
  return { kind, ramp: pxRamp(...c), glow: look.glow || '200,200,200', bands: look.bands, ring: look.ring, seed: c.join('').length * 13 + c[1].charCodeAt(2) };
}

// Surface map: for each (lon, lat) an index offset and an optional override colour
function pxSurface(sp) {
  const W = PX_N * 2, H = PX_N, noise = pxNoise(sp.seed), noise2 = pxNoise(sp.seed + 17);
  const map = new Array(W * H);
  const craters = [];
  if (sp.kind === 'rock') for (let i = 0; i < 9; i++) craters.push([noise(i * .37, .11, 1) * W * 1.7 % W, 6 + noise(.21, i * .41, 1) * (H - 12) * 1.6 % (H - 12), 2 + (i % 3) * 1.6]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, h = noise(u, v);
    let o = { d: 0, col: null };
    if (sp.kind === 'earth') {
      const cl = noise2(u * 1.5, v * 2.2, 3);
      if (cl > .63) o = { d: 0, pal: 'cloud' };
      else if (h > .55) o = { d: h > .65 ? 1 : 0, pal: 'land' };
      else o = { d: h < .4 ? -1 : 0, pal: 'sea' };
    } else if (sp.kind === 'gas') {
      const band = Math.sin((v + (h - .5) * .18) * Math.PI * (sp.bands ? 9 : 6));
      o = { d: band > .45 ? 1 : band < -.55 ? -1 : 0 };
      if (sp.bands) { const dx = Math.min(Math.abs(u - .3), 1 - Math.abs(u - .3)) * 2, dy = (v - .64) * 1.1; if (dx * dx / .02 + dy * dy / .004 < 1) o = { d: 0, col: [190, 70, 40] }; }
    } else if (sp.kind === 'rock') {
      o = { d: h < .42 ? -1 : h > .62 ? 1 : 0 };
      for (const [cx, cy, cr] of craters) {
        const dx = Math.min(Math.abs(x - cx), W - Math.abs(x - cx)) * .5, dy = y - cy, d = Math.hypot(dx, dy);
        if (d < cr) o = { d: dy < -cr * .35 || dx < -cr * .5 ? -2 : -1 };
        else if (d < cr + 1 && dy > 0) o = { d: 1 };
      }
    } else if (sp.kind === 'star') {
      o = { d: h > .6 ? 1 : h < .4 ? -1 : 0 };
    }
    map[y * W + x] = o;
  }
  return { map, W, H };
}

const PX_EARTH = {
  sea: pxRamp('#7fc0ff', '#2f6be8', '#0b1f5a'),
  land: pxRamp('#d9f2a0', '#4ea347', '#173a1a'),
  cloud: pxRamp('#ffffff', '#c8d4ef', '#5d6a90'),
};

const PX_CACHE = new Map();
// Returns a canvas: the planet (and ring, if any) on a PX_N-based grid. `rot` = longitude shift in art pixels.
function pxPlanet(kind, look = {}, rot = 0, tint = null) {
  const sp = pxSpec(kind, look);
  const sk = kind + (look.c || []).join() + (look.ring ? 'r' : '') + (look.bands ? 'b' : '');
  let base = PX_CACHE.get(sk);
  if (!base) { base = { sp, surf: pxSurface(sp), frames: new Map() }; PX_CACHE.set(sk, base); }
  const fk = (rot % base.surf.W) + '|' + (tint || '');
  let cv = base.frames.get(fk);
  if (cv) return cv;
  if (base.frames.size > 400) base.frames.clear();
  const N = PX_N, M = sp.ring ? Math.round(N * 2.3) : N, off = (M - N) / 2;
  cv = document.createElement('canvas'); cv.width = M; cv.height = M;
  const g = cv.getContext('2d'), img = g.createImageData(M, M), px = img.data;
  const put = (x, y, c, a = 255) => { const i = (y * M + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  const R = N / 2, { map, W, H } = base.surf, star = sp.kind === 'star';
  const tintC = tint ? pxRgb(tint) : null;
  // ring geometry (tilted ellipse); back half first, planet, then front half
  const ringCol = sp.ring ? pxRamp('#fff6e0', pxToHex(pxRgb(sp.glow)), '#2a1e10') : null;
  const ringAt = (x, y) => {
    if (!sp.ring) return null;
    const cx = x + .5 - M / 2, cy = y + .5 - M / 2, a = -.25, rx = cx * Math.cos(a) + cy * Math.sin(a), ry = -cx * Math.sin(a) + cy * Math.cos(a);
    const e = Math.hypot(rx / (M * .48), ry / (M * .12));
    if (e < .66 || e > 1 || (e > .83 && e < .87)) return null;
    const lvl = e < .74 ? 3 : e < .83 ? 4 : 2;
    return { back: ry < 0, c: ringCol[Math.max(0, Math.min(5, lvl + (PX_BAYER[(y & 3) * 4 + (x & 3)] > .2 ? 1 : 0) - (rx > 0 ? 1 : 0)))] };
  };
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const rg = ringAt(x, y);
    const nx = (x - off + .5 - R) / R, ny = (y - off + .5 - R) / R, d2 = nx * nx + ny * ny;
    if (d2 > 1) { if (rg) put(x, y, rg.c); continue; }
    if (rg && !rg.back) { put(x, y, rg.c); continue; }
    const nz = Math.sqrt(1 - d2);
    const lon = Math.atan2(nx, nz) / Math.PI * .5 + .5, lat = Math.asin(ny) / Math.PI + .5;
    const mx = ((Math.floor(lon * W) + rot) % W + W) % W, my = Math.min(H - 1, Math.floor(lat * H));
    const o = map[my * W + mx];
    const dith = PX_BAYER[((y - off) & 3) * 4 + ((x - off) & 3)];
    let l;
    if (star) l = .55 + .45 * nz;                                  // limb darkening, no night side
    else l = Math.max(0, nx * PX_LIGHT[0] + ny * PX_LIGHT[1] + nz * PX_LIGHT[2]) * .95 + .05;
    let idx = Math.floor(l * 5.2 + dith * .55) + o.d;
    if (!star && nz < .3 && l > .45) idx += 1;                       // thin lit rim
    idx = Math.max(0, Math.min(5, idx));
    let c = sp.kind === 'earth' ? PX_EARTH[o.pal][idx] : o.col ? pxMix(o.col, idx < 3 ? [20, 5, 5] : [255, 200, 160], Math.abs(idx - 3) * .22) : sp.ramp[idx];
    if (tintC) c = pxMix(c, pxMix(tintC, [0, 0, 0], 1 - idx / 6), .38);
    put(x, y, c);
  }
  g.putImageData(img, 0, 0);
  base.frames.set(fk, cv);
  return cv;
}
// scale of the returned canvas relative to the planet diameter
const pxPlanetSpan = look => (look && look.ring ? Math.round(PX_N * 2.3) : PX_N) / PX_N;

// Still image for HTML orbs (data URL, cached per planet + skin tint)
const PX_URL = {};
function pxPlanetUrl(pid, tint = null) {
  const k = pid + '|' + (tint || ''), d = PLANET[pid];
  return PX_URL[k] || (PX_URL[k] = pxPlanet(d.kind, d.look || {}, 0, tint).toDataURL());
}

/* Pixel sprites drawn by SpriteCook (img/*.png): meteors, chest, black hole.
   pxSprite() returns the image once it has loaded, else null so callers can fall back. */
const PX_SPR = {};
function pxSprite(name) {
  let im = PX_SPR[name];
  if (!im) { im = PX_SPR[name] = new Image(); im.src = `img/${name}.png`; }
  return im.complete && im.naturalWidth ? im : null;
}
['rock_0', 'rock_1', 'rock_2', 'rock_3', 'meteor_fire', 'chest_closed', 'blackhole'].forEach(pxSprite);
// draw a sprite centred on (x, y), scaled to width w, rotated by a, with crisp pixels
function pxDraw(ctx, im, x, y, w, a = 0) {
  const h = w * im.naturalHeight / im.naturalWidth, sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (a) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
  else ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
  ctx.imageSmoothingEnabled = sm;
}
