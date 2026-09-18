#!/usr/bin/env python3
"""Overlay two or more digitized hikes: gain above the trailhead, and grade.

Each hike enters as LABEL=path.csv, where the CSV is the output of
digitize_elevation.py. Elevation is plotted as gain above each trailhead
rather than as absolute elevation, so climbs that start at different heights
are comparable on one axis.

Usage:
    python3 compare_hikes.py "Grouse Grind=profile.csv" \
        "Stawamus Chief=chief.csv" -o compare.png
"""

from __future__ import annotations

import argparse
import sys

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter

from analyze_gradient import (FEET_PER_MILE, GRID, INK, INK_2, SURFACE, grade,
                              load)

# One hue per hike, used in both panels: the color is the hike's identity.
HIKES = ("#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("hikes", nargs="+", metavar="LABEL=CSV",
                   help="digitized profiles to overlay")
    p.add_argument("-o", "--out", default="compare.png")
    p.add_argument("--window", type=float, default=0.15,
                   help="gradient smoothing window in miles")
    p.add_argument("--edge", choices=("reflect", "poly", "interp"),
                   default="reflect", help="see analyze_gradient.grade()")
    p.add_argument("--title", default="Two climbs, same axes")
    args = p.parse_args(argv)

    if len(args.hikes) > len(HIKES):
        print(f"at most {len(HIKES)} hikes", file=sys.stderr)
        return 1

    series = []
    for spec, color in zip(args.hikes, HIKES):
        label, _, path = spec.partition("=")
        if not path:
            print(f"expected LABEL=CSV, got {spec!r}", file=sys.stderr)
            return 1
        x, y, key = load(path)
        if key != "y_ft":
            print(f"{path} has no y_ft column -- re-run the digitizer with "
                  f"--elev-start/--elev-end", file=sys.stderr)
            return 1
        series.append({
            "label": label, "color": color, "x": x,
            "gain": y - y[0],
            "grade": grade(x, y, args.window, args.edge),
            "mean": (y[-1] - y[0]) / ((x[-1] - x[0]) * FEET_PER_MILE) * 100,
        })

    fig, (ax_e, ax_g) = plt.subplots(
        2, 1, figsize=(10, 7.5), dpi=160, sharex=True,
        gridspec_kw={"height_ratios": [1, 1], "hspace": 0.18})
    fig.patch.set_facecolor(SURFACE)
    for ax in (ax_e, ax_g):
        ax.set_facecolor(SURFACE)
        ax.grid(True, color=GRID, linewidth=1, linestyle="-")
        ax.set_axisbelow(True)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        for side in ("left", "bottom"):
            ax.spines[side].set_color(GRID)
        ax.tick_params(colors=INK_2, labelsize=9, length=0)

    for s in series:
        # No area wash here: two overlapping fills would muddy each other
        # exactly where the climbs are being compared.
        ax_e.plot(s["x"], s["gain"], color=s["color"], linewidth=2,
                  solid_joinstyle="round", label=s["label"])
        # Label the summit of each climb rather than every point.
        ax_e.plot([s["x"][-1]], [s["gain"][-1]], "o", markersize=8,
                  color=s["color"], markeredgecolor=SURFACE, markeredgewidth=2,
                  zorder=3)
        ax_e.annotate(f"+{s['gain'][-1]:,.0f} ft", (s["x"][-1], s["gain"][-1]),
                      textcoords="offset points", xytext=(-10, 6), ha="right",
                      va="bottom", color=INK_2, fontsize=9)
    ax_e.set_ylabel("Gain above trailhead (ft)", color=INK_2, fontsize=10)
    ax_e.set_title(args.title, color=INK, fontsize=14, loc="left", pad=14)
    ax_e.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax_e.margins(y=0.14)

    for s in series:
        ax_g.plot(s["x"], s["grade"], color=s["color"], linewidth=2,
                  solid_joinstyle="round", label=s["label"])
        # Each hike's whole-climb average, thinner than the data it averages.
        ax_g.axhline(s["mean"], color=s["color"], linewidth=1)
        ax_g.annotate(f"average  {s['mean']:.0f}%",
                      (0, s["mean"]), xycoords=("axes fraction", "data"),
                      textcoords="offset points", xytext=(4, 5),
                      color=INK_2, fontsize=9)
    ax_g.set_ylabel("Grade (rise / run)", color=INK_2, fontsize=10)
    ax_g.set_xlabel("Distance from trailhead (mi)", color=INK_2, fontsize=10)
    ax_g.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0f}%"))
    ax_g.set_title(f"Slope from a local quadratic fit over a "
                   f"{args.window:g} mi window", color=INK_2, fontsize=10,
                   loc="left", pad=10)
    ax_g.set_xlim(0, max(s["x"][-1] for s in series))
    ax_g.margins(y=0.14)

    leg = ax_e.legend(loc="lower right", bbox_to_anchor=(1.0, 1.0),
                      ncol=len(series), frameon=False, fontsize=9,
                      handlelength=1.6, columnspacing=1.6, borderpad=0)
    for text in leg.get_texts():
        text.set_color(INK_2)

    fig.savefig(args.out, facecolor=SURFACE, bbox_inches="tight")

    for s in series:
        steep = int(np.argmax(s["grade"]))
        above = float((s["grade"] >= 40).mean()) * 100
        print(f"{s['label']}: {s['gain'][-1]:,.0f} ft over {s['x'][-1]:.2f} mi"
              f"  average {s['mean']:.1f}%"
              f"  steepest {s['grade'][steep]:.0f}% at {s['x'][steep]:.2f} mi"
              f"  {above:.0f}% of distance at 40%+")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
