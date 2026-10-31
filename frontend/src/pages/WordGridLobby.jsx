import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import {
  createWordGridRoom,
  joinWordGridRoom,
  getWordGridRoomStatus,
  queueQuickMatch,
  getSlotStatesForCount,
  generateMockRoomCode,
} from '../services/wordgridApi';
import { wordgridSocket } from '../services/wordgridSocket';
import {
  isValidWord,
  getWordPoints,
  isAdjacent,
  findWordOnGrid,
} from '../utils/wordDictionary';
import './WordGridLobby.css';

const ALL_SLOTS = ['P1', 'P2', 'P3', 'P4'];

const REALISTIC_NAMES = [
  'Aarav_Sharma',
  'Vikram_R',
  'Sneha_Patel',
  'Ananya_Iyer',
  'Rohan_Mehta',
  'Pooja_Nair',
  'Kabir_Verma',
  'Meera_Joshi',
];

const PLAYER_METADATA = {
  P1: {
    slot: 'P1',
    label: 'Player 1',
    colorName: 'Red',
    hex: '#e94560',
    avatar: '🔴',
    defaultName: 'Player 1',
  },
  P2: {
    slot: 'P2',
    label: 'Player 2',
    colorName: 'Green',
    hex: '#00c9a7',
    avatar: '🟢',
    defaultName: 'Player 2',
  },
  P3: {
    slot: 'P3',
    label: 'Player 3',
    colorName: 'Yellow',
    hex: '#f7b731',
    avatar: '🟡',
    defaultName: 'Player 3',
  },
  P4: {
    slot: 'P4',
    label: 'Player 4',
    colorName: 'Blue',
    hex: '#4fc3f7',
    avatar: '🔵',
    defaultName: 'Player 4',
  },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Initialize an empty 10x10 letter grid
const createInitialGrid = () => {
  return Array.from({ length: 100 }, (_, idx) => ({
    index: idx,
    row: Math.floor(idx / 10),
    col: idx % 10,
    letter: '',
    claimedBy: null, // 'P1' | 'P2' | 'P3' | 'P4'
    claimColor: null,
  }));
};

export const WordGridLobby = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Navigation & View: 'LOBBY' | 'ARENA'
  const [view, setView] = useState('LOBBY');
  const [playerCount, setPlayerCount] = useState(2); // 2 | 3 | 4
  const [isSoloAI, setIsSoloAI] = useState(false);

  // Roles & Waiting Room Modal State
  const [isHost, setIsHost] = useState(true);
  const [readyStates, setReadyStates] = useState({
    P1: true,
    P2: false,
    P3: false,
    P4: false,
  });
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomCode, setRoomCode] = useState(() => (searchParams.get('room') || '').trim().toUpperCase());
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Quick Match Matchmaking State
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState(12);
  const searchCountdownRef = useRef(12);
  const searchIntervalRef = useRef(null);
  const [botSlots, setBotSlots] = useState(() => new Set());

  // Session & Identity
  const [sessionId, setSessionId] = useState('');
  const [mySlot, setMySlot] = useState('P1');
  const [slotStates, setSlotStates] = useState(() => getSlotStatesForCount(2));
  const [playerNames, setPlayerNames] = useState({
    P1: 'Player 1',
    P2: 'Player 2',
    P3: 'No Player',
    P4: 'No Player',
  });
  const [scores, setScores] = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });
  const [wordsClaimedCount, setWordsClaimedCount] = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });

  // Game Board & Turn State
  const [grid, setGrid] = useState(createInitialGrid);
  const [currentTurn, setCurrentTurn] = useState('P1');
  const [turnTimer, setTurnTimer] = useState(30);
  const [fastProceedCountdown, setFastProceedCountdown] = useState(5);
  const [currentPhase, setCurrentPhase] = useState('PLACE_LETTER'); // 'PLACE_LETTER' | 'CLAIM_WORD'
  const [justPlacedIndex, setJustPlacedIndex] = useState(null);

  // Letter placement selection & Traced Word Path
  const [selectedEmptyIndex, setSelectedEmptyIndex] = useState(null);
  const [tracedPath, setTracedPath] = useState([]); // Array of cell objects: [{ row, col, index, letter }]
  const [isDraggingPath, setIsDraggingPath] = useState(false);
  const [claimedFingerprints, setClaimedFingerprints] = useState(new Set());

  // Game Over & Modals
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverRankings, setGameOverRankings] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Refs for timer and synchronization across async callbacks
  const stateRef = useRef({
    sessionId,
    mySlot,
    isHost,
    readyStates,
    currentTurn,
    currentPhase,
    slotStates,
    grid,
    scores,
    wordsClaimedCount,
    isSoloAI,
    isGameOver,
    claimedFingerprints,
    playerNames,
    playerCount,
    botSlots,
  });

  useEffect(() => {
    stateRef.current = {
      sessionId,
      mySlot,
      isHost,
      readyStates,
      currentTurn,
      currentPhase,
      slotStates,
      grid,
      scores,
      wordsClaimedCount,
      isSoloAI,
      isGameOver,
      claimedFingerprints,
      playerNames,
      playerCount,
      botSlots,
    };
  }, [
    sessionId,
    mySlot,
    isHost,
    readyStates,
    currentTurn,
    currentPhase,
    slotStates,
    grid,
    scores,
    wordsClaimedCount,
    isSoloAI,
    isGameOver,
    claimedFingerprints,
    playerNames,
    playerCount,
    botSlots,
  ]);

  // Toast System
  const showToast = useCallback((message, type = 'info', durationMs = 2400) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  // Confetti trigger
  const fireConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#e94560', '#00c9a7', '#f7b731', '#4fc3f7', '#ffffff'],
      });
    } catch {
      // ignore
    }
  }, []);

  // Active turn sequence for current configuration
  const getActiveTurnOrder = useCallback((slots) => {
    return ALL_SLOTS.filter((s) => slots[s] === 'ACTIVE');
  }, []);

  // Switch Turn
  const advanceTurn = useCallback(
    (reason = '') => {
      if (stateRef.current.isGameOver) return;
      if (reason) showToast(reason, 'info', 1600);

      const activeSlots = getActiveTurnOrder(stateRef.current.slotStates);
      if (activeSlots.length === 0) return;

      const currentIdx = activeSlots.indexOf(stateRef.current.currentTurn);
      const nextSlot = activeSlots[(currentIdx + 1) % activeSlots.length];

      setCurrentTurn(nextSlot);
      setCurrentPhase('PLACE_LETTER');
      setSelectedEmptyIndex(null);
      setTracedPath([]);
      setJustPlacedIndex(null);
      setTurnTimer(30);
      setFastProceedCountdown(5);
    },
    [getActiveTurnOrder, showToast]
  );

  // Check Game Over conditions
  const checkGameOver = useCallback(
    (customGrid = null, customScores = null) => {
      const activeGrid = customGrid || stateRef.current.grid;
      const activeScores = customScores || stateRef.current.scores;

      const isFull = activeGrid.every((c) => c.letter !== '');
      const maxScore = Math.max(...Object.values(activeScores));

      if (isFull || maxScore >= 30) {
        setIsGameOver(true);
        fireConfetti();

        // Calculate rankings
        const activeSlots = getActiveTurnOrder(stateRef.current.slotStates);
        const ranks = activeSlots
          .map((slot) => ({
            slot,
            name: stateRef.current.playerNames[slot] || PLAYER_METADATA[slot].label,
            score: activeScores[slot] || 0,
            words: stateRef.current.wordsClaimedCount[slot] || 0,
            avatar: PLAYER_METADATA[slot].avatar,
            hex: PLAYER_METADATA[slot].hex,
          }))
          .sort((a, b) => b.score - a.score)
          .map((item, idx) => ({ ...item, rank: idx + 1 }));

        setGameOverRankings(ranks);
        return true;
      }
      return false;
    },
    [fireConfetti, getActiveTurnOrder]
  );

  // AI Turn simulation for offline / solo mode
  const executeAITurn = useCallback(
    (botSlot) => {
      if (stateRef.current.isGameOver) return;

      setTimeout(() => {
        const { grid: currentGrid, claimedFingerprints: curFp } = stateRef.current;

        // 1. Find an empty cell
        const emptyIndices = [];
        currentGrid.forEach((cell, idx) => {
          if (!cell.letter) emptyIndices.push(idx);
        });

        if (emptyIndices.length === 0) {
          checkGameOver();
          return;
        }

        // Pick empty cell (prefer neighboring existing letters if any)
        let chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const candidateNeighbors = emptyIndices.filter((idx) => {
          const r = Math.floor(idx / 10);
          const c = idx % 10;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                if (currentGrid[nr * 10 + nc].letter) return true;
              }
            }
          }
          return false;
        });

        if (candidateNeighbors.length > 0 && Math.random() > 0.3) {
          chosenIndex = candidateNeighbors[Math.floor(Math.random() * candidateNeighbors.length)];
        }

        // Strategic letter choices
        const frequentLetters = 'EEEEAAAARRRRTTTTOOOOSSSSNNNNIIIILLLLCCCCDDDDGGGGMMMM';
        const letterToPlace = frequentLetters[Math.floor(Math.random() * frequentLetters.length)];

        // Place letter
        const newGrid = [...currentGrid];
        newGrid[chosenIndex] = {
          ...newGrid[chosenIndex],
          letter: letterToPlace,
        };

        setGrid(newGrid);
        setJustPlacedIndex(chosenIndex);

        // 2. Check if AI can form a word
        const found = findWordOnGrid(newGrid, curFp, 5);

        if (found) {
          setTimeout(() => {
            const { word, path } = found;
            const pts = getWordPoints(word);
            const fp = path.map((p) => `${p.row},${p.col}`).join('->');

            const updatedGrid = newGrid.map((c) => {
              const inFound = path.some((p) => p.row === c.row && p.col === c.col);
              if (inFound) {
                return {
                  ...c,
                  claimedBy: botSlot,
                  claimColor: PLAYER_METADATA[botSlot].hex,
                };
              }
              return c;
            });

            const nextScores = {
              ...stateRef.current.scores,
              [botSlot]: (stateRef.current.scores[botSlot] || 0) + pts,
            };

            setGrid(updatedGrid);
            setScores(nextScores);
            setWordsClaimedCount((prev) => ({
              ...prev,
              [botSlot]: (prev[botSlot] || 0) + 1,
            }));
            setClaimedFingerprints((prev) => new Set([...prev, fp]));

            showToast(
              `🤖 ${stateRef.current.playerNames[botSlot]} claimed "${word}" for +${pts} pts!`,
              'success',
              2600
            );

            if (!checkGameOver(updatedGrid, nextScores)) {
              setTimeout(() => advanceTurn(), 800);
            }
          }, 1000);
        } else {
          // No word found -> Fast proceed after 1s
          setTimeout(() => {
            advanceTurn(`🤖 ${stateRef.current.playerNames[botSlot]} passed`);
          }, 1100);
        }
      }, 900);
    },
    [advanceTurn, checkGameOver, showToast]
  );

  // Turn timer countdown effect
  useEffect(() => {
    if (view !== 'ARENA' || isGameOver) return;

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          // Turn Expired
          advanceTurn(`⏰ Turn expired for ${stateRef.current.playerNames[stateRef.current.currentTurn]}`);
          return 30;
        }
        return prev - 1;
      });

      // Post-turn 5s Fast Proceed countdown
      if (currentPhase === 'CLAIM_WORD') {
        setFastProceedCountdown((prev) => {
          if (prev <= 1) {
            advanceTurn('⏩ Auto-proceeded turn');
            return 5;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [view, isGameOver, currentPhase, advanceTurn]);

  // Handle active bot turns
  useEffect(() => {
    if (view !== 'ARENA' || isGameOver) return;

    const activeSlot = currentTurn;
    const isBot =
      (isSoloAI && activeSlot !== mySlot) ||
      botSlots.has(activeSlot) ||
      stateRef.current.playerNames[activeSlot]?.includes('[AI]');

    if (isBot) {
      executeAITurn(activeSlot);
    }
  }, [currentTurn, view, isGameOver, isSoloAI, mySlot, executeAITurn, botSlots]);

  // Handle WebSocket Event Subscriptions
  const handleSocketEvent = useCallback(
    (event) => {
      if (!event || !event.type) return;

      switch (event.type) {
        case 'PLAYER_JOINED': {
          setSlotStates((prev) => ({
            ...prev,
            [event.slot]: 'ACTIVE',
          }));
          if (event.playerName) {
            setPlayerNames((prev) => ({
              ...prev,
              [event.slot]: event.playerName,
            }));
          }
          setReadyStates((prev) => ({
            ...prev,
            [event.slot]: false,
          }));
          showToast(`🎮 ${event.playerName || event.slot} joined the room!`, 'success');

          // If Host, broadcast room synchronization so guest receives current slotStates, playerNames & readyStates
          if (stateRef.current.isHost && stateRef.current.sessionId) {
            wordgridSocket.sendRoomEvent(stateRef.current.sessionId, {
              type: 'ROOM_SYNC',
              slotStates: {
                ...stateRef.current.slotStates,
                [event.slot]: 'ACTIVE',
              },
              playerNames: {
                ...stateRef.current.playerNames,
                [event.slot]: event.playerName || stateRef.current.playerNames[event.slot],
              },
              readyStates: {
                ...stateRef.current.readyStates,
                P1: true,
                [event.slot]: false,
              },
            });
          }
          break;
        }
        case 'PLAYER_READY': {
          const { slot, isReady } = event;
          setReadyStates((prev) => ({
            ...prev,
            [slot]: Boolean(isReady),
          }));
          const pName = stateRef.current.playerNames[slot] || slot;
          showToast(
            isReady ? `🟢 ${pName} is Ready!` : `⏳ ${pName} is not ready`,
            'info',
            2000
          );
          break;
        }
        case 'ROOM_SYNC': {
          if (event.slotStates) {
            setSlotStates((prev) => ({ ...prev, ...event.slotStates }));
          }
          if (event.playerNames) {
            setPlayerNames((prev) => ({ ...prev, ...event.playerNames }));
          }
          if (event.readyStates) {
            setReadyStates((prev) => ({ ...prev, ...event.readyStates, P1: true }));
          }
          break;
        }
        case 'START_MATCH':
        case 'ROOM_READY': {
          setIsRoomModalOpen(false);
          setView('ARENA');
          if (event.slotStates) setSlotStates(event.slotStates);
          if (event.firstTurn) setCurrentTurn(event.firstTurn);
          showToast('🚀 Match starting! Let the word blitz begin!', 'success');
          break;
        }
        case 'LETTER_PLACED': {
          const { row, col, letter, slot } = event;
          const idx = row * 10 + col;
          setGrid((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], letter: letter.toUpperCase() };
            return next;
          });
          setJustPlacedIndex(idx);
          if (slot === mySlot) {
            setCurrentPhase('CLAIM_WORD');
            setFastProceedCountdown(5);
          }
          break;
        }
        case 'WORD_RESULT': {
          const { slot, word, valid, pointsAwarded, cells, scores: newScores } = event;
          if (valid) {
            showToast(`🎉 ${slot} claimed "${word}" (+${pointsAwarded} pts)!`, 'success');
            if (cells && Array.isArray(cells)) {
              setGrid((prev) => {
                const next = [...prev];
                cells.forEach((c) => {
                  const idx = c.row * 10 + c.col;
                  if (next[idx]) {
                    next[idx] = {
                      ...next[idx],
                      claimedBy: slot,
                      claimColor: PLAYER_METADATA[slot].hex,
                    };
                  }
                });
                return next;
              });
            }
            if (newScores) setScores(newScores);
          } else {
            showToast(`⚠️ "${word}" is not a valid word (${pointsAwarded} penalty)!`, 'error');
          }
          break;
        }
        case 'TURN_ENDED':
        case 'FAST_PROCEED': {
          if (event.nextTurn) {
            setCurrentTurn(event.nextTurn);
            setCurrentPhase('PLACE_LETTER');
            setTurnTimer(30);
            setFastProceedCountdown(5);
            setSelectedEmptyIndex(null);
            setTracedPath([]);
          }
          break;
        }
        case 'TURN_SKIPPED': {
          showToast(`⏩ ${event.slot} was skipped [${event.reason || 'INACTIVE'}]`, 'skip');
          if (event.nextTurn) setCurrentTurn(event.nextTurn);
          break;
        }
        case 'GAME_OVER': {
          setIsGameOver(true);
          fireConfetti();
          if (event.rankings) setGameOverRankings(event.rankings);
          break;
        }
        default:
          break;
      }
    },
    [fireConfetti, mySlot, showToast]
  );

  // Place Letter selection
  const handleLetterSelection = useCallback(
    (letter) => {
      if (selectedEmptyIndex === null) return;
      const cell = grid[selectedEmptyIndex];
      if (!cell || cell.letter !== '') return;

      const newGrid = [...grid];
      newGrid[selectedEmptyIndex] = {
        ...newGrid[selectedEmptyIndex],
        letter: letter.toUpperCase(),
      };

      setGrid(newGrid);
      setJustPlacedIndex(selectedEmptyIndex);
      setSelectedEmptyIndex(null);
      setCurrentPhase('CLAIM_WORD');
      setFastProceedCountdown(5);

      // Send to WebSocket if live session
      if (!isSoloAI && sessionId) {
        const activeColor = PLAYER_METADATA[mySlot].colorName.toUpperCase();
        wordgridSocket.placeLetter(sessionId, user?.userId || mySlot, activeColor, cell.row, cell.col, letter);
      }

      showToast(`Placed letter "${letter.toUpperCase()}". Trace a word or Fast Proceed!`, 'info', 2000);
    },
    [grid, isSoloAI, mySlot, selectedEmptyIndex, sessionId, showToast, user?.userId]
  );

  // Keyboard shortcut listener for letter placement
  useEffect(() => {
    if (view !== 'ARENA' || currentPhase !== 'PLACE_LETTER') return;
    if (currentTurn !== mySlot && !isSoloAI) return;
    if (selectedEmptyIndex === null) return;

    const handleKeyDown = (e) => {
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        handleLetterSelection(key);
      } else if (e.key === 'Escape') {
        setSelectedEmptyIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentPhase, currentTurn, mySlot, isSoloAI, selectedEmptyIndex, handleLetterSelection]);

  // Initialize room from URL query if ?room=WGB-XXXX exists
  useEffect(() => {
    const urlRoom = (searchParams.get('room') || '').trim().toUpperCase();
    if (urlRoom && view === 'LOBBY' && !sessionId) {
      getWordGridRoomStatus(urlRoom)
        .then((res) => {
          if (res) {
            const playerId = user?.userId || `GUEST_${Math.floor(100000 + Math.random() * 900000)}`;
            const playerName = user?.displayName || 'Player';
            joinWordGridRoom({ roomCode: urlRoom, playerId, playerName }).then((joinRes) => {
              if (joinRes) {
                const assigned = joinRes.assignedSlot || 'P2';
                setSessionId(joinRes.sessionId);
                setRoomCode(urlRoom);
                setIsHost(false);
                setMySlot(assigned);
                setSlotStates(joinRes.slotStates || getSlotStatesForCount(joinRes.playerCount || 2));
                setPlayerCount(joinRes.playerCount || 2);
                if (joinRes.playerNames) setPlayerNames(joinRes.playerNames);
                setReadyStates({ P1: true, P2: false, P3: false, P4: false });
                setIsSoloAI(false);
                setBotSlots(new Set());

                wordgridSocket.connect({
                  sessionId: joinRes.sessionId,
                  onEvent: handleSocketEvent,
                  onConnect: () => {
                    wordgridSocket.sendRoomEvent(joinRes.sessionId, {
                      type: 'PLAYER_JOINED',
                      slot: assigned,
                      playerId,
                      playerName,
                    });
                  },
                });

                // FIX: Open Waiting Room Modal, DO NOT jump directly into ARENA!
                setIsRoomModalOpen(true);
                showToast(`🎮 Joined Room ${urlRoom}! Please mark as Ready.`, 'success');
              }
            });
          }
        })
        .catch(() => {});
    }
  }, [searchParams, user, view, sessionId, handleSocketEvent, showToast]);

  // Clean up socket and matchmaking intervals on unmount
  useEffect(() => {
    return () => {
      if (searchIntervalRef.current) {
        clearInterval(searchIntervalRef.current);
        searchIntervalRef.current = null;
      }
      wordgridSocket.disconnect();
    };
  }, []);

  // Create Private Room (Host)
  const handleCreatePrivateRoom = async () => {
    const playerId = user?.userId || `HOST_${Math.floor(100000 + Math.random() * 900000)}`;
    const playerName = user?.displayName || 'Host Player';

    const res = await createWordGridRoom({ playerId, playerName, playerCount });
    if (res) {
      setSessionId(res.sessionId);
      setRoomCode(res.roomCode);
      setIsHost(true);
      setMySlot('P1');
      setSlotStates(res.slotStates);
      if (res.playerNames) setPlayerNames(res.playerNames);
      setReadyStates({ P1: true, P2: false, P3: false, P4: false });
      setIsSoloAI(false);
      setBotSlots(new Set());
      setIsRoomModalOpen(true);

      wordgridSocket.connect({
        sessionId: res.sessionId,
        onEvent: handleSocketEvent,
      });
    }
  };

  // Launch Quick Match with 12s search countdown & realistic human names fallback
  const handleQuickMatch = async () => {
    if (isSearchingMatch) return;

    const playerId = user?.userId || `PLAYER_${Math.floor(100000 + Math.random() * 900000)}`;
    const playerName = user?.displayName || 'Player 1';
    const newSessionId = `OWG_QM_${Math.floor(10000 + Math.random() * 90000)}`;
    const newRoomCode = generateMockRoomCode();

    setSessionId(newSessionId);
    setRoomCode(newRoomCode);
    setIsHost(true);
    setMySlot('P1');
    setIsSoloAI(false);
    setBotSlots(new Set());

    // Connect to WebSocket so live players can match if available
    wordgridSocket.connect({
      sessionId: newSessionId,
      onEvent: handleSocketEvent,
    });

    setIsSearchingMatch(true);
    setSearchCountdown(12);
    searchCountdownRef.current = 12;

    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
    }

    searchIntervalRef.current = setInterval(() => {
      searchCountdownRef.current -= 1;
      setSearchCountdown(searchCountdownRef.current);

      if (searchCountdownRef.current <= 0) {
        clearInterval(searchIntervalRef.current);
        searchIntervalRef.current = null;
        finalizeQuickMatch(newSessionId, newRoomCode, playerCount, playerId, playerName);
      }
    }, 1000);
  };

  // Finalize Quick Match: Auto-fill with realistic human names and smoothly enter arena
  const finalizeQuickMatch = (sessId, rCode, count, playerId, playerName) => {
    setIsSearchingMatch(false);

    const slots = getSlotStatesForCount(count);
    const neededSlots = ALL_SLOTS.filter((s) => slots[s] === 'WAITING');

    const newPlayerNames = {
      P1: playerName,
      P2: 'No Player',
      P3: 'No Player',
      P4: 'No Player',
    };
    const newSlotStates = { ...slots, P1: 'ACTIVE' };
    const simulatedBots = new Set();

    // Auto-fill realistic human names
    const shuffledNames = [...REALISTIC_NAMES].sort(() => 0.5 - Math.random());
    neededSlots.forEach((slot, idx) => {
      newSlotStates[slot] = 'ACTIVE';
      newPlayerNames[slot] = shuffledNames[idx % shuffledNames.length];
      simulatedBots.add(slot);
    });

    setSlotStates(newSlotStates);
    setPlayerNames(newPlayerNames);
    setBotSlots(simulatedBots);
    setScores({ P1: 0, P2: 0, P3: 0, P4: 0 });
    setWordsClaimedCount({ P1: 0, P2: 0, P3: 0, P4: 0 });
    setGrid(createInitialGrid());
    setClaimedFingerprints(new Set());
    setIsGameOver(false);
    setCurrentTurn('P1');
    setCurrentPhase('PLACE_LETTER');
    setTurnTimer(30);

    setView('ARENA');
    setIsRoomModalOpen(false);
    showToast('⚡ Match found! Entering arena...', 'success');
  };

  // Cancel Quick Match Search
  const handleCancelSearch = () => {
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
      searchIntervalRef.current = null;
    }
    setIsSearchingMatch(false);
    setSearchCountdown(12);
    wordgridSocket.disconnect();
    showToast('Matchmaking search cancelled.', 'info');
  };

  // Copy Private Room Shareable Link
  const handleCopyLink = () => {
    const origin = window.location.origin;
    const fullUrl = `${origin}/games/wordgrid?room=${roomCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      showToast('📋 Room link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Action: Join Room by Room Code (Guest)
  const handleJoinByCode = async (codeToJoin) => {
    const rawCode = (codeToJoin !== undefined ? codeToJoin : joinCodeInput) || '';
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      showToast('⚠️ Please enter a valid room code!', 'error');
      return;
    }

    setIsJoining(true);
    try {
      const statusRes = await getWordGridRoomStatus(code);
      if (statusRes && (statusRes.status === 'ABANDONED' || statusRes.status === 'CLOSED')) {
        showToast(`⚠️ Room ${code} is inactive or closed.`, 'error');
        setIsJoining(false);
        return;
      }

      const playerId = user?.userId || `GUEST_${Math.floor(100000 + Math.random() * 900000)}`;
      const playerName = user?.displayName || 'Player';

      const joinRes = await joinWordGridRoom({ roomCode: code, playerId, playerName });
      if (!joinRes) {
        showToast('⚠️ Could not join room. Please check the code and try again.', 'error');
        setIsJoining(false);
        return;
      }

      const assigned = joinRes.assignedSlot || 'P2';
      setSessionId(joinRes.sessionId);
      setRoomCode(joinRes.roomCode || code);
      setIsHost(false);
      setMySlot(assigned);
      const updatedSlotStates = joinRes.slotStates || getSlotStatesForCount(joinRes.playerCount || 2);
      setSlotStates(updatedSlotStates);
      setPlayerCount(joinRes.playerCount || 2);
      if (joinRes.playerNames) setPlayerNames(joinRes.playerNames);
      setReadyStates({ P1: true, P2: false, P3: false, P4: false });
      setIsSoloAI(false);
      setBotSlots(new Set());

      wordgridSocket.connect({
        sessionId: joinRes.sessionId,
        onEvent: handleSocketEvent,
        onConnect: () => {
          wordgridSocket.sendRoomEvent(joinRes.sessionId, {
            type: 'PLAYER_JOINED',
            slot: assigned,
            playerId,
            playerName,
          });
        },
      });

      // FIX: Open Private Room Modal, DO NOT setView('ARENA')
      setIsRoomModalOpen(true);
      showToast(`🎮 Joined room ${code}! Please mark as Ready.`, 'success');
      setJoinCodeInput('');
    } catch (err) {
      console.warn('Failed to join room:', err);
      showToast(`⚠️ Error joining room ${code}: ${err.message || 'Network error'}`, 'error');
    } finally {
      setIsJoining(false);
    }
  };

  // Guest Ready State Toggle
  const handleToggleReady = () => {
    const newReady = !readyStates[mySlot];
    setReadyStates((prev) => ({
      ...prev,
      [mySlot]: newReady,
    }));
    if (sessionId) {
      wordgridSocket.sendPlayerReady(
        sessionId,
        user?.userId || mySlot,
        mySlot,
        newReady
      );
    }
    showToast(newReady ? "🟢 You are marked as Ready!" : "⏳ Marked as Not Ready", 'info');
  };

  // Host: Start Match Now (Broadcasts START_MATCH to all participants)
  const handleHostStartGame = () => {
    const activeCount = ALL_SLOTS.filter((s) => slotStates[s] === 'ACTIVE').length;
    const guestSlots = ALL_SLOTS.filter((s) => s !== 'P1' && slotStates[s] === 'ACTIVE');
    const allGuestsReady = guestSlots.length > 0 && guestSlots.every((s) => Boolean(readyStates[s]));

    if (activeCount < 2 || !allGuestsReady) {
      showToast('⚠️ Waiting for all players to be Ready before starting!', 'error', 3000);
      return;
    }

    if (sessionId) {
      wordgridSocket.sendStartMatch(sessionId);
    }

    // Direct transition as well
    setIsRoomModalOpen(false);
    setView('ARENA');
    showToast('🚀 Match starting! Let the word blitz begin!', 'success');
  };

  // Play Again rematch
  const handlePlayAgain = () => {
    setGrid(createInitialGrid());
    setScores({ P1: 0, P2: 0, P3: 0, P4: 0 });
    setWordsClaimedCount({ P1: 0, P2: 0, P3: 0, P4: 0 });
    setClaimedFingerprints(new Set());
    setIsGameOver(false);
    setCurrentTurn('P1');
    setCurrentPhase('PLACE_LETTER');
    setTurnTimer(30);
    setFastProceedCountdown(5);
    setSelectedEmptyIndex(null);
    setTracedPath([]);
    setJustPlacedIndex(null);
    showToast('🔄 Rematch started! Good luck!', 'success');
  };

  // Cell Click Handler
  const handleCellClick = (cellIndex) => {
    if (isGameOver) return;
    const isMyTurn = currentTurn === mySlot || (isSoloAI && currentTurn === 'P1');
    if (!isMyTurn) return;

    const cell = grid[cellIndex];

    // Phase 1: Letter Placement
    if (currentPhase === 'PLACE_LETTER') {
      if (cell.letter === '') {
        setSelectedEmptyIndex(cellIndex === selectedEmptyIndex ? null : cellIndex);
      }
      return;
    }

    // Phase 2: Word Claiming (Sequence Tapping)
    if (currentPhase === 'CLAIM_WORD') {
      if (!cell.letter) return; // Cannot trace empty cell

      const alreadyInPathIdx = tracedPath.findIndex((p) => p.index === cellIndex);

      if (alreadyInPathIdx >= 0) {
        // Tapped on already traced cell -> undo back to this cell
        setTracedPath((prev) => prev.slice(0, alreadyInPathIdx + 1));
        return;
      }

      if (tracedPath.length === 0) {
        // First cell in trace
        setTracedPath([cell]);
      } else {
        // Check adjacency to the last cell in path
        const lastCell = tracedPath[tracedPath.length - 1];
        if (isAdjacent(lastCell, cell)) {
          setTracedPath((prev) => [...prev, cell]);
        } else {
          showToast('⚠️ Word paths must connect adjacent cells!', 'error', 1500);
        }
      }
    }
  };

  // Drag-to-trace word handlers
  const handleCellMouseDown = (cellIndex) => {
    if (isGameOver || currentPhase !== 'CLAIM_WORD') return;
    const isMyTurn = currentTurn === mySlot || (isSoloAI && currentTurn === 'P1');
    if (!isMyTurn) return;

    const cell = grid[cellIndex];
    if (!cell.letter) return;

    setIsDraggingPath(true);
    setTracedPath([cell]);
  };

  const handleCellMouseEnter = (cellIndex) => {
    if (!isDraggingPath || currentPhase !== 'CLAIM_WORD') return;
    const cell = grid[cellIndex];
    if (!cell.letter) return;

    // Avoid duplicates in path
    if (tracedPath.some((p) => p.index === cellIndex)) return;

    const lastCell = tracedPath[tracedPath.length - 1];
    if (lastCell && isAdjacent(lastCell, cell)) {
      setTracedPath((prev) => [...prev, cell]);
    }
  };

  const handleMouseUp = () => {
    if (isDraggingPath) {
      setIsDraggingPath(false);
    }
  };

  // Formed word string from current path
  const currentSpelledWord = tracedPath.map((p) => p.letter).join('');
  const isCurrentWordValid = isValidWord(currentSpelledWord);
  const potentialPoints = isCurrentWordValid ? (currentSpelledWord.length >= 7 ? 3 : 2) : -1;

  // Confirm Word Claim
  const handleConfirmWordClaim = () => {
    if (tracedPath.length < 3) {
      showToast('⚠️ Words must be at least 3 letters long!', 'error', 1800);
      return;
    }

    const pathFingerprint = tracedPath.map((p) => `${p.row},${p.col}`).join('->');
    if (claimedFingerprints.has(pathFingerprint)) {
      showToast('⚠️ This exact word path has already been claimed!', 'error', 2000);
      return;
    }

    const activeSlot = currentTurn;
    const spelled = currentSpelledWord.toUpperCase();

    if (isValidWord(spelled)) {
      const pts = spelled.length >= 7 ? 3 : 2;
      const updatedGrid = grid.map((cell) => {
        const inPath = tracedPath.some((p) => p.index === cell.index);
        if (inPath) {
          return {
            ...cell,
            claimedBy: activeSlot,
            claimColor: PLAYER_METADATA[activeSlot].hex,
          };
        }
        return cell;
      });

      const nextScores = {
        ...scores,
        [activeSlot]: (scores[activeSlot] || 0) + pts,
      };

      setGrid(updatedGrid);
      setScores(nextScores);
      setWordsClaimedCount((prev) => ({
        ...prev,
        [activeSlot]: (prev[activeSlot] || 0) + 1,
      }));
      setClaimedFingerprints((prev) => new Set([...prev, pathFingerprint]));
      setTracedPath([]);

      showToast(`🎉 Word "${spelled}" Claimed! +${pts} Points!`, 'success', 2500);

      // Send to WebSocket
      if (!isSoloAI && sessionId) {
        const pathPayload = tracedPath.map((p) => ({ row: p.row, col: p.col }));
        wordgridSocket.claimWord(
          sessionId,
          user?.userId || activeSlot,
          PLAYER_METADATA[activeSlot].colorName.toUpperCase(),
          pathPayload
        );
      }

      if (!checkGameOver(updatedGrid, nextScores)) {
        advanceTurn();
      }
    } else {
      // Penalty: -1 point
      const nextScores = {
        ...scores,
        [activeSlot]: Math.max(0, (scores[activeSlot] || 0) - 1),
      };
      setScores(nextScores);
      showToast(`❌ "${spelled}" is not in dictionary! (-1 pt penalty)`, 'error', 2500);
      setTracedPath([]);
    }
  };

  // Cancel Word Trace
  const handleCancelWordTrace = () => {
    setTracedPath([]);
  };

  // Fast Proceed ⏩ Button
  const handleFastProceed = () => {
    const isMyTurn = currentTurn === mySlot || (isSoloAI && currentTurn === 'P1');
    if (!isMyTurn) return;

    if (!isSoloAI && sessionId) {
      wordgridSocket.fastProceed(sessionId, user?.userId || currentTurn);
    }
    advanceTurn(`⏩ Turn skipped by ${playerNames[currentTurn]}`);
  };

  // Reset to Lobby
  const handleBackToLobby = () => {
    wordgridSocket.disconnect();
    setView('LOBBY');
    setIsGameOver(false);
    setGrid(createInitialGrid());
    setIsRoomModalOpen(false);
  };

  return (
    <div className="wgb-container" onMouseUp={handleMouseUp}>
      {/* Toast Overlay */}
      <div className="wgb-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`wgb-toast ${t.type}`}>
            {t.type === 'success' && '✨'}
            {t.type === 'error' && '⚠️'}
            {t.type === 'skip' && '⏩'}
            {t.type === 'info' && '💡'}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <header className="wgb-header">
        {view === 'ARENA' ? (
          <button className="wgb-back-link" onClick={handleBackToLobby}>
            ← Exit to Lobby
          </button>
        ) : (
          <Link to="/games" className="wgb-back-link">
            ← Games Hub
          </Link>
        )}

        {view === 'ARENA' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="wgb-room-badge">
              ROOM: {roomCode || 'SOLO'} ({playerCount}P)
            </span>
          </div>
        )}
      </header>

      {/* ================= LOBBY SCREEN ================= */}
      {view === 'LOBBY' && (
        <main className="wgb-lobby-hero">
          <div className="wgb-lobby-badge">Word Grid Blitz microservice</div>
          <h1 className="wgb-lobby-title">WORD GRID BLITZ</h1>
          <p className="wgb-lobby-subtitle">
            Strategic 10×10 real-time word battle. Place letters, trace connected lines, claim words, and dominate the
            neon grid!
          </p>

          {/* Segmented Toggle for Player Count */}
          <div className="wgb-player-segmented">
            <button
              className={`wgb-segment-btn ${playerCount === 2 ? 'active' : ''}`}
              onClick={() => setPlayerCount(2)}
            >
              <span>⚔️</span> 2P Duel
            </button>
            <button
              className={`wgb-segment-btn ${playerCount === 3 ? 'active' : ''}`}
              onClick={() => setPlayerCount(3)}
            >
              <span>🔺</span> 3P Trio
            </button>
            <button
              className={`wgb-segment-btn ${playerCount === 4 ? 'active' : ''}`}
              onClick={() => setPlayerCount(4)}
            >
              <span>👑</span> 4P Squad
            </button>
          </div>

          {/* Action Cards: Exactly 2 Options */}
          <div className="wgb-lobby-actions">
            {/* 1. Quick Match Card */}
            <div className="wgb-action-card highlight wgb-quick-match-card">
              <div className="wgb-action-icon">⚡</div>
              <h2 className="wgb-action-title">Quick Match</h2>
              <p className="wgb-action-desc">
                Instant 10×10 matchmaking. Play with live opponents or auto-match seamlessly.
              </p>

              {isSearchingMatch ? (
                <div className="wgb-search-in-progress">
                  <div className="wgb-search-radar">
                    <div className="wgb-radar-ring ring-1" />
                    <div className="wgb-radar-ring ring-2" />
                    <div className="wgb-radar-ring ring-3" />
                    <span className="wgb-radar-icon">⚡</span>
                  </div>
                  <div className="wgb-search-status-title">Searching for Opponents...</div>
                  <div className="wgb-search-countdown-badge">⏱️ {searchCountdown}s</div>
                  <p className="wgb-search-status-sub">
                    Auto-filling with players in {searchCountdown}s...
                  </p>
                  <button className="wgb-btn-cancel-search" onClick={handleCancelSearch}>
                    ✕ Cancel Search
                  </button>
                </div>
              ) : (
                <div className="wgb-quick-match-idle">
                  <button className="wgb-btn-primary" onClick={handleQuickMatch}>
                    <span>⚡</span> Find Match ({playerCount}P)
                  </button>
                  <div className="wgb-quick-match-hint">12s matchmaking countdown</div>
                </div>
              )}
            </div>

            {/* 2. Private Room Card (Create Room + Join by Code directly on the card) */}
            <div className="wgb-action-card wgb-private-room-card">
              <div className="wgb-action-icon">🔗</div>
              <h2 className="wgb-action-title">Private Room</h2>
              <p className="wgb-action-desc">
                Create a private room to invite friends, or join an active match with a room code.
              </p>

              <div className="wgb-private-card-body">
                <button className="wgb-btn-primary wgb-btn-create-room" onClick={handleCreatePrivateRoom}>
                  <span>➕</span> Create Room ({playerCount}P)
                </button>

                <div className="wgb-card-divider">
                  <span>OR JOIN BY CODE</span>
                </div>

                <form
                  className="wgb-card-join-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinByCode(joinCodeInput);
                  }}
                >
                  <div className="wgb-card-input-wrap">
                    <span className="wgb-card-input-icon">🔑</span>
                    <input
                      type="text"
                      className="wgb-card-join-input"
                      placeholder="e.g. WGB-ABCD"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={16}
                      disabled={isJoining}
                      aria-label="Room Code"
                    />
                  </div>
                  <button
                    type="submit"
                    className="wgb-btn-secondary wgb-btn-join-room"
                    disabled={isJoining || !joinCodeInput.trim()}
                  >
                    <span>🚪</span> {isJoining ? 'Joining...' : 'Join Room'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Private Room Waiting Modal */}
      {isRoomModalOpen && (
        <div className="wgb-modal-overlay">
          <div className="wgb-modal-box">
            <button className="wgb-modal-close" onClick={() => setIsRoomModalOpen(false)}>
              ✕
            </button>
            <div className="wgb-lobby-badge">
              {isHost ? 'Private Room (Host)' : 'Waiting Room (Guest)'}
            </div>
            <h2 style={{ margin: '0.5rem 0', color: '#fff' }}>
              {isHost ? 'Invite Your Opponents' : `Room ${roomCode}`}
            </h2>
            <p style={{ color: 'var(--wgb-text-muted)', fontSize: '0.9rem' }}>
              {isHost
                ? `Share this room code or link with friends to fill all ${playerCount} player slots:`
                : 'Waiting for the host to start the match. Mark yourself as ready below!'}
            </p>

            <div className="wgb-room-code-display">
              <span className="wgb-room-code-text">{roomCode}</span>
              <button className="wgb-copy-btn" onClick={handleCopyLink}>
                {copiedLink ? '✓ Copied!' : '📋 Copy Link'}
              </button>
            </div>

            {/* Multiplayer Guard Notice Banner for Host */}
            {isHost && ALL_SLOTS.filter((s) => slotStates[s] === 'ACTIVE').length < 2 && (
              <div className="wgb-room-warning-banner">
                ⚠️ Only you are active in this room. Share your room code above to let friends join before starting!
              </div>
            )}

            {isHost &&
              ALL_SLOTS.filter((s) => slotStates[s] === 'ACTIVE').length >= 2 &&
              !ALL_SLOTS.filter((s) => s !== 'P1' && slotStates[s] === 'ACTIVE').every((s) => Boolean(readyStates[s])) && (
                <div className="wgb-room-warning-banner waiting">
                  ⏳ Waiting for all joined players to mark themselves as Ready...
                </div>
              )}

            {/* Live Slot Status Cards */}
            <div className="wgb-slots-grid">
              {ALL_SLOTS.map((slot) => {
                const meta = PLAYER_METADATA[slot];
                const state = slotStates[slot];
                const isInactive = state === 'INACTIVE_SETUP';
                const isWaiting = state === 'WAITING';
                const isActive = state === 'ACTIVE';
                const isMe = slot === mySlot;
                const isSlotReady = slot === 'P1' ? true : Boolean(readyStates[slot]);
                const name = isInactive
                  ? 'No Player'
                  : isWaiting
                    ? 'Waiting for player...'
                    : playerNames[slot] || meta.label;

                return (
                  <div
                    key={slot}
                    className={`wgb-slot-card slot-${slot.toLowerCase()} ${
                      isInactive ? 'inactive-setup' : ''
                    } ${isMe ? 'is-me' : ''}`}
                  >
                    {isInactive && (
                      <div className="wgb-inactive-overlay">
                        <span className="wgb-inactive-overlay-x">✖</span>
                        <span>No Player</span>
                      </div>
                    )}
                    <div className="wgb-slot-avatar">{meta.avatar}</div>
                    <div className="wgb-slot-info">
                      <div className="wgb-slot-player-name">
                        {name} {isMe ? <span className="wgb-me-tag">(You)</span> : null}
                      </div>
                      <div className="wgb-slot-tag">
                        {slot === 'P1' ? (
                          <span className="wgb-host-badge">👑 Host • 🟢 Ready</span>
                        ) : isActive ? (
                          isSlotReady ? (
                            <span className="wgb-ready-badge ready">🟢 Ready</span>
                          ) : (
                            <span className="wgb-ready-badge unready">⏳ Not Ready</span>
                          )
                        ) : (
                          <span>{meta.label} • {state || 'WAITING'}</span>
                        )}
                      </div>

                      {/* Guest sees their slot with a "Ready" toggle button: [ 🟢 I'm Ready / ⏳ Mark as Ready ] */}
                      {!isHost && isMe && isActive && (
                        <div className="wgb-slot-ready-action">
                          <button
                            type="button"
                            className={`wgb-ready-toggle-btn ${readyStates[slot] ? 'is-ready' : 'not-ready'}`}
                            onClick={handleToggleReady}
                          >
                            {readyStates[slot] ? "🟢 I'm Ready" : "⏳ Mark as Ready"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Controls: Host vs Guest */}
            {isHost ? (
              <div className="wgb-modal-host-footer">
                {(() => {
                  const activeSlots = ALL_SLOTS.filter((s) => slotStates[s] === 'ACTIVE');
                  const activeCount = activeSlots.length;
                  const guestSlots = ALL_SLOTS.filter((s) => s !== 'P1' && slotStates[s] === 'ACTIVE');
                  const allGuestsReady = guestSlots.length > 0 && guestSlots.every((s) => Boolean(readyStates[s]));
                  const canHostStart = activeCount >= 2 && allGuestsReady;

                  let buttonMessage = '🚀 Start Game Now';
                  if (activeCount < 2) {
                    buttonMessage = 'Waiting for players to join...';
                  } else if (!allGuestsReady) {
                    buttonMessage = 'Waiting for all players to be Ready...';
                  }

                  return (
                    <button
                      className={`wgb-btn-primary ${!canHostStart ? 'disabled' : 'wgb-btn-pulse'}`}
                      disabled={!canHostStart}
                      onClick={handleHostStartGame}
                      title={buttonMessage}
                    >
                      {canHostStart ? '🚀 Start Game Now' : `⏳ ${buttonMessage}`}
                    </button>
                  );
                })()}
                <button className="wgb-btn-outline" onClick={() => setIsRoomModalOpen(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="wgb-modal-guest-footer">
                <button
                  type="button"
                  className={`wgb-ready-toggle-btn-lg ${readyStates[mySlot] ? 'is-ready' : 'not-ready'}`}
                  onClick={handleToggleReady}
                >
                  {readyStates[mySlot] ? "🟢 I'm Ready (Click to Unready)" : "⏳ Mark as Ready"}
                </button>
                <div className="wgb-guest-waiting-msg">
                  {readyStates[mySlot]
                    ? '✨ You are ready! Waiting for host to start the game...'
                    : '👉 Click "Mark as Ready" to signal the host you are ready to play!'}
                </div>
                <button className="wgb-btn-outline" onClick={() => setIsRoomModalOpen(false)}>
                  Leave Room
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ARENA SCREEN ================= */}
      {view === 'ARENA' && (
        <main className="wgb-arena-layout">
          {/* Turn Header Controls */}
          <section className="wgb-arena-controls">
            <div className="wgb-turn-header">
              <div className={`wgb-turn-active-pill ${currentTurn.toLowerCase()}`}>
                <span>{PLAYER_METADATA[currentTurn].avatar}</span>
                <span>
                  {playerNames[currentTurn]}'s Turn ({PLAYER_METADATA[currentTurn].colorName})
                </span>
                {currentTurn === mySlot && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(YOU)</span>}
              </div>

              <div className="wgb-turn-actions">
                <button
                  className="wgb-fast-proceed-btn"
                  onClick={handleFastProceed}
                  disabled={currentTurn !== mySlot && !isSoloAI}
                  title="Finish turn early if no word can be formed"
                >
                  <span>Fast Proceed ⏩</span>
                  {currentPhase === 'CLAIM_WORD' && <span>({fastProceedCountdown}s)</span>}
                </button>
              </div>
            </div>

            {/* 30s Turn Countdown Bar */}
            <div className="wgb-timer-container">
              <div className="wgb-timer-label-row">
                <span>
                  Phase: {currentPhase === 'PLACE_LETTER' ? '1. Place Any Letter (A-Z)' : '2. Trace Word Line (Optional)'}
                </span>
                <span>⏱️ {turnTimer}s remaining</span>
              </div>
              <div className="wgb-timer-bar-wrap">
                <div
                  className={`wgb-timer-bar-fill ${turnTimer <= 7 ? 'critical' : 'normal'}`}
                  style={{ width: `${(turnTimer / 30) * 100}%` }}
                />
              </div>
            </div>
          </section>

          {/* Arena Main Content: Player Scoreboards + 10x10 Word Grid */}
          <div className="wgb-arena-main-content">
            {/* Scoreboard Cards */}
            <aside className="wgb-scoreboard-list">
              {ALL_SLOTS.map((slot) => {
                const meta = PLAYER_METADATA[slot];
                const state = slotStates[slot];
                const isInactive = state === 'INACTIVE_SETUP';
                const isCurrent = currentTurn === slot;
                const score = scores[slot] || 0;
                const wordCount = wordsClaimedCount[slot] || 0;
                const name = isInactive ? 'No Player' : playerNames[slot] || meta.label;

                return (
                  <div
                    key={slot}
                    className={`wgb-player-card slot-${slot.toLowerCase()} ${isCurrent ? 'active-turn' : ''} ${
                      isInactive ? 'inactive-setup' : ''
                    }`}
                  >
                    {isInactive && (
                      <div className="wgb-inactive-overlay">
                        <span className="wgb-inactive-overlay-x">✖</span>
                        <span>No Player</span>
                      </div>
                    )}

                    <div className="wgb-card-left">
                      <div className="wgb-slot-avatar">{meta.avatar}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{name}</div>
                        <div className="wgb-words-count">{wordCount} words claimed</div>
                      </div>
                    </div>

                    <div className="wgb-player-score">{score} pts</div>
                  </div>
                );
              })}

              <div className="wgb-action-card" style={{ padding: '1rem', marginTop: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '0.85rem' }}>Scoring Rules</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--wgb-text-muted)', lineHeight: '1.6' }}>
                  <div>• 3-6 letter word: <strong>+2 pts</strong></div>
                  <div>• 7+ letter word: <strong>+3 pts</strong> (+1 bonus)</div>
                  <div>• Invalid word: <strong style={{ color: '#e94560' }}>-1 pt penalty</strong></div>
                  <div>• Adjacency: 8 directions allowed</div>
                </div>
              </div>
            </aside>

            {/* 10x10 Grid Section */}
            <section className="wgb-grid-section">
              <div className="wgb-grid-board">
                {grid.map((cell) => {
                  const isSelectedEmpty = cell.index === selectedEmptyIndex;
                  const isJustPlaced = cell.index === justPlacedIndex;
                  const isInPath = tracedPath.some((p) => p.index === cell.index);
                  const claimClass = cell.claimedBy ? `claimed-${cell.claimedBy.toLowerCase()}` : '';

                  return (
                    <div
                      key={cell.index}
                      className={`wgb-cell ${cell.letter ? 'filled' : 'empty'} ${
                        isSelectedEmpty ? 'selected-empty' : ''
                      } ${isJustPlaced ? 'just-placed' : ''} ${isInPath ? 'in-path' : ''} ${claimClass}`}
                      onClick={() => handleCellClick(cell.index)}
                      onMouseDown={() => handleCellMouseDown(cell.index)}
                      onMouseEnter={() => handleCellMouseEnter(cell.index)}
                    >
                      {cell.letter}
                    </div>
                  );
                })}
              </div>

              {/* Phase Tip */}
              <div className="wgb-phase-tip">
                {currentPhase === 'PLACE_LETTER' && (
                  <>
                    <span>💡</span>
                    <span>
                      {currentTurn === mySlot || isSoloAI
                        ? 'Click any empty cell, then select or type a letter A–Z.'
                        : `Waiting for ${playerNames[currentTurn]} to place a letter...`}
                    </span>
                  </>
                )}
                {currentPhase === 'CLAIM_WORD' && (
                  <>
                    <span>💡</span>
                    <span>
                      {currentTurn === mySlot || isSoloAI
                        ? 'Click & drag or tap adjacent letters to trace a word (min 3).'
                        : `${playerNames[currentTurn]} is searching for words...`}
                    </span>
                  </>
                )}
              </div>

              {/* Compact Letter Picker (Phase 1) */}
              {currentPhase === 'PLACE_LETTER' && selectedEmptyIndex !== null && (
                <div className="wgb-letter-picker">
                  <div className="wgb-picker-title">
                    <span>Select Letter for Cell ({grid[selectedEmptyIndex].row + 1}, {grid[selectedEmptyIndex].col + 1})</span>
                    <span style={{ fontSize: '0.75rem', color: '#00c9a7' }}>or type A–Z on keyboard</span>
                  </div>
                  <div className="wgb-picker-keys">
                    {ALPHABET.map((char) => (
                      <button key={char} className="wgb-key-btn" onClick={() => handleLetterSelection(char)}>
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Word Claim Confirmation Bar (Phase 2) */}
              {currentPhase === 'CLAIM_WORD' && tracedPath.length >= 3 && (
                <div className="wgb-claim-confirm-bar">
                  <div className="wgb-claim-word-info">
                    <span className="wgb-claim-word-spelled">"{currentSpelledWord}"</span>
                    <span
                      className="wgb-claim-points-badge"
                      style={{
                        background: isCurrentWordValid ? 'rgba(0, 201, 167, 0.15)' : 'rgba(233, 69, 96, 0.15)',
                        color: isCurrentWordValid ? '#00c9a7' : '#e94560',
                      }}
                    >
                      {isCurrentWordValid ? `+${potentialPoints} pts (${currentSpelledWord.length >= 7 ? '7+ Bonus' : 'Valid'})` : 'Invalid (-1 pt)'}
                    </span>
                  </div>
                  <div className="wgb-claim-buttons">
                    <button className="wgb-btn-claim-action" onClick={handleConfirmWordClaim}>
                      ✓ Claim Word
                    </button>
                    <button className="wgb-btn-cancel-action" onClick={handleCancelWordTrace}>
                      ✕ Clear
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      )}

      {/* ================= GAME OVER PODIUM MODAL ================= */}
      {isGameOver && (
        <div className="wgb-modal-overlay">
          <div className="wgb-modal-box" style={{ maxWidth: '480px' }}>
            <div className="wgb-podium-header">🏆 VICTORY PODIUM</div>
            <p className="wgb-podium-subtitle">
              Game Over! Word grid domination achieved.
            </p>

            <div className="wgb-podium-ranks">
              {gameOverRankings.map((r) => (
                <div key={r.slot} className={`wgb-rank-row rank-${r.rank}`}>
                  <div className="wgb-rank-place">
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '4️⃣'}
                  </div>
                  <div className="wgb-rank-user">
                    <span>{r.avatar}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{r.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--wgb-text-muted)' }}>
                        {r.words} words claimed
                      </div>
                    </div>
                  </div>
                  <div className="wgb-rank-score">{r.score} pts</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="wgb-btn-primary" onClick={handlePlayAgain}>
                🔄 Play Again
              </button>
              <button className="wgb-btn-outline" onClick={handleBackToLobby}>
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordGridLobby;
