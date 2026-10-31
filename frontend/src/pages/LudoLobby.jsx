import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import {
  createLudoRoom,
  joinLudoRoom,
  getLudoRoomStatus,
  queueQuickMatch,
  getSlotStatesForCount,
} from '../services/ludoApi';
import { ludoSocket } from '../services/ludoSocket';
import './LudoLobby.css';

// 52 Main Track Coordinates in clockwise order around the 15x15 board
// Starting cell 0 corresponds to Red's start square at (row 13, col 6)
const TRACK_COORDINATES = [
  { r: 13, c: 6 }, // 0: Red Start ⭐
  { r: 12, c: 6 }, // 1
  { r: 11, c: 6 }, // 2
  { r: 10, c: 6 }, // 3
  { r: 9, c: 6 },  // 4
  { r: 8, c: 5 },  // 5
  { r: 8, c: 4 },  // 6
  { r: 8, c: 3 },  // 7
  { r: 8, c: 2 },  // 8: Safe Cell ⭐
  { r: 8, c: 1 },  // 9
  { r: 8, c: 0 },  // 10
  { r: 7, c: 0 },  // 11
  { r: 6, c: 0 },  // 12
  { r: 6, c: 1 },  // 13: Blue Start ⭐
  { r: 6, c: 2 },  // 14
  { r: 6, c: 3 },  // 15
  { r: 6, c: 4 },  // 16
  { r: 6, c: 5 },  // 17
  { r: 5, c: 6 },  // 18
  { r: 4, c: 6 },  // 19
  { r: 3, c: 6 },  // 20
  { r: 2, c: 6 },  // 21: Safe Cell ⭐
  { r: 1, c: 6 },  // 22
  { r: 0, c: 6 },  // 23
  { r: 0, c: 7 },  // 24
  { r: 0, c: 8 },  // 25
  { r: 1, c: 8 },  // 26: Green Start ⭐
  { r: 2, c: 8 },  // 27
  { r: 3, c: 8 },  // 28
  { r: 4, c: 8 },  // 29
  { r: 5, c: 8 },  // 30
  { r: 6, c: 9 },  // 31
  { r: 6, c: 10 }, // 32
  { r: 6, c: 11 }, // 33
  { r: 6, c: 12 }, // 34: Safe Cell ⭐
  { r: 6, c: 13 }, // 35
  { r: 6, c: 14 }, // 36
  { r: 7, c: 14 }, // 37
  { r: 8, c: 14 }, // 38
  { r: 8, c: 13 }, // 39: Yellow Start ⭐
  { r: 8, c: 12 }, // 40
  { r: 8, c: 11 }, // 41
  { r: 8, c: 10 }, // 42
  { r: 8, c: 9 },  // 43
  { r: 9, c: 8 },  // 44
  { r: 10, c: 8 }, // 45
  { r: 11, c: 8 }, // 46
  { r: 12, c: 8 }, // 47: Safe Cell ⭐
  { r: 13, c: 8 }, // 48
  { r: 14, c: 8 }, // 49
  { r: 14, c: 7 }, // 50
  { r: 14, c: 6 }, // 51
];

// Starting offset index on the 52 track for each color
const COLOR_START_INDEX = {
  RED: 0,
  BLUE: 13,
  GREEN: 26,
  YELLOW: 39,
};

// Home stretch track (steps 51 to 55) for each color leading to center finish (step 56)
const HOME_STRETCHES = {
  RED: [
    { r: 13, c: 7 },
    { r: 12, c: 7 },
    { r: 11, c: 7 },
    { r: 10, c: 7 },
    { r: 9, c: 7 },
  ],
  BLUE: [
    { r: 7, c: 1 },
    { r: 7, c: 2 },
    { r: 7, c: 3 },
    { r: 7, c: 4 },
    { r: 7, c: 5 },
  ],
  GREEN: [
    { r: 1, c: 7 },
    { r: 2, c: 7 },
    { r: 3, c: 7 },
    { r: 4, c: 7 },
    { r: 5, c: 7 },
  ],
  YELLOW: [
    { r: 7, c: 13 },
    { r: 7, c: 12 },
    { r: 7, c: 11 },
    { r: 7, c: 10 },
    { r: 7, c: 9 },
  ],
};

const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Initial token setup for each color (4 tokens each at yard: step = -1)
const createInitialTokens = () => {
  const tokens = {};
  ['RED', 'GREEN', 'YELLOW', 'BLUE'].forEach((color) => {
    tokens[color] = [1, 2, 3, 4].map((num) => ({
      tokenId: `${color[0]}${num}`,
      color,
      step: -1, // -1 = Home Yard, 0 = Start, 1..50 = track, 51..55 = home stretch, 56 = Finished
    }));
  });
  return tokens;
};

const ALL_COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

const REALISTIC_NAMES = [
  'Aarav_Sharma',
  'Vikram_R',
  'Sneha_Patel',
  'CyberNinja99',
  'Rohan_Verma',
  'Priya_K',
  'Aditya_M',
  'Neha_Singh',
];

