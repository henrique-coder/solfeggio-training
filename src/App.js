import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Vex from 'vexflow';
import { useHotkeys } from 'react-hotkeys-hook';
import './App.css';

const VF = Vex.Flow;

// --- Translations ---
const translations = {
    // General UI
    title: { Brazil: 'Treinamento de Solfejo', 'United States': 'Solfeggio Training' },
    scoreLabel: { Brazil: 'Pontuação:', 'United States': 'Score:' },
    loadingFonts: { Brazil: 'Carregando fontes...', 'United States': 'Loading fonts...' },
    githubTooltip: { Brazil: 'Ver no GitHub', 'United States': 'View on GitHub' },
    notDefined: { Brazil: 'N/D', 'United States': 'N/A' }, // For undefined hotkeys

    // Settings Panel
    configButtonOpen: { Brazil: 'Configurações', 'United States': 'Settings' },
    configButtonClose: { Brazil: 'Fechar Config.', 'United States': 'Close Settings' },
    configPanelTitle: { Brazil: 'Configurações', 'United States': 'Settings' },
    languageLabel: { Brazil: 'Idioma:', 'United States': 'Language:' }, // Changed from Notation
    clefLabel: { Brazil: 'Clave:', 'United States': 'Clef:' }, // Changed label
    configSubPanelHotkeys: { Brazil: 'Teclas de Atalho', 'United States': 'Hotkeys' },
    configPrompt: { Brazil: 'Pressione a tecla para "{note}"... (ESC para cancelar)', 'United States': 'Press the key for "{note}"... (ESC to cancel)' },
    changeButton: { Brazil: 'Alterar', 'United States': 'Change' },
    cancelButton: { Brazil: 'Cancelar', 'United States': 'Cancel' },
    clearButtonTooltip: { Brazil: 'Limpar Tecla', 'United States': 'Clear Hotkey' },

    // Hotkey Alerts
    alertKeyInUse: { Brazil: 'A tecla "{key}" já está atribuída à nota "{existingNote}". Removendo atribuição anterior.', 'United States': 'The key "{key}" is already assigned to the note "{existingNote}". Removing previous assignment.' },
    alertInvalidKey: { Brazil: 'Tecla inválida. Use letras, números, F1-F12, setas ou símbolos comuns.', 'United States': 'Invalid key. Use letters, numbers, F1-F12, arrow keys, or common symbols.' },

    // Range Adjuster
    adjustRange: { Brazil: 'Ajustar Extensão das Notas:', 'United States': 'Adjust Note Range:' },
    lowNoteDown: { Brazil: '↓ Grave', 'United States': '↓ Low' },
    lowNoteUp: { Brazil: '↑ Grave', 'United States': '↑ Low' },
    highNoteDown: { Brazil: '↓ Agudo', 'United States': '↓ High' },
    highNoteUp: { Brazil: '↑ Agudo', 'United States': '↑ High' },

    // Clef Names (Simplified)
    treble: { Brazil: 'Sol', 'United States': 'Treble' },
    bass: { Brazil: 'Fá', 'United States': 'Bass' },
    alto: { Brazil: 'Dó', 'United States': 'Alto' },
};

// --- Notation Data ---
// Changed keys and names for language selection
const notationData = {
    Brazil: {
        name: "PT-BR (Dó-Ré-Mi)",
        notation: ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"],
    },
    "United States": {
        name: "EN-US (C-D-E)",
        notation: ["C", "D", "E", "F", "G", "A", "B"],
    }
};

// --- Clef Data (Internal mapping, display text comes from translations) ---
const clefData = {
    treble: "Treble", // Internal key remains the same
    bass: "Bass",
    alto: "Alto"
};

// --- Constants ---
const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;
const HOTKEY_STORAGE_KEY = 'solfeggio_hotkeys';
const PITCHES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// --- Helper Functions ---
const getInitialHotkeyMappings = (notes) => {
    // ... (logic remains the same) ...
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
                 console.warn("getInitialHotkeyMappings received non-array 'notes'. Using empty mappings.");
                 return {};
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
     } else {
         console.warn("getInitialHotkeyMappings received non-array 'notes' for default generation. Using empty mappings.");
     }
    return defaultMappings;
};

