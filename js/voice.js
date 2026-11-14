/*
 * voice.js — image-to-sound conversion after
 *   Meijer, P. B. L. (1992). An experimental system for auditory image
 *   representations. IEEE Trans. Biomed. Eng., 39(2), 112-121.
 *
 * The mapping (Section II of the paper):
 *   - The image is an M (rows) x N (columns) matrix of brightness values.
 *   - It is scanned column by column, left to right, in T seconds, so each
 *     column sounds for T/N seconds          (horizontal position -> time)
 *   - Every row has its own sinusoidal oscillator; higher rows have higher
 *     frequencies                             (vertical position  -> pitch)
 *   - The pixel's brightness is the amplitude of its oscillator
 *                                             (brightness       -> loudness)
 *   - The M oscillators of a column are summed.
 *   - A click marks the start of each image.
 *
 * Paper's prototype values, used as defaults here: M = N = 64, 16 grey
 * tones, T = 1.05 s, 500 Hz - 5 kHz, exponential frequency distribution
 * (eq. 10: neighbouring frequencies differ by a constant factor).
 *
 * Two things here are NOT in the 1992 paper, and can be switched off:
 *   - stereo:    left-to-right panning during the scan (used by the later
 *                vOICe software and described in our paper's Figure 1)
 *   - smoothing: a ~1.5 ms ramp on amplitude changes between columns, which
 *                removes the crackle of hard column switching
 *
 * This file has no dependencies and does not touch the page. Usage:
 *
 *   const sound  = Voice.synthesize(grid, { duration: 1.05 });
 *   const buffer = Voice.toAudioBuffer(audioContext, sound);
 *   Voice.play(audioContext, buffer);
 *
 * where grid is an array of rows (top row first), each an array of
 * brightness values from 0 (black, silent) to 1 (white, loudest).
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    duration: 1.05,              // T: seconds for one left-to-right scan
    fLow: 500,                   // Hz, bottom row
    fHigh: 5000,                 // Hz, top row
    distribution: 'exponential', // or 'linear' (the paper's equidistant variant)
    grayLevels: 16,              // G: brightness is quantised to this many levels (0 = off)
    sampleRate: 44100,
    click: true,                 // synchronisation click before the scan
    stereo: true,                // pan left -> right during the scan
    smoothing: 0.0015,           // seconds; 0 = hard column switching as in the paper
    gain: 0.25                   // output level of one full-brightness oscillator
  };

  function options(opts) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in (opts || {})) if (opts[k] !== undefined) o[k] = opts[k];
    return o;
  }

  /* Oscillator frequencies for M rows. Index 0 is the BOTTOM row. */
  function frequencies(M, opts) {
    var o = options(opts), f = new Float64Array(M), i;
    for (i = 0; i < M; i++) {
      var x = M > 1 ? i / (M - 1) : 0;
      f[i] = o.distribution === 'linear'
        ? o.fLow + (o.fHigh - o.fLow) * x
        : o.fLow * Math.pow(o.fHigh / o.fLow, x);
    }
    return f;
  }

  /*
   * grid: array of M rows (top first), each with N brightness values in 0..1.
   * Returns { left, right, sampleRate, duration } with Float32Array channels.
   */
  function synthesize(grid, opts) {
    var o = options(opts);
    var M = grid.length, N = grid[0].length;
    var sr = o.sampleRate;
    var nScan = Math.round(o.duration * sr);
    var nLead = o.click ? Math.round(0.05 * sr) : 0; // click + short pause
    var total = nLead + nScan;
    var mono = new Float32Array(total);
    var env = new Float32Array(nScan);
    var freqs = frequencies(M, o);
    var G = o.grayLevels;
    var k = o.smoothing > 0 ? 1 - Math.exp(-1 / (o.smoothing * sr)) : 1;
    var r, j, n;

    for (r = 0; r < M; r++) {
      var row = grid[r], any = false;
      // Amplitude envelope of this row's oscillator: one step per column.
      for (j = 0; j < N; j++) {
        var a = Math.max(0, Math.min(1, row[j] || 0));
        if (G > 1) a = Math.round(a * (G - 1)) / (G - 1);
        if (a > 0) any = true;
        var start = Math.floor(j * nScan / N), end = Math.floor((j + 1) * nScan / N);
        for (n = start; n < end; n++) env[n] = a;
      }
      if (!any) continue;

      var w = 2 * Math.PI * freqs[M - 1 - r] / sr;
      var phase = Math.random() * 2 * Math.PI; // arbitrary constant, as in the paper
      var e = 0;
      for (n = 0; n < nScan; n++) {
        e += k * (env[n] - e);
        if (e > 1e-4) mono[nLead + n] += e * Math.sin(phase + w * n);
      }
    }

    // Level: fixed gain so brighter / larger images really are louder,
    // with a soft limiter so very bright images do not clip harshly.
    var fade = Math.min(nScan, Math.round(0.003 * sr));
    for (n = 0; n < nScan; n++) {
      var v = Math.tanh(o.gain * mono[nLead + n]);
      if (n >= nScan - fade) v *= (nScan - n) / fade;
      mono[nLead + n] = v;
    }

    if (o.click) {
      var nClick = Math.round(0.004 * sr);
      for (n = 0; n < nClick; n++) {
        mono[n] = 0.5 * (Math.random() * 2 - 1) * Math.exp(-n / (0.0007 * sr));
      }
    }

    var left = mono, right = mono;
    if (o.stereo) {
      left = new Float32Array(total);
      right = new Float32Array(total);
      for (n = 0; n < total; n++) {
        var p = n < nLead ? 0.5 : (n - nLead) / nScan; // 0 = left, 1 = right
        left[n] = mono[n] * Math.cos(p * Math.PI / 2);
        right[n] = mono[n] * Math.sin(p * Math.PI / 2);
      }
    }
    return { left: left, right: right, sampleRate: sr, duration: total / sr };
  }

  /* ---------- Browser helpers ---------- */

  /* Brightness grid from a canvas, at the canvas's own resolution. */
  function gridFromCanvas(canvas) {
    var w = canvas.width, h = canvas.height;
    var d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var grid = [], x, y;
    for (y = 0; y < h; y++) {
      var row = new Float32Array(w);
      for (x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        row[x] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 * (d[i + 3] / 255);
      }
      grid.push(row);
    }
    return grid;
  }

  /* Brightness grid from any image / video / canvas, resized to rows x cols. */
  function gridFromImage(source, rows, cols) {
    var c = document.createElement('canvas');
    c.width = cols || 64;
    c.height = rows || 64;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return gridFromCanvas(c);
  }

  function toAudioBuffer(audioContext, sound) {
    var b = audioContext.createBuffer(2, sound.left.length, sound.sampleRate);
    b.getChannelData(0).set(sound.left);
    b.getChannelData(1).set(sound.right);
    return b;
  }

  /* Plays an AudioBuffer; returns the source node (call .stop() to cut it). */
  function play(audioContext, buffer) {
    var src = audioContext.createBufferSource();
    src.buffer = buffer;
    src.connect(audioContext.destination);
    src.start();
    return src;
  }

  /* 16-bit stereo WAV file (ArrayBuffer), e.g. for saving stimuli. */
  function toWav(sound) {
    var n = sound.left.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf), i;
    function str(off, s) { for (var q = 0; q < s.length; q++) v.setUint8(off + q, s.charCodeAt(q)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sound.sampleRate, true); v.setUint32(28, sound.sampleRate * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, sound.left[i])) * 32767, true);
      v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, sound.right[i])) * 32767, true);
    }
    return buf;
  }

  var Voice = {
    DEFAULTS: DEFAULTS,
    frequencies: frequencies,
    synthesize: synthesize,
    gridFromCanvas: gridFromCanvas,
    gridFromImage: gridFromImage,
    toAudioBuffer: toAudioBuffer,
    play: play,
    toWav: toWav
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Voice;
  else root.Voice = Voice;
})(typeof window !== 'undefined' ? window : this);
