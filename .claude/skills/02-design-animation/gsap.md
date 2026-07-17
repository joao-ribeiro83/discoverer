<!--
Merged from:
- autoskills-main/packages/autoskills/skills-registry/gsap-core/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/gsap-timeline/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/gsap-scrolltrigger/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/gsap-react/SKILL.md
-->

# GSAP Animation Library

GreenSock Animation Platform (GSAP) is a robust JavaScript animation library for performant, timeline-based animations with scroll-driven, SVG, and CSS animation support.

## Installation

```bash
npm install gsap
npm install @gsap/react  # For React integration
```

---

## Core Tween Methods

- **gsap.to(targets, vars)** — Animate from current state to vars (most common)
- **gsap.from(targets, vars)** — Animate from vars to current state (good for entrances)
- **gsap.fromTo(targets, fromVars, toVars)** — Explicit start and end
- **gsap.set(targets, vars)** — Apply immediately (duration 0)

### Transform Aliases (Preferred)

| GSAP Property | CSS Equivalent |
|---------------|----------------|
| `x`, `y`, `z` | translateX/Y/Z (px) |
| `xPercent`, `yPercent` | Percentage-based movement |
| `scale`, `scaleX`, `scaleY` | scale |
| `rotation`, `rotationX`, `rotationY` | rotate |
| `transformOrigin` | transform-origin |
| `autoAlpha` | opacity + visibility (use for fade in/out) |

### Common Vars

| Property | Description |
|----------|-------------|
| `duration` | Seconds (default 0.5) |
| `delay` | Seconds before start |
| `ease` | Easing string or function |
| `stagger` | Offset between multiple targets |
| `repeat` | Number or -1 for infinite |
| `yoyo` | Reverse direction on repeat |
| `onComplete`, `onStart`, `onUpdate` | Callbacks |

### Easing

```javascript
ease: "power1.out"     // default
ease: "power3.inOut"
ease: "back.out(1.7)"
ease: "elastic.out(1, 0.3)"
ease: "none"
```

---

## Staggered Animations

```javascript
gsap.to(".item", {
  y: -20,
  stagger: 0.1
});
```

---

## Timeline Sequencing

Create sequenced animations instead of chaining with delays:

```javascript
const tl = gsap.timeline();
tl.to(".a", { x: 100 })
  .to(".b", { y: 50 }, "-=0.5")  // overlap 0.5s
  .to(".c", { opacity: 0 });
```

### Timeline Controls

```javascript
tl.play();
tl.pause();
tl.reverse();
tl.restart();
tl.seek(0.5);
tl.progress(0.5);
tl.kill();
```

---

## ScrollTrigger - Scroll-Based Animation

Register plugin first:

```javascript
gsap.registerPlugin(ScrollTrigger);
```

### Basic Scroll Trigger

```javascript
gsap.to(".box", {
  x: 500,
  duration: 1,
  scrollTrigger: {
    trigger: ".box",
    start: "top center",
    end: "bottom center",
    toggleActions: "play reverse play reverse"
  }
});
```

### Pinning

```javascript
gsap.to(".section", {
  scrollTrigger: {
    trigger: ".section",
    start: "top top",
    end: "+=1000",
    pin: true,
    scrub: 1
  }
});
```

### Scrubbing

```javascript
scrub: true        // direct linking to scroll
scrub: 1          // 1 second smoothness delay
```

---

## React Integration

### Using useGSAP Hook (Recommended)

```javascript
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

const containerRef = useRef(null);

useGSAP(() => {
  gsap.to(".box", { x: 100 });
}, { scope: containerRef });
```

### useEffect Pattern (Alternative)

```javascript
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, containerRef);
  
  return () => ctx.revert();  // Cleanup required!
}, []);
```

### Context-Safe Callbacks

```javascript
useGSAP((context, contextSafe) => {
  const onClick = contextSafe(() => {
    gsap.to(".item", { rotation: 180 });
  });
  
  element.addEventListener("click", onClick);
  
  return () => element.removeEventListener("click", onClick);
});
```

---

## Responsive Animation (matchMedia)

```javascript
let mm = gsap.matchMedia();

mm.add({
  isDesktop: "(min-width: 800px)",
  isMobile: "(max-width: 799px)",
  reduceMotion: "(prefers-reduced-motion: reduce)"
}, (context) => {
  const { isDesktop, reduceMotion } = context.conditions;
  
  gsap.to(".box", {
    rotation: isDesktop ? 360 : 180,
    duration: reduceMotion ? 0 : 2
  });
});

// Cleanup on unmount
mm.revert();
```

---

## CSS Variables

```javascript
gsap.to(":root", {
  "--hue": 180,
  "--size": 100,
  duration: 1
});
```

---

## Best Practices

- ✅ Use camelCase property names (`backgroundColor`, `rotationX`)
- ✅ Prefer transform aliases over animating raw `transform`
- ✅ Use `autoAlpha` instead of `opacity` for fade effects
- ✅ Create timelines instead of chaining with delays
- ✅ Use `gsap.matchMedia()` for responsive breakpoints
- ✅ Run GSAP only on client (use useGSAP or useEffect)
- ✅ Always cleanup ScrollTriggers and tweens on unmount

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Animating layout properties (`width`, `height`, `top`, `left`) | Use `x`, `y`, `scale` instead |
| Multiple `from()` tweens on same target without `immediateRender: false` | Set on later tweens |
| Targeting selectors without scope in React | Pass scope to useGSAP or gsap.context |
| Forgetting to register ScrollTrigger plugin | Call `gsap.registerPlugin(ScrollTrigger)` |
| Using both scrub and toggleActions on same trigger | Choose one; scrub wins |
| Animating trigger element itself when pinning | Animate children instead |
| Not calling `ctx.revert()` on unmount | Always cleanup in effect return |
| Missing `ease: "none"` on horizontal scroll tween | Required for containerAnimation |