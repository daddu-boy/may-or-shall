from PIL import Image, ImageDraw, ImageFont
import os

SRC = "/Users/sidharthkapoor/Desktop/Desktop/may-or-shall/public/addin/logo-master.png"
OUT = "/Users/sidharthkapoor/Desktop/Desktop/may-or-shall/store/edge"
os.makedirs(OUT, exist_ok=True)

CREAM = (243, 241, 236)
INK = (28, 25, 23)
MUTED = (87, 83, 78)
INDIGO = (79, 70, 229)

FONTS = [
    "/System/Library/Fonts/Supplemental/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]
BOLD = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]

def font(size, bold=False):
    for p in (BOLD if bold else FONTS):
        if os.path.exists(p):
            try:
                if p.endswith(".ttc"):
                    return ImageFont.truetype(p, size, index=1 if bold else 0)
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

# --- source logo, cropped free of its outer grey band -------------------------
logo = Image.open(SRC).convert("RGB")
w, h = logo.size
inset = int(w * 0.06)
logo = logo.crop((inset, inset, w - inset, h - inset))

def rounded(img, radius_frac=0.14):
    """Return img with rounded corners (RGBA)."""
    img = img.convert("RGBA")
    r = int(min(img.size) * radius_frac)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], r, fill=255)
    img.putalpha(mask)
    return img

# --- 1. extension logo 300x300 ------------------------------------------------
logo.resize((300, 300), Image.LANCZOS).save(f"{OUT}/logo-300x300.png")

# --- promotional tiles --------------------------------------------------------
def tile(size, logo_frac, title_pt, sub_pt, gap, sub_lines, pad_frac=0.085):
    W, H = size
    im = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(im)

    # thin indigo accent bar down the left edge
    d.rectangle([0, 0, max(4, W // 200), H], fill=INDIGO)

    pad = int(W * pad_frac)
    ls = int(H * logo_frac)
    lg = rounded(logo.resize((ls, ls), Image.LANCZOS))
    ly = (H - ls) // 2
    im.paste(lg, (pad, ly), lg)

    tx = pad + ls + gap
    avail = W - tx - pad

    # shrink the title until it fits the space that's left
    while title_pt > 10:
        ft = font(title_pt, bold=True)
        if d.textlength("May or Shall", font=ft) <= avail:
            break
        title_pt -= 2
    ft = font(title_pt, bold=True)

    # shrink the subtitle until the longest line fits the space that's left
    while sub_pt > 8:
        fs = font(sub_pt)
        if max(d.textlength(l, font=fs) for l in sub_lines) <= avail:
            break
        sub_pt -= 1
    fs = font(sub_pt)

    # centre the whole text block on the logo's vertical midpoint
    tb = d.textbbox((0, 0), "May or Shall", font=ft)
    th = gapt = tb[3] - tb[1]
    line_h = int(sub_pt * 1.45)
    space = int(sub_pt * 1.0)
    total = th + space + line_h * len(sub_lines)
    y = (H - total) // 2 - tb[1]

    d.text((tx, y), "May or Shall", font=ft, fill=INK)
    y += th + space
    for ln in sub_lines:
        d.text((tx, y), ln, font=fs, fill=MUTED)
        y += line_h
    return im

# small promotional tile 440x280 — stacked, the side-by-side layout is too tight here
def stacked(size, logo_px, title_pt, sub_pt, sub):
    W, H = size
    im = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, max(4, H // 70)], fill=INDIGO)

    ft, fs = font(title_pt, bold=True), font(sub_pt)
    tb = d.textbbox((0, 0), "May or Shall", font=ft)
    th = tb[3] - tb[1]
    sb = d.textbbox((0, 0), sub, font=fs)
    sh = sb[3] - sb[1]
    gap1, gap2 = int(H * 0.075), int(sub_pt * 0.75)
    total = logo_px + gap1 + th + gap2 + sh
    y = (H - total) // 2 + int(H * 0.02)

    lg = rounded(logo.resize((logo_px, logo_px), Image.LANCZOS))
    im.paste(lg, ((W - logo_px) // 2, y), lg)
    y += logo_px + gap1
    d.text(((W - d.textlength("May or Shall", font=ft)) / 2, y - tb[1]), "May or Shall", font=ft, fill=INK)
    y += th + gap2
    d.text(((W - d.textlength(sub, font=fs)) / 2, y - sb[1]), sub, font=fs, fill=MUTED)
    return im

stacked((440, 280), 108, 34, 15, "Web Clipper for litigators").save(
    f"{OUT}/promo-small-440x280.png"
)

# large promotional tile 1400x560
tile(
    (1400, 560), 0.62, 104, 40, 60,
    ["Web Clipper for litigators", "Save any highlight, with its source, into your matter"],
).save(f"{OUT}/promo-large-1400x560.png")

print("wrote:", sorted(os.listdir(OUT)))
