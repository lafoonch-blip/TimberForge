"""Trace the approved TimberForge badge PNG into clean layered vector paths."""
import numpy as np, cv2, json
from PIL import Image

SRC = "/sessions/nifty-optimistic-goodall/mnt/uploads/326ec392-a0ea-465f-b639-68b6c7fc3dbf-1788831151355_image.png"
CROP = (316, 114, 938, 829)          # shield bounding box
VBW = 100.0                           # target viewBox width

# painter's order, back -> front
PALETTE = [
    ("sky",     (252, 252, 251)),
    ("tan",     (168, 148, 110)),
    ("midg",    (101, 113,  80)),
    ("field",   ( 87, 103,  68)),
    ("field2",  ( 65,  86,  57)),
    ("field3",  ( 52,  75,  52)),
    ("tree",    ( 14,  43,  30)),
    ("border",  (  4,  27,  28)),
]

def build():
    im = Image.open(SRC).convert("RGB").crop(CROP)
    a = np.array(im).astype(np.int32)
    H, W = a.shape[:2]
    scale = VBW / W
    vbh = round(H * scale, 2)

    # nearest-palette quantisation
    cols = np.array([c for _, c in PALETTE], dtype=np.int32)
    d = ((a[:, :, None, :] - cols[None, None, :, :]) ** 2).sum(3)
    idx = d.argmin(2).astype(np.uint8)

    # shield mask: fill the outer silhouette of everything that isn't background
    nonbg = (np.abs(a - np.array([252, 252, 251], dtype=np.int32)).sum(2) > 26).astype(np.uint8)
    nonbg = cv2.morphologyEx(nonbg, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cnts, _ = cv2.findContours(nonbg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    outer = max(cnts, key=cv2.contourArea)
    shield = np.zeros((H, W), np.uint8)
    cv2.drawContours(shield, [outer], -1, 1, -1)

    layers = []
    for i, (name, rgb) in enumerate(PALETTE):
        m = ((idx == i) & (shield > 0)).astype(np.uint8)
        if name == "sky":
            m = (shield > 0).astype(np.uint8)      # solid backing, no seams
        else:
            m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=1)
            m = (m & shield).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        print(f"    [{name}] px={int(m.sum())}")
        if m.sum() < 40:
            continue
        cs, hier = cv2.findContours(m, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        parts = []
        for c, h in zip(cs, hier[0] if hier is not None else []):
            if cv2.contourArea(c) < 22:
                continue
            eps = 0.55 if name in ("border", "tree", "sky") else 0.8
            ap = cv2.approxPolyDP(c, eps, True)
            if len(ap) < 3:
                continue
            pts = ap.reshape(-1, 2) * scale
            parts.append("M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z")
        if parts:
            layers.append({"name": name,
                           "fill": "#%02X%02X%02X" % rgb,
                           "d": " ".join(parts),
                           "n": len(parts)})

    return layers, vbh, scale, shield, outer

def shield_outline(outer, scale, eps=0.6):
    ap = cv2.approxPolyDP(outer, eps, True).reshape(-1, 2) * scale
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in ap) + " Z"

if __name__ == "__main__":
    layers, vbh, scale, shield, outer = build()
    out = {"vbh": vbh, "layers": layers,
           "shield": shield_outline(outer, scale)}
    json.dump(out, open("/sessions/nifty-optimistic-goodall/brand/traced.json", "w"))
    tot = sum(l["n"] for l in layers)
    for l in layers:
        print(f'  {l["name"]:8} {l["n"]:>4} paths  {len(l["d"]):>7} chars  {l["fill"]}')
    print(f"viewBox 0 0 100 {vbh}   total {tot} subpaths")
