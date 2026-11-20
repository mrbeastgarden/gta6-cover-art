// Renders a multi-panel GTA-style poster onto any canvas: white-guttered photo
// panels, a colour grade over each panel, and a big display caption with a
// tagline. Pure canvas 2D, no network, no fonts beyond the bundled Anton.

export const LAYOUTS = {
  hero: { panels: 1, rects: [{ x: 0, y: 0, w: 1, h: 1 }] },
  split: { panels: 2, rects: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  comic: {
    panels: 3,
    rects: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ],
  },
  grid: {
    panels: 4,
    rects: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

const GRADES = {
  sunset: { photo: 'saturate(1.25) contrast(1.08)', warm: true, neon: false },
  neon: { photo: 'saturate(1.4) contrast(1.12)', warm: false, neon: true },
  noir: { photo: 'grayscale(1) contrast(1.18) brightness(1.04)', warm: false, neon: false },
  palm: { photo: 'saturate(1.35) contrast(1.05) sepia(0.22)', warm: true, neon: false },
};

/** A fresh empty panel slot: no photo yet, centred, natural zoom. */
export function blankPanel() {
  return { img: null, zoom: 1, ox: 0, oy: 0 };
}

/** Draws one photo cover-fit inside rect (x, y, w, h), honouring zoom and pan. */
export function drawPanelPhoto(ctx, panel, rect) {
  const img = panel.img;
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const base = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  const pw = iw * base;
  const ph = ih * base;
  const dx = rect.x + (rect.w - pw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + panel.oy * rect.h;
  ctx.drawImage(img, dx, dy, pw, ph);
}

/** Paints the grade wash and vignette over a panel rect. */
export function gradePanel(ctx, grade, rect) {
  const { w, h } = rect;
  let wash;
  if (grade === 'sunset') {
    wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + h);
    wash.addColorStop(0, 'rgba(255, 122, 24, 0)');
    wash.addColorStop(0.55, 'rgba(255, 46, 136, 0.14)');
    wash.addColorStop(1, 'rgba(123, 47, 247, 0.46)');
  } else if (grade === 'neon') {
    wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + w, rect.y + h);
    wash.addColorStop(0, 'rgba(0, 229, 199, 0.30)');
    wash.addColorStop(0.5, 'rgba(123, 47, 247, 0.16)');
    wash.addColorStop(1, 'rgba(255, 46, 136, 0.38)');
  } else if (grade === 'noir') {
    wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + h);
    wash.addColorStop(0, 'rgba(10, 10, 18, 0.05)');
    wash.addColorStop(1, 'rgba(10, 10, 18, 0.42)');
  } else {
    wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + h);
    wash.addColorStop(0, 'rgba(255, 226, 89, 0.20)');
    wash.addColorStop(0.6, 'rgba(255, 167, 81, 0.08)');
    wash.addColorStop(1, 'rgba(0, 176, 155, 0.28)');
  }
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, w, h);
  const vig = ctx.createRadialGradient(
    rect.x + w / 2, rect.y + h / 2, Math.min(w, h) * 0.42,
    rect.x + w / 2, rect.y + h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, w, h);
}

