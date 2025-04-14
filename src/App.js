import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Vex from 'vexflow';
import { useHotkeys } from 'react-hotkeys-hook';
import './App.css';

const VF = Vex.Flow;

const translations = {
  title: { Brazil: 'Treinamento de Solfejo', 'United States': 'Solfeggio Training' },
  scoreLabel: { Brazil: 'Pontuação:', 'United States': 'Score:' },
  configButtonOpen: { Brazil: 'Configurar Teclas', 'United States': 'Configure Hotkeys' },
  configButtonClose: { Brazil: 'Fechar Configuração', 'United States': 'Close Configuration' },
  configPanelTitle: { Brazil: 'Configurar Teclas de Atalho', 'United States': 'Configure Hotkeys' },
  configPrompt: { Brazil: 'Pressione a tecla para "{note}"... (ESC para cancelar)', 'United States': 'Press the key for "{note}"... (ESC to cancel)' },
  notDefined: { Brazil: 'N/D', 'United States': 'N/A' },
  changeButton: { Brazil: 'Alterar', 'United States': 'Change' },
  cancelButton: { Brazil: 'Cancelar', 'United States': 'Cancel' },
  clearButtonTooltip: { Brazil: 'Limpar Tecla', 'United States': 'Clear Hotkey' },
  alertKeyInUse: { Brazil: 'A tecla "{key}" já está atribuída à nota "{existingNote}". Removendo atribuição anterior.', 'United States': 'The key "{key}" is already assigned to the note "{existingNote}". Removing previous assignment.' },
  alertInvalidKey: { Brazil: 'Tecla inválida. Use letras, números, F1-F12, setas ou símbolos comuns.', 'United States': 'Invalid key. Use letters, numbers, F1-F12, arrow keys, or common symbols.' },
  adjustRange: { Brazil: 'Ajustar extensão das notas:', 'United States': 'Adjust note range:' },
  lowNoteDown: { Brazil: '↓ Grave', 'United States': '↓ Low' },
  lowNoteUp: { Brazil: '↑ Grave', 'United States': '↑ Low' },
  highNoteDown: { Brazil: '↓ Agudo', 'United States': '↓ High' },
  highNoteUp: { Brazil: '↑ Agudo', 'United States': '↑ High' },
  treble: { Brazil: 'Clave de Sol', 'United States': 'Treble Clef' },
  bass: { Brazil: 'Clave de Fá', 'United States': 'Bass Clef' },
  alto: { Brazil: 'Clave de Dó', 'United States': 'Alto Clef' },
  loadingFonts: { Brazil: 'Carregando fontes...', 'United States': 'Loading fonts...' },
};

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
const HOTKEY_STORAGE_KEY = 'solfeggio_hotkeys';

const getInitialHotkeyMappings = (notes) => {
  try {
    const savedMappings = localStorage.getItem(HOTKEY_STORAGE_KEY);
    if (savedMappings) {
      const parsed = JSON.parse(savedMappings);
      const currentMappings = {};
      if (Array.isArray(notes)) {
          notes.forEach(note => {
            currentMappings[note] = parsed[note] || null;
          });
      } else {
           console.warn("getInitialHotkeyMappings received non-array 'notes'");
      }
      return currentMappings;
    }
  } catch (error) {
    console.error("Failed to load hotkeys from localStorage", error);
  }
  const defaultMappings = {};
  if (Array.isArray(notes)) {
      notes.forEach(note => {
        defaultMappings[note] = null;
      });
  }
  return defaultMappings;
};

