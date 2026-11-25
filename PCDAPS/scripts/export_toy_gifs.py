#!/usr/bin/env python3
"""Export the two canvas-based toy animations as standalone GIFs."""

import base64
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TOY = ROOT / "static" / "images" / "toy"
DATA = ROOT / "static" / "data"

BASE_W = 528
MODE_H = 570
LANGEVIN_H = 528
SCALE = 0.75
GAP = 18
HEADER_H = 62
MODE_FOOTER_H = 150
LANGEVIN_FOOTER_H = 100

# The site animation is intentionally shortened for GIF viewing.
MODES_SWEEP = 5000
MODES_GATE = 1200
MODES_END = 1800


def font(size, bold=False):
    candidates = (
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"),
        ("/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf"),
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


FONT_TITLE = font(25, True)
FONT_SUBTITLE = font(20)
FONT_SMALL = font(18)


def decode_u8(value, lo, hi):
    raw = base64.b64decode(value)
    values = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
    return lo + values / 255.0 * (hi - lo)


def ease(t):
    return 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2


def lerp(a, b, t):
    return a + (b - a) * t


def frac(u, levels):
    if u <= levels[0]:
        return 0.0
    n = len(levels)
    if u >= levels[-1]:
        return float(n - 1)
    k = 0
    while k < n - 2 and levels[k + 1] <= u:
        k += 1
    return k + (u - levels[k]) / (levels[k + 1] - levels[k])


def at(values, i, f, n):
    k0 = int(math.floor(f))
    k1 = min(k0 + 1, n - 1)
    return lerp(values[i * n + k0], values[i * n + k1], f - k0)


def u_of(s, hi, lo):
    return (math.log10(hi) - math.log10(s)) / (math.log10(hi) - math.log10(lo))


def stroke_path(draw, points, color, dashed=False):
    if len(points) < 2:
        return
    # Canvas uses a dark under-stroke plus a thinner colored stroke.
    draw.line(points, fill=(0, 0, 0, 155), width=7, joint="curve")
    if dashed:
        for a, b in zip(points[:-1], points[1:]):
            x0, y0 = a
            x1, y1 = b
            length = math.hypot(x1 - x0, y1 - y0)
            if not length:
                continue
            ux, uy = (x1 - x0) / length, (y1 - y0) / length
            for start in np.arange(0, length, 8):
                end = min(start + 4, length)
                draw.line([(x0 + ux * start, y0 + uy * start), (x0 + ux * end, y0 + uy * end)], fill=color, width=3)
    else:
        draw.line(points, fill=color, width=3, joint="curve")


def glyph(draw, kind, x, y, s):
    if kind == "good":
        draw.ellipse((x - s, y - s, x + s, y + s), fill=(42, 120, 214, 255), outline=(255, 255, 255, 255), width=2)
    elif kind == "open":
        draw.ellipse((x - s * 0.92, y - s * 0.92, x + s * 0.92, y + s * 0.92), fill=(255, 255, 255, 255), outline=(11, 11, 11, 255), width=2)
    else:
        p = [(x, y - s * 1.25), (x + s * 1.25, y), (x, y + s * 1.25), (x - s * 1.25, y)]
        draw.polygon(p, fill=(235, 104, 52, 255), outline=(255, 255, 255, 255))


def mode_panel(key, state, d, heat, methods, jitter):
    img = Image.new("RGBA", (BASE_W, MODE_H), (12, 10, 18, 255))
    draw = ImageDraw.Draw(img)
    mr, mb = 15, 20
    pw, ph = BASE_W - mr, MODE_H - mb
    zoom = key == "zoom"
    lo, hi = (d["zoom"]["lo"], d["zoom"]["hi"]) if zoom else (d["y_lo"], d["y_hi"])

    def y_pos(v):
        return (hi - v) / (hi - lo) * ph

    ux = state["u"] * pw
    if heat[key] is not None and ux > 0.5:
        hm = heat[key].resize((pw, ph), Image.Resampling.BILINEAR)
        img.alpha_composite(hm.crop((0, 0, max(1, round(ux)), ph)), (0, 0))

    if zoom:
        for v in (d["a"], d["a"] + d["b"]):
            draw.line((0, y_pos(v), pw, y_pos(v)), fill=(47, 179, 174, 230), width=2)
    if key == "pcdaps" and state["u"] >= state["u_gate"] - 1e-6:
        width = 3 if state["hold"] else 2
        draw.line((state["u_gate"] * pw, 0, state["u_gate"] * pw, ph), fill=(255, 255, 255, 220), width=width)

    if not zoom:
        method = key
        f = frac(state["u"], state["u_levels"])
        m = methods[method]
        for tr in m["trails"]:
            if f < d["trail_start"]:
                continue
            pruned = method == "pcdaps" and tr["dest"] == 1
            col = (255, 255, 255, 255) if tr["dest"] and method == "exact" else (255, 122, 61, 255) if tr["dest"] else (90, 162, 255, 255)
            k_end = int(math.floor(f))
            pre, post = [], []
            for k in range(d["trail_start"], k_end + 1):
                point = (state["u_levels"][k] * pw, y_pos(tr["y"][k]))
                if pruned and state["post"] and k > state["gate_pre"]:
                    post.append(point)
                else:
                    pre.append(point)
            k0 = min(k_end, len(state["u_levels"]) - 1)
            k1 = min(k_end + 1, len(state["u_levels"]) - 1)
            head_y = lerp(tr["y"][k0], tr["y"][k1], f - k_end)
            head = (ux, y_pos(head_y))
            jump = None
            if pruned and state["hold"]:
                jump = [(state["u_gate"] * pw, y_pos(tr["y"][state["gate_pre"]])),
                        (state["u_gate"] * pw, y_pos(lerp(tr["y"][state["gate_pre"]], tr["y"][state["gate_pre"] + 1], ease(state["g"]))))]
            elif pruned and state["post"]:
                if f < state["gate_pre"] + 1:
                    jump = [(state["u_levels"][state["gate_pre"]] * pw, y_pos(tr["y"][state["gate_pre"]])),
                            (ux, y_pos(tr["y"][state["gate_pre"] + 1]))]
                else:
                    jump = [(state["u_levels"][state["gate_pre"]] * pw, y_pos(tr["y"][state["gate_pre"]])), post[0]] if post else None
                    post.append(head)
            else:
                pre.append(head)
            stroke_path(draw, pre, col)
            if jump:
                mix = ease(state["g"]) if state["hold"] else 1
                jump_col = tuple(round(lerp(a, b, mix)) for a, b in zip((255, 122, 61), (90, 162, 255))) + (255,)
                stroke_path(draw, jump, jump_col, True)
            if post:
                stroke_path(draw, post, (90, 162, 255, 255))

        if not state["final"]:
            for i in range(d["n"]):
                dest = bool(m["dest"][i])
                if method == "exact":
                    color = (255, 255, 255, 210) if dest else (90, 162, 255, 210)
                elif method == "daps":
                    color = (255, 122, 61, 210) if dest else (90, 162, 255, 210)
                elif not dest:
                    color = (90, 162, 255, 210)
                elif state["hold"]:
                    mix = ease(state["g"])
                    color = tuple(round(lerp(a, b, mix)) for a, b in zip((255, 122, 61), (90, 162, 255))) + (210,)
                else:
                    color = (90, 162, 255, 210) if state["post"] else (255, 122, 61, 210)
                px = ux + jitter[i] * 10 - 3
                py = y_pos(at(m["pos"], i, f if not (method == "pcdaps" and dest and state["post"]) else max(f, state["gate_pre"] + 1), len(d["levels"])))
                r = max(2, round(pw / 150))
                draw.ellipse((px - r, py - r, px + r, py + r), fill=color)
    elif not state["final"]:
        fz = frac(state["u"], state["u_zoom"])
        for j in range(d["zoom"]["n"]):
            py = y_pos(at(state["zoom_pos"], j, fz, len(d["zoom"]["levels"])))
            px = ux + jitter[j] * 10 - 3
            r = max(2, round(pw / 150))
            draw.ellipse((px - r, py - r, px + r, py + r), fill=(255, 122, 61, 210))

    if not state["final"] and 0 < state["u"] < 1:
        draw.line((ux, 0, ux, ph), fill=(255, 255, 255, 140), width=2)
    draw.rectangle((0, 0, pw - 1, ph - 1), outline=(74, 83, 96, 255), width=2)

    gs = max(7, round(pw / 60))
    gx = pw + mr / 2
    if zoom:
        glyph(draw, "open", gx, y_pos(d["a"]), gs)
        glyph(draw, "bad", gx, y_pos(d["a"] + d["b"]), gs)
    else:
        glyph(draw, "good", gx, y_pos(-d["a"] * d["k_clean"]), gs)
        if key == "exact":
            glyph(draw, "open", gx, y_pos(d["a"] * d["k_clean"]), gs)
        if key == "daps":
            glyph(draw, "bad", gx, y_pos((d["a"] + d["b"]) * d["k_clean"]), gs)

    ink = (74, 83, 96, 255)
    for x, label in ((0, "10"), (0.5, "1"), (1, "0.1")):
        xx = x * pw
        draw.line((xx, ph, xx, ph + 6), fill=ink, width=2)
        anchor = "la" if x == 0 else "ma" if x == 0.5 else "ra"
        draw.text((xx, ph + 8), label, font=FONT_SMALL, fill=ink, anchor=anchor)
    return img


def render_modes_frame(t, d, heat, methods, jitter):
    u_levels = [u_of(s, d["sigma_hi"], d["sigma_lo"]) for s in d["levels"]]
    gate_pre = d["gate_level"] - 1
    u_gate = u_levels[gate_pre]
    sweep, gate, end = MODES_SWEEP, MODES_GATE, MODES_END
    a = sweep * u_gate
    if t < a:
        state = {"u": t / sweep, "g": 0, "hold": False, "post": False, "final": False}
    elif t < a + gate:
        state = {"u": u_gate, "g": (t - a) / gate, "hold": True, "post": False, "final": False}
    elif t < a + gate + sweep * (1 - u_gate):
        state = {"u": u_gate + (t - a - gate) / sweep, "g": 1, "hold": False, "post": True, "final": False}
    else:
        state = {"u": 1, "g": 1, "hold": False, "post": True, "final": True}
    state.update({"u_levels": u_levels, "u_zoom": [u_of(s, d["sigma_hi"], d["sigma_lo"]) for s in d["zoom"]["levels"]],
                  "u_gate": u_gate, "gate_pre": gate_pre, "zoom_pos": decode_u8(d["zoom"]["pos"], d["zoom"]["lo"], d["zoom"]["hi"])})

    sigma = 10 ** (math.log10(d["sigma_hi"]) - state["u"] * (math.log10(d["sigma_hi"]) - math.log10(d["sigma_lo"])))
    sigma_text = f"σ = {sigma:.1f}" if sigma >= 1 else f"σ = {sigma:.2f}"

    labels = ["Ground truth", "DAPS", "PC-DAPS", "DAPS · zoom on + side"]
    keys = ["exact", "daps", "pcdaps", "zoom"]
    frame_w = 4 * BASE_W + 3 * GAP
    frame = Image.new("RGBA", (frame_w, HEADER_H + MODE_H + MODE_FOOTER_H), (255, 255, 255, 255))
    frame_draw = ImageDraw.Draw(frame)
    for i, (label, key) in enumerate(zip(labels, keys)):
        x = i * (BASE_W + GAP)
        frame_draw.text((x + BASE_W / 2, 14), label, font=FONT_TITLE, fill=(11, 11, 11, 255), anchor="ma")
        frame.alpha_composite(mode_panel(key, state, d, heat, methods, jitter), (x, HEADER_H))

    # Website-equivalent axis row: noise direction, density color bar, and live σ readout.
    footer_y = HEADER_H + MODE_H + 18
    frame_draw.text((frame_w / 2 - 460, footer_y), "noise level σ (sampling →)", font=FONT_SUBTITLE, fill=(74, 83, 96, 255), anchor="lm")
    bar_x, bar_y, bar_w, bar_h = frame_w / 2 - 90, footer_y - 7, 192, 15
    magma = [(0, 0, 4), (24, 15, 61), (68, 15, 118), (114, 31, 129), (158, 47, 127), (204, 71, 120), (237, 105, 93), (251, 173, 92), (252, 253, 191)]
    for j in range(round(bar_w)):
        q = j / max(1, bar_w - 1) * (len(magma) - 1)
        k = min(int(q), len(magma) - 2)
        mix = q - k
        col = tuple(round(lerp(magma[k][c], magma[k + 1][c], mix)) for c in range(3)) + (255,)
        frame_draw.line((bar_x + j, bar_y, bar_x + j, bar_y + bar_h), fill=col, width=1)
    frame_draw.rectangle((bar_x, bar_y, bar_x + bar_w, bar_y + bar_h), outline=(74, 83, 96, 255), width=1)
    frame_draw.text((bar_x - 10, footer_y), "0", font=FONT_SMALL, fill=(74, 83, 96, 255), anchor="rm")
    frame_draw.text((bar_x + bar_w + 10, footer_y), "1", font=FONT_SMALL, fill=(74, 83, 96, 255), anchor="lm")
    frame_draw.text((bar_x + bar_w + 30, footer_y), "density (max-normalized per σ)", font=FONT_SMALL, fill=(74, 83, 96, 255), anchor="lm")
    frame_draw.text((frame_w - 35, footer_y), sigma_text, font=FONT_SUBTITLE, fill=(11, 11, 11, 255), anchor="rm")

    # Website-equivalent legend.
    legend_y = footer_y + 46
    legend_items = [
        ("●", "majority posterior mode x1", (42, 120, 214, 255)),
        ("○", "minority posterior mode x2", (11, 11, 11, 255)),
        ("◆", "DAPS-hallucinated mode x3", (235, 104, 52, 255)),
        ("•", "particles, colored by the mode they are headed to", (90, 162, 255, 255)),
    ]
    x = 170
    for symbol, text, color in legend_items:
        frame_draw.text((x, legend_y), symbol, font=font(20, True), fill=color, anchor="lm")
        frame_draw.text((x + 24, legend_y), text, font=FONT_SMALL, fill=(74, 83, 96, 255), anchor="lm")
        x += 390 if symbol != "•" else 540
    return frame.resize((round(frame.width * SCALE), round(frame.height * SCALE)), Image.Resampling.LANCZOS)


def draw_dot(draw, x, y, radius, fill, ring=(255, 255, 255, 255)):
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=ring, width=2)


