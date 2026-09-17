#!/usr/bin/env python3
"""Plot a digitized elevation profile and its smoothed gradient.

Reads the CSV written by digitize_elevation.py and renders two stacked panels
over a shared distance axis: elevation, and grade (rise/run as a percentage).

The raw samples are quantized to the screenshot's pixel grid -- about 8.7 ft
per pixel row against 7.2 ft of run per column -- so a plain finite difference
is dominated by that quantization, swinging +-60% grade between neighbouring
samples. The derivative is therefore taken from a Savitzky-Golay fit: a local
quadratic least-squares fit whose analytic slope is evaluated at each point.
Two window lengths are shown so the smoothing itself is visible rather than
being a hidden parameter.

Usage:
    python3 analyze_gradient.py profile.csv -o gradient.png
"""

from __future__ import annotations

import argparse
import csv

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter
from scipy.signal import savgol_filter

FEET_PER_MILE = 5280.0

# Palette roles (light surface).
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
INK_MUTED = "#8a8985"
GRID = "#e6e5e2"
# Color follows the quantity: elevation is always slot 1, grade always slot 2,
# so the two panels never trade hues. Extra smoothing windows take later slots.
ELEVATION = "#2a78d6"
# The broadest window keeps slot 1, so adding a tighter one does not repaint it.
GRADE = ("#eb6834", "#4a3aa7", "#1baf7a")


def load(path: str):
    with open(path) as fh:
        rows = list(csv.DictReader(fh))
    x_mi = np.array([float(r["x_mi"]) for r in rows])
    key = "y_ft" if "y_ft" in rows[0] else "y_px"
    return x_mi, np.array([float(r[key]) for r in rows]), key


def extend(y: np.ndarray, half: int, edge: str) -> np.ndarray:
    """Pad y by `half` samples at each end so the fit stays centred there."""
    half = min(half, len(y) - 1)
    if edge == "reflect":
        # Point reflection through the endpoint: y[-k] = 2*y[0] - y[k]. It
        # continues the profile's slope across the boundary and flips its
        # curvature, which is the standard extension for a derivative filter.
        return np.pad(y, half, mode="reflect", reflect_type="odd")
    if edge == "poly":
        # Quadratic fitted to the outermost half-window and extrapolated out.
        # Note this reads the curvature of the end segment as a trend to
        # continue, so a profile that starts flat and steepens extrapolates
        # to a negative grade before its first sample.
        fit = max(3, half)
        left = np.polyval(np.polyfit(np.arange(fit), y[:fit], 2),
                          np.arange(-half, 0))
        right = np.polyval(np.polyfit(np.arange(len(y) - fit, len(y)), y[-fit:], 2),
                           np.arange(len(y), len(y) + half))
        return np.concatenate([left, y, right])
    raise ValueError(f"unknown edge mode {edge!r}")


