// Real weather ambience recordings (see public/sounds/CREDITS.md)
const VOLUME = 0.15;
const FADE_MS = 1200;

const src = (name) => `${process.env.PUBLIC_URL}/sounds/${name}.ogg`;

// file + relative loudness for each scene
const SOUNDS = {
  "clear-day": { file: "birds", level: 1 },
  "clear-night": { file: "crickets", level: 0.7 },
  clouds: { file: "wind", level: 0.6 },
  rain: { file: "rain", level: 1 },
  thunder: { file: "thunder", level: 1 },
  snow: { file: "wind", level: 0.4 },
  mist: { file: "wind", level: 0.35 },
};

let current = null; // { audio, timer }

const fade = (audio, to, done) => {
  const from = audio.volume;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / FADE_MS, 1);
    audio.volume = from + (to - from) * t;
    if (t < 1) audio._fade = requestAnimationFrame(step);
    else if (done) done();
  };
  cancelAnimationFrame(audio._fade);
  audio._fade = requestAnimationFrame(step);
};

export const playWeatherSound = (condition, isNight) => {
  const key = condition === "clear" ? `clear-${isNight ? "night" : "day"}` : condition;
  const sound = SOUNDS[key];
  if (!sound) return stopWeatherSound();

  // Same recording already playing: just adjust the volume
  if (current && current.file === sound.file) {
    fade(current.audio, VOLUME * sound.level);
    return;
  }

  stopWeatherSound();
  const audio = new Audio(src(sound.file));
  audio.loop = true;
  audio.volume = 0;
  audio.play().catch(() => {}); // blocked until the user interacts with the page
  fade(audio, VOLUME * sound.level);
  current = { audio, file: sound.file };
};

export const stopWeatherSound = () => {
  if (!current) return;
  const { audio } = current;
  current = null;
  fade(audio, 0, () => {
    audio.pause();
    audio.src = "";
  });
};
