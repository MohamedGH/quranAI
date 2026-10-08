import struct
import zlib
import os
import math

def create_png(width, height, is_maskable=False):
    # Generates raw RGBA PNG with rounded background and book motif
    raw_data = bytearray()
    cx, cy = width / 2.0, height / 2.0
    radius = min(width, height) * (0.38 if is_maskable else 0.44)

    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        for x in range(width):
            dx = (x - cx) / float(width)
            dy = (y - cy) / float(height)
            dist = math.sqrt(dx * dx + dy * dy)

            # Background color gradient: deep navy #0b1726 to #111d2e
            t = (x + y) / float(width + height)
            r = int(11 + t * 6)
            g = int(23 + t * 6)
            b = int(38 + t * 8)
            a = 255

            if not is_maskable:
                # Rounded square mask
                kx = abs(x - cx) - (width * 0.5 - 24)
                ky = abs(y - cy) - (height * 0.5 - 24)
                if kx > 0 and ky > 0 and math.sqrt(kx*kx + ky*ky) > 24:
                    a = 0

            # Central Quran motif (golden book & crescent)
            # Center zone: dist < 0.32
            if a > 0:
                if 0.22 <= dist <= 0.23:
                    # Gold ornament ring
                    r, g, b = 212, 175, 55
                elif dist < 0.20:
                    # Inner icon features
                    # Book wings
                    in_book_y = (y - cy) / (height * 0.25)
                    in_book_x = (x - cx) / (width * 0.25)
                    if -0.2 < in_book_y < 0.8 and abs(in_book_x) < 0.9:
                        # Book shapes
                        curve_y = 0.3 * (in_book_x ** 2) - 0.2
                        if abs(in_book_y - curve_y) < 0.45 and abs(in_book_x) > 0.05:
                            # Gold page
                            r, g, b = 218, 185, 75
                        elif abs(in_book_x) <= 0.05 and -0.1 < in_book_y < 0.7:
                            # Spine bookmark
                            r, g, b = 62, 184, 160 # Teal
                    # Crescent at top
                    cres_dx = (x - cx) / (width * 0.1)
                    cres_dy = (y - (cy - height * 0.12)) / (height * 0.1)
                    cres_d1 = math.sqrt(cres_dx * cres_dx + cres_dy * cres_dy)
                    cres_d2 = math.sqrt((cres_dx - 0.3) ** 2 + (cres_dy + 0.1) ** 2)
                    if cres_d1 < 0.7 and cres_d2 > 0.5:
                        r, g, b = 245, 215, 105

            raw_data.extend([r, g, b, a])

    compressed = zlib.compress(bytes(raw_data), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", compressed)
    iend = chunk(b"IEND", b"")

    return header + ihdr + idat + iend

os.makedirs("public", exist_ok=True)

with open("public/pwa-192x192.png", "wb") as f:
    f.write(create_png(192, 192, is_maskable=False))

with open("public/pwa-512x512.png", "wb") as f:
    f.write(create_png(512, 512, is_maskable=False))

with open("public/pwa-maskable-512x512.png", "wb") as f:
    f.write(create_png(512, 512, is_maskable=True))

with open("public/apple-touch-icon.png", "wb") as f:
    f.write(create_png(180, 180, is_maskable=False))

with open("public/favicon.ico", "wb") as f:
    # 32x32 PNG as ico fallback
    f.write(create_png(32, 32, is_maskable=False))

print("PWA assets successfully generated.")