def langevin_panel(p, idx, t, d, bg):
    img = bg.resize((BASE_W, LANGEVIN_H), Image.Resampling.BILINEAR).convert("RGBA")
    draw = ImageDraw.Draw(img)
    ex = d["extent"]
    W = H = BASE_W

    def X(x):
        return (x - ex[0]) / (ex[1] - ex[0]) * W

    def Y(y):
        return (ex[3] - y) / (ex[3] - ex[2]) * H

    draw.line((0, Y(d["y"]), W, Y(d["y"])), fill=(42, 120, 214, 205), width=2)
    for e in p["ellipses"]:
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        box = (X(e["mu"][0] - e["r"][0]), Y(e["mu"][1] + e["r"][1]), X(e["mu"][0] + e["r"][0]), Y(e["mu"][1] - e["r"][1]))
        od.ellipse(box, outline=(0, 124, 122, round(255 * e["op"])), width=4)
        img = Image.alpha_composite(img, overlay)
        draw = ImageDraw.Draw(img)

    if p["method"] == "PC-DAPS":
        for q in d["bag"][1:]:
            draw_dot(draw, X(q[0]), Y(q[1]), 7, (255, 255, 255, 255), (82, 81, 78, 255))

    n = len(p["path"])
    prog = max(0, min(t / 5600.0, 1))
    fj = prog * (n - 1)
    j = min(int(math.floor(fj)), n - 1)
    if j >= n - 1:
        head = p["path"][-1]
    else:
        head = [lerp(p["path"][j][0], p["path"][j + 1][0], fj - j), lerp(p["path"][j][1], p["path"][j + 1][1], fj - j)]
    points = [(X(p["path"][0][0]), Y(p["path"][0][1]))]
    points += [(X(p["path"][k][0]), Y(p["path"][k][1])) for k in range(1, j + 1)]
    points.append((X(head[0]), Y(head[1])))
    draw.line(points, fill=(11, 11, 11, 255), width=4, joint="curve")
    draw_dot(draw, X(p["path"][0][0]), Y(p["path"][0][1]), 8, (11, 11, 11, 255))
    if prog < 1:
        draw_dot(draw, X(head[0]), Y(head[1]), 7, (11, 11, 11, 255))
    else:
        pop = max(0, min((t - 5600) / 260.0, 1))
        s = 1 + 0.35 * math.sin(pop * math.pi)
        ex0, ey0 = X(p["end"][0]), Y(p["end"][1])
        if p["on_prior"]:
            draw_dot(draw, ex0, ey0, round(11.2 * s), (42, 120, 214, 255))
        else:
            a = 13.2 * s
            draw.polygon([(ex0, ey0 - a), (ex0 + a, ey0), (ex0, ey0 + a), (ex0 - a, ey0)], fill=(235, 104, 52, 255), outline=(255, 255, 255, 255))
    draw.rectangle((0, 0, W - 1, H - 1), outline=(11, 11, 11, 255), width=2)
    if idx == 0:
        ly = Y(d["y"]) - 8
        draw.text((8, ly), "x2 = y", font=font(22, True), fill=(42, 120, 214, 255))
    return img


