# The Apiary — Website — design reference

This is a design mockup created in a visual design tool, exported as a
standalone page. Treat it as a REFERENCE MOCKUP, not production code:
the markup and inline styles carry the design's precise values — colors,
font sizes, spacing, radii, shadows, layout — which an implementation
should replicate faithfully in its own components and styling system
rather than copy wholesale.

## Contents

- `Main.dc.html` — the artboard (a Design Component: an `<x-dc>`
  template + a small logic class). The values to replicate live in its
  inline `style="…"` attributes and the `<helmet><style>` block.
- `motion.js` — scroll reveals and ambient animation (emblem draw-in,
  the Architect's eye, the ascent meter, the Wall's CRT/glitch, the
  closing swarm). Elements opt in through classes and `data-*`
  attributes in the template; all motion is off under
  `prefers-reduced-motion`.
- `support.js`, `vendor/react*.js` — the runtime that renders the
  component in a browser; not part of the design.

## Viewing

Serve the folder (e.g. `python3 -m http.server`) and open `Main.dc.html`;
some browsers block the scripts over file://.

## Deploying (Vercel)

Static site, no build step. Import the repo in Vercel with the
framework preset "Other" and leave the build/output settings empty.
`vercel.json` rewrites `/` to `Main.dc.html`, so the site loads at the
root URL.
