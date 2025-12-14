/*
 Complete MIDI Player (Browser) - Final Fix
 --------------------------------------------------
 Features:
 - Tone.js + @tonejs/midi
 - Dozens of instruments (SoundFont mp3)
 - Fixed: Sharp (#) to Flat (b) conversion for filenames
 - Full note map (A0 ~ C8)
 - Instrument switching with proper dispose
*/

import { Midi } from "https://esm.sh/@tonejs/midi@2.0.28";

// --------------------------------------------------
// SoundFont base URLs (gleitz / midi-js-soundfonts)
// --------------------------------------------------
export const INSTRUMENT_BASE_URLS = {
  acoustic_grand_piano: "https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-mp3/",
  electric_piano_1: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_piano_1-mp3/",
  harpsichord: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/harpsichord-mp3/",

  acoustic_guitar_nylon: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_nylon-mp3/",
  acoustic_guitar_steel: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_steel-mp3/",
  electric_guitar_clean: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_clean-mp3/",

  acoustic_bass: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_bass-mp3/",
  electric_bass_finger: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_bass_finger-mp3/",

  violin: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/violin-mp3/",
  cello: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/cello-mp3/",
  string_ensemble_1: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/string_ensemble_1-mp3/",

  trumpet: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trumpet-mp3/",
  trombone: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trombone-mp3/",

  flute: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/flute-mp3/",
  clarinet: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/clarinet-mp3/",

  choir_aahs: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/choir_aahs-mp3/",
  synth_strings_1: "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_strings_1-mp3/"
};

// --------------------------------------------------
// Full note map A0 ~ C8 (Fixed: Sharps -> Flats)
// --------------------------------------------------
export const NOTE_MAP = (() => {
  const notes = {};
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  // 檔名對照表：將升記號轉為降記號
  // 因為 gleitz 資料庫只有 Db, Eb, Gb... 沒有 C#, D#, F#
  const SHARP_TO_FLAT = {
    "C#": "Db",
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb"
  };

  for (let octave = 0; octave <= 8; octave++) {
    for (let i = 0; i < 12; i++) {
      // 1. 範圍修正：標準鋼琴範圍是 A0 (21) ~ C8 (108)
      if (octave === 0 && i < 9) continue; // Skip C0 ~ G#0
      if (octave === 8 && i > 0) continue; // Skip C#8 ~ B8

      const noteName = NAMES[i];      // 例如: "C#"
      const fullNote = `${noteName}${octave}`; // 例如: "C#4"
      
      let fileName = fullNote;

      // 2. 檔名修正：如果是升記號，轉成降記號檔名
      if (noteName.includes("#")) {
        fileName = `${SHARP_TO_FLAT[noteName]}${octave}`; // C#4 -> Db4
      }

      // 3. 設定對應
      // Key 必須維持 "C#4" (因為 MIDI 檔案解析出來是 Sharps)
      // Value 設定為 "Db4.mp3" (實際存在的檔案)
      notes[fullNote] = fileName + ".mp3";
    }
  }

  return notes;
})();

// --------------------------------------------------
// Global audio state
// --------------------------------------------------
let sampler = null;
let currentPart = null;
let midiDuration = 0;

// Shared effects
const reverb = new Tone.Reverb({
  decay: 1.2,
  wet: 0.2
}).toDestination();

// --------------------------------------------------
// Instrument handling
// --------------------------------------------------
export async function loadInstrument(name) {
  if (!INSTRUMENT_BASE_URLS[name]) {
    throw new Error(`Unknown instrument: ${name}`);
  }

  if (sampler) {
    sampler.disconnect();
    sampler.dispose();
    sampler = null;
  }

  await Tone.start();

  return new Promise((resolve) => {
    sampler = new Tone.Sampler({
      urls: NOTE_MAP,
      baseUrl: INSTRUMENT_BASE_URLS[name],
      release: 1,
      onload: () => {
        resolve();
      }
    }).connect(reverb);
  });
}

// --------------------------------------------------
// MIDI loading & playback
// --------------------------------------------------
export async function loadAndPlayMIDI(arrayBuffer, trackIndex = 0) {
  await Tone.start();

  if (!sampler || !sampler.loaded) {
    throw new Error("Instrument not loaded yet");
  }

  const midi = new Midi(arrayBuffer);
  
  // 尋找音符最多的軌道
  let targetTrack = midi.tracks[trackIndex];
  if (!targetTrack || targetTrack.notes.length === 0) {
     targetTrack = midi.tracks.reduce((prev, current) => 
        (prev.notes.length > current.notes.length) ? prev : current
     , midi.tracks[0]);
  }

  if (!targetTrack) throw new Error("No playable track found");

  if (currentPart) {
    currentPart.dispose();
    currentPart = null;
  }

  midiDuration = midi.duration;

  currentPart = new Tone.Part((time, note) => {
    sampler.triggerAttackRelease(
      note.name,
      note.duration,
      time,
      note.velocity
    );
  }, targetTrack.notes).start(0);

  Tone.Transport.stop();
  Tone.Transport.seconds = 0;
  Tone.Transport.start();
}

// --------------------------------------------------
// Transport controls
// --------------------------------------------------
export function play() {
  Tone.Transport.start();
}

export function pause() {
  Tone.Transport.pause();
}

export function stop() {
  Tone.Transport.stop();
  Tone.Transport.seconds = 0;
}

export function seek(percent) {
  if (!midiDuration) return;
  Tone.Transport.seconds = midiDuration * percent;
}

export function getCurrentTime() {
  return Tone.Transport.seconds;
}

export function getDuration() {
  return midiDuration;
}

// --------------------------------------------------
// Utility
// --------------------------------------------------
export function listAvailableInstruments() {
  return Object.keys(INSTRUMENT_BASE_URLS);
}