def render_langevin_frame(t, d, bg):
    labels = ["DAPS · Gaussian", "PC-DAPS · Gaussian", "PC-DAPS · Gaussian mixture", "Exact posterior"]
    frame_w = 4 * BASE_W + 3 * GAP
    frame = Image.new("RGBA", (frame_w, HEADER_H + LANGEVIN_H + LANGEVIN_FOOTER_H), (255, 255, 255, 255))
    frame_draw = ImageDraw.Draw(frame)
    for i, (label, p) in enumerate(zip(labels, d["panels"])):
        x = i * (BASE_W + GAP)
        frame_draw.text((x + BASE_W / 2, 14), label, font=FONT_TITLE, fill=(11, 11, 11, 255), anchor="ma")
        frame.alpha_composite(langevin_panel(p, i, t, d, bg), (x, HEADER_H))

    step = round(max(0, min(t / 5600.0, 1)) * d["steps"])
    footer_y = HEADER_H + LANGEVIN_H + 18
    frame_draw.text((frame_w / 2, footer_y), f"Langevin step {step} / {d['steps']}", font=FONT_SUBTITLE, fill=(11, 11, 11, 255), anchor="ma")

    # Website-equivalent legend, kept on one readable line so it remains self-contained.
    legend_y = footer_y + 54
    legend = [
        ("▣", "prior p(x0)", (120, 125, 130, 255)),
        ("━", "likelihood p(y|x0)", (42, 120, 214, 255)),
        ("◯", "approximation of p(x0|xt)", (0, 124, 122, 255)),
        ("○", "bag particles", (82, 81, 78, 255)),
        ("—", "Langevin run from xhat0", (11, 11, 11, 255)),
        ("●", "ends on the prior", (42, 120, 214, 255)),
        ("◆", "ends off the prior (hallucination)", (235, 104, 52, 255)),
    ]
    symbol_font = font(19, True)
    gap = 28
    widths = []
    for symbol, text, _ in legend:
        symbol_box = frame_draw.textbbox((0, 0), symbol, font=symbol_font)
        text_box = frame_draw.textbbox((0, 0), text, font=FONT_SMALL)
        widths.append((symbol_box[2] - symbol_box[0]) + 8 + (text_box[2] - text_box[0]))
    x = (frame_w - (sum(widths) + gap * (len(legend) - 1))) / 2
    for (symbol, text, color), width in zip(legend, widths):
        frame_draw.text((x, legend_y), symbol, font=symbol_font, fill=color, anchor="lm")
        symbol_width = frame_draw.textbbox((0, 0), symbol, font=symbol_font)[2]
        frame_draw.text((x + symbol_width + 8, legend_y), text, font=FONT_SMALL, fill=(74, 83, 96, 255), anchor="lm")
        x += width + gap
    return frame.resize((round(frame.width * SCALE), round(frame.height * SCALE)), Image.Resampling.LANCZOS)


