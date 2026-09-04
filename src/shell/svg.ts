// svg.ts — the path-line overlay primitives shared by the target row and any
// play surface that draws a connecting line through a sequence.

export const SVG_NS = 'http://www.w3.org/2000/svg';

let maskSeq = 0;

export const svgEl = (tag: string, attrs: Record<string, string>): SVGElement => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]!);
  return e;
};

/**
 * Give the path line a radial fade mask so it thins to nothing right at each
 * vertex (the letters) and stays bright at the mid-segments (the shared edges).
 * Combined with the line painting on top of the cells, the line crosses cleanly
 * over the diamond edges yet leaves the letters unobstructed. Returns the group
 * to fill with one fade circle per vertex, plus that circle's fill.
 */
export function attachFadeMask(
  svg: SVGSVGElement,
  poly: SVGPolylineElement,
  w: number,
  h: number,
): { group: SVGGElement; fill: string } {
  const uid = `pf${maskSeq++}`;
  const M = 48; // margin so the line's glow isn't clipped by the mask region
  const grad = svgEl('radialGradient', { id: `${uid}g` });
  grad.append(
    svgEl('stop', { offset: '0%', 'stop-color': '#000', 'stop-opacity': '1' }),
    svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0' }),
  );
  const group = svgEl('g', {}) as SVGGElement;
  const region = { x: `${-M}`, y: `${-M}`, width: `${w + 2 * M}`, height: `${h + 2 * M}` };
  const mask = svgEl('mask', { id: `${uid}m`, maskUnits: 'userSpaceOnUse', ...region });
  mask.append(svgEl('rect', { ...region, fill: '#fff' }), group); // white = visible; circles subtract
  const defs = svgEl('defs', {});
  defs.append(grad, mask);
  svg.append(defs);
  poly.setAttribute('mask', `url(#${uid}m)`);
  return { group, fill: `url(#${uid}g)` };
}

/** Put a fade circle (radius `r`) at each path vertex so the line dims there. */
export function setFadeVertices(
  group: SVGGElement,
  pts: ReadonlyArray<{ x: number; y: number }>,
  r: number,
  fill: string,
): void {
  while (group.firstChild) group.removeChild(group.firstChild);
  for (const p of pts) {
    group.append(svgEl('circle', { cx: `${p.x}`, cy: `${p.y}`, r: `${r}`, fill }));
  }
}

/** A `<svg class="path-overlay">` sized `w`×`h`, with an empty polyline and its
 * vertex-fade mask already attached. */
export function makeOverlay(
  host: HTMLElement,
  w: number,
  h: number,
): { polyline: SVGPolylineElement; fadeGroup: SVGGElement; fadeFill: string } {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'path-overlay');
  svg.setAttribute('width', `${w}`);
  svg.setAttribute('height', `${h}`);
  const polyline = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
  svg.append(polyline);
  host.append(svg);
  const fade = attachFadeMask(svg, polyline, w, h);
  return { polyline, fadeGroup: fade.group, fadeFill: fade.fill };
}