/** A dark scrim behind the caption so white lettering reads on any photo. */
export function captionScrim(ctx, grade, y, h, w) {
  const scrim = ctx.createLinearGradient(0, y, 0, y + h);
  if (grade === 'neon') {
    scrim.addColorStop(0, 'rgba(20, 0, 40, 0)');
    scrim.addColorStop(1, 'rgba(20, 0, 40, 0.72)');
  } else if (grade === 'noir') {
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  } else {
    scrim.addColorStop(0, 'rgba(60, 0, 60, 0)');
    scrim.addColorStop(1, 'rgba(60, 0, 60, 0.66)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, y, w, h);
}

/** Draws the big caption and tagline, auto-fitting the width. */
export function drawCaption(ctx, state, w, h) {
  const text = (state.caption || '').trim().toUpperCase();
  const tag = (state.subcaption || '').trim().toUpperCase();
  if (!text && !tag) return;
  const maxW = w * 0.92;
  let size = h * 0.115 * (state.capSize / 100);
  const font = (s) => `${s}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (text) {
    ctx.font = font(size);
    while (ctx.measureText(text).width > maxW && size > 14) {
      size -= 2;
      ctx.font = font(size);
    }
  }
  const tagSize = Math.max(14, size * 0.22);
  const blockH = (text ? size * 1.05 : 0) + (tag ? tagSize * 2.1 : 0);
  let top;
  if (state.capPos === 'top') top = h * 0.045;
  else if (state.capPos === 'middle') top = (h - blockH) / 2;
  else top = h - blockH - h * 0.05;
  if (state.capPos === 'bottom') captionScrim(ctx, state.grade, top - h * 0.03, blockH + h * 0.08, w);
  if (state.capPos === 'middle') captionScrim(ctx, state.grade, top - h * 0.03, blockH + h * 0.06, w);
  let y = top + size;
  if (text) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.font = font(size);
    // Pink offset echo, then dark outline, then white face. The echo sits
    // down-right so the title pops even on a bright sky.
    ctx.fillStyle = state.grade === 'neon' ? '#00e5c7' : '#ff2e88';
    ctx.fillText(text, w / 2 + size * 0.045, y + size * 0.05);
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeStyle = '#14001e';
    ctx.strokeText(text, w / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, y);
    y += size * 0.16;
  }
  if (tag) {
    ctx.font = `bold ${tagSize}px system-ui, sans-serif`;
    const tw = ctx.measureText(tag).width;
    const pad = tagSize * 0.9;
    const pillW = Math.min(tw + pad * 2, maxW);
    const pillH = tagSize * 1.9;
    const pillY = y + tagSize * 0.35;
    ctx.fillStyle = 'rgba(20, 0, 30, 0.82)';
    roundRect(ctx, (w - pillW) / 2, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = state.grade === 'palm' ? '#ffe259' : '#ffffff';
    ctx.fillText(tag, w / 2, pillY + pillH / 2 + tagSize * 0.36);
  }
}

/** Rounded-rectangle path helper (no Path2D dependency). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draws the whole cover for `state` onto `canvas` at its own pixel size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] || LAYOUTS.comic;
  const grade = GRADES[state.grade] ? state.grade : 'sunset';
  const gutter = Math.max(4, Math.round(Math.min(w, h) * 0.008));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  layout.rects.forEach((frac, i) => {
    // White gutters: a full gutter at the outer edge, half a gutter between panels.
    const rect = {
      x: frac.x * w + (frac.x === 0 ? gutter : gutter / 2),
      y: frac.y * h + (frac.y === 0 ? gutter : gutter / 2),
      w: frac.w * w - (frac.x === 0 ? gutter : gutter / 2) - (frac.x + frac.w >= 1 ? gutter : gutter / 2),
      h: frac.h * h - (frac.y === 0 ? gutter : gutter / 2) - (frac.y + frac.h >= 1 ? gutter : gutter / 2),
    };
    const panel = state.panels[i] || blankPanel();
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    // Dark bed under the photo, so a zoomed-out photo never shows white gaps.
    const bed = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    bed.addColorStop(0, '#3a1c5c');
    bed.addColorStop(1, '#14001e');
    ctx.fillStyle = bed;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (panel.img) {
      ctx.filter = GRADES[grade].photo;
      drawPanelPhoto(ctx, panel, rect);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `bold ${Math.max(16, rect.h * 0.06)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    gradePanel(ctx, grade, rect);
    ctx.restore();
  });
  // Thin dark frame so the poster reads at thumbnail size.
  ctx.strokeStyle = '#14001e';
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  drawCaption(ctx, state, w, h);
}

/** Renders the cover offscreen at `sizeKey` and returns the canvas. */
export function renderCover(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
