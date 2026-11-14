/*
 * levels.js — EDIT THIS FILE to change the app's settings and levels.
 *
 * ---------------------------------------------------------------------
 * How a level works
 * ---------------------------------------------------------------------
 *   id       Unique number. Progress is saved under this id, so keep it
 *            the same if you only reorder or retitle a level.
 *   title    Shown on the home screen.
 *   choices  How many images to choose between (2 = 2-AFC, 4 = 4-AFC).
 *   stimuli  The pool of stimuli for the level. Each entry is either
 *              - a built-in shape name from js/stimuli.js ("line-h"), or
 *              - a path to an image file ("assets/objects/cup.png").
 *            Images are shrunk to CONFIG.resolution and turned to
 *            greyscale; bright pixels are loud, black is silent, so
 *            light-on-dark images work best.
 *   trials   (optional) Either a number of trials (default
 *            CONFIG.trialsPerLevel; targets and distractors are then
 *            drawn at random from the pool), or an explicit list:
 *              trials: [
 *                { target: "assets/a.png", distractors: ["assets/b.png"] },
 *                ...
 *              ]
 *            With an explicit list, "stimuli" and "choices" are not needed.
 *   thumb    (optional) Stimulus shown on the home screen. Defaults to
 *            the first stimulus.
 *
 * Levels appear on the home screen in the order they are listed here.
 * Scoring: 3 stars, minus one for every wrong answer.
 */

var CONFIG = {
  resolution: 64,      // image is resolution x resolution pixels (paper: 64)
  trialsPerLevel: 6,
  starsToUnlock: 1,    // stars needed on a level to unlock the next (0 = all open)

  // Acuity test (tumbling E)
  acuitySizes: [60, 50, 40, 30, 25, 20, 15, 10, 5], // E height in pixels, largest first
  acuityTrialsPerSize: 4,
  acuityPassMark: 3,   // correct answers needed to pass a size
  fieldOfViewDeg: 66,  // assumed field of view of the image, for the Snellen score

  // Overrides for the sound module — see DEFAULTS in js/voice.js
  sound: {
    // duration: 1.05,
    // stereo: true,
    // click: true
  }
};

var LEVELS = [
  { id: 1, title: 'Left or right?', choices: 2,
    stimuli: ['patch-left', 'patch-right'] },

  { id: 2, title: 'High or low?', choices: 2,
    stimuli: ['patch-top', 'patch-bottom'] },

  { id: 3, title: 'Bright or dim?', choices: 2,
    stimuli: ['patch-bright', 'patch-dim'] },

  { id: 4, title: 'Flat or upright line?', choices: 2,
    stimuli: ['line-h', 'line-v'] },

  { id: 5, title: 'Rising or falling line?', choices: 2,
    stimuli: ['line-up', 'line-down'] },

  { id: 6, title: 'Line orientation', choices: 4, thumb: 'line-down',
    stimuli: ['line-h', 'line-v', 'line-up', 'line-down'] },

  { id: 7, title: 'Where is the patch?', choices: 4,
    stimuli: ['patch-tl', 'patch-tr', 'patch-bl', 'patch-br'] },

  { id: 8, title: 'Parallel lines', choices: 4,
    stimuli: ['lines-h2', 'lines-h3', 'lines-v2', 'lines-v3'] },

  { id: 9, title: 'Shapes and sizes', choices: 4, trials: 8,
    stimuli: ['square', 'circle', 'triangle', 'cross',
              'square-small', 'circle-small', 'square-outline', 'circle-outline'] },

  // Example of a level built from image files.
  { id: 10, title: 'Everyday objects', choices: 4, trials: 8,
    stimuli: ['assets/objects/cup.png', 'assets/objects/house.png',
              'assets/objects/tree.png', 'assets/objects/chair.png',
              'assets/objects/bottle.png', 'assets/objects/table.png'] }
];