export const LudoLobby = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Active view: 'LOBBY' | 'WAITING_ROOM' | 'PLAYING'
  const [view, setView] = useState('LOBBY');
  const [playerCount, setPlayerCount] = useState(2); // 2 | 3 | 4
  const [isSoloAI, setIsSoloAI] = useState(false);

  // Roles & Ready states
  const [isHost, setIsHost] = useState(false);
  const [readyStates, setReadyStates] = useState({
    RED: true,
    GREEN: false,
    YELLOW: false,
    BLUE: false,
  });

  // Quick Match state
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [matchSearchTimer, setMatchSearchTimer] = useState(12);
  const searchTimerRef = useRef(null);

  // Room state
  const [roomCode, setRoomCode] = useState(() => {
    return (searchParams.get('room') || '').trim().toUpperCase();
  });
  const [sessionId, setSessionId] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [myColor, setMyColor] = useState('RED');
  const [slotStates, setSlotStates] = useState(() => getSlotStatesForCount(2));
  const [playerNames, setPlayerNames] = useState({
    RED: 'Host Player',
    GREEN: 'Waiting for player...',
    YELLOW: 'Waiting for player...',
    BLUE: 'Waiting for player...',
  });
  const [copySuccess, setCopySuccess] = useState(false);

  // Gameplay state
  const [tokens, setTokens] = useState(createInitialTokens);
  const [currentTurn, setCurrentTurn] = useState('RED');
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [movableTokens, setMovableTokens] = useState([]);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [turnTimer, setTurnTimer] = useState(30);
  const [rankings, setRankings] = useState([]); // Array of finished colors
  const [isGameOver, setIsGameOver] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Refs for async & AI callbacks
  const stateRef = useRef({
    currentTurn: 'RED',
    hasRolled: false,
    diceValue: 1,
    tokens: createInitialTokens(),
    slotStates: getSlotStatesForCount(2),
    isGameOver: false,
    playerNames: {},
    myColor: 'RED',
    isSoloAI: false,
    isHost: false,
    readyStates: { RED: true, GREEN: false, YELLOW: false, BLUE: false },
    consecutiveSixes: 0,
    rankings: [],
    playerCount: 2,
    sessionId: '',
  });

  useEffect(() => {
    stateRef.current = {
      currentTurn,
      hasRolled,
      diceValue,
      tokens,
      slotStates,
      isGameOver,
      playerNames,
      myColor,
      isSoloAI,
      isHost,
      readyStates,
      consecutiveSixes,
      rankings,
      playerCount,
      sessionId,
    };
  }, [
    currentTurn,
    hasRolled,
    diceValue,
    tokens,
    slotStates,
    isGameOver,
    playerNames,
    myColor,
    isSoloAI,
    isHost,
    readyStates,
    consecutiveSixes,
    rankings,
    playerCount,
    sessionId,
  ]);

  const playerId = user?.userId || 'GUEST_LOCAL';
  const playerName = user?.displayName || 'Player';

  // Show transient toast
  const showToast = useCallback((msg, durationMs = 2000) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, durationMs);
  }, []);

  // Trigger celebration fireworks
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#00ff88', '#ffe600', '#ff3366'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  // Compute cell coordinates for a token
  const getTokenCoordinates = useCallback((token) => {
    const { color, step } = token;
    if (step === -1) return null; // In yard
    if (step >= 56) return { isHome: true }; // Finished in center podium

    if (step >= 51) {
      // In home stretch
      const stretchIdx = step - 51;
      return HOME_STRETCHES[color][stretchIdx];
    }

    // On standard 52-cell track
    const offset = COLOR_START_INDEX[color];
    const trackIndex = (offset + step) % 52;
    return TRACK_COORDINATES[trackIndex];
  }, []);

  // Get active turn order based on player count and slot states
  const getActiveTurnOrder = useCallback((slots) => {
    // Clockwise order: RED -> BLUE -> GREEN -> YELLOW
    return ALL_COLORS.filter((c) => slots[c] === 'ACTIVE');
  }, []);

  // Switch to next active player turn
  const passTurnToNext = useCallback(
    (reasonToast = '') => {
      if (stateRef.current.isGameOver) return;
      if (reasonToast) showToast(reasonToast, 1600);

      const activeOrder = getActiveTurnOrder(stateRef.current.slotStates);
      if (activeOrder.length === 0) return;

      const currentIdx = activeOrder.indexOf(stateRef.current.currentTurn);
      const nextColor = activeOrder[(currentIdx + 1) % activeOrder.length];

      setCurrentTurn(nextColor);
      setHasRolled(false);
      setMovableTokens([]);
      setConsecutiveSixes(0);
      setTurnTimer(30);
    },
    [getActiveTurnOrder, showToast]
  );

  // Compute eligible tokens that can move given current dice roll
  const computeMovableTokens = useCallback((color, roll, currentTokens) => {
    const list = currentTokens[color] || [];
    const movable = [];

    list.forEach((token) => {
      if (token.step === 56) {
        // Already finished
        return;
      }
      if (token.step === -1) {
        // In Yard: only roll of 6 can bring it out
        if (roll === 6) {
          movable.push(token.tokenId);
        }
      } else if (token.step + roll <= 56) {
        // Can advance on board or home stretch
        movable.push(token.tokenId);
      }
    });

    return movable;
  }, []);

  // Execute a token move
  const handleExecuteMove = useCallback(
    (tokenId) => {
      const {
        currentTurn: turnColor,
        tokens: currentTokens,
        diceValue: roll,
        slotStates: currentSlots,
        rankings: currentRanks,
      } = stateRef.current;

      const tokenList = currentTokens[turnColor];
      const targetToken = tokenList.find((t) => t.tokenId === tokenId);
      if (!targetToken) return;

      const newTokens = JSON.parse(JSON.stringify(currentTokens));
      const myUpdatedTokens = newTokens[turnColor];
      const tokToUpdate = myUpdatedTokens.find((t) => t.tokenId === tokenId);

      let capturesOpponent = false;
      let reachesHome = false;

      if (tokToUpdate.step === -1) {
        // Bring token out of Yard to starting cell (step 0)
        tokToUpdate.step = 0;
        showToast(`🚀 ${turnColor} deployed ${tokToUpdate.tokenId} onto the track!`);
      } else {
        tokToUpdate.step += roll;
        if (tokToUpdate.step === 56) {
          reachesHome = true;
          showToast(`🏆 ${turnColor}'s token reached Home!`);
        }
      }

      // Check capture logic if landing on main track
      if (tokToUpdate.step >= 0 && tokToUpdate.step < 51) {
        const myStartOffset = COLOR_START_INDEX[turnColor];
        const landingTrackIndex = (myStartOffset + tokToUpdate.step) % 52;

        // Is this a safe cell?
        if (!SAFE_TRACK_INDICES.has(landingTrackIndex)) {
          // Check opponents on this same cell
          ALL_COLORS.forEach((oppColor) => {
            if (oppColor !== turnColor && currentSlots[oppColor] === 'ACTIVE') {
              const oppList = newTokens[oppColor];
              oppList.forEach((oppToken) => {
                if (oppToken.step >= 0 && oppToken.step < 51) {
                  const oppStartOffset = COLOR_START_INDEX[oppColor];
                  const oppTrackIndex = (oppStartOffset + oppToken.step) % 52;
                  if (oppTrackIndex === landingTrackIndex) {
                    // Capture opponent! Send back to yard
                    oppToken.step = -1;
                    capturesOpponent = true;
                    showToast(`💥 ${turnColor} captured ${oppColor}'s token ${oppToken.tokenId}!`);
                  }
                }
              });
            }
          });
        }
      }

      // Update state
      setTokens(newTokens);
      setMovableTokens([]);
      setHasRolled(false);

      if (!stateRef.current.isSoloAI && stateRef.current.sessionId) {
        ludoSocket.moveToken(stateRef.current.sessionId, playerId, turnColor, tokenId);
      }

      // Check if player has finished all 4 tokens
      const finishedCount = myUpdatedTokens.filter((t) => t.step === 56).length;
      if (finishedCount === 4 && !currentRanks.includes(turnColor)) {
        const newRanks = [...currentRanks, turnColor];
        setRankings(newRanks);
        showToast(`🎉 ${turnColor} finished in rank #${newRanks.length}!`, 3000);

        if (newRanks.length === 1) {
          triggerCelebration();
        }

        const activeOrder = getActiveTurnOrder(currentSlots);
        if (newRanks.length >= activeOrder.length - 1 || activeOrder.length <= 2) {
          // Game Over!
          setIsGameOver(true);
          return;
        }
      }

      // Check bonus turn: rolling 6, capturing an opponent, or reaching home grants bonus turn!
      const getsBonusTurn = (roll === 6 && stateRef.current.consecutiveSixes < 3) || capturesOpponent || reachesHome;

      if (getsBonusTurn) {
        showToast(`⚡ Bonus turn for ${turnColor}! Roll again.`, 1500);
        setTurnTimer(30);
      } else {
        passTurnToNext();
      }
    },
    [passTurnToNext, showToast, triggerCelebration, getActiveTurnOrder, playerId]
  );

  // Roll Dice handler
  const handleRollDice = useCallback(() => {
    if (isRolling || hasRolled || isGameOver) return;

    setIsRolling(true);
    setMovableTokens([]);

    if (!isSoloAI && stateRef.current.sessionId) {
      ludoSocket.rollDice(stateRef.current.sessionId, playerId, stateRef.current.currentTurn);
    }

    setTimeout(() => {
      const rolledVal = Math.floor(Math.random() * 6) + 1;
      setDiceValue(rolledVal);
      setIsRolling(false);
      setHasRolled(true);

      const nextSixes = rolledVal === 6 ? stateRef.current.consecutiveSixes + 1 : 0;
      setConsecutiveSixes(nextSixes);

      // Check 3 consecutive 6s forfeiture rule
      if (nextSixes >= 3) {
        showToast(`⚠️ ${stateRef.current.currentTurn} rolled three 6s — turn forfeited!`, 2500);
        setTimeout(() => {
          passTurnToNext();
        }, 1200);
        return;
      }

      // Compute legal moves
      const legalMoves = computeMovableTokens(
        stateRef.current.currentTurn,
        rolledVal,
        stateRef.current.tokens
      );

      if (legalMoves.length === 0) {
        showToast(`No legal moves for ${stateRef.current.currentTurn}! Turn passed.`, 1600);
        setTimeout(() => {
          passTurnToNext();
        }, 1200);
      } else {
        setMovableTokens(legalMoves);
        // If playing against AI or if it's AI turn, AI will handle move
        // If only 1 move and current player, user can click or auto-move
      }
    }, 600);
  }, [isRolling, hasRolled, isGameOver, computeMovableTokens, passTurnToNext, showToast, isSoloAI, playerId]);

  // AI Opponent Decision Engine
  useEffect(() => {
    if (view !== 'PLAYING' || isGameOver) return;

    const { currentTurn: turn, myColor: humanColor, hasRolled: rolled, diceValue: roll, tokens: curTokens } = stateRef.current;
    const isAiTurn = turn !== humanColor;

    if (!isAiTurn) return;

    let aiTimer;
    if (!rolled && !isRolling) {
      // AI rolls dice after realistic pause
      aiTimer = setTimeout(() => {
        handleRollDice();
      }, 700);
    } else if (rolled && movableTokens.length > 0) {
      // AI picks best move
      aiTimer = setTimeout(() => {
        // Priority 1: Pick a move that captures an opponent
        let bestToken = movableTokens[0];
        let foundCapture = false;

        for (const tid of movableTokens) {
          const tok = curTokens[turn].find((t) => t.tokenId === tid);
          if (tok) {
            const nextStep = tok.step === -1 ? 0 : tok.step + roll;
            if (nextStep >= 0 && nextStep < 51) {
              const myStartOffset = COLOR_START_INDEX[turn];
              const targetTrackIdx = (myStartOffset + nextStep) % 52;
              if (!SAFE_TRACK_INDICES.has(targetTrackIdx)) {
                ALL_COLORS.forEach((opp) => {
                  if (opp !== turn) {
                    curTokens[opp]?.forEach((oppT) => {
                      if (oppT.step >= 0 && oppT.step < 51) {
                        const oppIdx = (COLOR_START_INDEX[opp] + oppT.step) % 52;
                        if (oppIdx === targetTrackIdx) {
                          bestToken = tid;
                          foundCapture = true;
                        }
                      }
                    });
                  }
                });
              }
            }
          }
          if (foundCapture) break;
        }

        // Priority 2: If rolled 6 and has token in yard, deploy it!
        if (!foundCapture && roll === 6) {
          const yardTok = curTokens[turn].find((t) => t.step === -1 && movableTokens.includes(t.tokenId));
          if (yardTok) bestToken = yardTok.tokenId;
        }

        handleExecuteMove(bestToken);
      }, 600);
    }

    return () => clearTimeout(aiTimer);
  }, [view, currentTurn, hasRolled, isRolling, movableTokens, isGameOver, handleRollDice, handleExecuteMove]);

  // Turn timer countdown (30s)
  useEffect(() => {
    if (view !== 'PLAYING' || isGameOver) return;

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          showToast(`⏳ Turn timer expired for ${stateRef.current.currentTurn}!`, 1500);
          passTurnToNext();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, isGameOver, passTurnToNext, showToast]);

  // Real-time WebSocket synchronization
  const handleSocketEvent = useCallback(
    (evt) => {
      if (!evt || !evt.type) return;

      if (evt.type === 'PLAYER_JOINED') {
        const color = evt.color;
        const joinedName = evt.playerName || `Player (${color})`;
        setSlotStates((prev) => ({
          ...prev,
          [color]: 'ACTIVE',
        }));
        setPlayerNames((prev) => ({
          ...prev,
          [color]: joinedName,
        }));
        setReadyStates((prev) => ({
          ...prev,
          [color]: false,
        }));
        showToast(`🎮 ${joinedName} joined the room as ${color}!`, 2500);

        // If this user is Host, send ROOM_SYNC back so guest receives full room status
        if (stateRef.current.isHost) {
          setTimeout(() => {
            if (stateRef.current.sessionId) {
              ludoSocket.sendRoomEvent(stateRef.current.sessionId, {
                type: 'ROOM_SYNC',
                slotStates: {
                  ...stateRef.current.slotStates,
                  [color]: 'ACTIVE',
                },
                playerNames: {
                  ...stateRef.current.playerNames,
                  [color]: joinedName,
                },
                readyStates: {
                  ...stateRef.current.readyStates,
                  RED: true,
                  [color]: false,
                },
                playerCount: stateRef.current.playerCount,
              });
            }
          }, 150);
        }
      } else if (evt.type === 'ROOM_SYNC') {
        if (evt.slotStates) setSlotStates(evt.slotStates);
        if (evt.playerNames) setPlayerNames(evt.playerNames);
        if (evt.readyStates) setReadyStates(evt.readyStates);
        if (evt.playerCount) setPlayerCount(evt.playerCount);
      } else if (evt.type === 'PLAYER_READY') {
        const { color, isReady } = evt;
        setReadyStates((prev) => ({
          ...prev,
          [color]: !!isReady,
        }));
        const pName = stateRef.current.playerNames[color] || color;
        showToast(`${pName} is ${isReady ? 'READY 🟢' : 'NOT READY ⏳'}`, 2000);
      } else if (evt.type === 'START_MATCH') {
        // Starts game for EVERYONE in sync
        const activeSlots = { ...stateRef.current.slotStates };
        ALL_COLORS.forEach((c) => {
          if (activeSlots[c] === 'WAITING' && stateRef.current.readyStates[c]) {
            activeSlots[c] = 'ACTIVE';
          }
        });
        setSlotStates(activeSlots);
        setTokens(createInitialTokens());
        setCurrentTurn('RED');
        setRankings([]);
        setIsGameOver(false);
        setHasRolled(false);
        setMovableTokens([]);
        setConsecutiveSixes(0);
        setTurnTimer(30);
        setView('PLAYING');
        showToast('🚀 Match started! RED goes first.', 3000);
      } else if (evt.type === 'DICE_ROLLED') {
        setDiceValue(evt.diceValue);
        if (evt.movableTokens) setMovableTokens(evt.movableTokens);
      } else if (evt.type === 'TOKEN_MOVED') {
        if (evt.nextTurn) setCurrentTurn(evt.nextTurn);
        if (evt.tokens) setTokens(evt.tokens);
      } else if (evt.type === 'TURN_SKIPPED') {
        showToast(`Turn skipped for ${evt.skippedColor}: ${evt.reason}`);
        if (evt.nextTurn) setCurrentTurn(evt.nextTurn);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!sessionId || isSoloAI) return;

    ludoSocket.connect({
      sessionId,
      onConnect: () => {
        // If guest, broadcast PLAYER_JOINED so Host's screen updates immediately!
        if (!stateRef.current.isHost) {
          ludoSocket.sendRoomEvent(sessionId, {
            type: 'PLAYER_JOINED',
            color: stateRef.current.myColor,
            playerId,
            playerName,
          });
        }
      },
      onEvent: handleSocketEvent,
    });

    return () => {
      ludoSocket.disconnect();
    };
  }, [sessionId, isSoloAI, handleSocketEvent, playerId, playerName]);

  // URL Query auto-join effect
  useEffect(() => {
    const queryRoom = searchParams.get('room');
    if (!queryRoom || view !== 'LOBBY') return;

    const code = queryRoom.trim().toUpperCase();
    setIsHost(false); // Guest via URL
    getLudoRoomStatus(code)
      .then((statusRes) => {
        if (statusRes.status !== 'ABANDONED') {
          return joinLudoRoom({ roomCode: code, playerId, playerName });
        }
        throw new Error('Room is inactive');
      })
      .then((res) => {
        setRoomCode(code);
        setSessionId(res.sessionId || `OWG_LDO_${code}`);
        setMyColor(res.assignedColor || 'YELLOW');
        setPlayerCount(res.playerCount || 2);
        setSlotStates(res.slotStates || getSlotStatesForCount(res.playerCount || 2));
        if (res.playerNames) setPlayerNames(res.playerNames);
        setReadyStates({ RED: true, GREEN: false, YELLOW: false, BLUE: false });
        setView('WAITING_ROOM');
        showToast(`Joined room ${code}!`);
      })
      .catch(() => {
        setRoomCode(code);
        setSessionId(`OWG_LDO_${code}`);
        setMyColor('YELLOW');
        setReadyStates({ RED: true, GREEN: false, YELLOW: false, BLUE: false });
        setView('WAITING_ROOM');
      });
  }, [searchParams, view, playerId, playerName, showToast]);

  // Quick Match Handlers
  const cancelQuickMatch = () => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setIsSearchingMatch(false);
    showToast('Matchmaking cancelled.');
  };

  const finalizeQuickMatchOpponent = () => {
    setIsSearchingMatch(false);
    setIsSoloAI(true);
    setIsHost(true);
    setMyColor('RED');

    // Pick realistic names without [AI] label
    const pool = [...REALISTIC_NAMES].sort(() => Math.random() - 0.5);
    const slots = getSlotStatesForCount(playerCount);
    const activeSlots = { ...slots };

    const opponentNames = {
      RED: `${playerName}`,
      GREEN: slots.GREEN === 'WAITING' ? (pool.pop() || 'Aarav_Sharma') : 'No Player',
      YELLOW: slots.YELLOW === 'WAITING' ? (pool.pop() || 'Vikram_R') : 'No Player',
      BLUE: slots.BLUE === 'WAITING' ? (pool.pop() || 'Sneha_Patel') : 'No Player',
    };

    ALL_COLORS.forEach((c) => {
      if (slots[c] === 'WAITING') activeSlots[c] = 'ACTIVE';
    });

    const opponentDisplay = playerCount === 2 ? opponentNames.YELLOW : `${opponentNames.YELLOW}, ${opponentNames.GREEN || ''}`;
    setSlotStates(activeSlots);
    setPlayerNames(opponentNames);
    setCurrentTurn('RED');
    setTokens(createInitialTokens());
    setRankings([]);
    setIsGameOver(false);
    setHasRolled(false);
    setMovableTokens([]);
    setConsecutiveSixes(0);
    setTurnTimer(30);
    setView('PLAYING');
    showToast(`Duelist found: ${opponentDisplay}! Match starting 🎲`, 2500);
  };

  const startQuickMatchCountdown = () => {
    setIsSearchingMatch(true);
    setMatchSearchTimer(12);

    if (searchTimerRef.current) clearInterval(searchTimerRef.current);

    const startTime = Date.now();
    searchTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 12 - elapsed);
      setMatchSearchTimer(remaining);

      if (remaining <= 1 || elapsed >= 11) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
        finalizeQuickMatchOpponent();
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
      }
    };
  }, []);

  // Action: Create Private Room
  const handleCreatePrivateRoom = async () => {
    setIsHost(true);
    setMyColor('RED');
    setReadyStates({ RED: true, GREEN: false, YELLOW: false, BLUE: false });
    const res = await createLudoRoom({ playerId, playerName, playerCount });
    setRoomCode(res.roomCode);
    setSessionId(res.sessionId);
    setSlotStates(res.slotStates || getSlotStatesForCount(playerCount));
    setPlayerNames(res.playerNames || {
      RED: `${playerName} (Host)`,
      GREEN: playerCount >= 3 ? 'Waiting for player...' : 'No Player',
      YELLOW: 'Waiting for player...',
      BLUE: playerCount === 4 ? 'Waiting for player...' : 'No Player',
    });
    setView('WAITING_ROOM');
  };

  // Copy shareable room link
  const handleCopyLink = () => {
    const url = `${window.location.origin}/games/ludo?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2200);
    });
  };

  // Action: Join Room by Room Code
  const handleJoinByCode = async (codeToJoin) => {
    const code = (codeToJoin !== undefined ? codeToJoin : joinCodeInput).trim().toUpperCase();
    if (!code) {
      showToast('⚠️ Please enter a valid room code.');
      return;
    }

    setIsHost(false); // Guest via Code
    try {
      const statusRes = await getLudoRoomStatus(code);
      if (statusRes && statusRes.status === 'ABANDONED') {
        showToast(`⚠️ Room ${code} is inactive or abandoned.`);
        return;
      }

      const res = await joinLudoRoom({ roomCode: code, playerId, playerName });
      setRoomCode(code);
      setSessionId(res.sessionId || `OWG_LDO_${code}`);
      setMyColor(res.assignedColor || 'YELLOW');
      setPlayerCount(res.playerCount || 2);
      setSlotStates(res.slotStates || getSlotStatesForCount(res.playerCount || 2));
      if (res.playerNames) setPlayerNames(res.playerNames);
      setReadyStates({ RED: true, GREEN: false, YELLOW: false, BLUE: false });
      setView('WAITING_ROOM');
      showToast(`Joined room ${code}!`);
    } catch (err) {
      console.warn('Failed to query or join room, fallback to waiting room:', err);
      setRoomCode(code);
      setSessionId(`OWG_LDO_${code}`);
      setMyColor('YELLOW');
      setReadyStates({ RED: true, GREEN: false, YELLOW: false, BLUE: false });
      setView('WAITING_ROOM');
      showToast(`Joined room ${code}!`);
    }
  };

  // Guest Toggle Ready Action
  const handleToggleReady = () => {
    const nextReady = !readyStates[myColor];
    setReadyStates((prev) => ({ ...prev, [myColor]: nextReady }));
    if (sessionId) {
      ludoSocket.sendPlayerReady(sessionId, playerId, myColor, nextReady);
    }
  };

  // Host Start Match Action
  const handleHostStartMatch = () => {
    if (!canStart) return;

    if (sessionId) {
      ludoSocket.sendStartMatch(sessionId);
    }

    const activeSlots = { ...slotStates };
    ALL_COLORS.forEach((c) => {
      if (activeSlots[c] === 'WAITING' && readyStates[c]) {
        activeSlots[c] = 'ACTIVE';
      }
    });
    setSlotStates(activeSlots);
    setTokens(createInitialTokens());
    setCurrentTurn('RED');
    setRankings([]);
    setIsGameOver(false);
    setHasRolled(false);
    setTurnTimer(30);
    setView('PLAYING');
    showToast('🚀 Match started! RED goes first.');
  };

  // Render tokens located on a specific (row, col)
  const renderTokensOnCell = (r, c) => {
    const onThisCell = [];

    ALL_COLORS.forEach((color) => {
      const tokenList = tokens[color] || [];
      tokenList.forEach((token) => {
        const coords = getTokenCoordinates(token);
        if (coords && coords.r === r && coords.c === c) {
          onThisCell.push(token);
        }
      });
    });

    if (onThisCell.length === 0) return null;

    return (
      <div className={onThisCell.length > 1 ? 'tokens-stack' : 'token-container'}>
        {onThisCell.map((token) => {
          const isEligible =
            currentTurn === token.color &&
            hasRolled &&
            movableTokens.includes(token.tokenId) &&
            (!isSoloAI || currentTurn === myColor);

          return (
            <div
              key={token.tokenId}
              className={`ludo-token token-${token.color} ${isEligible ? 'token-movable' : ''}`}
              onClick={() => {
                if (isEligible) handleExecuteMove(token.tokenId);
              }}
              title={`${token.tokenId} (${token.color})`}
            >
              {token.tokenId}
            </div>
          );
        })}
      </div>
    );
  };

  // Render Yard Quadrant (6x6) with Inactive "X" Overlay when appropriate
  const renderYard = (color, yardClass) => {
    const slotState = slotStates[color] || 'INACTIVE_SETUP';
    const isInactive = slotState === 'INACTIVE_SETUP' || slotState === 'OFFLINE' || slotState === 'NOT_AVAILABLE';

    let inactiveLabel = 'No Player';
    if (slotState === 'OFFLINE') inactiveLabel = 'Offline';
    if (slotState === 'NOT_AVAILABLE') inactiveLabel = 'Unavailable';

    const yardTokens = tokens[color]?.filter((t) => t.step === -1) || [];

    return (
      <div className={`yard ${yardClass}`}>
        <span className="yard-title-label">{color}</span>

        {/* 4 Token circles in yard */}
        <div className="yard-inner-card">
          {[1, 2, 3, 4].map((num) => {
            const tokId = `${color[0]}${num}`;
            const tokenInYard = yardTokens.find((t) => t.tokenId === tokId);
            const isEligible =
              tokenInYard &&
              currentTurn === color &&
              hasRolled &&
              movableTokens.includes(tokId) &&
              (!isSoloAI || currentTurn === myColor);

            return (
              <div key={tokId} className="yard-token-slot">
                {tokenInYard && (
                  <div
                    className={`ludo-token token-${color} ${isInactive ? 'token-inactive' : ''} ${
                      isEligible ? 'token-movable' : ''
                    }`}
                    onClick={() => {
                      if (isEligible) handleExecuteMove(tokId);
                    }}
                    title={tokId}
                  >
                    {tokId}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Inactive Yard - "X" Overlay */}
        {isInactive && (
          <div className="yard-inactive-overlay">
            <div className="inactive-x-badge">✕</div>
            <div className="inactive-state-label">{inactiveLabel}</div>
          </div>
        )}
      </div>
    );
  };

  // Render Center Home Podium zone (Rows 7-9, Cols 7-9)
  const renderCenterPodium = () => {
    return (
      <div className="center-home-podium">
        <div className="podium-wedge wedge-green" />
        <div className="podium-wedge wedge-red" />
        <div className="podium-wedge wedge-blue" />
        <div className="podium-wedge wedge-yellow" />
        <div className="center-home-trophy">👑</div>
      </div>
    );
  };

  // Render single cell at row, col
  const renderGridCell = (r, c) => {
    // 4 Corner Yards
    if (r < 6 && c < 6) return null; // Blue Yard
    if (r < 6 && c > 8) return null; // Green Yard
    if (r > 8 && c < 6) return null; // Red Yard
    if (r > 8 && c > 8) return null; // Yellow Yard

    // Center Home
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return null;

    // Check starting cells
    let cellExtraClass = '';
    let isSafeCell = false;

    if (r === 13 && c === 6) { cellExtraClass = 'start-cell-red safe-cell'; isSafeCell = true; }
    else if (r === 6 && c === 1) { cellExtraClass = 'start-cell-blue safe-cell'; isSafeCell = true; }
    else if (r === 1 && c === 8) { cellExtraClass = 'start-cell-green safe-cell'; isSafeCell = true; }
    else if (r === 8 && c === 13) { cellExtraClass = 'start-cell-yellow safe-cell'; isSafeCell = true; }
    // Check safe star cells
    else if (
      (r === 8 && c === 2) ||
      (r === 2 && c === 6) ||
      (r === 6 && c === 12) ||
      (r === 12 && c === 8)
    ) {
      cellExtraClass = 'safe-cell';
      isSafeCell = true;
    }
    // Check Home Stretches
    else if (c === 7 && r >= 9 && r <= 13) { cellExtraClass = 'home-stretch-red'; }
    else if (c === 7 && r >= 1 && r <= 5) { cellExtraClass = 'home-stretch-green'; }
    else if (r === 7 && c >= 1 && c <= 5) { cellExtraClass = 'home-stretch-blue'; }
    else if (r === 7 && c >= 9 && c <= 13) { cellExtraClass = 'home-stretch-yellow'; }

    return (
      <div
        key={`cell-${r}-${c}`}
        className={`ludo-cell ${cellExtraClass}`}
        style={{ gridRow: r + 1, gridColumn: c + 1 }}
      >
        {isSafeCell && <span className="safe-star-glyph">⭐</span>}
        {renderTokensOnCell(r, c)}
      </div>
    );
  };

  // Render 3D Dice Face
  const renderDiceFace = (val) => {
    // 3x3 grid pip positions
    const pips = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };

    const activePips = pips[val] || [4];

    return (
      <div className="dice-face">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
          <div
            key={idx}
            className="dice-pip"
            style={{ opacity: activePips.includes(idx) ? 1 : 0 }}
          />
        ))}
      </div>
    );
  };

  const joinedColors = ALL_COLORS.filter(
    (c) =>
      slotStates[c] === 'ACTIVE' ||
      (slotStates[c] !== 'INACTIVE_SETUP' &&
        slotStates[c] !== 'OFFLINE' &&
        slotStates[c] !== 'NOT_AVAILABLE' &&
        playerNames[c] &&
        !playerNames[c].includes('Waiting') &&
        !playerNames[c].includes('No Player'))
  );
  const activeCount = joinedColors.length;
  const allReady = activeCount >= 2 && joinedColors.every((c) => !!readyStates[c]);
  const canStart = activeCount >= 2 && allReady;

  return (
    <div className="ludo-lobby-container">
      {/* Breadcrumb Navigation */}
      <nav className="ludo-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/games">Games</Link>
        <span>/</span>
        <span className="ludo-breadcrumb-current">Ludo Royale</span>
      </nav>

      {/* Main Hero Header */}
      <section className="ludo-hero">
        <div className="ludo-hero-badge">
          <span className="ludo-pulse-dot" />
          <span>Real-Time 2-4 Player PvP</span>
        </div>
        <h1 className="ludo-title">Ludo Royale</h1>
        <p className="ludo-tagline">
          The ultimate cyberpunk neon board showdown. Roll the dice, capture enemy tokens, race
          through the safe star grid, and claim the championship podium!
        </p>

        {/* View: LOBBY */}
        {view === 'LOBBY' && (
          <div className="lobby-content">
            {/* Player Count Segmented Control */}
            <div className="lobby-count-wrapper">
              <span className="lobby-count-label">Game Mode:</span>
              <div className="player-count-picker" role="radiogroup" aria-label="Player Count">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`player-count-btn ${playerCount === count ? 'active' : ''}`}
                    onClick={() => setPlayerCount(count)}
                    disabled={isSearchingMatch}
                  >
                    <span>{count === 2 ? '👥' : count === 3 ? '⚔️' : '👑'}</span>
                    <span>{count} Players</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Exactly 2 options/cards */}
            <div className="lobby-cards-grid">
              {/* 1. Quick Match Card */}
              <div className="lobby-card quick-match-card">
                <div className="card-top-badge">
                  <span className="ludo-pulse-dot" />
                  <span>Instant Matchmaking</span>
                </div>
                <div className="card-header">
                  <div className="card-icon">⚡</div>
                  <h2 className="card-title">Quick Match</h2>
                </div>
                <p className="card-description">
                  Jump straight into a fast-paced duel! Instant matchmaking searches for online duelists in your selected {playerCount}-player mode.
                </p>

                {isSearchingMatch ? (
                  <div className="searching-match-box">
                    <div className="searching-radar-spinner" />
                    <div className="searching-match-text">
                      🔍 Searching for online duelist... ({matchSearchTimer}s)
                    </div>
                    <button
                      type="button"
                      className="btn-cancel-search"
                      onClick={cancelQuickMatch}
                    >
                      Cancel Search
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-primary-ludo card-action-btn"
                    onClick={startQuickMatchCountdown}
                  >
                    <span>⚡</span>
                    <span>Quick Match</span>
                  </button>
                )}
              </div>

              {/* 2. Private Room Card */}
              <div className="lobby-card private-room-card">
                <div className="card-top-badge private-badge">
                  <span>🔗 Custom Lobby</span>
                </div>
                <div className="card-header">
                  <div className="card-icon">🔗</div>
                  <h2 className="card-title">Private Room</h2>
                </div>
                <p className="card-description">
                  Play exclusively with your friends via private room code or shareable invite link.
                </p>

                <div className="private-sub-options">
                  {/* Sub-option 1: Create Room */}
                  <div className="private-sub-block">
                    <button
                      type="button"
                      className="btn-secondary-ludo card-sub-btn"
                      onClick={handleCreatePrivateRoom}
                    >
                      <span>➕</span>
                      <span>Create Room</span>
                    </button>
                  </div>

                  <div className="sub-options-divider">
                    <span>OR JOIN BY CODE</span>
                  </div>

                  {/* Sub-option 2: Join by Code */}
                  <div className="private-sub-block">
                    <div className="lobby-join-box card-join-box">
                      <div className="lobby-join-input-wrap">
                        <span className="lobby-join-icon">🔑</span>
                        <input
                          type="text"
                          className="lobby-join-input"
                          placeholder="Enter Room Code (e.g. LDO-9421)"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleJoinByCode(joinCodeInput);
                            }
                          }}
                          maxLength={16}
                          aria-label="Join with Room Code"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-join-room"
                        onClick={() => handleJoinByCode(joinCodeInput)}
                      >
                        <span>🚪</span>
                        <span>Join Room</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* View: WAITING ROOM MODAL */}
      {view === 'WAITING_ROOM' && (
        <div className="ludo-modal-backdrop">
          <div className="ludo-modal">
            <div className="modal-header">
              <h3>Private Room: {roomCode}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setView('LOBBY');
                  ludoSocket.disconnect();
                }}
              >
                ✕
              </button>
            </div>

            {/* Room Code & Copy Link Card */}
            <div className="room-code-box">
              <div>
                <div className="room-code-label">Room Code</div>
                <div className="room-code-value">{roomCode}</div>
              </div>
              <button
                type="button"
                className="copy-btn"
                onClick={handleCopyLink}
              >
                <span>📋</span>
                <span>Copy Link</span>
                {copySuccess && <div className="copy-tooltip">Copied!</div>}
              </button>
            </div>

            {/* Prominent waiting alert banner if activeCount < 2 */}
            {activeCount < 2 && (
              <div className="waiting-room-alert-banner">
                <span className="waiting-alert-text">
                  ⚠️ Only you are in this room. Share your room code or copy link above so friends can join before starting!
                </span>
              </div>
            )}

            {/* 4 Quadrants Live Slots Card */}
            <div className="slots-preview-grid">
              {ALL_COLORS.map((col) => {
                const state = slotStates[col];
                const isSlotHost = col === 'RED';
                const isInactive =
                  state === 'INACTIVE_SETUP' ||
                  state === 'OFFLINE' ||
                  state === 'NOT_AVAILABLE';
                const isJoined = !isInactive && (state === 'ACTIVE' || (playerNames[col] && !playerNames[col].includes('Waiting')));
                const isReady = readyStates[col];

                return (
                  <div
                    key={col}
                    className={`slot-card slot-${col.toLowerCase()} ${isInactive ? 'slot-inactive' : ''}`}
                  >
                    <div className={`slot-avatar ${isInactive ? 'inactive' : col.toLowerCase()}`}>
                      {col[0]}
                    </div>
                    <div className="slot-details">
                      <div className="slot-name">{playerNames[col] || col}</div>
                      <div className="slot-status-text">
                        {isSlotHost ? (
                          <span className="slot-pill ready">👑 Host (Ready)</span>
                        ) : isJoined ? (
                          <span className={`slot-pill ${isReady ? 'ready' : 'not-ready'}`}>
                            {isReady ? '🟢 Ready' : '⏳ Not Ready'}
                          </span>
                        ) : isInactive ? (
                          'No Player'
                        ) : (
                          'Waiting for player...'
                        )}
                      </div>
                    </div>
                    {isInactive && <div className="slot-badge-x">✕</div>}
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="waiting-room-footer">
              {isHost ? (
                <>
                  <div className="host-guidance-text">
                    {activeCount < 2
                      ? 'Waiting for at least 1 other player to join before starting.'
                      : (!allReady
                        ? 'Waiting for all joined players to mark themselves as Ready.'
                        : 'All players are Ready! Press Start Match to begin.')}
                  </div>
                  <div className="waiting-modal-actions">
                    <button
                      type="button"
                      className="btn-solo-ludo"
                      onClick={() => {
                        setView('LOBBY');
                        ludoSocket.disconnect();
                      }}
                    >
                      Leave Room
                    </button>
                    <button
                      type="button"
                      className={`btn-primary-ludo ${!canStart ? 'btn-disabled' : ''}`}
                      disabled={!canStart}
                      onClick={handleHostStartMatch}
                    >
                      <span>🚀</span>
                      <span>
                        {activeCount < 2
                          ? 'Waiting for players to join...'
                          : (!allReady
                            ? 'Waiting for all players to be Ready...'
                            : 'Start Match')}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="guest-ready-status">
                    {readyStates[myColor]
                      ? '🟢 You are Ready! Waiting for Host to start match...'
                      : '⏳ Click "Mark as Ready" when you are set to play!'}
                  </div>
                  <div className="waiting-modal-actions">
                    <button
                      type="button"
                      className="btn-solo-ludo"
                      onClick={() => {
                        setView('LOBBY');
                        ludoSocket.disconnect();
                      }}
                    >
                      Leave Room
                    </button>
                    <button
                      type="button"
                      className={`btn-ready-toggle ${readyStates[myColor] ? 'is-ready' : 'not-ready'}`}
                      onClick={handleToggleReady}
                    >
                      <span>{readyStates[myColor] ? '🟢' : '⏳'}</span>
                      <span>{readyStates[myColor] ? "I'm Ready" : 'Mark as Ready'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View: PLAYING - 15x15 Cyberpunk Arena */}
      {view === 'PLAYING' && (
        <main className="ludo-arena">
          {/* Turn Indicator Strip */}
          <div className="turn-indicator-strip">
            <div className="turn-player-list">
              {ALL_COLORS.map((c) => {
                const isActiveSlot = slotStates[c] === 'ACTIVE';
                const isCurrentTurn = currentTurn === c;

                if (!isActiveSlot) return null;

                return (
                  <div
                    key={c}
                    className={`turn-player-pill pill-${c} ${isCurrentTurn ? 'active' : ''}`}
                  >
                    <div
                      className={`ludo-pulse-dot`}
                      style={{
                        backgroundColor:
                          c === 'RED'
                            ? '#ff3366'
                            : c === 'GREEN'
                            ? '#00ff88'
                            : c === 'YELLOW'
                            ? '#ffe600'
                            : '#00f2fe',
                      }}
                    />
                    <span>{playerNames[c] || c}</span>
                  </div>
                );
              })}
            </div>

            {/* 30s Countdown Timer Bar */}
            <div className="turn-timer-box">
              <span className={`timer-countdown ${turnTimer <= 5 ? 'warning' : ''}`}>
                {turnTimer}s
              </span>
              <div className="timer-bar-wrapper">
                <div
                  className="timer-bar-fill"
                  style={{ width: `${(turnTimer / 30) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 15x15 Ludo Board Grid */}
          <div className="ludo-board-wrapper">
            {/* 4 Corner Yards */}
            {renderYard('BLUE', 'yard-blue')}
            {renderYard('GREEN', 'yard-green')}
            {renderYard('RED', 'yard-red')}
            {renderYard('YELLOW', 'yard-yellow')}

            {/* Central Podium Triangle Finish */}
            {renderCenterPodium()}

            {/* Track cells for rows 0 to 14, cols 0 to 14 */}
            {Array.from({ length: 15 }, (_, r) =>
              Array.from({ length: 15 }, (_, c) => renderGridCell(r, c))
            )}
          </div>

          {/* Bottom Game Controls & 3D Dice Roller */}
          <div className="game-controls-bar">
            <div className="dice-container">
              <div
                className={`neon-dice ${isRolling ? 'rolling' : ''}`}
                onClick={() => {
                  if (currentTurn === myColor || isSoloAI) handleRollDice();
                }}
                title="Roll Dice"
              >
                {renderDiceFace(diceValue)}
              </div>
              <button
                type="button"
                className="btn-roll-dice"
                disabled={
                  isRolling ||
                  hasRolled ||
                  isGameOver ||
                  (!isSoloAI && currentTurn !== myColor)
                }
                onClick={handleRollDice}
              >
                {isRolling ? 'Rolling...' : `Roll (${diceValue})`}
              </button>
            </div>
            <button
              type="button"
              className="btn-solo-ludo"
              onClick={() => setView('LOBBY')}
            >
              Exit to Lobby
            </button>
          </div>
        </main>
      )}

      {/* In-Game Toast Banner */}
      {toastMessage && (
        <div className="ludo-toast-banner" role="status">
          <span>📢</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Game Over / Winner Podium Modal */}
      {isGameOver && (
        <div className="ludo-modal-backdrop">
          <div className="ludo-modal podium-modal">
            <h2 className="podium-title">🏆 Match Complete!</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 1.5rem 0' }}>
              The cyber dice have spoken! Congratulations to all champions.
            </p>

            <div className="podium-ranks">
              {/* 2nd place */}
              {rankings[1] && (
                <div className="podium-step">
                  <div className="podium-player-name">{playerNames[rankings[1]] || rankings[1]}</div>
                  <div className="podium-pillar rank-2">🥈 2nd</div>
                </div>
              )}
              {/* 1st place */}
              {rankings[0] && (
                <div className="podium-step">
                  <div className="podium-player-name">{playerNames[rankings[0]] || rankings[0]}</div>
                  <div className="podium-pillar rank-1">🥇 1st</div>
                </div>
              )}
              {/* 3rd place */}
              {rankings[2] && (
                <div className="podium-step">
                  <div className="podium-player-name">{playerNames[rankings[2]] || rankings[2]}</div>
                  <div className="podium-pillar rank-3">🥉 3rd</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary-ludo"
                onClick={() => {
                  setTokens(createInitialTokens());
                  setRankings([]);
                  setIsGameOver(false);
                  setCurrentTurn('RED');
                  setHasRolled(false);
                  setTurnTimer(30);
                  triggerCelebration();
                }}
              >
                Play Again
              </button>
              <button
                type="button"
                className="btn-secondary-ludo"
                onClick={() => {
                  setView('LOBBY');
                  setIsGameOver(false);
                }}
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LudoLobby;
