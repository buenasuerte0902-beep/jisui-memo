from PIL import Image, ImageDraw
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(base_dir, "icons")
os.makedirs(out_dir, exist_ok=True)


def make_icon(size, filename, maskable=False):
    img = Image.new("RGB", (size, size), "#2f7d5a")
    draw = ImageDraw.Draw(img)
    pad = int(size * (0.22 if maskable else 0.12))
    bowl_top = int(size * 0.42)
    draw.ellipse([pad, bowl_top, size - pad, size - pad], fill="#ffffff")
    draw.ellipse([pad, bowl_top, size - pad, bowl_top + int(size * 0.10)], fill="#e8c98a")
    line_w = max(2, size // 40)
    for dx in (-0.14, 0, 0.14):
        x = size / 2 + size * dx
        draw.line([(x, size * 0.14), (x, size * 0.34)], fill="#ffffff", width=line_w)
    img.save(os.path.join(out_dir, filename), "PNG")


make_icon(192, "icon-192.png")
make_icon(512, "icon-512.png")
make_icon(512, "icon-maskable-512.png", maskable=True)
make_icon(180, "apple-touch-icon.png")
print("done")