// --- Main App Component ---
function App() {
    // --- State Variables ---
    const [score, setScore] = useState(0);
    const [currentNote, setCurrentNote] = useState('');
    const [notation, setNotation] = useState('United States'); // Default language
    const [clef, setClef] = useState('treble');
    const [lowNote, setLowNote] = useState('G/3');
    const [highNote, setHighNote] = useState('G/5');
    const [fontsReady, setFontsReady] = useState(false);
    const [configuringNote, setConfiguringNote] = useState(null);
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [gearAnimating, setGearAnimating] = useState(false);

    const currentNotes = useMemo(() => {
        return notationData[notation]?.notation || [];
    }, [notation]);

    const [hotkeyMappings, setHotkeyMappings] = useState(() => getInitialHotkeyMappings(currentNotes));

    // --- Refs ---
    const staffRef = useRef(null);
    const rangeStaffRef = useRef(null);
    const rendererRef = useRef(null);
    const contextRef = useRef(null);
    const staveRef = useRef(null);
    const rangeRendererRef = useRef(null);
    const rangeContextRef = useRef(null);
    const rangeStaveRef = useRef(null);
    const lastRangeClefRef = useRef(null); // Ref to track last initialized clef for range stave

    // --- Translation Function ---
    const t = useCallback((key, replacements = {}) => {
        const lang = notation; // Use notation state directly as language key
        let text = translations[key]?.[lang] || translations[key]?.['United States'] || key; // Fallback
        Object.entries(replacements).forEach(([placeholder, value]) => {
            const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
            text = text.replace(regex, value);
        });
        return text;
    }, [notation]);

    // --- Effects ---

    // Save/Load Hotkeys
    useEffect(() => {
        try {
            localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeyMappings));
        } catch (error) { console.error("Failed to save hotkeys", error); }
    }, [hotkeyMappings]);

    useEffect(() => {
        setHotkeyMappings(getInitialHotkeyMappings(currentNotes));
    }, [currentNotes]);

    // Hotkey Configuration Listener
    useEffect(() => {
        if (!configuringNote) return;
        const handleKeyDown = (event) => {
            if (!event || typeof event.key !== 'string') return;
            if (event.key === 'Escape') {
                setConfiguringNote(null); return;
            }
            event.preventDefault();
            const key = event.key.toLowerCase();
            const isValidKey = /^[a-z0-9]$/.test(key) || key.startsWith("arrow") || /^f[1-9]$|^f1[0-2]$/.test(key) || /^[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]$/.test(key) || key === ' ';
             if (isValidKey) {
                 const existingNote = Object.keys(hotkeyMappings).find(note => hotkeyMappings[note] === key && note !== configuringNote);
                 if (existingNote) {
                     alert(t('alertKeyInUse', { key: key, existingNote: existingNote }));
                     setHotkeyMappings(prev => ({ ...prev, [existingNote]: null, [configuringNote]: key }));
                 } else {
                     setHotkeyMappings(prev => ({ ...prev, [configuringNote]: key }));
                 }
                 setConfiguringNote(null);
             } else { alert(t('alertInvalidKey')); }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [configuringNote, hotkeyMappings, t]);

    // Font Readiness Check
    useEffect(() => {
        document.fonts.ready.then(() => setFontsReady(true))
                           .catch(error => console.error("Font loading failed:", error));
    }, []);

    // --- VexFlow Drawing ---

    // Draw note on MAIN stave
    const drawNote = useCallback((noteName) => {
        if (!fontsReady || !contextRef.current || !staveRef.current || !noteName) return;
        const context = contextRef.current;
        const stave = staveRef.current;
        // Clear previous notes only
        const elementsToRemove = context.svg.querySelectorAll('.vf-stavenote, .vf-voice, .vf-accidental, .vf-annotation, .vf-beam, .vf-modifiercontext');
        elementsToRemove.forEach(el => el.parentNode?.removeChild(el));
        try {
            const note = new VF.StaveNote({ clef: clef, keys: [noteName], duration: 'w' });
            if (noteName.includes('#') || noteName.includes('b')) {
                note.addAccidental(0, new VF.Accidental(noteName.includes('#') ? '#' : 'b'));
            }
            const voice = new VF.Voice({ num_beats: 1, beat_value: 1 }).addTickables([note]);
            new VF.Formatter().joinVoices([voice]).format([voice], stave.getWidth() - 50);
            voice.draw(context, stave);
        } catch (error) { console.error("Error drawing main note:", noteName, error); }
    }, [fontsReady, clef]);

    // Initialize/Update MAIN stave structure (clef, lines)
    useEffect(() => {
        if (fontsReady && staffRef.current) {
            staffRef.current.innerHTML = ''; // Clear completely on clef change
            try {
                rendererRef.current = new VF.Renderer(staffRef.current, VF.Renderer.Backends.SVG);
                contextRef.current = rendererRef.current.getContext();
                rendererRef.current.resize(600, 150);
                staveRef.current = new VF.Stave(10, 10, 580).addClef(clef).setContext(contextRef.current).draw();
                // Redraw current note AFTER stave is ready
                if (currentNote) { setTimeout(() => drawNote(currentNote), 0); }
            } catch (error) { console.error("Error initializing main stave:", error); }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fontsReady, clef]); // DrawNote dep removed, called internally


    // Draw notes on RANGE stave
    const drawRangeNotes = useCallback(() => {
        // Prerequisites check
        if (!fontsReady || !rangeContextRef.current || !rangeStaveRef.current || !lowNote || !highNote || !clef) {
            console.warn("Cannot draw range notes: Prerequisites not met.");
            return;
        }
        console.log("Attempting drawRangeNotes for", lowNote, "-", highNote, "Clef:", clef);
        const context = rangeContextRef.current;
        const stave = rangeStaveRef.current;

        // Clear only previous note elements, preserving stave/clef
        const elementsToRemove = context.svg.querySelectorAll('.vf-stavenote, .vf-voice, .vf-accidental, .vf-annotation, .vf-beam, .vf-modifiercontext');
        elementsToRemove.forEach(el => el.parentNode?.removeChild(el));
        console.log("Cleared old range notes.");

        const [lowPitch, lowOctaveStr] = lowNote.split('/');
        const [highPitch, highOctaveStr] = highNote.split('/');
        const lowOctave = parseInt(lowOctaveStr);
        const highOctave = parseInt(highOctaveStr);
        const lowIndex = PITCHES.indexOf(lowPitch) + (lowOctave * PITCHES.length);
        const highIndex = PITCHES.indexOf(highPitch) + (highOctave * PITCHES.length);

        if (lowIndex > highIndex) {
            console.warn("Invalid range: lowIndex > highIndex");
            return;
        }

        let visibleNotes = [];
        for (let i = lowIndex; i <= highIndex; i++) {
            visibleNotes.push(`${PITCHES[i % PITCHES.length]}/${Math.floor(i / PITCHES.length)}`);
        }

        if (visibleNotes.length === 0) { console.log("No notes in range."); return; }
        // Limit displayed notes for clarity/performance
        const maxNotesToShow = 15;
        if (visibleNotes.length > maxNotesToShow) {
             console.warn(`Range too large (${visibleNotes.length} notes), displaying boundaries only.`);
             visibleNotes = [visibleNotes[0], visibleNotes[visibleNotes.length - 1]];
        }

        try {
            console.log("Creating StaveNote objects for range:", visibleNotes);
            const staveNotes = visibleNotes.map(noteName => {
                const note = new VF.StaveNote({ clef: clef, keys: [noteName], duration: 'q' });
                if (noteName.includes('#') || noteName.includes('b')) {
                    note.addAccidental(0, new VF.Accidental(noteName.includes('#') ? '#' : 'b'));
                }
                // Highlight boundaries
                if (noteName === lowNote || noteName === highNote) {
                    note.setStyle({ fillStyle: '#318CE7', strokeStyle: '#318CE7' }); // Blue
                } else {
                    note.setStyle({ fillStyle: 'grey', strokeStyle: 'grey' }); // Grey
                }
                return note;
            });

            // Format and draw
            console.log("Formatting and drawing range notes...");
             const voice = new VF.Voice({ num_beats: Math.max(1, Math.ceil(staveNotes.length / 4)), beat_value: 4 });
             voice.setStrict(false); // Be less strict about timing if needed
             voice.addTickables(staveNotes);
             new VF.Formatter().joinVoices([voice]).format([voice], stave.getWidth() - 50, { align_rests: false, context: context});
             voice.draw(context, stave);
            console.log("Successfully drew range notes.");
        } catch(error) {
            console.error("Error drawing range notes:", error, "Notes:", visibleNotes);
             // Attempt to clear context again on error to prevent broken state
            // context.clear(); // Might be too aggressive, comment out if it causes issues
        }
    }, [fontsReady, clef, lowNote, highNote]); // Dependencies

    // Combined Effect for RANGE stave Initialization & Note Drawing
    useEffect(() => {
        if (!fontsReady || !rangeStaffRef.current) {
            console.log("Range stave effect: Waiting for fonts/ref.");
            return;
        }
        console.log("Range stave effect: Running. Current Clef:", clef, "Last Clef:", lastRangeClefRef.current);

        let needsInitialization = !rangeRendererRef.current || clef !== lastRangeClefRef.current;

        if (needsInitialization) {
            console.log("Range stave: Initializing structure for clef:", clef);
            rangeStaffRef.current.innerHTML = ''; // Clear container completely
            try {
                rangeRendererRef.current = new VF.Renderer(rangeStaffRef.current, VF.Renderer.Backends.SVG);
                rangeContextRef.current = rangeRendererRef.current.getContext();
                rangeRendererRef.current.resize(600, 150);
                rangeStaveRef.current = new VF.Stave(10, 10, 580);
                rangeStaveRef.current.addClef(clef).setContext(rangeContextRef.current).draw(); // Draw clef
                lastRangeClefRef.current = clef; // Update the ref tracking the initialized clef
                 console.log("Range stave: Initialization complete.");
            } catch (error) {
                console.error("Error initializing range stave structure:", error);
                // Reset refs on error to allow re-initialization attempt
                rangeRendererRef.current = null;
                rangeContextRef.current = null;
                rangeStaveRef.current = null;
                lastRangeClefRef.current = null;
                return; // Stop if initialization failed
            }
        }

        // Always attempt to draw notes after ensuring structure is potentially initialized/updated
        // Ensure context/stave are valid before calling drawRangeNotes
        if (rangeContextRef.current && rangeStaveRef.current) {
             // Use setTimeout to ensure the DOM updates from initialization (if any) are flushed
             // This can sometimes help with race conditions in SVG rendering
             setTimeout(() => drawRangeNotes(), 0);
        } else {
             console.warn("Range stave effect: Context or Stave ref is missing, cannot draw notes yet.");
        }

    }, [fontsReady, clef, lowNote, highNote, drawRangeNotes]); // Dependencies


    // --- Core Logic ---

    // Generate Random Note
    const generateRandomNote = useCallback(() => {
        const [lowPitch, lowOctaveStr] = lowNote.split('/');
        const [highPitch, highOctaveStr] = highNote.split('/');
        const lowOctave = parseInt(lowOctaveStr);
        const highOctave = parseInt(highOctaveStr);
        const lowIndex = PITCHES.indexOf(lowPitch) + (lowOctave * PITCHES.length);
        const highIndex = PITCHES.indexOf(highPitch) + (highOctave * PITCHES.length);
        if (lowIndex > highIndex) {
             if (currentNote && currentNote.length > 1) return currentNote;
             else return lowNote;
        }
        if (lowIndex === highIndex) return lowNote;
        const randomIndex = Math.floor(Math.random() * (highIndex - lowIndex + 1)) + lowIndex;
        const pitch = PITCHES[randomIndex % PITCHES.length];
        const octave = Math.floor(randomIndex / PITCHES.length);
        return `${pitch}/${octave}`;
    }, [lowNote, highNote, currentNote]);

    // Check Answer
    const checkAnswer = useCallback((selectedNoteName) => {
        if (!currentNote || configuringNote) return; // Prevent checking while configuring
        const [pitch] = currentNote.split('/');
        const correctNoteIndex = PITCHES.indexOf(pitch);
        if (correctNoteIndex === -1) return;
        const correctNote = notationData[notation]?.notation?.[correctNoteIndex];
        if (!correctNote) return;
        const button = Array.from(document.querySelectorAll('#options button')).find(
            btn => btn.textContent.trim().split(' ')[0].toLowerCase() === selectedNoteName.toLowerCase()
        );
        if (selectedNoteName === correctNote) {
            setScore(prev => prev + 1);
            if (button) button.classList.add('correct');
            setTimeout(() => {
                if (button) button.classList.remove('correct');
                const newNote = generateRandomNote();
                setCurrentNote(newNote);
                drawNote(newNote); // Draw the new note
            }, 300);
        } else {
            setScore(0);
            if (button) button.classList.add('incorrect');
            setTimeout(() => { if (button) button.classList.remove('incorrect'); }, 500);
        }
    }, [currentNote, notation, generateRandomNote, drawNote, configuringNote]); // Added configuringNote dependency

    // --- Hotkey Handling ---
    const activeHotkeysString = useMemo(() => {
        return Object.values(hotkeyMappings).filter(key => key !== null).join(',');
    }, [hotkeyMappings]);

    useHotkeys(
        activeHotkeysString,
        (event, handler) => {
            if (!event || typeof event.key !== 'string' || configuringNote) return;
            const pressedKey = event.key.toLowerCase();
            const noteForPressedKey = Object.entries(hotkeyMappings).find(([_, mappedKey]) => mappedKey === pressedKey);
            if (noteForPressedKey) { checkAnswer(noteForPressedKey[0]); }
        },
        { enableOnFormTags: false, enabled: !configuringNote },
        [hotkeyMappings, checkAnswer, configuringNote]
    );

    // --- Initial Note Generation ---
    useEffect(() => {
        if (fontsReady && clef && lowNote && highNote && currentNotes.length > 0 && !currentNote) {
            const initialNote = generateRandomNote();
            setCurrentNote(initialNote);
            // Defer drawing slightly
            setTimeout(() => drawNote(initialNote), 50);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fontsReady, clef, lowNote, highNote, currentNotes, generateRandomNote]); // drawNote removed

    // --- UI Interaction Handlers ---
    const moveNote = useCallback((isLow, direction) => {
        if (configuringNote) return; // Prevent range change while configuring
        const noteToChange = isLow ? lowNote : highNote;
        const otherNote = isLow ? highNote : lowNote;
        const [pitch, octaveStr] = noteToChange.split('/');
        const octaveNum = parseInt(octaveStr);
        let pitchIndex = PITCHES.indexOf(pitch);
        let newOctaveNum = octaveNum;
        let newPitchIndex = pitchIndex;
        if (direction === 'up') {
            newPitchIndex++;
            if (newPitchIndex >= PITCHES.length) { newPitchIndex = 0; newOctaveNum++; }
        } else {
            newPitchIndex--;
            if (newPitchIndex < 0) { newPitchIndex = PITCHES.length - 1; newOctaveNum--; }
        }
        if (newOctaveNum < MIN_OCTAVE || (newOctaveNum === MIN_OCTAVE && newPitchIndex < PITCHES.indexOf('C'))) return;
        if (newOctaveNum > MAX_OCTAVE || (newOctaveNum === MAX_OCTAVE && newPitchIndex > PITCHES.indexOf('B'))) return;
        const newNote = `${PITCHES[newPitchIndex]}/${newOctaveNum}`;
        const [otherPitch, otherOctaveStr] = otherNote.split('/');
        const otherOctaveNum = parseInt(otherOctaveStr);
        const otherPitchIndex = PITCHES.indexOf(otherPitch);
        const newNoteValue = newOctaveNum * PITCHES.length + newPitchIndex;
        const otherNoteValue = otherOctaveNum * PITCHES.length + otherPitchIndex;
        if (isLow) {
            if (newNoteValue < otherNoteValue) setLowNote(newNote);
        } else {
            if (newNoteValue > otherNoteValue) setHighNote(newNote);
        }
    }, [lowNote, highNote, configuringNote]); // Added configuringNote dependency

    const handleConfigureClick = (noteToConfigure) => setConfiguringNote(noteToConfigure);
    const handleClearHotkey = (noteToClear) => setHotkeyMappings(prev => ({ ...prev, [noteToClear]: null }));
    const toggleConfigPanel = () => {
        if (configuringNote) return; // Don't toggle if configuring
        setShowConfigPanel(prev => !prev);
        setGearAnimating(true);
        setTimeout(() => setGearAnimating(false), 500);
    };

    // --- Render ---
    return (
        <div className="App">
            <h1>{t('title')}</h1>
            <div id="score">{t('scoreLabel')} {score}</div>

            {/* Main Exercise Stave */}
            <div id="staveContainer" ref={staffRef}>
                 {!fontsReady && <p>{t('loadingFonts')}</p>}
            </div>

            {/* Answer Buttons */}
            <div id="options">
                 {currentNotes.map(note => {
                     const hotkey = hotkeyMappings[note];
                     const displayHotkey = hotkey ? ` (${hotkey})` : '';
                     return (
                         <button key={note} onClick={() => checkAnswer(note)} disabled={!!configuringNote}>
                             {note}{displayHotkey}
                         </button>
                     );
                 })}
            </div>

             {/* Range Adjuster Section */}
            <div className="range-adjuster">
                 <label className="range-label-title">{t('adjustRange')}</label>
                 <div id="rangeStaffContainer" ref={rangeStaffRef}>
                     {/* VexFlow draws range stave SVG here */}
                     {/* Display loading only if fonts aren't ready */}
                      {!fontsReady && <p>...</p>}
                 </div>
                 <div className="range-buttons">
                      <button onClick={() => moveNote(true, 'down')} title={t('lowNoteDown')} disabled={!!configuringNote}> {t('lowNoteDown')} </button>
                      <button onClick={() => moveNote(true, 'up')} title={t('lowNoteUp')} disabled={!!configuringNote}> {t('lowNoteUp')} </button>
                      <span className="range-label">{lowNote} - {highNote}</span>
                      <button onClick={() => moveNote(false, 'down')} title={t('highNoteDown')} disabled={!!configuringNote}> {t('highNoteDown')} </button>
                      <button onClick={() => moveNote(false, 'up')} title={t('highNoteUp')} disabled={!!configuringNote}> {t('highNoteUp')} </button>
                  </div>
             </div>

             {/* Settings Toggle Button */}
             <button
                 id="config-button"
                 className={`gear-button ${gearAnimating ? 'animating' : ''}`}
                 onClick={toggleConfigPanel}
                 title={showConfigPanel ? t('configButtonClose') : t('configButtonOpen')}
                 aria-label={showConfigPanel ? t('configButtonClose') : t('configButtonOpen')}
                 disabled={!!configuringNote}

             >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                     <path d="M20.1 9.2214C18.29 9.2214 17.55 7.9414 18.45 6.3714C18.97 5.4614 18.66 4.3014 17.75 3.7814L16.02 2.7914C15.23 2.3214 14.21 2.6014 13.74 3.3914L13.63 3.5814C12.73 5.1514 11.25 5.1514 10.34 3.5814L10.23 3.3914C9.78 2.6014 8.76 2.3214 7.97 2.7914L6.24 3.7814C5.33 4.3014 5.02 5.4714 5.54 6.3814C6.45 7.9414 5.71 9.2214 3.9 9.2214C2.86 9.2214 2 10.0714 2 11.1214V12.8814C2 13.9214 2.85 14.7814 3.9 14.7814C5.71 14.7814 6.45 16.0614 5.54 17.6314C5.02 18.5414 5.33 19.7014 6.24 20.2214L7.97 21.2114C8.76 21.6814 9.78 21.4014 10.25 20.6114L10.36 20.4214C11.26 18.8514 12.74 18.8514 13.65 20.4214L13.76 20.6114C14.23 21.4014 15.25 21.6814 16.04 21.2114L17.77 20.2214C18.68 19.7014 18.99 18.5314 18.47 17.6314C17.56 16.0614 18.3 14.7814 20.11 14.7814C21.15 14.7814 22.01 13.9314 22.01 12.8814V11.1214C22 10.0814 21.15 9.2214 20.1 9.2214ZM12 15.2514C10.21 15.2514 8.75 13.7914 8.75 12.0014C8.75 10.2114 10.21 8.7514 12 8.7514C13.79 8.7514 15.25 10.2114 15.25 12.0014C15.25 13.7914 13.79 15.2514 12 15.2514Z"/>
                 </svg>
             </button>

            {/* Configuration Panel (Conditional) */}
             {showConfigPanel && (
                 <div className="config-panel">
                     <h2>{t('configPanelTitle')}</h2>

                     {/* Language Selector */}
                     <div className="setting-item">
                          <label htmlFor="notation-select">{t('languageLabel')}</label>
                         <select
                             id="notation-select"
                             value={notation}
                             onChange={e => setNotation(e.target.value)}
                             disabled={!!configuringNote}
                         >
                             {Object.entries(notationData).map(([key, data]) => (
                                 // Use key for value, data.name for display
                                 <option key={key} value={key}>{data.name}</option>
                             ))}
                         </select>
                     </div>

                     {/* Clef Selector */}
                     <div className="setting-item">
                         <label htmlFor="clef-select">{t('clefLabel')}</label>
                         <select
                            id="clef-select"
                            value={clef}
                            onChange={e => setClef(e.target.value)}
                            disabled={!!configuringNote}
                         >
                             {Object.keys(clefData).map((key) => (
                                 // Use key for value, translated key for display
                                 <option key={key} value={key}>{t(key)}</option>
                             ))}
                         </select>
                     </div>

                     {/* Hotkey Configuration Area */}
                      <div className="setting-item">
                         <h3>{t('configSubPanelHotkeys')}</h3>
                         {configuringNote && (
                             <p className="config-prompt">
                                 {t('configPrompt', { note: configuringNote })}
                             </p>
                         )}
                         <ul className="hotkey-list">
                              {currentNotes.map(note => (
                                  <li key={note}>
                                      <span>{note}: {hotkeyMappings[note] || t('notDefined')}</span>
                                      <div>
                                          <button
                                              onClick={() => handleConfigureClick(note)}
                                              disabled={!!configuringNote}
                                              className="change-button"
                                              title={t('changeButton')}
                                          >
                                              {configuringNote === note ? '...' : t('changeButton')}
                                          </button>
                                          {hotkeyMappings[note] && (
                                              <button
                                                  onClick={() => handleClearHotkey(note)}
                                                  disabled={!!configuringNote}
                                                  className="clear-button"
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
                              <button onClick={() => setConfiguringNote(null)} className="cancel-config-button">
                                  {t('cancelButton')}
                              </button>
                          )}
                      </div>

                 </div> // End config-panel
             )}

            {/* GitHub Link */}
            <div className="footer-link">
                 <a href="https://github.com/henrique-coder" target="_blank" rel="noopener noreferrer" title={t('githubTooltip')} className="github-link">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="24" height="24" aria-hidden="true">
                         <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
                     </svg>
                     <span className="sr-only">GitHub</span>
                 </a>
             </div>
        </div> // End App
    );
}

export default App;
