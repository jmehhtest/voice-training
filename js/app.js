/*
 * app.js — screens (home, level, acuity test), progress saving.
 * Levels and settings live in js/levels.js; the sound maths in js/voice.js.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'voiceTraining.v1';
  var app = document.getElementById('app');
  var save = loadSave();
  var audioCtx = null;
  var currentSource = null;
  var screenToken = 0;     // changes on every screen change; stale async work checks it
  var keyHandler = null;

  /* ---------------- Saved progress ---------------- */

  function blankSave() {
    return { app: 'voice-training', version: 1, levels: {}, acuity: { best: null, history: [] } };
  }
  function validSave(s) {
    return s && s.app === 'voice-training' && typeof s.levels === 'object' && s.acuity &&
      Array.isArray(s.acuity.history);
  }
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (validSave(s)) return s;
    } catch (e) { /* no storage or bad data: start fresh */ }
    return blankSave();
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  function bestStars(level) {
    var rec = save.levels[level.id];
    return rec ? rec.stars : 0;
  }
  function played(level) { return !!save.levels[level.id]; }
  function unlocked(index) {
    if (index === 0 || !CONFIG.starsToUnlock) return true;
    return bestStars(LEVELS[index - 1]) >= CONFIG.starsToUnlock;
  }

  /* ---------------- Sound ---------------- */

  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function stopSound() {
    if (currentSource) { try { currentSource.stop(); } catch (e) { /* already stopped */ } }
    currentSource = null;
  }
  function soundscape(canvas) {
    var opts = {}, k;
    for (k in CONFIG.sound) opts[k] = CONFIG.sound[k];
    opts.sampleRate = ctx().sampleRate;
    return Voice.toAudioBuffer(ctx(), Voice.synthesize(Voice.gridFromCanvas(canvas), opts));
  }
  function playBuffer(buffer) {
    stopSound();
    currentSource = Voice.play(ctx(), buffer);
  }
  function tone(type, freq, dur, vol, delay) {
    var c = ctx(), t = c.currentTime + (delay || 0);
    var osc = c.createOscillator(), gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + dur);
  }
  function ding() { tone('sine', 1047, 0.45, 0.3); tone('sine', 1568, 0.5, 0.25, 0.09); }
  function buzzer() { tone('sawtooth', 110, 0.4, 0.22); tone('sawtooth', 116, 0.4, 0.22); }

  /* ---------------- Small helpers ---------------- */

  function $(sel) { return app.querySelector(sel); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function starsHtml(n) {
    return '<span class="stars" aria-label="' + n + ' of 3 stars">' +
      '<span class="on">' + '★'.repeat(n) + '</span>' + '★'.repeat(3 - n) + '</span>';
  }
  /* Call at the start of every screen. Returns this screen's token. */
  function newScreen() {
    stopSound();
    keyHandler = null;
    document.body.className = '';
    window.scrollTo(0, 0);
    return ++screenToken;
  }
  function feedback(correct) {
    stopSound();
    document.body.className = correct ? 'correct' : 'wrong';
    if (correct) ding(); else buzzer();
  }
  function showError(message) {
    newScreen();
    app.innerHTML = '<div class="card"><h2>Something went wrong</h2><p>' + esc(message) + '</p>' +
      '<p class="hint">If this level uses image files, the app must be opened from a web server ' +
      '(GitHub Pages, or <code>python3 -m http.server</code>), not by double-clicking index.html.</p>' +
      '<button id="back" class="primary">Home</button></div>';
    $('#back').onclick = home;
  }

  document.addEventListener('keydown', function (e) {
    if (keyHandler) keyHandler(e);
  });

  /* ---------------- Home ---------------- */

  function home() {
    newScreen();
    var best = save.acuity.best;
    app.innerHTML =
      '<header><h1>vOICe Training</h1>' +
      '<p class="sub">Learn to see with sound. Headphones recommended.</p></header>' +

      '<section class="card acuity">' +
        '<div><div class="label">Best acuity</div>' +
        '<div class="big">' + (best ? '20/' + best.snellen : '—') + '</div>' +
        '<div class="hint">' + (best ? 'Smallest E read: ' + best.size + ' px tall'
                                     : 'Not tested yet') + '</div></div>' +
        '<button id="acuity" class="primary">Take acuity test</button>' +
      '</section>' +

      '<details class="card"><summary>How the sound works</summary>' +
        '<p>Each image is scanned from left to right in about one second. ' +
        '<b>Left–right</b> position becomes <b>time</b> (and moves from your left ear to your right), ' +
        '<b>height</b> becomes <b>pitch</b>, and <b>brightness</b> becomes <b>loudness</b>. ' +
        'A short click marks the start of each scan.</p>' +
        '<div class="demos" id="demos"></div>' +
      '</details>' +

      '<h2>Levels</h2><div class="grid" id="grid"></div>' +

      '<footer>' +
        '<button id="export">Save progress to file</button>' +
        '<button id="import">Load progress from file</button>' +
        '<button id="reset">Reset progress</button>' +
        '<input type="file" id="file" accept=".json,application/json" hidden>' +
        '<p class="hint" id="status">Progress is stored in this browser.</p>' +
      '</footer>';

    $('#acuity').onclick = acuityIntro;

    // Demo sounds
    [['line-up', 'Rising line'], ['line-h', 'Flat line'], ['x', 'An X']].forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'demo';
      Stimuli.render(d[0]).then(function (canvas) {
        b.appendChild(canvas);
        b.appendChild(document.createTextNode('▶ ' + d[1]));
        b.onclick = function () { playBuffer(soundscape(canvas)); };
      });
      $('#demos').appendChild(b);
    });

    // Level grid
    LEVELS.forEach(function (level, i) {
      var open = unlocked(i);
      var b = document.createElement('button');
      b.className = 'level' + (open ? '' : ' locked');
      b.disabled = !open;
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="thumb"></span>' +
        '<span class="title">' + esc(level.title) + '</span>' +
        (open ? starsHtml(bestStars(level)) : '<span class="lock">Locked</span>');
      var thumbSpec = level.thumb || (level.stimuli ? level.stimuli[0] : level.trials[0].target);
      Stimuli.render(thumbSpec).then(function (canvas) {
        b.querySelector('.thumb').appendChild(canvas);
      }, function () { /* missing thumbnail: leave blank */ });
      b.onclick = function () { playLevel(level); };
      $('#grid').appendChild(b);
    });

    // Save / load / reset
    $('#export').onclick = function () {
      var blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'voice-training-progress.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    $('#import').onclick = function () { $('#file').click(); };
    $('#file').onchange = function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var s = null;
        try { s = JSON.parse(reader.result); } catch (e) { /* handled below */ }
        if (!validSave(s)) { $('#status').textContent = 'That file is not a vOICe Training progress file.'; return; }
        save = s; persist(); home();
        $('#status').textContent = 'Progress loaded from ' + file.name + '.';
      };
      reader.readAsText(file);
    };
    var armed = false;
    $('#reset').onclick = function () {
      if (!armed) { armed = true; this.textContent = 'Click again to erase everything'; return; }
      save = blankSave(); persist(); home();
    };
  }

  /* ---------------- Training level ---------------- */

  function buildTrials(level) {
    if (Array.isArray(level.trials)) {
      return level.trials.map(function (t) {
        return { target: t.target, options: shuffle([t.target].concat(t.distractors)) };
      });
    }
    var count = level.trials || CONFIG.trialsPerLevel;
    var nChoices = Math.min(level.choices || 2, level.stimuli.length);
    var targets = [], trials = [];
    while (targets.length < count) targets = targets.concat(shuffle(level.stimuli));
    targets.slice(0, count).forEach(function (target) {
      var others = shuffle(level.stimuli.filter(function (s) { return s !== target; }));
      trials.push({ target: target, options: shuffle([target].concat(others.slice(0, nChoices - 1))) });
    });
    return trials;
  }

  async function playLevel(level) {
    var token = newScreen();
    var trials = buildTrials(level), mistakes = 0;

    for (var t = 0; t < trials.length; t++) {
      var trial = trials[t];
      document.body.className = '';
      app.innerHTML =
        '<div class="topbar"><button id="quit">← Home</button>' +
        '<span>' + esc(level.title) + '</span><span>' + (t + 1) + ' / ' + trials.length + '</span></div>' +
        '<p class="prompt">Which image matches the sound?</p>' +
        '<button id="replay" class="primary">▶ Play again</button>' +
        '<div class="choices n' + trial.options.length + '" id="choices"></div>';
      $('#quit').onclick = home;

      var canvases, buffer;
      try {
        canvases = await Promise.all(trial.options.map(Stimuli.render));
        if (token !== screenToken) return;
        buffer = soundscape(canvases[trial.options.indexOf(trial.target)]);
      } catch (e) {
        if (token === screenToken) showError(e.message);
        return;
      }

      var buttons = canvases.map(function (canvas, i) {
        var b = document.createElement('button');
        b.className = 'choice';
        b.setAttribute('aria-label', 'Choice ' + (i + 1));
        b.appendChild(canvas);
        $('#choices').appendChild(b);
        return b;
      });
      $('#replay').onclick = function () { playBuffer(buffer); };
      playBuffer(buffer);

      var picked = await new Promise(function (resolve) {
        buttons.forEach(function (b, i) { b.onclick = function () { resolve(i); }; });
        keyHandler = function (e) {
          var n = parseInt(e.key, 10);
          if (n >= 1 && n <= buttons.length) resolve(n - 1);
          else if (e.key === ' ') { e.preventDefault(); playBuffer(buffer); }
        };
      });
      if (token !== screenToken) return;
      keyHandler = null;

      var correctIndex = trial.options.indexOf(trial.target);
      var correct = picked === correctIndex;
      if (!correct) mistakes++;
      buttons.forEach(function (b) { b.disabled = true; });
      buttons[correctIndex].classList.add('right');
      if (!correct) buttons[picked].classList.add('wrong');
      feedback(correct);
      await sleep(1100);
      if (token !== screenToken) return;
    }

    // Results: three stars, one lost per wrong answer.
    var stars = Math.max(0, 3 - mistakes);
    var previous = bestStars(level), first = !played(level);
    save.levels[level.id] = {
      stars: Math.max(previous, stars),
      plays: (save.levels[level.id] ? save.levels[level.id].plays : 0) + 1
    };
    persist();

    newScreen();
    var index = LEVELS.indexOf(level), next = LEVELS[index + 1];
    app.innerHTML =
      '<div class="card result"><h2>' + esc(level.title) + '</h2>' +
      '<div class="bigstars">' + starsHtml(stars) + '</div>' +
      '<p>' + (trials.length - mistakes) + ' of ' + trials.length + ' correct' +
      (!first && stars > previous ? ' — new best!' : '') + '</p>' +
      '<div class="row"><button id="again">Try again</button>' +
      (next && unlocked(index + 1) ? '<button id="next" class="primary">Next level</button>' : '') +
      '<button id="home"' + (next && unlocked(index + 1) ? '' : ' class="primary"') + '>Home</button></div></div>';
    $('#again').onclick = function () { playLevel(level); };
    $('#home').onclick = home;
    if ($('#next')) $('#next').onclick = function () { playLevel(next); };
  }

  /* ---------------- Acuity test (tumbling E) ---------------- */

  var DIRECTIONS = ['up', 'right', 'down', 'left'];

  /* Draws a Snellen E (5 x 5 units) of the given pixel height, centred. */
  function drawE(size, direction) {
    return function (c, S) {
      var u = size / 5, off = Math.floor((S - size) / 2), r, col;
      c.fillStyle = '#fff';
      for (r = 0; r < 5; r++) {
        for (col = 0; col < 5; col++) {
          var on = direction === 'right' ? (col === 0 || r % 2 === 0)
                 : direction === 'left'  ? (col === 4 || r % 2 === 0)
                 : direction === 'down'  ? (r === 0 || col % 2 === 0)
                 :                         (r === 4 || col % 2 === 0);
          if (on) c.fillRect(Math.round(off + col * u), Math.round(off + r * u), Math.ceil(u), Math.ceil(u));
        }
      }
    };
  }

  /* Snellen denominator: 20/20 means a stroke width of 1 arc minute. */
  function snellen(size) {
    var arcminPerPixel = CONFIG.fieldOfViewDeg * 60 / CONFIG.resolution;
    return Math.round(20 * (size / 5) * arcminPerPixel);
  }

  function acuityIntro() {
    newScreen();
    app.innerHTML =
      '<div class="topbar"><button id="quit">← Home</button><span>Acuity test</span><span></span></div>' +
      '<div class="card"><h2>Tumbling E test</h2>' +
      '<p>You will hear the letter E pointing up, down, left or right. ' +
      'Choose the direction its three prongs point. The E gets smaller each time you pass a size, ' +
      'and the test ends when it becomes too small to tell.</p>' +
      '<div class="demos" id="demos"></div>' +
      '<p class="hint">You need ' + CONFIG.acuityPassMark + ' of ' + CONFIG.acuityTrialsPerSize +
      ' correct to pass each size. Arrow keys work too; space replays the sound.</p>' +
      '<button id="start" class="primary">Start</button></div>';
    $('#quit').onclick = home;
    $('#start').onclick = acuityTest;
    DIRECTIONS.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'demo';
      Stimuli.render(drawE(CONFIG.acuitySizes[0], d)).then(function (canvas) {
        b.appendChild(canvas);
        b.appendChild(document.createTextNode('▶ ' + d));
        b.onclick = function () { playBuffer(soundscape(canvas)); };
      });
      $('#demos').appendChild(b);
    });
  }

  async function acuityTest() {
    var token = newScreen();
    var sizes = CONFIG.acuitySizes, perSize = CONFIG.acuityTrialsPerSize, pass = CONFIG.acuityPassMark;
    var passedSize = null;

    // Big, clear E pictures for the four answer buttons.
    var icons = {};
    for (var d = 0; d < 4; d++) icons[DIRECTIONS[d]] = await Stimuli.render(drawE(40, DIRECTIONS[d]));
    if (token !== screenToken) return;

    for (var s = 0; s < sizes.length; s++) {
      var right = 0, wrong = 0;
      for (var k = 0; k < perSize; k++) {
        var answer = DIRECTIONS[Math.floor(Math.random() * 4)];
        var canvas = await Stimuli.render(drawE(sizes[s], answer));
        if (token !== screenToken) return;
        var buffer = soundscape(canvas);

        document.body.className = '';
        app.innerHTML =
          '<div class="topbar"><button id="quit">← Home</button><span>Acuity test</span>' +
          '<span>Size ' + (s + 1) + ' / ' + sizes.length + '</span></div>' +
          '<p class="prompt">Which way is the E pointing?</p>' +
          '<div class="pad">' +
            '<button class="choice" data-d="up" aria-label="Up"></button>' +
            '<button class="choice" data-d="left" aria-label="Left"></button>' +
            '<button id="replay" class="primary" aria-label="Play again">▶</button>' +
            '<button class="choice" data-d="right" aria-label="Right"></button>' +
            '<button class="choice" data-d="down" aria-label="Down"></button>' +
          '</div>';
        $('#quit').onclick = home;
        $('#replay').onclick = function () { playBuffer(buffer); };
        var buttons = {};
        Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (b) {
          buttons[b.dataset.d] = b;
          var icon = document.createElement('canvas');
          icon.width = icon.height = CONFIG.resolution;
          icon.getContext('2d').drawImage(icons[b.dataset.d], 0, 0);
          b.appendChild(icon);
        });
        playBuffer(buffer);

        var picked = await new Promise(function (resolve) {
          DIRECTIONS.forEach(function (dir) { buttons[dir].onclick = function () { resolve(dir); }; });
          keyHandler = function (e) {
            var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
            if (m) { e.preventDefault(); resolve(m); }
            else if (e.key === ' ') { e.preventDefault(); playBuffer(buffer); }
          };
        });
        if (token !== screenToken) return;
        keyHandler = null;

        var correct = picked === answer;
        if (correct) right++; else wrong++;
        DIRECTIONS.forEach(function (dir) { buttons[dir].disabled = true; });
        buttons[answer].classList.add('right');
        if (!correct) buttons[picked].classList.add('wrong');
        feedback(correct);
        await sleep(1000);
        if (token !== screenToken) return;

        // Stop this size early once the outcome is decided.
        if (right >= pass || wrong > perSize - pass) break;
      }
      if (right >= pass) passedSize = sizes[s]; else break;
    }

    // Result
    var result = passedSize ? { size: passedSize, snellen: snellen(passedSize), date: new Date().toISOString() } : null;
    var best = save.acuity.best, isBest = false;
    save.acuity.history.push(result || { size: null, snellen: null, date: new Date().toISOString() });
    if (result && (!best || result.snellen < best.snellen)) { save.acuity.best = result; isBest = true; }
    persist();

    newScreen();
    app.innerHTML =
      '<div class="card result"><h2>Acuity test</h2>' +
      (result
        ? '<div class="big">20/' + result.snellen + '</div>' +
          '<p>Smallest E read: ' + result.size + ' px tall' + (isBest ? ' — new best!' : '') + '</p>'
        : '<div class="big">—</div><p>The largest E was not read reliably this time. ' +
          'Try a few training levels and come back.</p>') +
      '<p class="hint">Score assumes the ' + CONFIG.resolution + '-pixel image spans a ' +
      CONFIG.fieldOfViewDeg + '° field of view. Lower is better; the smallest E in this test is 20/' +
      snellen(sizes[sizes.length - 1]) + '.</p>' +
      '<div class="row"><button id="again">Test again</button><button id="home" class="primary">Home</button></div></div>';
    $('#again').onclick = acuityTest;
    $('#home').onclick = home;
  }

  home();
})();
