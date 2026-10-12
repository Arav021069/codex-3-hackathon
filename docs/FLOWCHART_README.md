# GuardSaaB Interactive Architecture Flowchart

A zero-dependency, production-grade interactive and animated architecture diagram component for the **GuardSaaB** documentation site.

This component renders the complete ground truth architecture from [`diagram.txt`](../diagram.txt) (22 nodes, 25 edges, 5 subgraphs, and 2 actor entities) using scalable vector graphics (SVG), CSS animations, and vanilla JavaScript.

---

## 1. Key Features

- **Strict Mermaid Ground-Truth Fidelity**:
  - Preserves all 22 nodes, 5 subgraphs (`group_entry`, `group_decision`, `group_operations`, `group_portals`, `group_integrations`), and 2 actor entities (`node_agent`, `node_user`).
  - Solid edges represent primary data flows; dashed edges (`-.->`) represent optional or secondary flows.
  - `node_audit` is rendered as a formal cylinder datastore.
  - All node click targets mirror the exact GitHub source URLs specified in `diagram.txt`.
- **Interactivity**:
  - **Pan & Zoom**: Mouse drag, trackpad pan, pinch-to-zoom, mousewheel zoom, plus floating controls (`+`, `-`, `Fit`, `1:1`).
  - **Node Hover**: Highlights the node and all connected incoming/outgoing edges while dimming unrelated elements; displays a metadata tooltip with file path and role.
  - **Node Click & Drawer**: Opens a slide-out drawer with node title, functional role, input/output data contracts, and a direct `View source ↗` link.
  - **Subgraph Collapse/Expand**: Toggle individual groups on the canvas (`[-]` / `[+]`) to isolate subsystems.
  - **Search & Filters**: Live fuzzy text search and subsystem filter pills (Entry, Decision, Operations, Portals, Integrations).
  - **"Trace a Request" Mode**: Step-by-step interactive walk-through of a live agent tool invocation:
    `Agent tool call` → `Hook Adapter` → `Engine Proxy` → `Policy Rules` → `Risk Analysis` → `Audit Store` → `Governance Dashboard`
    Includes `Play`, `Pause`, `Next`, `Prev`, step progress indicators, and descriptive captions.
- **Visual Design & Theming**:
  - Slop-free tactical dark theme (default) and clean light theme with manual toggle (`☀️` / `🌙`) and `prefers-color-scheme` auto-detection.
  - Preserves Mermaid tone families: **Blue** (Entry), **Amber** (Decision), **Mint** (Operations), **Rose** (Portals), and **Indigo** (Integrations).
  - Animated edge flows with directional motion (slower and fainter for dashed edges).
  - Subtle breathing pulse on entry points (`node_agent`, `node_user`) and persistent datastore (`node_audit`).
  - Full respect for `@media (prefers-reduced-motion: reduce)`.
- **Accessibility (WCAG AA)**:
  - Accessible keyboard navigation (`Tab`, `Enter`, `Space`, `Escape`).
  - High-contrast text and border tokens.
  - Dedicated text-alternative modal listing all nodes, groups, and connections for screen readers.

---

## 2. Quick Embed Instructions

The diagram is distributed as a single self-contained file:
- Source path: [`docs/architecture-flowchart.html`](./architecture-flowchart.html)
- Web path (when engine or docs server is running): `http://127.0.0.1:9000/flowchart` or `/architecture-flowchart.html`

### Option A: Standard `<iframe>` Embed (Recommended)

Drop this responsive snippet into any HTML page, Markdown docs site (Docusaurus, VitePress, Hugo, MkDocs), or CMS:

```html
<div class="guardsaab-diagram-container" style="position: relative; width: 100%; height: 750px; border: 1px solid #2c384e; border-radius: 8px; overflow: hidden; background: #0a0d14;">
  <iframe
    src="/flowchart"
    title="GuardSaaB Interactive Architecture Flowchart"
    style="width: 100%; height: 100%; border: none; display: block;"
    loading="lazy"
    allow="clipboard-write"
  ></iframe>
</div>
```

### Option B: React / Next.js Component

If your documentation website is built with React, Next.js, or Vite, create `components/GuardSaabFlowchart.tsx`:

