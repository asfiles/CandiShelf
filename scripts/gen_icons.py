#!/usr/bin/env python3
"""Generate CandiShelf app icons (PNG/ICO/ICNS) with no external deps.

Renders a 1024px master (rounded square, blue→purple gradient, three stacked
"candidate cards"), then box-downsamples to every size the Tauri bundler and the
web frontend need.
"""
import struct
import zlib
import math
import os

MASTER = 1024


def lerp(a, b, t):
    return a + (b - a) * t


def rounded_alpha(x, y, x0, y0, x1, y1, r):
    """Coverage (0..1) of pixel center inside a rounded rect (approx, 1px AA)."""
    # distance outside the rounded rectangle
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    if x0 <= x <= x1 and y0 <= y <= y1:
        # inside bounding box; check corner regions
        dx = x - cx
        dy = y - cy
        dist = math.hypot(dx, dy)
        if dist <= r:
            return min(1.0, r - dist + 0.5) if dist > r - 1 else 1.0
        return 0.0
    return 0.0


def inside_circle(x, y, cx, cy, r):
    d = math.hypot(x - cx, y - cy)
    if d <= r - 0.5:
        return 1.0
    if d >= r + 0.5:
        return 0.0
    return r + 0.5 - d


def render_master():
    N = MASTER
    px = bytearray(N * N * 4)

    # palette
    blue = (91, 140, 255)
    purple = (157, 91, 255)
    white = (250, 252, 255)
    line = (201, 210, 224)
    avatars = [(91, 140, 255), (63, 185, 132), (224, 166, 59)]

    bg_r = 190  # background rounded-corner radius

    # card geometry
    cx0, cx1 = 210, 814
    card_r = 34
    card_h = 150
    gap = 37
    cards = []
    y = 250
    for i in range(3):
        cards.append((cx0, y, cx1, y + card_h))
        y += card_h + gap

    for j in range(N):
        for i in range(N):
            idx = (j * N + i) * 4
            # background rounded square with diagonal gradient
            bg_cov = rounded_alpha(i, j, 0, 0, N - 1, N - 1, bg_r)
            if bg_cov <= 0:
                px[idx:idx + 4] = bytes((0, 0, 0, 0))
                continue
            t = (i + j) / (2.0 * N)
            r = int(lerp(blue[0], purple[0], t))
            g = int(lerp(blue[1], purple[1], t))
            b = int(lerp(blue[2], purple[2], t))
            a = int(255 * bg_cov)

            # subtle top-left sheen
            sheen = max(0.0, 1.0 - math.hypot(i - 260, j - 260) / 900.0) * 22
            r = min(255, int(r + sheen))
            g = min(255, int(g + sheen))
            b = min(255, int(b + sheen))

            # draw cards
            for ci, (x0, y0, x1, y1) in enumerate(cards):
                cov = rounded_alpha(i, j, x0, y0, x1, y1, card_r)
                if cov > 0:
                    r = int(lerp(r, white[0], cov))
                    g = int(lerp(g, white[1], cov))
                    b = int(lerp(b, white[2], cov))
                    # avatar circle
                    acx, acy, ar = x0 + 80, (y0 + y1) // 2, 46
                    acov = inside_circle(i, j, acx, acy, ar)
                    if acov > 0:
                        av = avatars[ci]
                        r = int(lerp(r, av[0], acov))
                        g = int(lerp(g, av[1], acov))
                        b = int(lerp(b, av[2], acov))
                    # name line
                    lx0, lx1 = x0 + 165, x1 - 60
                    ly0, ly1 = acy - 17, acy + 17
                    lcov = rounded_alpha(i, j, lx0, ly0, lx1, ly1, 17)
                    if lcov > 0:
                        r = int(lerp(r, line[0], lcov))
                        g = int(lerp(g, line[1], lcov))
                        b = int(lerp(b, line[2], lcov))
                    break

            px[idx] = max(0, min(255, r))
            px[idx + 1] = max(0, min(255, g))
            px[idx + 2] = max(0, min(255, b))
            px[idx + 3] = a
    return px


def downsample(src, n, target):
    """Area-average downsample RGBA from n×n to target×target."""
    dst = bytearray(target * target * 4)
    scale = n / target
    for ty in range(target):
        sy0 = int(ty * scale)
        sy1 = max(sy0 + 1, int((ty + 1) * scale))
        for tx in range(target):
            sx0 = int(tx * scale)
            sx1 = max(sx0 + 1, int((tx + 1) * scale))
            ar = ag = ab = aa = 0
            cnt = 0
            for sy in range(sy0, sy1):
                base = sy * n * 4
                for sx in range(sx0, sx1):
                    o = base + sx * 4
                    a = src[o + 3]
                    ar += src[o] * a
                    ag += src[o + 1] * a
                    ab += src[o + 2] * a
                    aa += a
                    cnt += 1
            o = (ty * target + tx) * 4
            if aa > 0:
                dst[o] = ar // aa
                dst[o + 1] = ag // aa
                dst[o + 2] = ab // aa
                dst[o + 3] = aa // cnt
            else:
                dst[o:o + 4] = bytes(4)
    return dst


def write_png(px, size, path):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(px[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    return png


def png_bytes(px, size):
    import io
    tmp = f"/tmp/_ico_{size}.png"
    write_png(px, size, tmp)
    with open(tmp, "rb") as f:
        data = f.read()
    os.remove(tmp)
    return data


def write_ico(images, path):
    # images: list of (size, png_bytes)
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    entries = b""
    offset = 6 + 16 * count
    datas = b""
    for size, data in images:
        w = 0 if size >= 256 else size
        entries += struct.pack(
            "<BBBBHHII", w, w, 0, 0, 1, 32, len(data), offset
        )
        offset += len(data)
        datas += data
    with open(path, "wb") as f:
        f.write(header + entries + datas)


def write_icns(images, path):
    # images: list of (type_code, png_bytes)
    body = b""
    for typ, data in images:
        body += typ + struct.pack(">I", len(data) + 8) + data
    total = 8 + len(body)
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", total) + body)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(here, "src-tauri", "icons")
    public_dir = os.path.join(here, "public")
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    print("Rendering 1024px master…")
    master = render_master()

    cache = {MASTER: master}

    def get(size):
        if size not in cache:
            print(f"  downsample → {size}px")
            cache[size] = downsample(master, MASTER, size)
        return cache[size]

    # Standard Tauri PNG icons
    png_targets = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    for name, size in png_targets.items():
        write_png(get(size), size, os.path.join(icons_dir, name))
        print(f"  wrote {name}")

    # Web frontend icon
    write_png(get(512), 512, os.path.join(public_dir, "icon.png"))
    print("  wrote public/icon.png")

    # ICO (Windows)
    ico_sizes = [16, 32, 48, 64, 128, 256]
    write_ico(
        [(s, png_bytes(get(s), s)) for s in ico_sizes],
        os.path.join(icons_dir, "icon.ico"),
    )
    print("  wrote icon.ico")

    # ICNS (macOS)
    icns_map = [
        (b"ic11", 32),
        (b"ic12", 64),
        (b"ic07", 128),
        (b"ic08", 256),
        (b"ic09", 512),
        (b"ic10", 1024),
    ]
    write_icns(
        [(typ, png_bytes(get(sz), sz)) for typ, sz in icns_map],
        os.path.join(icons_dir, "icon.icns"),
    )
    print("  wrote icon.icns")
    print("Done.")


if __name__ == "__main__":
    main()
