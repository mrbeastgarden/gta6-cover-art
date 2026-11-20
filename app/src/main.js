// Entry point: builds the editor, loads the samples, and either runs the
// interactive app or a fixed screenshot scene from the ?shot= query.
import { CoverEditor } from './editor.js';
import { runShot } from './shots.js';

const editor = new CoverEditor(document);
editor.bind();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

async function start() {
  await document.fonts.load('40px Anton');
  await editor.loadSamples();
  if (shot) {
    await runShot(shot, params, editor);
  }
  editor.redraw();
  // The display font can arrive after the first paint; redraw once it is
  // ready so the caption is always set in Anton, shots included.
  document.fonts.ready.then(() => editor.redraw());
  if (!shot) {
    // Keep the preview crisp once the display font arrives.
    document.fonts.ready.then(() => editor.redraw());
  }
}

start().catch((err) => {
  document.getElementById('status').textContent = `Could not start: ${err.message}`;
});
