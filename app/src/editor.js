// Editor state and interactions: photo tray, panel picking, drag-to-pan,
// wheel zoom, layout / grade / caption controls, and PNG export.
import { LAYOUTS, SIZES, blankPanel, drawCover, renderCover } from './render.js';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Default state: comic layout, sunset grade, both sample photos in play. */
export function defaultState() {
  return {
    size: '1080x1350',
    layout: 'comic',
    grade: 'sunset',
    caption: 'SUNSET HEIST',
    subcaption: 'BOULEVARD NIGHTS · EST. 2026',
    capSize: 100,
    capPos: 'bottom',
    selected: 0,
    traySelected: 0,
    panels: [blankPanel(), blankPanel(), blankPanel(), blankPanel()],
    tray: [],
  };
}

export class CoverEditor {
  constructor(doc) {
    this.doc = doc;
    this.canvas = doc.getElementById('cover');
    this.state = defaultState();
    this.drag = null;
    this.status = doc.getElementById('status');
    this.panelLabel = doc.getElementById('panelLabel');
  }

  /** Fits the preview canvas to the chosen export aspect and redraws. */
  redraw() {
    const size = SIZES[this.state.size];
    this.canvas.width = size.w;
    this.canvas.height = size.h;
    drawCover(this.canvas, this.state);
    const layout = LAYOUTS[this.state.layout];
    const n = layout.panels;
    const sel = Math.min(this.state.selected, n - 1);
    this.panelLabel.textContent =
      `Panel ${sel + 1} of ${n} — drag to move, scroll to zoom`;
    this.syncButtons();
  }