```tsx
import React, { useState } from 'react';

interface GuardSaabFlowchartProps {
  src?: string;
  height?: number | string;
  className?: string;
}

export const GuardSaabFlowchart: React.FC<GuardSaabFlowchartProps> = ({
  src = '/flowchart',
  height = '740px',
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div
      className={`guardsaab-flowchart-wrapper ${className}`}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 99999 : undefined,
        width: '100%',
        height: isFullscreen ? '100vh' : height,
        border: isFullscreen ? 'none' : '1px solid #2c384e',
        borderRadius: isFullscreen ? 0 : '8px',
        overflow: 'hidden',
        background: '#0a0d14',
      }}
    >
      <iframe
        src={src}
        title="GuardSaaB Architecture Flowchart"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        loading="lazy"
      />
    </div>
  );
};

export default GuardSaabFlowchart;
```

---

## 3. How to Edit the Diagram Data

The diagram data model is defined directly inside `docs/architecture-flowchart.html` within the JavaScript object:

```javascript
const MODEL = {
  groups: [ ... ],
  nodes: [ ... ],
  edges: [ ... ],
  traceSteps: [ ... ]
};
```

### A. Subgroups (`MODEL.groups`)

Each group corresponds to a Mermaid `subgraph`:

```javascript
{
  id: "group_entry",           // Unique ID
  title: "Entry & Ingestion",  // Display title in group header
  tone: "blue",                // "blue" | "amber" | "mint" | "rose" | "indigo"
  collapsed: false,            // Default collapsed state
  bbox: { x: 260, y: 160, w: 260, h: 420 } // Canvas bounding box
}
```

### B. Nodes (`MODEL.nodes`)

Each node matches a node definition and class in `diagram.txt`:

```javascript
{
  id: "node_engine",                  // Node identifier
  label: "Decision Gateway",          // Display text
  shape: "rect",                      // "rect" | "circle" | "cylinder"
  group: "group_entry",               // Subgraph id or null for root
  tone: "blue",                       // Tone color family
  file: "src/engine/server.ts",       // Source file path
  url: "https://github.com/...",      // Target click URL (GitHub link)
  x: 290, y: 440, w: 200, h: 62,      // Coordinate placement on 1800x1200 canvas
  role: "HTTP & WebSocket loopback gateway...",
  inputs: "HTTP /intercept payloads, WebSocket connection",
  outputs: "Action verdict (ALLOW, BLOCK, AUDIT, HITL)"
}
```

- **Shapes**:
  - `"rect"`: Standard rectangular card.
  - `"circle"`: Actor nodes (`node_agent`, `node_user`) rendered with concentric double rings.
  - `"cylinder"`: Datastore entities (`node_audit`) rendered with 3D elliptical top and body.

### C. Edges (`MODEL.edges`)

Edges define directional relationships and flows:

```javascript
{
  id: "e1",
  source: "node_agent",       // Source node id
  target: "node_hook",        // Target node id
  label: "intercepts call",   // Optional label text on the edge
  dashed: false               // true for "-.->", false for "-->"
}
```

- When `dashed: true`, the edge is rendered with `stroke-dasharray="6,4"` and a gentle, slower particle motion.
- When `dashed: false`, the edge is rendered as a solid primary line with vibrant dash-stream animation.

### D. Trace Steps (`MODEL.traceSteps`)

The interactive "Trace a Request" player follows this sequence:

```javascript
{
  step: 1,
  title: "Agent Tool Invocation",
  caption: "AI Agent prepares a shell or filesystem tool call in Claude Code or Codex CLI.",
  activeNodes: ["node_agent"],
  activeEdges: ["e1"]
}
```

To add or modify steps in the tour, append an object with the active nodes and active edges you want highlighted during that step.

---

## 4. File Layout & Production Build

| File | Purpose |
|---|---|
| [`docs/architecture-flowchart.html`](./architecture-flowchart.html) | Primary standalone interactive diagram application |
| [`dashboard/public/architecture-flowchart.html`](../dashboard/public/architecture-flowchart.html) | Mirror served by Vite frontend & production engine builds |
| [`docs/architecture.html`](./architecture.html) | Comprehensive product documentation with the flowchart embedded |
| [`src/engine/server.ts`](../src/engine/server.ts) | Loopback engine route handler serving `/flowchart` & `/architecture` |

---

## 5. Verification & Testing Checklist

- [x] Tested pan, zoom, fit, and 1:1 reset on high-DPI displays.
- [x] Verified node hover isolation: connected nodes remain bright while unrelated nodes dim to 15% opacity.
- [x] Verified side drawer inspection with functional role, IO contracts, and GitHub links.
- [x] Verified live search query filtering and group toggle pills.
- [x] Verified 9-step "Trace a request" step player (Play/Pause, Next, Previous).
- [x] Verified Light and Dark themes with contrast ratio > 4.5:1 (WCAG AA).
- [x] Verified `@media (prefers-reduced-motion)` fallback disables particle travel.
