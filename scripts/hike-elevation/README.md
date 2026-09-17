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

`profile.csv` is the digitized version of `profile.png`: 956 samples over
1.3 mi, 292.5 px ≈ 2540 ft of gain.