def grade(x_mi: np.ndarray, y_ft: np.ndarray, window_mi: float,
          edge: str = "reflect") -> np.ndarray:
    """Percent grade from a local quadratic fit over a window_mi-wide window.

    Within a half-window of each end there is no centred window to fit. With
    `edge="interp"` scipy fits the end window once and evaluates its derivative
    off-centre, which swings hard where the profile curves. The other modes
    extend the elevation data instead, so every sample keeps a centred fit.
    """
    step_ft = float(np.mean(np.diff(x_mi))) * FEET_PER_MILE
    width = int(round(window_mi * FEET_PER_MILE / step_ft))
    width = max(5, width | 1)  # odd, and wide enough for a quadratic
    if edge == "interp":
        slope = savgol_filter(y_ft, width, polyorder=2, deriv=1, delta=step_ft)
    else:
        half = min(width // 2, len(y_ft) - 1)
        padded = extend(y_ft, half, edge)
        slope = savgol_filter(padded, width, polyorder=2, deriv=1,
                              delta=step_ft)[half:len(padded) - half]
    return slope * 100.0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv", help="output of digitize_elevation.py")
    p.add_argument("-o", "--out", default="gradient.png")
    p.add_argument("--windows", type=float, nargs="+", default=(0.15,),
                   metavar="MILES",
                   help="smoothing window width(s) in miles; pass more than "
                        "one to compare them on the same axis")
    p.add_argument("--edge", choices=("reflect", "poly", "interp"),
                   default="reflect",
                   help="how the fit is closed off within a half-window of "
                        "each end (see grade())")
    p.add_argument("--trim", type=int, default=0,
                   help="drop this many samples from each end before fitting; "
                        "the outermost columns of a screenshot are often "
                        "clipped by the image border")
    p.add_argument("--title", default="Hike elevation and grade")
    args = p.parse_args(argv)

    x, y, key = load(args.csv)
    if args.trim:
        x, y = x[args.trim:-args.trim], y[args.trim:-args.trim]
    unit = "ft" if key == "y_ft" else "px"
    # Widest first, so the broadest window holds the first color slot.
    windows = sorted(args.windows, reverse=True)
    grades = [grade(x, y, w, args.edge) for w in windows]

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

    # Elevation: one series, so no legend -- the title names it.
    ax_e.plot(x, y, color=ELEVATION, linewidth=2, solid_joinstyle="round")
    ax_e.fill_between(x, y.min(), y, color=ELEVATION, alpha=0.10, linewidth=0)
    ax_e.set_ylabel(f"Elevation ({unit})", color=INK_2, fontsize=10)
    ax_e.set_title(args.title, color=INK, fontsize=14, loc="left", pad=14)
    ax_e.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
    # Direct-label the two ends rather than every point.
    # The curve rises left to right, so the free surface is above it on the
    # right and below it on the left.
    for xi, yi, dx, dy, ha in ((x[0], y[0], 10, 6, "left"),
                               (x[-1], y[-1], -10, 8, "right")):
        ax_e.plot([xi], [yi], "o", markersize=8, color=ELEVATION,
                  markeredgecolor=SURFACE, markeredgewidth=2, zorder=3)
        ax_e.annotate(f"{yi:,.0f} {unit}", (xi, yi), textcoords="offset points",
                      xytext=(dx, dy), ha=ha, va="bottom", color=INK_2, fontsize=9)
    ax_e.margins(y=0.12)

    mean_grade = (y[-1] - y[0]) / ((x[-1] - x[0]) * FEET_PER_MILE) * 100
    ax_g.axhline(mean_grade, color=INK_MUTED, linewidth=1)
    ax_g.annotate(f"whole-hike average  {mean_grade:.0f}%",
                  (x[0], mean_grade), textcoords="offset points", xytext=(4, 5),
                  color=INK_2, fontsize=9)

    for col, window, g in zip(GRADE, windows, grades):
        ax_g.plot(x, g, color=col, linewidth=2, solid_joinstyle="round",
                  label=f"{window:g} mi window")
    ax_g.set_ylabel("Grade (rise / run)", color=INK_2, fontsize=10)
    ax_g.set_xlabel("Distance (mi)", color=INK_2, fontsize=10)
    ax_g.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0f}%"))
    if len(windows) == 1:
        # One series needs no legend box -- the subtitle names the window.
        subtitle = (f"Slope from a local quadratic fit over a "
                    f"{windows[0]:g} mi window")
    else:
        subtitle = "Slope from a local quadratic fit, at two smoothing widths"
        # Above the panel, clear of the curves, which fill the plot area.
        leg = ax_g.legend(loc="lower right", bbox_to_anchor=(1.0, 1.0),
                          ncol=len(windows), frameon=False, fontsize=9,
                          handlelength=1.6, columnspacing=1.6, borderpad=0)
        for text in leg.get_texts():
            text.set_color(INK_2)
    ax_g.set_title(subtitle, color=INK_2, fontsize=10, loc="left", pad=10)

    # Mark the steepest point of the broadest series -- the one value the
    # "does it get steeper at the top?" question turns on.
    broadest = grades[0]
    peak = int(np.argmax(broadest))
    ax_g.plot([x[peak]], [broadest[peak]], "o", markersize=8, color=GRADE[0],
              markeredgecolor=SURFACE, markeredgewidth=2, zorder=3)
    # Sit the label above every series, so a tighter window cannot run
    # through the text.
    ax_g.annotate(f"steepest  {broadest[peak]:.0f}%  at {x[peak]:.2f} mi",
                  (x[peak], max(g.max() for g in grades)),
                  textcoords="offset points", xytext=(0, 10), ha="center",
                  color=INK_2, fontsize=9)

    ax_g.set_xlim(x[0], x[-1])
    ax_g.margins(y=0.14)
    fig.savefig(args.out, facecolor=SURFACE, bbox_inches="tight")

    # A short numeric read-out, so the picture is not the only evidence.
    print(f"samples {len(x)}  span {x[-1] - x[0]:.2f} mi  "
          f"gain {y[-1] - y[0]:,.0f} {unit}  average grade {mean_grade:.1f}%")
    # Quantization floor: the trace is read off a pixel grid, so report how
    # much slope noise that alone puts into each window.
    step_ft = float(np.mean(np.diff(x))) * FEET_PER_MILE
    levels = np.unique(np.round(y, 6))
    # The typical gap between distinct values is one grid step; a few gaps are
    # smaller (interpolated columns) or doubled (steep spots), so take the
    # median rather than the minimum.
    quantum = float(np.median(np.diff(levels))) if levels.size > 1 else 0.0
    sigma = quantum / np.sqrt(12.0)  # uniform quantization error
    for window in windows:
        n = max(5, int(round(window * FEET_PER_MILE / step_ft)) | 1)
        # std of the slope from an n-point evenly spaced least-squares line
        noise = sigma * np.sqrt(12.0 / (n * (n * n - 1))) / step_ft * 100
        print(f"  {window:g} mi window ({n} samples): "
              f"digitization noise floor +-{noise:.2f}% grade")

    broad = grades[0]  # section means read off the broadest window
    edges = np.linspace(x[0], x[-1], 5)
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (x >= lo) & (x <= hi)
        print(f"  {lo:.2f}-{hi:.2f} mi ({windows[0]:g} mi window): "
              f"mean grade {broad[sel].mean():5.1f}%  max {broad[sel].max():5.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
