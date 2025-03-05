import React, { useState, useEffect, useRef, useCallback } from 'react';
import Vex from 'vexflow';
import './App.css';

const VF = Vex.Flow;

const notationData = {
  Brazil: {
    name: "Brazil (Do-Re-Mi-Fa-Sol-La-Si)",
    notation: ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"],
  },
  "United States": {
    name: "United States (A-B-C-D-E-F-G)",
    notation: ["C", "D", "E", "F", "G", "A", "B"],
  }
};

const clefData = {
  treble: "Treble Clef",
  bass: "Bass Clef",
  alto: "Alto Clef"
};

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;

function App() {
  const [score, setScore] = useState(0);
  const [currentNote, setCurrentNote] = useState('');
  const [notation, setNotation] = useState('Brazil');
  const [clef, setClef] = useState('treble');
  const [lowNote, setLowNote] = useState('G/3');
  const [highNote, setHighNote] = useState('G/6');
  const staffRef = useRef(null);
  const rangeStaffRef = useRef(null);

  const generateRandomNote = useCallback(() => {
    const [lowPitch, lowOctave] = lowNote.split('/');
    const [highPitch, highOctave] = highNote.split('/');
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const lowIndex = pitches.indexOf(lowPitch) + (parseInt(lowOctave) * 7);
    const highIndex = pitches.indexOf(highPitch) + (parseInt(highOctave) * 7);
    const randomIndex = Math.floor(Math.random() * (highIndex - lowIndex + 1)) + lowIndex;
    const pitch = pitches[randomIndex % 7];
    const octave = Math.floor(randomIndex / 7);
    return `${pitch}/${octave}`;
  }, [lowNote, highNote]);

  const setup = useCallback(() => {
    if (!staffRef.current) return null;
    staffRef.current.innerHTML = '';
    const renderer = new VF.Renderer(staffRef.current, VF.Renderer.Backends.SVG);
    renderer.resize(600, 250);
    const context = renderer.getContext();
    const stave = new VF.Stave(10, 40, 580);
    stave.addClef(clef);
    stave.setContext(context).draw();
    return { context, stave };
  }, [clef]);

  const drawNote = useCallback((context, stave, noteName) => {
    if (!context || !stave) return;
    context.clear();
    stave.setContext(context).draw();
    const note = new VF.StaveNote({ clef, keys: [noteName], duration: 'w' });
    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables([note]);
    new VF.Formatter().joinVoices([voice]).format([voice], 550);
    voice.draw(context, stave);
  }, [clef]);

  const newRound = useCallback(() => {
    const setupResult = setup();
    if (!setupResult) return;
    const { context, stave } = setupResult;
    const newNote = generateRandomNote();
    setCurrentNote(newNote);
    drawNote(context, stave, newNote);
  }, [setup, generateRandomNote, drawNote]);

  const checkAnswer = (selectedNote) => {
    const [pitch] = currentNote.split('/');
    const correctNote = notationData[notation].notation[['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(pitch)];
    const button = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === selectedNote);

    if (selectedNote === correctNote) {
      setScore(prevScore => prevScore + 1);
      button.classList.add('correct');
      setTimeout(() => {
        button.classList.remove('correct');
        newRound();
      }, 300);
    } else {
      setScore(0);
      button.classList.add('incorrect');
      setTimeout(() => {
        button.classList.remove('incorrect');
      }, 300);
    }
  };

  const setupRangeStaff = useCallback(() => {
    if (!rangeStaffRef.current) return null;
    rangeStaffRef.current.innerHTML = '';
    const renderer = new VF.Renderer(rangeStaffRef.current, VF.Renderer.Backends.SVG);
    renderer.resize(600, 350);
    const context = renderer.getContext();
    const stave = new VF.Stave(10, 40, 580);
    stave.addClef(clef);
    stave.setContext(context).draw();
    return { context, stave };
  }, [clef]);

  const drawRangeNotes = useCallback(() => {
    const setupResult = setupRangeStaff();
    if (!setupResult) return;
    const { context, stave } = setupResult;

    const [lowPitch, lowOctave] = lowNote.split('/');
    const [highPitch, highOctave] = highNote.split('/');
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const lowIndex = pitches.indexOf(lowPitch) + (parseInt(lowOctave) * 7);
    const highIndex = pitches.indexOf(highPitch) + (parseInt(highOctave) * 7);

    const visibleNotes = [];
    for (let i = lowIndex; i <= highIndex; i++) {
      const pitch = pitches[i % 7];
      const octave = Math.floor(i / 7);
      visibleNotes.push(`${pitch}/${octave}`);
    }

    const staveNotes = visibleNotes.map(noteName => {
      return new VF.StaveNote({ clef, keys: [noteName], duration: 'q' });
    });

    const voice = new VF.Voice({ num_beats: staveNotes.length, beat_value: 4 });
    voice.addTickables(staveNotes);
    new VF.Formatter().joinVoices([voice]).format([voice], 550);
    voice.draw(context, stave);

    staveNotes.forEach((note, index) => {
      const noteName = visibleNotes[index];
      if (noteName === lowNote || noteName === highNote) {
        note.setStyle({ fillStyle: '#318CE7', strokeStyle: '#318CE7' });
      } else {
        note.setStyle({ fillStyle: 'black', strokeStyle: 'black' });
      }
      note.draw();
    });
  }, [clef, lowNote, highNote, setupRangeStaff]);

  useEffect(() => {
    drawRangeNotes();
  }, [drawRangeNotes]);

  useEffect(() => {
    newRound();
  }, [newRound]);

  const moveNote = (isLow, direction) => {
    const [pitch, octave] = isLow ? lowNote.split('/') : highNote.split('/');
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let pitchIndex = pitches.indexOf(pitch);
    let octaveNum = parseInt(octave);

    if (direction === 'up') {
      if (isLow || octaveNum < MAX_OCTAVE || (octaveNum === MAX_OCTAVE && pitchIndex < 6)) {
        pitchIndex++;
        if (pitchIndex > 6) {
          pitchIndex = 0;
          octaveNum++;
        }
      }
    } else {
      if (!isLow || octaveNum > MIN_OCTAVE || (octaveNum === MIN_OCTAVE && pitchIndex > 0)) {
        pitchIndex--;
        if (pitchIndex < 0) {
          pitchIndex = 6;
          octaveNum--;
        }
      }
    }

    octaveNum = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octaveNum));
    const newNote = `${pitches[pitchIndex]}/${octaveNum}`;

    if (isLow) {
      if (octaveNum < parseInt(highNote.split('/')[1]) || (octaveNum === parseInt(highNote.split('/')[1]) && pitchIndex < pitches.indexOf(highNote.split('/')[0]))) {
        setLowNote(newNote);
      }
    } else {
      if (octaveNum > parseInt(lowNote.split('/')[1]) || (octaveNum === parseInt(lowNote.split('/')[1]) && pitchIndex > pitches.indexOf(lowNote.split('/')[0]))) {
        setHighNote(newNote);
      }
    }
  };

  return (
    <div className="App">
      <h1>Solfeggio Training</h1>
      <div id="score">Score: {score}</div>
      <div ref={staffRef}></div>
      <div id="buttons">
        {notationData[notation].notation.map(note => (
          <button key={note} onClick={() => checkAnswer(note)}>{note}</button>
        ))}
      </div>
      <div id="options">
        <select value={notation} onChange={(e) => setNotation(e.target.value)}>
          {Object.entries(notationData).map(([key, data]) => (
            <option key={key} value={key}>{data.name}</option>
          ))}
        </select>
        <select value={clef} onChange={(e) => setClef(e.target.value)}>
          {Object.entries(clefData).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
      </div>
      <div>
        <p>Adjust note range:</p>
        <div>
          <button onClick={() => moveNote(true, 'down')}>↓ Low</button>
          <button onClick={() => moveNote(true, 'up')}>↑ Low</button>
          <button onClick={() => moveNote(false, 'down')}>↓ High</button>
          <button onClick={() => moveNote(false, 'up')}>↑ High</button>
        </div>
        <div ref={rangeStaffRef}></div>
      </div>
    </div>
  );
}

export default App;