def save_gif(frames, path, duration):
    frames[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=256).save(
        path,
        save_all=True,
        append_images=[f.convert("P", palette=Image.Palette.ADAPTIVE, colors=256) for f in frames[1:]],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=False,
    )


def main():
    modes = json.loads((DATA / "toy_modes.json").read_text())
    heat = {
        "exact": Image.open(TOY / "exact_posterior.png").convert("RGBA"),
        "daps": Image.open(TOY / "daps.png").convert("RGBA"),
        "pcdaps": Image.open(TOY / "msdaps.png").convert("RGBA"),
        "zoom": Image.open(TOY / "daps_zoom.png").convert("RGBA"),
    }
    methods = {}
    for name in ("exact", "daps", "pcdaps"):
        methods[name] = {
            "pos": decode_u8(modes["methods"][name]["pos"], modes["y_lo"], modes["y_hi"]),
            "dest": modes["methods"][name]["dest"],
            "trails": modes["methods"][name]["trails"],
        }
    rng = np.array([math.sin(i * 12.9898 + 78.233) * 43758.5453 for i in range(max(modes["n"], modes["zoom"]["n"]))])
    jitter = rng - np.floor(rng)
    modes_total = MODES_SWEEP + MODES_GATE + MODES_END
    modes_frames = [render_modes_frame(modes_total * i / 79, modes, heat, methods, jitter) for i in range(80)]
    save_gif(modes_frames, TOY / "toy_premature_mode_selection.gif", 100)

    langevin = json.loads((DATA / "toy_langevin.json").read_text())
    bg = Image.open(TOY / "langevin_background.png").convert("RGBA")
    langevin_frames = [render_langevin_frame((5600 + 2800) * i / 59, langevin, bg) for i in range(60)]
    save_gif(langevin_frames, TOY / "toy_gaussian_mixture_langevin.gif", 140)

    for path in (TOY / "toy_premature_mode_selection.gif", TOY / "toy_gaussian_mixture_langevin.gif"):
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
