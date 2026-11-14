/*
 * stimuli.js — built-in shapes, and loading of image files.
 *
 * Each built-in is a function that draws on a canvas context whose
 * coordinates run from 0 to 1 in both directions (0,0 = top left).
 * White is loudest, black is silent. Add your own shapes to SHAPES and
 * use their names in js/levels.js.
 */
var Stimuli = (function () {
  'use strict';

  var W = 0.07; // line thickness

  function rect(c, x, y, w, h, shade) {
    c.fillStyle = shade || '#fff';
    c.fillRect(x, y, w, h);
  }
  function line(c, x1, y1, x2, y2) {
    c.strokeStyle = '#fff';
    c.lineWidth = W;
    c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  function disc(c, x, y, r) {
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.fill();
  }
  function ring(c, x, y, r) {
    c.strokeStyle = '#fff'; c.lineWidth = W;
    c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.stroke();
  }

  var SHAPES = {
    // Luminance patches
    'patch-left':   function (c) { rect(c, 0.08, 0.35, 0.3, 0.3); },
    'patch-right':  function (c) { rect(c, 0.62, 0.35, 0.3, 0.3); },
    'patch-top':    function (c) { rect(c, 0.35, 0.08, 0.3, 0.3); },
    'patch-bottom': function (c) { rect(c, 0.35, 0.62, 0.3, 0.3); },
    'patch-bright': function (c) { rect(c, 0.3, 0.3, 0.4, 0.4, '#fff'); },
    'patch-dim':    function (c) { rect(c, 0.3, 0.3, 0.4, 0.4, '#444'); },
    'patch-tl':     function (c) { rect(c, 0.1, 0.1, 0.3, 0.3); },
    'patch-tr':     function (c) { rect(c, 0.6, 0.1, 0.3, 0.3); },
    'patch-bl':     function (c) { rect(c, 0.1, 0.6, 0.3, 0.3); },
    'patch-br':     function (c) { rect(c, 0.6, 0.6, 0.3, 0.3); },

    // Single lines
    'line-h':    function (c) { line(c, 0.1, 0.5, 0.9, 0.5); },
    'line-v':    function (c) { line(c, 0.5, 0.1, 0.5, 0.9); },
    'line-up':   function (c) { line(c, 0.1, 0.9, 0.9, 0.1); },
    'line-down': function (c) { line(c, 0.1, 0.1, 0.9, 0.9); },
    'x':         function (c) { line(c, 0.1, 0.9, 0.9, 0.1); line(c, 0.1, 0.1, 0.9, 0.9); },

    // Parallel lines
    'lines-h2': function (c) { line(c, 0.1, 0.3, 0.9, 0.3); line(c, 0.1, 0.7, 0.9, 0.7); },
    'lines-h3': function (c) { line(c, 0.1, 0.2, 0.9, 0.2); line(c, 0.1, 0.5, 0.9, 0.5); line(c, 0.1, 0.8, 0.9, 0.8); },
    'lines-v2': function (c) { line(c, 0.3, 0.1, 0.3, 0.9); line(c, 0.7, 0.1, 0.7, 0.9); },
    'lines-v3': function (c) { line(c, 0.2, 0.1, 0.2, 0.9); line(c, 0.5, 0.1, 0.5, 0.9); line(c, 0.8, 0.1, 0.8, 0.9); },

    // Shapes
    'square':         function (c) { rect(c, 0.2, 0.2, 0.6, 0.6); },
    'square-small':   function (c) { rect(c, 0.36, 0.36, 0.28, 0.28); },
    'square-outline': function (c) { c.strokeStyle = '#fff'; c.lineWidth = W; c.strokeRect(0.2 + W / 2, 0.2 + W / 2, 0.6 - W, 0.6 - W); },
    'circle':         function (c) { disc(c, 0.5, 0.5, 0.3); },
    'circle-small':   function (c) { disc(c, 0.5, 0.5, 0.14); },
    'circle-outline': function (c) { ring(c, 0.5, 0.5, 0.3 - W / 2); },
    'triangle':       function (c) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0.5, 0.18); c.lineTo(0.85, 0.82); c.lineTo(0.15, 0.82); c.closePath(); c.fill(); },
    'cross':          function (c) { rect(c, 0.4, 0.15, 0.2, 0.7); rect(c, 0.15, 0.4, 0.7, 0.2); }
  };

  function blankCanvas() {
    var S = CONFIG.resolution, canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    var c = canvas.getContext('2d');
    c.fillStyle = '#000';
    c.fillRect(0, 0, S, S);
    return canvas;
  }

  /*
   * Draws a stimulus onto a new resolution x resolution canvas.
   * spec: a SHAPES name, an image path, or a function (ctx, sizeInPixels)
   * that draws in pixel coordinates. Returns a Promise for the canvas.
   */
  function render(spec) {
    var S = CONFIG.resolution, canvas = blankCanvas(), c = canvas.getContext('2d');

    if (typeof spec === 'function') { spec(c, S); return Promise.resolve(canvas); }

    if (SHAPES[spec]) {
      c.save(); c.scale(S, S); SHAPES[spec](c); c.restore();
      return Promise.resolve(canvas);
    }

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        // Fit the whole image inside the square, keeping its proportions.
        var s = Math.min(S / img.width, S / img.height);
        var w = img.width * s, h = img.height * s;
        c.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        resolve(canvas);
      };
      img.onerror = function () { reject(new Error('Could not load stimulus "' + spec + '"')); };
      img.src = spec;
    });
  }

  return { SHAPES: SHAPES, render: render };
})();
