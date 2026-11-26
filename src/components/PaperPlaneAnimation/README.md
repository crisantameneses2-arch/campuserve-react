# PaperPlaneAnimation

A document lies down, folds into a paper airplane (corners → point down → corners → lock tip → plane) and flies away. 5 seconds per run, pure SVG, no extra libraries.

## Files

| File | What it is |
|---|---|
| `paperPlaneEngine.js` | The animation engine: fold geometry, 3D math, timing and colour palettes. No dependencies. |
| `PaperPlaneAnimation.jsx` | React component that draws the engine's output as SVG every frame. |

## Install

Copy the `PaperPlaneAnimation` folder into your project, e.g. `src/components/PaperPlaneAnimation/`. Nothing to `npm install`, only React 18+ (for `useId`).

## Use

```jsx
import PaperPlaneAnimation from './components/PaperPlaneAnimation/PaperPlaneAnimation';

// looping icon
<PaperPlaneAnimation size={200} />

// play once after a document request is submitted, then show a message
<PaperPlaneAnimation
  size={220}
  loop={false}
  onComplete={() => setShowSuccess(true)}
/>
```

### Props

| Prop | Default | Notes |
|---|---|---|
| `variant` | `'gradient'` | `'gradient'` (icon-set style), `'flat'` (blue/black/white), `'soft'` (grey-blue/yellow) |
| `size` | `240` | px number or CSS size (`'100%'`, `'12rem'`) |
| `duration` | `5` | seconds for one run |
| `loop` | `true` | `false` plays once and stops after the plane leaves |
| `playing` | `true` | set `false` to pause/stop |
| `onComplete` | – | called when a non-looping run ends |
| `className`, `style` | – | applied to the wrapper `div` |

If the user's device asks for reduced motion, the component shows the still document instead of animating.

## Changing the look

All colours are in `PALETTES` at the bottom of `paperPlaneEngine.js`:

- `bg`: background
- `f0` / `f1`: paper front, top → bottom gradient
- `b0` / `b1`: paper back (the plane's colour)
- `ear0` / `ear1`: curled corner
- `pink0` / `pink1`: header tag
- `lineCol`: text lines
- `sigCol`: signature
- `ink`: outline colour, `null` for no outlines

The document details (tag, lines, signature, corner) are the `DOC` list near the top of the engine, in paper coordinates (sheet is x 140–260, y 115–285).

## Changing the timing

The timeline is written for 3 seconds and stretched to `TOTAL` (5 s). Edit `STEP_T`, `T_STAND`, `T_WING`, `T_FLY`, `T_POP` near the top of the engine for per-step timing, or just pass a different `duration` prop to speed up or slow down the whole thing.
