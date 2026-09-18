#!/usr/bin/env python3
"""Digitize a hike elevation profile screenshot into x/y samples.

The plot is a white trace drawn on top of a filled region over a dark
background. For each pixel column we find the white trace by looking for the
bright run that sits directly on top of the fill, which keeps axis labels and
the elevation callouts (drawn in the same white) from being mistaken for data.

Output is one row per pixel column:

    x_mi   distance along the hike, miles
    y_px   trace height above the starting pixel height (0 at x=0, up = +)
    y_ft   y_px converted to feet via the two elevation callouts, when given

Usage:
    python3 digitize_elevation.py profile.png --x-max 1.3 \
        --elev-start 960 --elev-end 3500 -o profile.csv
"""

from __future__ import annotations

import argparse
import csv
import sys

import numpy as np
from PIL import Image


def masks(rgb: np.ndarray, bright_min: int, fill_sat: int):
    """Boolean masks for the white trace and the filled area under it."""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)

    # The trace is near-white: bright in every channel, so its darkest
    # channel is still high. Anti-aliased edges are dimmer and get skipped,
    # which is fine -- we want the core of the line.
    bright = lo >= bright_min

    # The fill is a saturated colour; the background is near-grey and dark.
    # Anything that is clearly coloured and not near-white counts as fill.
    fill = ((hi - lo) >= fill_sat) & (hi >= 40) & ~bright
    return bright, fill


def runs(col: np.ndarray):
    """Yield (start, end) inclusive index pairs of True runs in a 1-D mask."""
    (idx,) = np.nonzero(col)
    if idx.size == 0:
        return []
    breaks = np.nonzero(np.diff(idx) > 1)[0]
    starts = np.concatenate(([idx[0]], idx[breaks + 1]))
    ends = np.concatenate((idx[breaks], [idx[-1]]))
    return list(zip(starts.tolist(), ends.tolist()))


