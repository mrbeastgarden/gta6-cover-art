// Fixed scenes for screenshots and headless checks, driven by the query:
//   ?shot=cover&layout=comic&grade=sunset&size=1080x1350&caption=... — cover alone
//   ?shot=editor&layout=... — the editor with the sample photos loaded
//   ?shot=verify — renders all three export sizes offscreen and records their
//   pixel sizes and PNG data-URL heads into #verify, for a headless check.
// window.__shotReady is set once the scene has painted.

/** Applies the scene's layout / grade / size / caption choices to the editor. */
export function applySceneParams(params, editor) {
  const state = editor.state;
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('grade')) state.grade = params.get('grade');
  if (params.get('size')) state.size = params.get('size');
  if (params.get('caption') !== null) {
    state.caption = params.get('caption');
    document.getElementById('caption').value = state.caption;
  }
  if (params.get('subcaption') !== null) {
    state.subcaption = params.get('subcaption');
    document.getElementById('subcaption').value = state.subcaption;
  }
  if (params.get('capPos')) {
    state.capPos = params.get('capPos');
    document.getElementById('capPos').value = state.capPos;
  }
}

export async function runShot(shot, params, editor) {
  applySceneParams(params, editor);
  editor.redraw();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    editor.redraw();
  } else if (shot !== 'editor' && shot !== 'verify') {
    // Unknown shot name: fall back to the plain editor scene.
    document.getElementById('status').textContent = `Unknown shot “${shot}” — showing the editor.`;
  }
  if (shot === 'verify') {
    const { renderCover, SIZES } = await import('./render.js');
    const out = {};
    for (const key of Object.keys(SIZES)) {
      const canvas = renderCover(editor.state, key);
      out[key] = {
        w: canvas.width,
        h: canvas.height,
        png: canvas.toDataURL('image/png').startsWith('data:image/png'),
      };
    }
    document.getElementById('verify').textContent = JSON.stringify(out);
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
