# Elevation profile digitizer

`digitize_elevation.py` turns a screenshot of a hike's elevation profile into
x/y samples, one per pixel column of the trace.

```
pip install pillow numpy
python3 digitize_elevation.py profile.png --x-max 1.3 \
    --elev-start 960 --elev-end 3500 -o profile.csv --overlay overlay.png
```

Columns in the CSV:

| column | meaning |
| --- | --- |
| `x_mi` | distance along the hike in miles |
| `y_px` | trace height in pixels above the starting height (0 at `x_mi` 0, up positive) |
| `y_ft` | `y_px` scaled to feet, only when both `--elev-*` are given |

## How it finds the line

The trace is white, but so are the axis labels and the elevation callouts, so
brightness alone is not enough. For each column the script takes the bright run
that sits directly on top of the filled area — labels drawn over the fill sit
well below it, and labels over the background have no fill beneath them at all.
Where a glyph actually touches the line (the `3,500 ft` callout crosses it near
the summit) the merged run is much thicker than the line, so those 19 columns
are dropped and interpolated across instead. `--overlay` writes the samples
back onto the image in green to check the fit.

## Calibration assumptions

- `--x-max` is the distance at the **right end of the trace**; the script maps
  the traced pixel span linearly onto `[--x-min, --x-max]`.
- `--elev-start` / `--elev-end` assume the two callouts label the lowest and
  highest points of the trace, which is how the source app places them. The
  feet scale is therefore ~8.7 ft per pixel for this image.

## Gradient analysis

`analyze_gradient.py` plots the digitized profile and its derivative:

```
pip install matplotlib scipy
python3 analyze_gradient.py profile.csv -o gradient.png
```

The slope comes from a Savitzky-Golay fit: a local least-squares polynomial
whose analytic derivative is evaluated at each sample. `--windows` sets the
window width(s) in miles (default `0.1 0.15`); the broadest one keeps the first
color slot, so adding a tighter window does not repaint the one already on the
chart. `--trim N` drops N samples from each end, where a screenshot's outermost
columns are often clipped by the image border.

### Closing off the ends

Within a half-window of each end there is no centred window left to fit, and
the choice made there visibly changes the answer. `--edge` picks it:

| mode | what it does | grade at 0 / 1.3 mi (0.15 mi window) |
| --- | --- | --- |
| `reflect` (default) | pads by point reflection through the endpoint, `y[-k] = 2*y[0] - y[k]`: slope carries across the boundary, curvature flips | 11% / 27% |
| `poly` | pads with a quadratic fitted to the outermost half-window and extrapolated | -11% / 22% |
| `interp` | scipy's own: fits the end window once, evaluates its derivative off-centre | 24% / 36% |

For this profile `reflect` is the one to use. `poly` reads the curvature of the
end segment as a trend to continue, so the flat bench at the start -- which
steepens as it goes -- extrapolates to a *negative* grade before the first
sample, and `interp` reports 36% at a summit whose last tenth of a mile
averages 28%.

The script also prints the digitization noise floor. The pixel grid alone puts
only +-0.27% grade into a 0.05 mi window, so narrow windows are not measuring
screen-reading error -- they are resolving real wiggle in the source trace,
which is itself a smoothed rendering of GPS or DEM data. 0.15 mi averages over
that wiggle and leaves the shape of the climb.

`profile.csv` is the digitized version of `profile.png`: 956 samples over
1.3 mi, 292.5 px ≈ 2540 ft of gain.