def trace(bright: np.ndarray, fill: np.ndarray, gap: int, thick_factor: float,
          max_jump: float):
    """Row of the trace centre for each column, or NaN where there is none.

    Where the plot is filled, the trace is the bright run resting on top of the
    fill. Beyond the filled span -- a flat start at the axis, or the descent of
    an out-and-back profile, which these screenshots leave unfilled -- the run
    is picked by continuity with the column before it, so labels printed over
    the background are not mistaken for data.

    Columns where a label glyph has merged into the line are left as NaN: the
    run is far thicker than the line there and its centre would be wrong.
    """
    height, width = bright.shape
    col_runs = [runs(bright[:, x]) for x in range(width)]

    ys = np.full(width, np.nan)
    thickness = np.full(width, np.nan)

    def take(x: int, run: tuple[int, int]) -> float:
        start, end = run
        ys[x] = (start + end) / 2.0
        thickness[x] = end - start + 1
        return ys[x]

    # Anchor on the fill: labels printed over it sit well below its top edge,
    # and labels over the background have no fill beneath them at all.
    anchored = []
    for x in range(width):
        col_fill = np.nonzero(fill[:, x])[0]
        if not col_fill.size or not col_runs[x]:
            continue
        top = int(col_fill.min())
        picked = [c for c in col_runs[x] if 0 <= top - c[1] <= gap]
        if picked:
            take(x, min(picked, key=lambda c: c[0]))
            anchored.append(x)
    if not anchored:
        return ys, height - 1

    # Extend past the filled span by following the line: at each column take
    # the run closest to where the trace was last seen, allowing it to move by
    # max_jump rows per column crossed.
    for step in (-1, 1):
        edge = min(anchored) if step < 0 else max(anchored)
        last_x, last_y = edge, ys[edge]
        for x in range(edge + step, -1 if step < 0 else width, step):
            if not col_runs[x]:
                continue
            reach = max_jump * abs(x - last_x)
            near = [c for c in col_runs[x]
                    if abs((c[0] + c[1]) / 2.0 - last_y) <= reach]
            if not near:
                continue
            best = min(near, key=lambda c: abs((c[0] + c[1]) / 2.0 - last_y))
            last_x, last_y = x, take(x, best)

    seen = thickness[~np.isnan(thickness)]
    limit = max(thick_factor * float(np.median(seen)), np.median(seen) + 2)
    ys[thickness > limit] = np.nan

    fill_rows = np.nonzero(fill.any(axis=1))[0]
    baseline = int(fill_rows.max()) if fill_rows.size else height - 1
    return ys, baseline


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("image", help="screenshot of the elevation profile")
    p.add_argument("-o", "--out", default="-", help="CSV output path (default stdout)")
    p.add_argument("--x-max", type=float, required=True,
                   help="distance in miles at the right end of the trace")
    p.add_argument("--x-min", type=float, default=0.0,
                   help="distance in miles at the left end of the trace")
    p.add_argument("--elev-start", type=float,
                   help="elevation in feet at the left end, for the y_ft column")
    p.add_argument("--elev-end", type=float,
                   help="elevation in feet at the trace's highest point")
    p.add_argument("--bright-min", type=int, default=150,
                   help="minimum value in every channel for a trace pixel")
    p.add_argument("--fill-sat", type=int, default=20,
                   help="minimum channel spread for a fill pixel")
    p.add_argument("--gap", type=int, default=3,
                   help="pixels of slack allowed between trace and fill")
    p.add_argument("--segment", choices=("all", "ascent"), default="all",
                   help="'ascent' keeps only the climb to the high point, for "
                        "an out-and-back profile")
    p.add_argument("--max-jump", type=float, default=15.0,
                   help="rows the trace may move per column, when following it "
                        "beyond the filled span")
    p.add_argument("--overlay",
                   help="write a copy of the image with the samples drawn on "
                        "top, to eyeball the trace")
    p.add_argument("--thick-factor", type=float, default=1.6,
                   help="drop columns whose bright run exceeds this multiple "
                        "of the median line thickness (label collisions)")
    args = p.parse_args(argv)

    rgb = np.asarray(Image.open(args.image).convert("RGB")).astype(int)
    bright, fill = masks(rgb, args.bright_min, args.fill_sat)
    ys, baseline = trace(bright, fill, args.gap, args.thick_factor,
                         args.max_jump)

    cols = np.nonzero(~np.isnan(ys))[0]
    if cols.size < 2:
        print("no trace found -- try adjusting --bright-min/--fill-sat",
              file=sys.stderr)
        return 1
    x0, x1 = int(cols.min()), int(cols.max())

    # Bridge the dropped columns (label collisions) by interpolating across
    # them rather than leaving holes in the series.
    span = np.arange(x0, x1 + 1)
    y = np.interp(span, cols, ys[cols])

    if args.segment == "ascent":
        # Cut at the high point. The x scale is already fixed by the full
        # traced width, so the descent's own columns are not needed past here.
        summit = int(np.argmin(y))
        span, y = span[:summit + 1], y[:summit + 1]

    # Pixel rows grow downwards, so height above the start is start - y.
    y_px = y[0] - y
    x_mi = args.x_min + (span - x0) * (args.x_max - args.x_min) / (x1 - x0)

    y_ft = None
    if args.elev_start is not None and args.elev_end is not None:
        # The two callouts label the lowest and highest points of the trace,
        # so the peak of y_px maps to the elevation gain between them.
        peak = y_px.max()
        if peak <= 0:
            print("trace never rises -- cannot scale to feet", file=sys.stderr)
            return 1
        y_ft = args.elev_start + y_px * (args.elev_end - args.elev_start) / peak

    if args.overlay:
        marked = np.asarray(Image.open(args.image).convert("RGB")).copy()
        for i, row in enumerate(np.rint(y).astype(int)):
            if 0 <= row < marked.shape[0]:
                marked[row, span[i]] = (0, 255, 0)
        Image.fromarray(marked).save(args.overlay)

    header = ["x_mi", "y_px"] + (["y_ft"] if y_ft is not None else [])
    out = open(args.out, "w", newline="") if args.out != "-" else sys.stdout
    try:
        w = csv.writer(out)
        w.writerow(header)
        for i in range(len(span)):
            row = [f"{x_mi[i]:.6f}", f"{y_px[i]:.2f}"]
            if y_ft is not None:
                row.append(f"{y_ft[i]:.1f}")
            w.writerow(row)
    finally:
        if out is not sys.stdout:
            out.close()

    bridged = int(np.isnan(ys[span]).sum())
    print(f"traced columns {span[0]}-{span[-1]} ({len(span)} samples, "
          f"{bridged} interpolated), baseline row {baseline}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
