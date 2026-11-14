# vOICe Training — web demo

A browser version of the vOICe training app described in *App-Based Training
and Gamification for Sensory Substitution Devices*. Images are turned into
one-second "soundscapes" and the player picks the image that matches the sound.

This is a demo: nothing is sent anywhere. Progress is kept in the browser
(localStorage) and can be saved to / loaded from a JSON file on the home screen.

## Run it

It is a plain static site: no build step, no dependencies.

    python3 -m http.server 8000     # then open http://localhost:8000

Double-clicking `index.html` also works for the built-in shape levels, but
levels that use image files need a web server (browsers block reading image
pixels from `file://`).

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Repository **Settings → Pages → Build and deployment**: Source
   "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`.

All paths are relative, so it works from any sub-path. `.nojekyll` tells
Pages to serve the files as they are.

## Files

    index.html
    css/style.css
    js/levels.js     <- settings and the list of levels: edit this
    js/stimuli.js    built-in shapes (lines, patches, shapes); image loading
    js/voice.js      the sound module (image -> soundscape), standalone
    js/app.js        screens, scoring, saving
    assets/objects/  example image stimuli (level 10)

## Editing levels

Everything is in `js/levels.js`. A level looks like this:

```js
{ id: 11, title: 'Fruit', choices: 4,
  stimuli: ['assets/fruit/apple.png', 'assets/fruit/banana.png',
            'assets/fruit/pear.png',  'assets/fruit/grapes.png'] }
```

- `id` — unique number; saved progress is stored under it.
- `choices` — 2 for 2-AFC, 4 for 4-AFC.
- `stimuli` — the pool. Each entry is a built-in shape name (see
  `js/stimuli.js`) or a path to an image. On each trial one is the target and
  the others are drawn at random as distractors.
- `trials` — optional. A number of trials, or an explicit list when you want
  to fix every trial:

```js
{ id: 12, title: 'Hand-made trials',
  trials: [
    { target: 'assets/a.png', distractors: ['assets/b.png'] },
    { target: 'line-h',       distractors: ['line-v', 'line-up', 'line-down'] }
  ] }
```

- `thumb` — optional stimulus shown on the home screen.

Levels are shown in the order listed. Images are shrunk to 64 × 64 greyscale;
bright is loud and black is silent, so use light shapes on a black background.

Scoring follows the paper: three stars, minus one per wrong answer. A level
unlocks when the one before it has at least `CONFIG.starsToUnlock` stars
(set to 0 to open everything).

## The sound module

`js/voice.js` implements the mapping of Meijer (1992), *An experimental system
for auditory image representations*, IEEE Trans. Biomed. Eng. 39(2):

| Image                  | Sound                                        |
|------------------------|----------------------------------------------|
| column (left to right) | time: N columns scanned in T = 1.05 s        |
| row (bottom to top)    | pitch: one sine oscillator per row, 500 Hz – 5 kHz, exponentially spaced |
| brightness (16 levels) | amplitude of that row's oscillator           |
| start of image         | a click                                      |

Two additions are not in the 1992 paper and can be turned off: left-to-right
stereo panning (as in the later vOICe software), and a 1.5 ms smoothing of
amplitude changes between columns to avoid crackle.

It works on any brightness grid, independent of the app:

```js
// grid: array of rows (top first), each an array of values 0..1
const sound  = Voice.synthesize(grid, { duration: 1.05, stereo: false });
const buffer = Voice.toAudioBuffer(audioContext, sound);
Voice.play(audioContext, buffer);

Voice.gridFromImage(imgElement, 64, 64);  // grid from an image/canvas/video
Voice.toWav(sound);                        // ArrayBuffer of a .wav file
```

Options and defaults are at the top of the file; app-wide overrides go in
`CONFIG.sound` in `js/levels.js`.

## Acuity test

A tumbling-E test, available from the home screen at any time. The E starts
at 60 px tall and shrinks to 5 px (one-pixel strokes); each size needs 3 of 4
correct. The score is given as a Snellen fraction assuming the 64-pixel image
spans a 66° field of view (`CONFIG.fieldOfViewDeg`), so the smallest E is
about 20/1238. That is the limit of a 64 × 64 image, not of the listener.
