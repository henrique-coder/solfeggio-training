import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Flow } from 'vexflow';
import { useHotkeys } from 'react-hotkeys-hook';
import './App.css';

// Importando ícones
import { ReactComponent as SettingsIcon } from './icons/settings.svg';
import { ReactComponent as CheckIcon } from './icons/check.svg';
import { ReactComponent as XIcon } from './icons/x.svg';
import { ReactComponent as ArrowUpIcon } from './icons/arrow-up.svg';
import { ReactComponent as ArrowDownIcon } from './icons/arrow-down.svg';

const VF = Flow;

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

// Componentes atualizados
const ConfigButton = ({ onClick, isOpen, isAnimating, t }) => (
    <button
        id="config-button"
        onClick={onClick}
        className={isAnimating ? 'animating' : ''}
        aria-label={isOpen ? t('configButtonClose') : t('configButtonOpen')}
    >
        <SettingsIcon />
    </button>
);

const AnswerButton = ({ note, onClick, isCorrect, isIncorrect }) => (
    <button
        onClick={() => onClick(note)}
        className={`answer-button ${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}`}
    >
        {note}
        {isCorrect && <CheckIcon className="button-icon" />}
        {isIncorrect && <XIcon className="button-icon" />}
    </button>
);

const RangeButton = ({ onClick, direction, type, t }) => (
    <button onClick={onClick} className="range-button">
        {direction === 'up' ? <ArrowUpIcon /> : <ArrowDownIcon />}
        <span>{type === 'low' ? t('lowNote' + direction) : t('highNote' + direction)}</span>
    </button>
);

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
    const [feedback, setFeedback] = useState({ correct: null, incorrect: null });

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
            const regex = new RegExp(`\\{${placeholder}\\ }`, 'g');
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
            new VF.Formatter().joinVoices([voice]).format([voice], stave.getWidth() - 50, { align_rests: false, context: context });
            voice.draw(context, stave);
            console.log("Successfully drew range notes.");
        } catch (error) {
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
        if (selectedNoteName === correctNote) {
            setScore(prev => prev + 1);
            setFeedback({ correct: selectedNoteName, incorrect: null });
            setTimeout(() => {
                setFeedback({ correct: null, incorrect: null });
                const newNote = generateRandomNote();
                setCurrentNote(newNote);
                drawNote(newNote); // Draw the new note
            }, 300);
        } else {
            setScore(0);
            setFeedback({ correct: null, incorrect: selectedNoteName });
            setTimeout(() => setFeedback({ correct: null, incorrect: null }), 500);
        }
    }, [currentNote, notation, generateRandomNote, drawNote, configuringNote]);

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

    //  --- Render ---
    return (
        <div className="App">
            <h1>{t('title')}</h1>
            <div id="score">{t('scoreLabel')} {score}</div>

            {!fontsReady ? (
                <div className="loading">{t('loadingFonts')}</div>
            ) : (
                <>
                    <div id="staveContainer" ref={staffRef} />
                    <div id="options">
                        {currentNotes.map(note => (
                            <AnswerButton
                                key={note}
                                note={note}
                                onClick={checkAnswer}
                                isCorrect={feedback.correct === note}
                                isIncorrect={feedback.incorrect === note}
                            />
                        ))}
                    </div>

                    <div className="range-adjuster ">
                        <span className="range-label-title">{t('adjustRange')}</span>
                        <div id="rangeStaffContainer" ref={rangeStaffRef} />
                        <div className="range-buttons">
                            <RangeButton onClick={() => moveNote(true, 'down')} direction="down" type="low" t={t} />
                            <RangeButton onClick={() => moveNote(true, 'up')} direction="up" type="low" t={t} />
                            <RangeButton onClick={() => moveNote(false, 'down')} direction="down" type="high" t={t} />
                            <RangeButton onClick={() => moveNote(false, 'up')} direction="up" type="high" t={t} />
                        </div>
                    </div>

                    <ConfigButton
                        onClick={toggleConfigPanel}
                        isOpen={showConfigPanel}
                        isAnimating={gearAnimating}
                        t={t}
                    />

                    {showConfigPanel && (
                        <div className="config-panel">
                            <h2>{t('configPanelTitle')}</h2>

                            <div className="setting-item">
                                <label>{t('languageLabel')}</label>
                                <select
                                    value={notation}
                                    onChange={(e) => setNotation(e.target.value)}
                                    disabled={configuringNote !== null}
                                >
                                    {Object.keys(notationData).map(key => (
                                        <option key={key} value={key}>{notationData[key].name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="setting-item">
                                <label>{t('clefLabel')}</label>
                                <select
                                    value={clef}
                                    onChange={(e) => setClef(e.target.value)}
                                    disabled={configuringNote !== null}
                                >
                                    {Object.keys(clefData).map(key => (
                                        <option key={key} value={key}>{t(key)}</option>
                                    ))}
                                </select>
                            </div>

                            <h3>{t('configSubPanelHotkeys')}</h3>
                            {configuringNote && (
                                <div className="config-prompt">
                                    {t('configPrompt', { note: configuringNote })}
                                </div>
                            )}

                            <ul className="hotkey-list">
                                {currentNotes.map(note => (
                                    <li key={note}>
                                        <span>{note}</span>
                                        <div>
                                            <button
                                                className="change-button"
                                                onClick={() => handleConfigureClick(note)}
                                                disabled={configuringNote !== null && configuringNote !== note}
                                            >
                                                {hotkeyMappings[note] || t('notDefined')}
                                            </button>
                                            <button
                                                className="clear-button"
                                                onClick={() => handleClearHotkey(note)}
                                                disabled={configuringNote !== null}
                                            >
                                                <XIcon />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {configuringNote && (
                                <button
                                    className="cancel-config-button"
                                    onClick={() => setConfiguringNote(null)}
                                >
                                    {t('cancelButton')}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            <a
                href="https://github.com/seu-usuario/solfeggio-training"
                className="github-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('githubTooltip')}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.8 7a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91  1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
            </a>
        </div>
    );
}

export default App;