  syncButtons() {
    const setPressed = (id, key, value) => {
      this.doc.querySelectorAll(`#${id} button`).forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset[key] === value));
      });
    };
    setPressed('layouts', 'layout', this.state.layout);
    setPressed('grades', 'grade', this.state.grade);
    setPressed('sizes', 'size', this.state.size);
    const tray = this.doc.getElementById('tray');
    tray.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === this.state.traySelected));
    });
  }

  /** Rebuilds the photo tray thumbnails from state.tray. */
  renderTray() {
    const tray = this.doc.getElementById('tray');
    tray.replaceChildren();
    this.state.tray.forEach((photo, i) => {
      const b = this.doc.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.title = photo.name;
      b.setAttribute('aria-selected', String(i === this.state.traySelected));
      const img = this.doc.createElement('img');
      img.src = photo.thumb;
      img.alt = photo.name;
      b.appendChild(img);
      b.addEventListener('click', () => {
        this.state.traySelected = i;
        this.assignPhoto(i, this.state.selected);
      });
      tray.appendChild(b);
    });
  }

  /** Puts tray photo `trayIndex` into panel `panelIndex` and redraws. */
  assignPhoto(trayIndex, panelIndex) {
    const photo = this.state.tray[trayIndex];
    if (!photo) return;
    const panel = this.state.panels[panelIndex];
    panel.img = photo.img;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    this.redraw();
  }

  /** Fills every panel of the current layout with the selected tray photo. */
  fillAllPanels() {
    const photo = this.state.tray[this.state.traySelected];
    if (!photo) return;
    const n = LAYOUTS[this.state.layout].panels;
    for (let i = 0; i < n; i++) this.assignPhoto(this.state.traySelected, i);
    this.say(`“${photo.name}” fills all ${n} panels.`);
  }

  /** Adds user files to the tray (read locally, never uploaded). */
  async addFiles(files) {
    let added = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        this.state.tray.push({ name: file.name.replace(/\.[^.]+$/, ''), img, thumb: url });
        added += 1;
      } catch {
        URL.revokeObjectURL(url);
      }
    }
    if (added) {
      this.state.traySelected = this.state.tray.length - 1;
      this.renderTray();
      this.assignPhoto(this.state.traySelected, this.state.selected);
      this.say(`${added} photo${added > 1 ? 's' : ''} added — click a panel to place it.`);
    }
  }

  /** Loads the two bundled sample photos into the tray and panels. */
  async loadSamples() {
    const samples = [
      { name: 'Pier', url: 'samples/pier.jpg' },
      { name: 'Boulevard', url: 'samples/boulevard.jpg' },
    ];
    for (const s of samples) {
      const img = await loadImage(s.url);
      this.state.tray.push({ name: s.name, img, thumb: s.url });
    }
    this.renderTray();
    this.assignPhoto(0, 0);
    this.assignPhoto(1, 1);
    this.assignPhoto(0, 2);
    this.assignPhoto(1, 3);
  }

  /** Which panel (if any) sits under canvas point (cx, cy) in CSS pixels. */
  panelAt(cx, cy) {
    const box = this.canvas.getBoundingClientRect();
    const fx = (cx - box.left) / box.width;
    const fy = (cy - box.top) / box.height;
    const layout = LAYOUTS[this.state.layout];
    for (let i = 0; i < layout.panels; i++) {
      const r = layout.rects[i];
      if (fx >= r.x && fx < r.x + r.w && fy >= r.y && fy < r.y + r.h) return i;
    }
    return -1;
  }

  /** Pointer press on the preview: select a panel and start a pan drag. */
  onPointerDown(e) {
    const i = this.panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    this.state.selected = i;
    const panel = this.state.panels[i];
    this.drag = { x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy, moved: 0 };
    this.canvas.setPointerCapture(e.pointerId);
    this.redraw();
  }

  /** Pointer move: pan the dragged panel's photo. */
  onPointerMove(e) {
    if (!this.drag) return;
    const box = this.canvas.getBoundingClientRect();
    const panel = this.state.panels[this.state.selected];
    panel.ox = clamp(this.drag.ox + (e.clientX - this.drag.x) / box.width, -0.6, 0.6);
    panel.oy = clamp(this.drag.oy + (e.clientY - this.drag.y) / box.height, -0.6, 0.6);
    this.drag.moved = Math.max(this.drag.moved, Math.abs(e.clientX - this.drag.x), Math.abs(e.clientY - this.drag.y));
    this.redraw();
  }

  onPointerUp() {
    // Keep the distance of the drag that just ended, so a click fired right
    // after a real drag does not place a photo by accident.
    const moved = this.drag ? this.drag.moved : 0;
    this.drag = null;
    this.lastDragMoved = moved;
  }

  /** Wheel over the preview: zoom the selected panel's photo. */
  onWheel(e) {
    e.preventDefault();
    const panel = this.state.panels[this.state.selected];
    panel.zoom = clamp(panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93), 0.6, 4);
    this.redraw();
  }

  zoomStep(factor) {
    const panel = this.state.panels[this.state.selected];
    panel.zoom = clamp(panel.zoom * factor, 0.6, 4);
    this.redraw();
  }

  resetPanel() {
    const panel = this.state.panels[this.state.selected];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    this.redraw();
  }

  /** Exports the cover at the chosen size as a PNG download. */
  exportPng() {
    const canvas = renderCover(this.state, this.state.size);
    canvas.toBlob((blob) => {
      if (!blob) {
        this.say('Export failed — try again.');
        return;
      }
      const a = this.doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${this.state.size}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.say(`Saved vice-cover-${this.state.size}.png (${canvas.width} × ${canvas.height}).`);
    }, 'image/png');
  }

  say(text) { this.status.textContent = text; }

  /** Wires every control on the page. */
  bind() {
    const doc = this.doc;
    doc.getElementById('upload').addEventListener('change', (e) => {
      this.addFiles(e.target.files);
      e.target.value = '';
    });
    doc.getElementById('fillAll').addEventListener('click', () => this.fillAllPanels());
    doc.querySelectorAll('#layouts button').forEach((b) => {
      b.addEventListener('click', () => {
        this.state.layout = b.dataset.layout;
        this.state.selected = 0;
        this.redraw();
      });
    });
    doc.querySelectorAll('#grades button').forEach((b) => {
      b.addEventListener('click', () => {
        this.state.grade = b.dataset.grade;
        this.redraw();
      });
    });
    doc.querySelectorAll('#sizes button').forEach((b) => {
      b.addEventListener('click', () => {
        this.state.size = b.dataset.size;
        this.redraw();
      });
    });
    doc.getElementById('caption').addEventListener('input', (e) => {
      this.state.caption = e.target.value;
      this.redraw();
    });
    doc.getElementById('subcaption').addEventListener('input', (e) => {
      this.state.subcaption = e.target.value;
      this.redraw();
    });
    doc.getElementById('capSize').addEventListener('input', (e) => {
      this.state.capSize = Number(e.target.value);
      this.redraw();
    });
    doc.getElementById('capPos').addEventListener('change', (e) => {
      this.state.capPos = e.target.value;
      this.redraw();
    });
    doc.getElementById('export').addEventListener('click', () => this.exportPng());
    doc.getElementById('zoomIn').addEventListener('click', () => this.zoomStep(1.2));
    doc.getElementById('zoomOut').addEventListener('click', () => this.zoomStep(1 / 1.2));
    doc.getElementById('resetPanel').addEventListener('click', () => this.resetPanel());
    this.canvas.addEventListener('click', (e) => {
      // A click that ends a drag is a pan, not a placement.
      if ((this.lastDragMoved || 0) > 4) return;
      const i = this.panelAt(e.clientX, e.clientY);
      if (i >= 0 && this.state.tray[this.state.traySelected]) {
        // Clicking a panel with a tray photo selected places that photo.
        if (this.state.panels[i].img !== this.state.tray[this.state.traySelected].img) {
          this.state.selected = i;
          this.assignPhoto(this.state.traySelected, i);
        }
      }
    });
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.onPointerUp());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