function App() {
  const [score, setScore] = useState(0);
  const [currentNote, setCurrentNote] = useState('');
  const [notation, setNotation] = useState('Brazil');
  const [clef, setClef] = useState('treble');
  const [lowNote, setLowNote] = useState('G/3');
  const [highNote, setHighNote] = useState('G/6');
  const [fontsReady, setFontsReady] = useState(false);

  const staffRef = useRef(null);
  const rangeStaffRef = useRef(null);
  const rendererRef = useRef(null);
  const contextRef = useRef(null);
  const staveRef = useRef(null);
  const rangeRendererRef = useRef(null);
  const rangeContextRef = useRef(null);
  const rangeStaveRef = useRef(null);

  const currentNotes = useMemo(() => {
      if (!notationData || !notationData[notation]) {
          console.error(`notationData or notationData['${notation}'] is undefined.`);
          return [];
      }
      return notationData[notation].notation;
  }, [notation]);
  const [hotkeyMappings, setHotkeyMappings] = useState(() => getInitialHotkeyMappings(currentNotes));
  const [configuringNote, setConfiguringNote] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const t = useCallback((key, replacements = {}) => {
     const lang = notation;
     let text = translations[key]?.[lang] || translations[key]?.['United States'] || key;
     Object.entries(replacements).forEach(([placeholder, value]) => {
       const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
       text = text.replace(regex, value);
     });
     return text;
   }, [notation]);

   useEffect(() => {
    try {
        localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeyMappings));
    } catch (error) {
        console.error("Failed to save hotkeys to localStorage", error);
    }
   }, [hotkeyMappings]);

   useEffect(() => {
    setHotkeyMappings(getInitialHotkeyMappings(currentNotes));
   }, [currentNotes]);

   useEffect(() => {
    if (!configuringNote) return;

    const handleKeyDown = (event) => {
      if (!event || typeof event.key !== 'string') {
          console.warn("Received keydown event without a valid string key:", event);
          return;
      }

      if (event.key === 'Escape') {
        setConfiguringNote(null);
        return;
      }

      event.preventDefault();
      const key = event.key.toLowerCase();

      const isValidKey = /^[a-z0-9]$/.test(key) ||
                         key.startsWith("arrow") ||
                         /^f[1-9]$|^f1[0-2]$/.test(key) ||
                         /^[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]$/.test(key);

      if (isValidKey) {
        const existingNote = Object.keys(hotkeyMappings).find(
          note => hotkeyMappings[note] === key && note !== configuringNote
        );

        if (existingNote) {
          alert(t('alertKeyInUse', { key: key, existingNote: existingNote }));
          setHotkeyMappings(prev => ({ ...prev, [existingNote]: null, [configuringNote]: key }));
        } else {
          setHotkeyMappings(prev => ({ ...prev, [configuringNote]: key }));
        }
        setConfiguringNote(null);
      } else {
        alert(t('alertInvalidKey'));
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
   }, [configuringNote, hotkeyMappings, t]);

  useEffect(() => {
    console.log("Checking font status...");

    document.fonts.ready.then(() => {
      console.log("Fonts are ready!");
      setFontsReady(true);
    }).catch(error => {
        console.error("Font loading failed:", error);
    });
  }, []);

  useEffect(() => {
    if (fontsReady && staffRef.current) {
      console.log("Initializing/Updating main stave for clef:", clef);

      if (!rendererRef.current) {
        rendererRef.current = new VF.Renderer(staffRef.current, VF.Renderer.Backends.SVG);
        contextRef.current = rendererRef.current.getContext();
      }
      rendererRef.current.resize(600, 250);
      contextRef.current.clear();
      staveRef.current = new VF.Stave(10, 40, 580);
      staveRef.current.addClef(clef).setContext(contextRef.current).draw();
    } else if (!fontsReady) {
        console.log("Waiting for fonts to initialize main stave...");
    } else {
        console.log("Waiting for staffRef.current to initialize main stave...");
    }
  }, [fontsReady, clef]);

   useEffect(() => {
     if (fontsReady && rangeStaffRef.current) {
        console.log("Initializing/Updating range stave for clef:", clef);
       if (!rangeRendererRef.current) {
         rangeRendererRef.current = new VF.Renderer(rangeStaffRef.current, VF.Renderer.Backends.SVG);
         rangeContextRef.current = rangeRendererRef.current.getContext();
       }
       rangeRendererRef.current.resize(600, 350);
       rangeContextRef.current.clear();
       rangeStaveRef.current = new VF.Stave(10, 40, 580);
       rangeStaveRef.current.addClef(clef).setContext(rangeContextRef.current).draw();
     } else if (!fontsReady) {
         console.log("Waiting for fonts to initialize range stave...");
     } else {
         console.log("Waiting for rangeStaffRef.current to initialize range stave...");
     }
   }, [fontsReady, clef]);

  const generateRandomNote = useCallback(() => {
    const [lowPitch, lowOctaveStr] = lowNote.split('/');
    const [highPitch, highOctaveStr] = highNote.split('/');
    const lowOctave = parseInt(lowOctaveStr);
    const highOctave = parseInt(highOctaveStr);
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const lowIndex = pitches.indexOf(lowPitch) + (lowOctave * 7);
    const highIndex = pitches.indexOf(highPitch) + (highOctave * 7);

    if (lowIndex > highIndex) {
        console.error("Low note index is higher than high note index. Returning low note.");
        return lowNote;
    }

    const randomIndex = Math.floor(Math.random() * (highIndex - lowIndex + 1)) + lowIndex;
    const pitch = pitches[randomIndex % 7];
    const octave = Math.floor(randomIndex / 7);
    return `${pitch}/${octave}`;
  }, [lowNote, highNote]);

  const drawNote = useCallback((noteName) => {
    if (!fontsReady || !contextRef.current || !staveRef.current || !noteName) {
      console.warn("Cannot draw note: Prerequisites not met.", {fontsReady, context: !!contextRef.current, stave: !!staveRef.current, noteName});
      return;
    }
    console.log("Attempting to draw note:", noteName);

     const elementsToRemove = contextRef.current.svg.querySelectorAll('.vf-stavenote, .vf-voice, .vf-accidental, .vf-annotation, .vf-beam');
     elementsToRemove.forEach(el => el.parentNode?.removeChild(el));

    try {
        const note = new VF.StaveNote({ clef, keys: [noteName], duration: 'w' });
        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
        voice.addTickables([note]);

        new VF.Formatter().joinVoices([voice]).format([voice], 550);
        voice.draw(contextRef.current, staveRef.current);
        console.log("Successfully drew note:", noteName);
    } catch (error) {
        console.error("Error drawing note:", noteName, error);
    }
  }, [fontsReady, clef]);

  const drawRangeNotes = useCallback(() => {
    if (!fontsReady || !rangeContextRef.current || !rangeStaveRef.current || !lowNote || !highNote) {
        console.warn("Cannot draw range notes: Prerequisites not met.", {fontsReady, context: !!rangeContextRef.current, stave: !!rangeStaveRef.current, lowNote, highNote});
        return;
    }
    console.log("Attempting to draw range notes from", lowNote, "to", highNote);

    const elementsToRemove = rangeContextRef.current.svg.querySelectorAll('.vf-stavenote, .vf-voice, .vf-accidental, .vf-annotation, .vf-beam');
    elementsToRemove.forEach(el => el.parentNode?.removeChild(el));

    const [lowPitch, lowOctaveStr] = lowNote.split('/');
    const [highPitch, highOctaveStr] = highNote.split('/');
    const lowOctave = parseInt(lowOctaveStr);
    const highOctave = parseInt(highOctaveStr);
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const lowIndex = pitches.indexOf(lowPitch) + (lowOctave * 7);
    const highIndex = pitches.indexOf(highPitch) + (highOctave * 7);

    if (lowIndex > highIndex) {
        console.warn("Low note index > high note index in drawRangeNotes. Skipping.");
        return;
    }
    const visibleNotes = [];
    for (let i = lowIndex; i <= highIndex; i++) {
      visibleNotes.push(`${pitches[i % 7]}/${Math.floor(i / 7)}`);
    }
    if (visibleNotes.length === 0) {
        console.log("No notes in the current range to draw.");
        return;
    };

    try {
        const staveNotes = visibleNotes.map(noteName => {
          const note = new VF.StaveNote({ clef, keys: [noteName], duration: 'q' });

          if (noteName === lowNote || noteName === highNote) {
            note.setStyle({ fillStyle: '#318CE7', strokeStyle: '#318CE7' });
          } else {
            note.setStyle({ fillStyle: 'black', strokeStyle: 'black' });
          }
          return note;
        });

        VF.Formatter.FormatAndDraw(rangeContextRef.current, rangeStaveRef.current, staveNotes);
        console.log("Successfully drew range notes.");

    } catch(error) {
        console.error("Error drawing range notes:", error);
    }
  }, [fontsReady, clef, lowNote, highNote]);

  const checkAnswer = useCallback((selectedNote) => {
     if (!currentNote) {
         console.warn("checkAnswer called with no currentNote set.");
         return;
     }

    const [pitch] = currentNote.split('/');
    const correctNoteIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(pitch);

     if (correctNoteIndex === -1) {
         console.error("Invalid pitch in currentNote:", currentNote);
         return;
     }

     const correctNote = notationData[notation].notation[correctNoteIndex];

    const button = Array.from(document.querySelectorAll('#buttons button')).find(btn => btn.textContent.startsWith(selectedNote));

    if (selectedNote === correctNote) {
      setScore(prevScore => prevScore + 1);
      if (button) button.classList.add('correct');
      setTimeout(() => {
        if (button) button.classList.remove('correct');
         const newNote = generateRandomNote();
         setCurrentNote(newNote);
         drawNote(newNote);
      }, 300);
    } else {
      setScore(0);
      if (button) button.classList.add('incorrect');
      setTimeout(() => {
        if (button) button.classList.remove('incorrect');
      }, 300);
    }
  }, [currentNote, notation, generateRandomNote, drawNote]);

   const activeHotkeysString = useMemo(() => {
       return Object.values(hotkeyMappings).filter(key => key !== null).join(',');
   }, [hotkeyMappings]);

   useHotkeys(
    activeHotkeysString,
    (event, handler) => {
      if (!event || typeof event.key !== 'string') {
        console.warn("Received hotkey event without a valid string key:", event);
        return;
      }
      const pressedKey = event.key.toLowerCase();

      const noteForPressedKey = Object.entries(hotkeyMappings).find(([note, mappedKey]) => mappedKey === pressedKey);

      if (noteForPressedKey) {
        checkAnswer(noteForPressedKey[0]);
      }
    },
    { enableOnFormTags: false, enabled: !configuringNote },
    [hotkeyMappings, checkAnswer, configuringNote]
   );

   useEffect(() => {
    if (fontsReady) {
        console.log("Dependencies changed, generating new initial note...");
        const initialNote = generateRandomNote();
        setCurrentNote(initialNote);
        drawNote(initialNote);
    } else {
        console.log("Waiting for fonts before generating initial note...");
    }
   }, [fontsReady, clef, notation, lowNote, highNote, generateRandomNote, drawNote]);

  useEffect(() => {
    drawRangeNotes();
  }, [drawRangeNotes]);

  const moveNote = useCallback((isLow, direction) => {
    const noteToChange = isLow ? lowNote : highNote;
    const otherNote = isLow ? highNote : lowNote;

    const [pitch, octaveStr] = noteToChange.split('/');
    const octaveNum = parseInt(octaveStr);
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let pitchIndex = pitches.indexOf(pitch);
    let newOctaveNum = octaveNum;
    let newPitchIndex = pitchIndex;

    if (direction === 'up') {
      newPitchIndex++;
      if (newPitchIndex > 6) { newPitchIndex = 0; newOctaveNum++; }
    } else {
      newPitchIndex--;
      if (newPitchIndex < 0) { newPitchIndex = 6; newOctaveNum--; }
    }

    if (newOctaveNum < MIN_OCTAVE || (newOctaveNum === MIN_OCTAVE && newPitchIndex < 0)) {
        console.warn("Cannot move below MIN_OCTAVE."); return;
    }
    if (newOctaveNum > MAX_OCTAVE || (newOctaveNum === MAX_OCTAVE && newPitchIndex > pitches.indexOf('B'))) {
        console.warn("Cannot move above MAX_OCTAVE."); return;
    }

    const newNote = `${pitches[newPitchIndex]}/${newOctaveNum}`;

    const [otherPitch, otherOctaveStr] = otherNote.split('/');
    const otherOctaveNum = parseInt(otherOctaveStr);
    const otherPitchIndex = pitches.indexOf(otherPitch);

    const newNoteValue = newOctaveNum * 7 + newPitchIndex;
    const otherNoteValue = otherOctaveNum * 7 + otherPitchIndex;

    if (isLow) {
      if (newNoteValue < otherNoteValue) {
        setLowNote(newNote);
      } else { console.warn("Cannot move low note above or equal to high note."); }
    } else {
      if (newNoteValue > otherNoteValue) {
        setHighNote(newNote);
      } else { console.warn("Cannot move high note below or equal to low note."); }
    }
  }, [lowNote, highNote]);

  const handleConfigureClick = (noteToConfigure) => {
    setConfiguringNote(noteToConfigure);
    setShowConfigPanel(true);
  };
  const handleClearHotkey = (noteToClear) => {
    setHotkeyMappings(prev => ({ ...prev, [noteToClear]: null }));
  };

  return (
     <Router>
       <div className="App">

         <h1>{t('title')}</h1>

         <div id="score">{t('scoreLabel')} {score}</div>

         <div ref={staffRef} style={{ minHeight: '150px', marginBottom: '20px', border: '1px solid lightgrey', background: '#fff' }}>
           {!fontsReady && t('loadingFonts')}
         </div>

         <div id="buttons">
           {Array.isArray(currentNotes) && currentNotes.map(note => {
             const hotkey = hotkeyMappings[note];
             const displayHotkey = hotkey ? ` (${hotkey})` : '';
             return (
               <button key={note} onClick={() => checkAnswer(note)}>
                 {note}{displayHotkey}
               </button>
             );
           })}
         </div>

         <button onClick={() => setShowConfigPanel(prev => !prev)} style={{ marginTop: '20px' }}>
           {showConfigPanel ? t('configButtonClose') : t('configButtonOpen')}
         </button>

         {showConfigPanel && (
           <div id="hotkey-config" style={{ border: '1px solid #ccc', padding: '15px', marginTop: '15px', backgroundColor: '#f9f9f9' }}>
             <h2>{t('configPanelTitle')}</h2>
             {configuringNote && (
               <p style={{ color: 'blue', fontWeight: 'bold' }}>
                 {t('configPrompt', { note: configuringNote })}
               </p>
             )}
             <ul style={{ listStyle: 'none', padding: 0 }}>
               {Array.isArray(currentNotes) && currentNotes.map(note => (
                 <li key={note} style={{ margin: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span>{note}: <strong>{hotkeyMappings[note] || t('notDefined')}</strong></span>
                   <div>
                     <button
                       onClick={() => handleConfigureClick(note)}
                       disabled={!!configuringNote}
                       style={{ marginLeft: '10px' }}
                     >
                       {configuringNote === note ? '...' : t('changeButton')}
                     </button>
                     {hotkeyMappings[note] && (
                        <button
                          onClick={() => handleClearHotkey(note)}
                          disabled={!!configuringNote}
                          style={{ marginLeft: '5px', color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2em' }}
                          title={t('clearButtonTooltip')}
                          aria-label={t('clearButtonTooltip')}
                        >
                          &#x2716;
                        </button>
                     )}
                   </div>
                 </li>
               ))}
             </ul>
              {configuringNote && (
                 <button onClick={() => setConfiguringNote(null)} style={{marginTop: '10px'}}>
                   {t('cancelButton')}
                 </button>
               )}
           </div>
         )}

         <div id="options" style={{ marginTop: '20px' }}>
           <select value={notation} onChange={(e) => setNotation(e.target.value)}>
             {Object.entries(notationData).map(([key, data]) => (
               <option key={key} value={key}>{data.name}</option>
             ))}
           </select>
           <select value={clef} onChange={(e) => setClef(e.target.value)}>
             {Object.entries(clefData).map(([key, _]) => (
               <option key={key} value={key}>{t(key)}</option>
             ))}
           </select>
         </div>

         <div style={{ marginTop: '20px' }}>
           <p>{t('adjustRange')}</p>
           <div>
             <button onClick={() => moveNote(true, 'down')}>{t('lowNoteDown')}</button>
             <button onClick={() => moveNote(true, 'up')}>{t('lowNoteUp')}</button>
             <button onClick={() => moveNote(false, 'down')}>{t('highNoteDown')}</button>
             <button onClick={() => moveNote(false, 'up')}>{t('highNoteUp')}</button>
           </div>
           <div ref={rangeStaffRef} style={{ minHeight: '150px', marginTop: '10px', border: '1px solid lightgrey', background: '#fff' }}>
              {!fontsReady && "..."}
           </div>
         </div>

       </div>
     </Router>
   );
}

export default App;
