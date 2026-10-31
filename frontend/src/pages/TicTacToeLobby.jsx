import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { getPlayerIdentity } from '../utils/playerIdentity';
import {
  tictactoeApi,
  checkWinner,
  computeBestAIMove,
} from '../services/tictactoeApi';
import { tictactoeSocket } from '../services/tictactoeSocket';
import './TicTacToeLobby.css';

// Sound Synthesizer via Web Audio API
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  getAudioContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playMoveSound(symbol) {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (symbol === 'X') {
        // High bright pleasant chime (659.25Hz -> 987.77Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else {
        // Low warm wooden chime / tap (329.63Hz -> 220Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(329.63, now);
        osc.frequency.exponentialRampToValueAtTime(220.0, now + 0.15);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.warn('Move sound error:', e);
    }
  }

  playTurnTickSound() {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Tick sound error:', e);
    }
  }

  playMatchStartSound() {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [329.63, 440.0, 554.37, 659.25];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.value = f;

        const start = now + i * 0.07;
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch (e) {
      console.warn('Match start sound error:', e);
    }
  }

  playWinFanfare() {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.value = f;

        const start = now + i * 0.12;
        const dur = i === freqs.length - 1 ? 0.6 : 0.25;
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (e) {
      console.warn('Win fanfare error:', e);
    }
  }
}

const soundManager = new SoundSynthesizer();

const INITIAL_BOARD = Array(9).fill('');

const REALISTIC_BOT_NAMES = [
  'Aarav_Sharma',
  'Vikram_R',
  'Sneha_Patel',
  'CyberNinja99',
  'Rohan_Verma',
  'Priya_K',
  'Aditya_M',
  'Neha_Singh',
];

const TicTacToeLobby = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasAutoJoinedRef = useRef(false);

  // Active view: 'LOBBY' | 'WAITING_ROOM' | 'PLAYING'
  const [view, setView] = useState('LOBBY');
  const [gameMode, setGameMode] = useState('QUICK_MATCH'); // 'QUICK_MATCH' | 'PRIVATE'

  // Room & Host/Guest state
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false); // Guest's own ready state
  const [opponentReady, setOpponentReady] = useState(false); // Opponent's ready state
  const [opponentJoined, setOpponentJoined] = useState(false); // Whether opponent has connected
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState(() => {
    return (searchParams.get('room') || '').trim().toUpperCase();
  });
  const [mySymbol, setMySymbol] = useState('X');
  const [playerXName, setPlayerXName] = useState('Player X');
  const [playerOName, setPlayerOName] = useState('Player O');
  const [isAiOpponent, setIsAiOpponent] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Sound & WebRTC Voice State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMatchDisbanded, setIsMatchDisbanded] = useState(false);
  const [disbandMessage, setDisbandMessage] = useState('');
  const [isVoiceJoined, setIsVoiceJoined] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
  const [isOpponentSpeaking, setIsOpponentSpeaking] = useState(false);
  const [peerVoiceJoined, setPeerVoiceJoined] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Quick match countdown
  const [isSearching, setIsSearching] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState(12);

  // Gameplay state
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [currentTurn, setCurrentTurn] = useState('X');
  const [turnTimer, setTurnTimer] = useState(30);
  const [winner, setWinner] = useState(null); // 'X' | 'O' | 'DRAW' | null
  const [winningPattern, setWinningPattern] = useState(null); // e.g. [0, 1, 2]
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hover ghost preview
  const [hoveredCell, setHoveredCell] = useState(null);

  const playerIdentity = getPlayerIdentity(user);
  const playerId = playerIdentity.playerId;
  const playerName = playerIdentity.playerName;

  // State refs for async callbacks, audio & websockets
  const boardRef = useRef(board);
  const currentTurnRef = useRef(currentTurn);
  const isGameOverRef = useRef(isGameOver);
  const mySymbolRef = useRef(mySymbol);
  const isHostRef = useRef(isHost);
  const sessionIdRef = useRef(sessionId);
  const playerIdRef = useRef(playerId);
  const playerNameRef = useRef(playerName);
  const viewRef = useRef(view);
  const searchTimerRef = useRef(null);

  // WebRTC refs
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localAudioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isVoiceJoinedRef = useRef(isVoiceJoined);
  const isMicMutedRef = useRef(isMicMuted);
  const isDeafenedRef = useRef(isDeafened);
  const peerVoiceJoinedRef = useRef(peerVoiceJoined);
  const isAiOpponentRef = useRef(isAiOpponent);

  useEffect(() => {
    boardRef.current = board;
    currentTurnRef.current = currentTurn;
    isGameOverRef.current = isGameOver;
    mySymbolRef.current = mySymbol;
    isHostRef.current = isHost;
    sessionIdRef.current = sessionId;
    playerIdRef.current = playerId;
    playerNameRef.current = playerName;
    viewRef.current = view;
    isVoiceJoinedRef.current = isVoiceJoined;
    isMicMutedRef.current = isMicMuted;
    isDeafenedRef.current = isDeafened;
    peerVoiceJoinedRef.current = peerVoiceJoined;
    isAiOpponentRef.current = isAiOpponent;
  }, [
    board,
    currentTurn,
    isGameOver,
    mySymbol,
    isHost,
    sessionId,
    playerId,
    playerName,
    view,
    isVoiceJoined,
    isMicMuted,
    isDeafened,
    peerVoiceJoined,
    isAiOpponent,
  ]);

  // WebRTC Voice Methods
  const setupSpeakingDetection = useCallback((stream, isLocal) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      if (isLocal) {
        localAudioCtxRef.current = ctx;
        localAnalyserRef.current = analyser;
      } else {
        remoteAudioCtxRef.current = ctx;
        remoteAnalyserRef.current = analyser;
      }
    } catch (err) {
      console.warn('Audio analyser setup error:', err);
    }
  }, []);

  const cleanupVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localAudioCtxRef.current) {
      try {
        localAudioCtxRef.current.close();
      } catch {}
      localAudioCtxRef.current = null;
    }
    if (remoteAudioCtxRef.current) {
      try {
        remoteAudioCtxRef.current.close();
      } catch {}
      remoteAudioCtxRef.current = null;
    }
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
    pendingCandidatesRef.current = [];
    setIsVoiceJoined(false);
    setIsMicMuted(false);
    setIsDeafened(false);
    setIsSelfSpeaking(false);
    setIsOpponentSpeaking(false);
    isVoiceJoinedRef.current = false;
  }, []);

  const getOrCreatePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && sessionIdRef.current) {
        tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
          type: 'WEBRTC_SIGNAL',
          signalType: 'ICE_CANDIDATE',
          candidate: event.candidate,
          senderId: playerIdRef.current,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = isDeafenedRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
      setupSpeakingDetection(remoteStream, false);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [setupSpeakingDetection]);

  const initiateWebRtcCall = useCallback(async () => {
    try {
      const pc = getOrCreatePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
        type: 'WEBRTC_SIGNAL',
        signalType: 'OFFER',
        offer: pc.localDescription,
        senderId: playerIdRef.current,
      });
    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
    }
  }, [getOrCreatePeerConnection]);

  const handleWebRtcSignal = useCallback(
    async (payload) => {
      const { signalType, offer, answer, candidate } = payload;

      if (signalType === 'VOICE_JOINED') {
        setPeerVoiceJoined(true);
        setStatusMessage('🎙️ Challenger joined voice chat!');
        if (isVoiceJoinedRef.current) {
          initiateWebRtcCall();
        }
      } else if (signalType === 'VOICE_LEFT') {
        setPeerVoiceJoined(false);
        setIsOpponentSpeaking(false);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        setStatusMessage('Challenger left voice chat.');
      } else if (signalType === 'OFFER') {
        if (!isVoiceJoinedRef.current) return;
        try {
          const pc = getOrCreatePeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Queued candidate failed:', e);
            }
          }
          const createdAnswer = await pc.createAnswer();
          await pc.setLocalDescription(createdAnswer);
          tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
            type: 'WEBRTC_SIGNAL',
            signalType: 'ANSWER',
            answer: pc.localDescription,
            senderId: playerIdRef.current,
          });
        } catch (err) {
          console.error('Error handling WebRTC offer:', err);
        }
      } else if (signalType === 'ANSWER') {
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            while (pendingCandidatesRef.current.length > 0) {
              const cand = pendingCandidatesRef.current.shift();
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('Queued candidate failed:', e);
              }
            }
          } catch (err) {
            console.error('Error handling WebRTC answer:', err);
          }
        }
      } else if (signalType === 'ICE_CANDIDATE') {
        if (candidate) {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      }
    },
    [getOrCreatePeerConnection, initiateWebRtcCall]
  );

  const joinVoiceChat = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatusMessage('⚠️ WebRTC Audio is not supported in this browser environment.');
      return;
    }

    try {
      setVoiceLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      setupSpeakingDetection(stream, true);
      setIsVoiceJoined(true);
      isVoiceJoinedRef.current = true;
      setStatusMessage('🎙️ Connected to room voice chat!');

      tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
        type: 'WEBRTC_SIGNAL',
        signalType: 'VOICE_JOINED',
        senderId: playerIdRef.current,
      });

      if (peerVoiceJoinedRef.current) {
        initiateWebRtcCall();
      }
    } catch (err) {
      console.error('Mic access error:', err);
      setStatusMessage('⚠️ Microphone access was denied or not found.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const leaveVoiceChat = () => {
    cleanupVoice();
    setStatusMessage('Left room voice chat.');
    if (sessionIdRef.current) {
      tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
        type: 'WEBRTC_SIGNAL',
        signalType: 'VOICE_LEFT',
        senderId: playerIdRef.current,
      });
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    isMicMutedRef.current = nextMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (nextMuted) {
      setIsSelfSpeaking(false);
    }
  };

  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    isDeafenedRef.current = nextDeafened;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = nextDeafened;
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
  };

  // Speaking Detection volume polling
  useEffect(() => {
    if (!isVoiceJoined) {
      setIsSelfSpeaking(false);
      setIsOpponentSpeaking(false);
      return;
    }

    const interval = setInterval(() => {
      if (localAnalyserRef.current && !isMicMutedRef.current) {
        const data = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
        localAnalyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setIsSelfSpeaking(avg > 15);
      } else {
        setIsSelfSpeaking(false);
      }

      if (remoteAnalyserRef.current && !isDeafenedRef.current) {
        const data = new Uint8Array(remoteAnalyserRef.current.frequencyBinCount);
        remoteAnalyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setIsOpponentSpeaking(avg > 15);
      } else {
        setIsOpponentSpeaking(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isVoiceJoined]);

  // Handle Confetti Celebration
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#4facfe', '#00ffaa', '#e94560', '#ff007f'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback(
    (winResult) => {
      setIsGameOver(true);
      setWinner(winResult.winner);
      setWinningPattern(winResult.winningPattern);

      if (winResult.winner === mySymbolRef.current) {
        triggerCelebration();
        soundManager.playWinFanfare();
        setStatusMessage('🎉 VICTORY! You won the match!');
      } else if (winResult.winner === 'DRAW') {
        setStatusMessage("🤝 STALEMATE! It's a draw!");
      } else {
        setStatusMessage('💀 DEFEAT! Opponent won the match.');
      }
    },
    [triggerCelebration]
  );

  // AI Move Scheduler
  const scheduleAiMove = useCallback((currentBoard, aiSym) => {
    setTimeout(() => {
      if (isGameOverRef.current) return;
      const bestMove = computeBestAIMove(currentBoard, aiSym);
      if (bestMove !== null && bestMove !== undefined) {
        soundManager.playMoveSound(aiSym);
        const nextBoard = [...currentBoard];
        nextBoard[bestMove] = aiSym;
        setBoard(nextBoard);

        const outcome = checkWinner(nextBoard);
        if (outcome) {
          handleGameOver(outcome);
        } else {
          setCurrentTurn(aiSym === 'X' ? 'O' : 'X');
          setTurnTimer(30);
        }
      }
    }, 600);
  }, [handleGameOver]);

  // Restart / Rematch
  const restartGame = useCallback(() => {
    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setTurnTimer(30);
    setStatusMessage('New round started! Player X starts.');

    if (!isAiOpponent && sessionId) {
      tictactoeSocket.requestRematch(sessionId, playerId, mySymbol);
    }

    if (isAiOpponent && mySymbol === 'O') {
      scheduleAiMove(INITIAL_BOARD, 'X');
    }
  }, [sessionId, playerId, mySymbol, isAiOpponent, scheduleAiMove]);

  // WebSocket incoming message handler
  const handleSocketMessage = useCallback(
    (payload) => {
      if (!payload) return;
      const eventType = payload.eventType || payload.type;
      const session = payload.session || {};
      const serverBoard = session.board || payload.board;
      const nextTurn = session.currentTurn || payload.nextTurn;

      if (eventType === 'PLAYER_JOINED') {
        // Someone joined the private room
        const incomingPlayerId = payload.playerId || (session.playerO);
        if (incomingPlayerId !== playerIdRef.current) {
          const guestName = payload.playerName || session.playerOName || payload.playerO || 'Challenger';
          setPlayerOName(guestName);
          setOpponentJoined(true);
          setStatusMessage(`${guestName} joined the room!`);

          // If Host, announce host presence and identity back
          if (isHostRef.current) {
            tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
              type: 'HOST_INFO',
              eventType: 'HOST_INFO',
              playerName: playerNameRef.current,
              playerId: playerIdRef.current,
            });
          }
        }
      } else if (eventType === 'HOST_INFO') {
        if (!isHostRef.current && payload.playerName) {
          setPlayerXName(payload.playerName);
        }
      } else if (eventType === 'PLAYER_READY') {
        if (payload.playerId !== playerIdRef.current) {
          setOpponentReady(Boolean(payload.isReady));
          setStatusMessage(
            payload.isReady
              ? `${payload.playerName || 'Opponent'} is ready to battle!`
              : `${payload.playerName || 'Opponent'} is not ready.`
          );
        }
      } else if (eventType === 'START_MATCH') {
        soundManager.playMatchStartSound();
        // Transition both host and guest immediately into PLAYING
        setBoard(INITIAL_BOARD);
        setCurrentTurn('X');
        setTurnTimer(30);
        setIsGameOver(false);
        setWinner(null);
        setWinningPattern(null);
        setView('PLAYING');
        setStatusMessage(
          mySymbolRef.current === 'X'
            ? 'Match started! Your move (X).'
            : 'Match started! Host moves first (X).'
        );
      } else if (eventType === 'MOVE_MADE' || eventType === 'MOVE' || payload.position !== undefined) {
        if (payload.playerId && payload.playerId === playerIdRef.current) {
          return; // Skip own broadcast echo
        }

        const moveSym = payload.symbol || (currentTurnRef.current === 'X' ? 'X' : 'O');
        soundManager.playMoveSound(moveSym);

        let updatedBoard = null;
        if (serverBoard && Array.isArray(serverBoard)) {
          updatedBoard = serverBoard.map((c) => (c ? String(c).trim() : ''));
        } else if (payload.position !== undefined && payload.symbol) {
          updatedBoard = [...boardRef.current];
          updatedBoard[payload.position] = payload.symbol;
        }

        if (updatedBoard) {
          setBoard(updatedBoard);
          const outcome = session.winner
            ? { winner: session.winner, winningPattern: session.winningPattern }
            : checkWinner(updatedBoard);
          if (outcome && outcome.winner) {
            handleGameOver(outcome);
            return;
          }
        }

        setTurnTimer(30);
        if (nextTurn) {
          setCurrentTurn(nextTurn);
        } else if (payload.symbol) {
          setCurrentTurn(payload.symbol === 'X' ? 'O' : 'X');
        } else {
          setCurrentTurn((prev) => (prev === 'X' ? 'O' : 'X'));
        }
      } else if (eventType === 'TURN_CHANGED') {
        const next = payload.nextTurn || (currentTurnRef.current === 'X' ? 'O' : 'X');
        setCurrentTurn(next);
        setTurnTimer(payload.turnTimer !== undefined ? payload.turnTimer : 30);
        setStatusMessage(`⏱️ Turn changed to Player ${next}.`);
      } else if (eventType === 'PLAYER_RECONNECTED') {
        setStatusMessage('Player reconnected!');
        if (payload.session) {
          if (payload.session.board) {
            setBoard(payload.session.board.map((c) => (c ? String(c).trim() : '')));
          }
          if (payload.session.currentTurn) {
            setCurrentTurn(payload.session.currentTurn);
          }
          if (payload.session.turnTimer !== undefined) {
            setTurnTimer(payload.session.turnTimer);
          }
        } else {
          if (payload.board) setBoard(payload.board);
          if (payload.currentTurn) setCurrentTurn(payload.currentTurn);
          if (payload.turnTimer !== undefined) setTurnTimer(payload.turnTimer);
        }
      } else if (eventType === 'PLAYER_LEFT') {
        if (isHostRef.current) {
          setPlayerOName('Waiting for Challenger...');
          setOpponentJoined(false);
          setOpponentReady(false);
          setStatusMessage('Opponent left the room. Waiting for a new challenger to join!');
        }
      } else if (eventType === 'MATCH_DISBANDED') {
        if (payload.leaverName && payload.leaverName === playerNameRef.current) {
          return;
        }
        if (viewRef.current === 'WAITING_ROOM' && isHostRef.current) {
          // In waiting room, host ignores non-host disbands
          return;
        }
        setIsMatchDisbanded(true);
        setDisbandMessage(payload.message || `${payload.leaverName || 'Opponent'} left the match.`);
        setStatusMessage(`⚠️ ${payload.leaverName || 'Opponent'} left the match.`);
      } else if (eventType === 'WEBRTC_SIGNAL') {
        if (payload.senderId === playerIdRef.current) return;
        handleWebRtcSignal(payload);
      } else if (eventType === 'GAME_OVER') {
        handleGameOver({
          winner: payload.winner || session.winner,
          winningPattern: payload.winningPattern || session.winningPattern,
        });
      } else if (eventType === 'MATCH_FORFEITED') {
        setStatusMessage(`⚠️ ${payload.forfeiter || 'Opponent'} forfeited the match.`);
        handleGameOver({
          winner: mySymbolRef.current,
          winningPattern: null,
        });
      } else if (eventType === 'REMATCH_ACCEPTED' || eventType === 'REMATCH_START') {
        restartGame();
      }
    },
    [handleGameOver, restartGame, handleWebRtcSignal]
  );

  // Turn Countdown Timer (30s)
  useEffect(() => {
    if (view !== 'PLAYING' || isGameOver) {
      return;
    }

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 6 && prev > 1) {
          soundManager.playTurnTickSound();
        }

        if (prev <= 1) {
          const nextTurn = currentTurnRef.current === 'X' ? 'O' : 'X';

          if (!isAiOpponentRef.current && sessionIdRef.current) {
            tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
              type: 'TURN_CHANGED',
              nextTurn,
              turnTimer: 30,
            });
          }

          setCurrentTurn(nextTurn);

          if (isAiOpponentRef.current && nextTurn === 'O') {
            scheduleAiMove(boardRef.current, 'O');
          }

          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, isGameOver, scheduleAiMove]);

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isAiOpponentRef.current && sessionIdRef.current) {
        tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
          type: 'MATCH_DISBANDED',
          leaverName: playerNameRef.current,
          message: `${playerNameRef.current} left the match.`,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupVoice();
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
      }
      tictactoeSocket.disconnect();
    };
  }, [cleanupVoice]);

  // Quick Match: Pair with simulated realistic player
  const pairWithSimulatedPlayer = useCallback(() => {
    setIsSearching(false);
    const botName = REALISTIC_BOT_NAMES[Math.floor(Math.random() * REALISTIC_BOT_NAMES.length)];
    const assignedSymbol = 'X'; // User plays as X
    setMySymbol(assignedSymbol);
    setPlayerXName(playerName);
    setPlayerOName(botName); // Shows realistic name like 'Aarav_Sharma' without [AI]
    setIsAiOpponent(true); // AI runs under the hood

    const mockSessionId = `OWG_QM_${Date.now()}`;
    const mockRoomCode = `QM-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(mockSessionId);
    setRoomCode(mockRoomCode);

    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setTurnTimer(30);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    soundManager.playMatchStartSound();
    setView('PLAYING');
    setStatusMessage(`Challenger found: ${botName}! Your move (X).`);
  }, [playerName]);

  // Start Quick Match with 12s countdown
  const startQuickMatch = useCallback(() => {
    setGameMode('QUICK_MATCH');
    setIsSearching(true);
    setSearchCountdown(12);
    setStatusMessage('');

    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
    }

    let remaining = 12;
    // Choose realistic finish time (10-12s elapsed, i.e., 0-2s remaining)
    const finishAtRemaining = Math.floor(Math.random() * 2);

    searchTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSearchCountdown(remaining);

      if (remaining <= finishAtRemaining) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
        pairWithSimulatedPlayer();
      }
    }, 1000);
  }, [pairWithSimulatedPlayer]);

  // Cancel Quick Match
  const cancelQuickMatch = useCallback(() => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setIsSearching(false);
    setSearchCountdown(12);
    setStatusMessage('Matchmaking cancelled.');
  }, []);

  // Create Private Room (Host)
  const createPrivateRoom = async () => {
    setLoading(true);
    setStatusMessage('Creating private room...');
    setGameMode('PRIVATE');
    setIsHost(true);
    setIsReady(true);
    setOpponentReady(false);
    setOpponentJoined(false);
    try {
      const res = await tictactoeApi.createRoom(playerId, playerName);
      setRoomCode(res.roomCode);
      setSessionId(res.sessionId);
      setMySymbol('X');
      setPlayerXName(playerName);
      setPlayerOName('Waiting for friend...');
      setIsAiOpponent(false);
      setView('WAITING_ROOM');

      tictactoeSocket.connect({
        sessionId: res.sessionId,
        onMessage: handleSocketMessage,
        onError: () => {},
      });
    } catch (err) {
      console.error('Create room error:', err);
      setStatusMessage('Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Join Private Room (Guest)
  const joinPrivateRoom = useCallback(
    async (codeToJoin) => {
      const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
      if (!code) {
        setStatusMessage('Please enter a valid room code.');
        return;
      }
      setLoading(true);
      setStatusMessage(`Connecting to room ${code}...`);
      setGameMode('PRIVATE');
      setIsHost(false);
      setIsReady(false);
      setOpponentReady(false);
      setOpponentJoined(true);
      try {
        const res = await tictactoeApi.joinRoom(code, playerId, playerName);
        setRoomCode(res.roomCode || code);
        setSessionId(res.sessionId);
        setMySymbol('O');
        setPlayerXName(res.playerXName || 'Room Host');
        setPlayerOName(playerName);
        setIsAiOpponent(false);

        tictactoeSocket.connect({
          sessionId: res.sessionId,
          onConnect: () => {
            // Inform host that guest joined!
            tictactoeSocket.sendRoomEvent(res.sessionId, {
              type: 'PLAYER_JOINED',
              symbol: 'O',
              playerId,
              playerName,
            });
          },
          onMessage: handleSocketMessage,
          onError: () => {},
        });

        // Crucial fix: Guest STAYS in WAITING_ROOM! DO NOT setView('PLAYING')
        setView('WAITING_ROOM');
        setStatusMessage(`Joined room ${code}! Click "I'm Ready" when prepared.`);
      } catch (err) {
        console.error('Join room error:', err);
        const isFull = /full|maximum|already/i.test(err.message || '');
        const isExpiredOrNotFound = /not exist|expired|not found/i.test(err.message || '');
        if (isFull) {
          setStatusMessage('⚠️ Room is full! Maximum 2 players already joined.');
        } else if (isExpiredOrNotFound) {
          setStatusMessage(err.message || '⚠️ Room does not exist or has expired.');
        } else {
          setStatusMessage(err.message || 'Could not join room. Check the code and try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [joinCodeInput, playerId, playerName, handleSocketMessage]
  );

  // Auto-join if room query parameter is present on initial mount
  useEffect(() => {
    const roomFromUrl = (searchParams.get('room') || '').trim().toUpperCase();
    if (roomFromUrl && !hasAutoJoinedRef.current && view === 'LOBBY' && !sessionId) {
      hasAutoJoinedRef.current = true;
      joinPrivateRoom(roomFromUrl);
    }
  }, [searchParams, view, sessionId, joinPrivateRoom]);

  // Guest toggle ready
  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    tictactoeSocket.sendPlayerReady(sessionId, playerId, mySymbol, nextReady);
  };

  // Host starts match (only enabled if opponentJoined && opponentReady)
  const handleHostStartMatch = () => {
    if (!opponentJoined || !opponentReady) return;
    soundManager.playMatchStartSound();
    tictactoeSocket.sendStartMatch(sessionId);
    // Transition Host immediately to avoid network delay
    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setTurnTimer(30);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setView('PLAYING');
    setStatusMessage('Match started! Your move (X).');
  };

  // Cell Click Handler
  const handleCellClick = (index) => {
    if (view !== 'PLAYING' || isGameOver) return;
    if (board[index] && board[index].trim() !== '') return;
    if (currentTurn !== mySymbol) return;

    soundManager.playMoveSound(mySymbol);

    const newBoard = [...board];
    newBoard[index] = mySymbol;
    setBoard(newBoard);
    setTurnTimer(30);

    const outcome = checkWinner(newBoard);
    const nextTurn = mySymbol === 'X' ? 'O' : 'X';
    setCurrentTurn(nextTurn);

    if (!isAiOpponent && sessionId) {
      tictactoeSocket.sendMove(sessionId, playerId, index, mySymbol);
      // Direct peer broadcast for sub-50ms synchronized UI across both screens
      tictactoeSocket.sendRoomEvent(sessionId, {
        type: 'MOVE_MADE',
        eventType: 'MOVE_MADE',
        playerId,
        position: index,
        symbol: mySymbol,
        nextTurn,
        board: newBoard,
        turnTimer: 30,
      });
    }

    if (outcome) {
      handleGameOver(outcome);
      return;
    }

    if (isAiOpponent) {
      scheduleAiMove(newBoard, nextTurn);
    }
  };

  // Exit match handler with confirmation
  const handleExitMatchClick = () => {
    if (view === 'PLAYING' && !isGameOver) {
      setShowExitConfirmModal(true);
    } else {
      returnToLobby();
    }
  };

  // Return to Lobby
  const returnToLobby = () => {
    hasAutoJoinedRef.current = true;
    try {
      setSearchParams({}, { replace: true });
    } catch (e) {
      console.warn('Failed to clear searchParams', e);
    }
    setShowExitConfirmModal(false);
    setIsMatchDisbanded(false);
    cleanupVoice();

    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (!isAiOpponent && sessionId) {
      if (view === 'WAITING_ROOM' && !isHost) {
        // Guest leaves waiting room: notify host and free player O slot
        tictactoeSocket.sendRoomEvent(sessionId, {
          type: 'PLAYER_LEFT',
          eventType: 'PLAYER_LEFT',
          symbol: 'O',
          playerId,
          playerName,
          message: `${playerName} left the room.`,
        });
        try {
          fetch(`/api/v1/tictactoe/rooms/${sessionId}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
          }).catch(() => {});
        } catch (_) {}
      } else {
        // Host leaves or match forfeit
        tictactoeSocket.sendRoomEvent(sessionId, {
          type: 'MATCH_DISBANDED',
          leaverName: playerName,
          message: `${playerName} left the match.`,
        });
      }
    }
    tictactoeSocket.disconnect();
    setView('LOBBY');
    setIsSearching(false);
    setSearchCountdown(12);
    setBoard(INITIAL_BOARD);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setRoomCode('');
    setSessionId('');
    setIsHost(false);
    setIsReady(false);
    setOpponentReady(false);
    setOpponentJoined(false);
    setIsAiOpponent(false);
    setStatusMessage('');
  };

  const exitToHome = () => {
    returnToLobby();
    navigate('/', { replace: true });
  };

  // Android hardware back button handler
  useEffect(() => {
    const handlePopState = () => {
      if (view === 'PLAYING' || view === 'WAITING_ROOM') {
        returnToLobby();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // Copy shareable URL
  const copyShareableLink = () => {
    const fullUrl = `${window.location.origin}/games/tictactoe?room=${roomCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Copy raw room code
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Determine strike-through class for winning cells
  const getStrikeThroughClass = () => {
    if (!winningPattern) return '';
    const patternStr = winningPattern.join(',');
    if (patternStr === '0,1,2') return 'strike-row-0';
    if (patternStr === '3,4,5') return 'strike-row-1';
    if (patternStr === '6,7,8') return 'strike-row-2';
    if (patternStr === '0,3,6') return 'strike-col-0';
    if (patternStr === '1,4,7') return 'strike-col-1';
    if (patternStr === '2,5,8') return 'strike-col-2';
    if (patternStr === '0,4,8') return 'strike-diag-main';
    if (patternStr === '2,4,6') return 'strike-diag-anti';
    return '';
  };

  const isMyTurn = currentTurn === mySymbol && !isGameOver;
  const isPlayerXSpeaking =
    (mySymbol === 'X' && isSelfSpeaking) ||
    (mySymbol === 'O' && isOpponentSpeaking);
  const isPlayerOSpeaking =
    (mySymbol === 'O' && isSelfSpeaking) ||
    (mySymbol === 'X' && isOpponentSpeaking);

  return (
    <div className="tictactoe-lobby-container">
      {/* Remote Audio Element for WebRTC */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Navigation Breadcrumb */}
      <nav className="lobby-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/games">Games</Link>
        <span>/</span>
        <span className="breadcrumb-current">Tic-Tac-Toe Arena</span>
      </nav>

      {/* LOBBY VIEW - Exactly 2 options */}
      {view === 'LOBBY' && (
        <div className="lobby-hero">
          <div className="lobby-hero-badge">
            <span className="badge-pulse-dot"></span> Real-Time 1v1 PvP
          </div>

          <h1 className="lobby-title">Tic-Tac-Toe Arena</h1>
          <p className="lobby-subtitle">
            Stateless microservice multiplayer with instant matchmaking and private room invites.
          </p>

          {/* Action Cards Grid - Exactly 2 options */}
          <div className="modes-grid two-cards-grid">
            {/* 1. Quick Match Card */}
            <div className="mode-card primary-card">
              <div className="mode-card-icon">⚡</div>
              <h3>Quick Match</h3>
              <p>Instantly match with an online challenger in random matchmaking queue.</p>

              {isSearching ? (
                <div className="matchmaking-search-container">
                  <div className="matchmaking-search-header">
                    <span className="search-pulse-ring"></span>
                    <span className="search-pulse-dot"></span>
                    <span className="matchmaking-timer-text">
                      🔍 Searching for online challenger... ({searchCountdown}s)
                    </span>
                  </div>
                  <div className="matchmaking-progress-track">
                    <div
                      className="matchmaking-progress-bar"
                      style={{ width: `${((12 - searchCountdown) / 12) * 100}%` }}
                    ></div>
                  </div>
                  <button
                    type="button"
                    className="mode-btn btn-outline cancel-search-btn"
                    onClick={cancelQuickMatch}
                  >
                    ❌ Cancel Search
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mode-btn btn-neon-cyan"
                  onClick={startQuickMatch}
                  disabled={loading}
                >
                  ⚡ Find Random Opponent
                </button>
              )}
            </div>

            {/* 2. Private Room Card */}
            <div className="mode-card highlight-card private-room-card">
              <div className="mode-card-icon">🔗</div>
              <h3>Private Room</h3>
              <p>Play with a coworker or friend via custom room code or direct invite link.</p>

              <div className="private-room-subactions">
                <div className="subaction-section">
                  <span className="subaction-label">Host a New Match</span>
                  <button
                    type="button"
                    className="mode-btn btn-neon-magenta"
                    onClick={createPrivateRoom}
                    disabled={loading || isSearching}
                  >
                    ➕ Create Room
                  </button>
                </div>

                <div className="subactions-divider">
                  <span>OR JOIN BY CODE</span>
                </div>

                <div className="subaction-section">
                  <span className="subaction-label">Enter Room Code</span>
                  <div className="join-form-inline">
                    <input
                      type="text"
                      placeholder="e.g. TTT-7X9B"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={10}
                      className="join-input inline-join-input"
                      disabled={loading || isSearching}
                    />
                    <button
                      type="button"
                      className="mode-btn btn-outline join-inline-btn"
                      onClick={() => joinPrivateRoom()}
                      disabled={loading || isSearching || !joinCodeInput.trim()}
                    >
                      🔑 Join Room
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WAITING ROOM VIEW (Host vs Guest) */}
      {view === 'WAITING_ROOM' && (
        <div className="lobby-hero waiting-hero">
          <div className="waiting-container">
            {isHost ? (
              /* HOST WAITING UI */
              <>
                <span className="lobby-status-tag">👑 Room Host</span>
                <h2 className="waiting-title">Room {roomCode}</h2>
                <p className="waiting-desc">
                  Share the room code or link. The match will start once your challenger joins and marks as Ready.
                </p>

                <div className="room-code-display">
                  <span className="room-code-label">ROOM CODE</span>
                  <span className="room-code-value">{roomCode}</span>
                </div>

                <div className="shareable-link-box">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/games/tictactoe?room=${roomCode}`}
                    className="shareable-link-input"
                  />
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={copyShareableLink}
                  >
                    {copySuccess ? '✅ Copied!' : '📋 Copy Link'}
                  </button>
                  <button
                    type="button"
                    className="copy-btn secondary-btn"
                    onClick={copyRoomCode}
                  >
                    Copy Code
                  </button>
                </div>

                {/* Opponent Status Box */}
                <div className="waiting-opponent-card">
                  <div className="opponent-avatar-row">
                    <div className="opponent-avatar-icon">
                      {opponentJoined ? '⚔️' : '⏳'}
                    </div>
                    <div className="opponent-meta-info">
                      <span className="opponent-label">Challenger:</span>
                      <span className="opponent-display-name">
                        {opponentJoined ? playerOName : 'Waiting for opponent to join...'}
                      </span>
                    </div>
                    {opponentJoined && (
                      <span className={`ready-badge ${opponentReady ? 'badge-ready' : 'badge-not-ready'}`}>
                        {opponentReady ? '🟢 Ready' : '⏳ Not Ready'}
                      </span>
                    )}
                  </div>

                  {!opponentJoined ? (
                    <div className="pulsing-indicator-box">
                      <div className="pulse-ring"></div>
                      <div className="pulse-dot"></div>
                      <span className="pulsing-text">Waiting for opponent to connect...</span>
                    </div>
                  ) : (
                    <div className="ready-status-note">
                      {opponentReady
                        ? '🟢 Opponent is ready! Click "Start Match" below to begin.'
                        : `⏳ Waiting for ${playerOName} to mark as Ready...`}
                    </div>
                  )}
                </div>

                {/* Host Voice Controls */}
                {!isAiOpponent && sessionId && (
                  <div className="waiting-voice-bar">
                    {!isVoiceJoined ? (
                      <button
                        type="button"
                        className="hud-tool-btn voice-join-btn"
                        onClick={joinVoiceChat}
                        disabled={voiceLoading}
                      >
                        {voiceLoading ? '⏳ Connecting...' : '🎙️ Join Room Voice Chat'}
                      </button>
                    ) : (
                      <div className="voice-active-wrap">
                        <span className="voice-status-pill">
                          <span className="voice-live-dot"></span> Voice Connected
                        </span>
                        <button
                          type="button"
                          className={`hud-tool-btn mic-btn ${isMicMuted ? 'btn-danger' : 'btn-active'}`}
                          onClick={toggleMute}
                          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                        >
                          {isMicMuted ? '🔇 Muted' : '🎙️ Mic ON'}
                        </button>
                        <button
                          type="button"
                          className={`hud-tool-btn deafen-btn ${isDeafened ? 'btn-danger' : 'btn-active'}`}
                          onClick={toggleDeafen}
                          title={isDeafened ? 'Undeafen Speaker' : 'Deafen Speaker'}
                        >
                          {isDeafened ? '🔈 Deafened' : '🔊 Deafen'}
                        </button>
                        <button
                          type="button"
                          className="hud-tool-btn voice-leave-btn"
                          onClick={leaveVoiceChat}
                        >
                          ❌ Leave
                        </button>
                      </div>
                    )}
                    {peerVoiceJoined && !isVoiceJoined && (
                      <span className="peer-voice-pill">Challenger joined voice!</span>
                    )}
                  </div>
                )}

                {/* Host Actions */}
                <div className="waiting-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-green start-match-btn"
                    onClick={handleHostStartMatch}
                    disabled={!opponentJoined || !opponentReady}
                  >
                    🚀 Start Match
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Cancel &amp; Back to Lobby
                  </button>
                </div>
              </>
            ) : (
              /* GUEST WAITING UI */
              <>
                <span className="lobby-status-tag guest-tag">🎯 Challenger (Player O)</span>
                <h2 className="waiting-title">Room {roomCode}</h2>
                <p className="waiting-desc">
                  You are connected to the room! Mark yourself as Ready so the Host can launch the game.
                </p>

                <div className="guest-room-info-card">
                  <div className="host-info-row">
                    <span className="host-label">👑 Room Host:</span>
                    <strong className="host-name">{playerXName || 'Host'}</strong>
                    <span className="host-status-badge">🟢 Connected</span>
                  </div>
                  <div className="room-code-mini">
                    <span>Room Code: <strong>{roomCode}</strong></span>
                  </div>
                </div>

                <div className="guest-ready-card">
                  <button
                    type="button"
                    className={`mode-btn guest-ready-toggle-btn ${
                      isReady ? 'btn-neon-green is-ready-active' : 'btn-neon-cyan'
                    }`}
                    onClick={handleToggleReady}
                  >
                    {isReady ? "🟢 I'm Ready (Click to Unready)" : '⏳ Mark as Ready'}
                  </button>

                  <p className="guest-ready-subtext">
                    {isReady
                      ? '✅ You are marked as Ready! Waiting for Host to start match...'
                      : 'Click the button above to let the Host know you are ready to play.'}
                  </p>
                </div>

                {/* Guest Voice Controls */}
                {!isAiOpponent && sessionId && (
                  <div className="waiting-voice-bar">
                    {!isVoiceJoined ? (
                      <button
                        type="button"
                        className="hud-tool-btn voice-join-btn"
                        onClick={joinVoiceChat}
                        disabled={voiceLoading}
                      >
                        {voiceLoading ? '⏳ Connecting...' : '🎙️ Join Room Voice Chat'}
                      </button>
                    ) : (
                      <div className="voice-active-wrap">
                        <span className="voice-status-pill">
                          <span className="voice-live-dot"></span> Voice Connected
                        </span>
                        <button
                          type="button"
                          className={`hud-tool-btn mic-btn ${isMicMuted ? 'btn-danger' : 'btn-active'}`}
                          onClick={toggleMute}
                          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                        >
                          {isMicMuted ? '🔇 Muted' : '🎙️ Mic ON'}
                        </button>
                        <button
                          type="button"
                          className={`hud-tool-btn deafen-btn ${isDeafened ? 'btn-danger' : 'btn-active'}`}
                          onClick={toggleDeafen}
                          title={isDeafened ? 'Undeafen Speaker' : 'Deafen Speaker'}
                        >
                          {isDeafened ? '🔈 Deafened' : '🔊 Deafen'}
                        </button>
                        <button
                          type="button"
                          className="hud-tool-btn voice-leave-btn"
                          onClick={leaveVoiceChat}
                        >
                          ❌ Leave
                        </button>
                      </div>
                    )}
                    {peerVoiceJoined && !isVoiceJoined && (
                      <span className="peer-voice-pill">Host joined voice!</span>
                    )}
                  </div>
                )}

                <div className="waiting-actions">
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Leave Room &amp; Back to Lobby
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE GAME VIEW */}
      {view === 'PLAYING' && (
        <div className="gameplay-container">
          {/* HUD Bar: Sound & WebRTC Voice Controls */}
          <div className="game-hud-bar">
            <div className="hud-left-controls">
              <button
                type="button"
                className={`hud-tool-btn sound-toggle-btn ${!soundEnabled ? 'sound-off' : ''}`}
                onClick={toggleSound}
                title="Toggle Game Sound Effects"
              >
                {soundEnabled ? '🔊 Sound: ON' : '🔈 Sound: OFF'}
              </button>
            </div>

            {!isAiOpponent && sessionId && (
              <div className="hud-right-controls">
                {!isVoiceJoined ? (
                  <div className="voice-unjoined-wrap">
                    <button
                      type="button"
                      className="hud-tool-btn voice-join-btn"
                      onClick={joinVoiceChat}
                      disabled={voiceLoading}
                    >
                      {voiceLoading ? '⏳ Connecting...' : '🎙️ Voice: Join'}
                    </button>
                    {peerVoiceJoined && (
                      <span className="peer-voice-pill">Challenger in voice!</span>
                    )}
                  </div>
                ) : (
                  <div className="voice-active-wrap">
                    <span className="voice-status-pill">
                      <span className="voice-live-dot"></span> Voice Active
                    </span>
                    <button
                      type="button"
                      className={`hud-tool-btn mic-btn ${isMicMuted ? 'btn-danger' : 'btn-active'}`}
                      onClick={toggleMute}
                      title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      {isMicMuted ? '🔇 Muted' : '🎙️ Mic ON'}
                    </button>
                    <button
                      type="button"
                      className={`hud-tool-btn deafen-btn ${isDeafened ? 'btn-danger' : 'btn-active'}`}
                      onClick={toggleDeafen}
                      title={isDeafened ? 'Undeafen Speaker' : 'Deafen Speaker'}
                    >
                      {isDeafened ? '🔈 Deafened' : '🔊 Deafen'}
                    </button>
                    <button
                      type="button"
                      className="hud-tool-btn voice-leave-btn"
                      onClick={leaveVoiceChat}
                      title="Leave Voice Chat"
                    >
                      ❌ Leave
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PLAYER HUD */}
          <div className="player-hud">
            {/* Player X Card */}
            <div
              className={`player-card player-x ${
                currentTurn === 'X' ? 'active-turn' : ''
              } ${mySymbol === 'X' ? 'is-self' : ''} ${
                isPlayerXSpeaking ? 'speaking-pulse-glow' : ''
              }`}
            >
              <div
                className={`player-avatar-box symbol-x ${
                  isPlayerXSpeaking ? 'avatar-speaking' : ''
                }`}
              >
                <span>X</span>
                {isPlayerXSpeaking && (
                  <span className="speaking-mic-wave" title="Speaking">
                    🎙️
                  </span>
                )}
              </div>
              <div className="player-details">
                <span className="player-badge">
                  {mySymbol === 'X' ? 'YOU' : 'OPPONENT'}
                </span>
                <span className="player-name">{playerXName}</span>
                {isPlayerXSpeaking && (
                  <span className="speaking-label">Speaking...</span>
                )}
              </div>
            </div>

            {/* Match VS Badge & Turn Timer */}
            <div className="match-timer-box">
              <div className="vs-badge">VS</div>
              <div className="turn-indicator">
                <span className="turn-label">
                  Turn:{' '}
                  <strong
                    className={
                      currentTurn === 'X' ? 'cyan-text' : 'magenta-text'
                    }
                  >
                    Player {currentTurn}
                  </strong>
                </span>
                {isMyTurn && (
                  <span className="your-turn-pill">YOUR TURN</span>
                )}
              </div>

              {/* 30s Countdown Bar */}
              <div className="timer-bar-wrapper">
                <div
                  className={`timer-bar-fill ${
                    turnTimer <= 5 ? 'timer-danger' : ''
                  }`}
                  style={{ width: `${(turnTimer / 30) * 100}%` }}
                ></div>
              </div>
              <span className="timer-seconds">{turnTimer}s remaining</span>
            </div>

            {/* Player O Card */}
            <div
              className={`player-card player-o ${
                currentTurn === 'O' ? 'active-turn' : ''
              } ${mySymbol === 'O' ? 'is-self' : ''} ${
                isPlayerOSpeaking ? 'speaking-pulse-glow' : ''
              }`}
            >
              <div
                className={`player-avatar-box symbol-o ${
                  isPlayerOSpeaking ? 'avatar-speaking' : ''
                }`}
              >
                <span>O</span>
                {isPlayerOSpeaking && (
                  <span className="speaking-mic-wave" title="Speaking">
                    🎙️
                  </span>
                )}
              </div>
              <div className="player-details">
                <span className="player-badge">
                  {mySymbol === 'O' ? 'YOU' : 'OPPONENT'}
                </span>
                <span className="player-name">{playerOName}</span>
                {isPlayerOSpeaking && (
                  <span className="speaking-label">Speaking...</span>
                )}
              </div>
            </div>
          </div>

          {/* INTERACTIVE 3X3 NEON GRID */}
          <div className="grid-arena-wrapper">
            <div className="grid-arena">
              {board.map((cellValue, idx) => {
                const isWinningCell =
                  winningPattern && winningPattern.includes(idx);
                const showGhost =
                  !cellValue &&
                  isMyTurn &&
                  hoveredCell === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`grid-cell ${
                      cellValue ? `filled-${cellValue.toLowerCase()}` : ''
                    } ${isWinningCell ? 'winning-cell' : ''}`}
                    onClick={() => handleCellClick(idx)}
                    onMouseEnter={() => setHoveredCell(idx)}
                    onMouseLeave={() => setHoveredCell(null)}
                    disabled={Boolean(cellValue) || !isMyTurn || isGameOver}
                    aria-label={`Cell ${idx} ${cellValue || 'empty'}`}
                  >
                    {/* Rendered Symbol */}
                    {cellValue === 'X' && (
                      <span className="symbol-svg symbol-svg-x animate-pop">
                        ✕
                      </span>
                    )}
                    {cellValue === 'O' && (
                      <span className="symbol-svg symbol-svg-o animate-pop">
                        ◯
                      </span>
                    )}

                    {/* Ghost preview */}
                    {showGhost && (
                      <span
                        className={`symbol-ghost ${
                          mySymbol === 'X' ? 'ghost-x' : 'ghost-o'
                        }`}
                      >
                        {mySymbol === 'X' ? '✕' : '◯'}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Strike-through line */}
              {winningPattern && (
                <div
                  className={`win-strike-line ${getStrikeThroughClass()}`}
                ></div>
              )}
            </div>
          </div>

          {/* Quick Controls Under Grid */}
          <div className="match-controls">
            <button
              type="button"
              className="ctrl-btn"
              onClick={restartGame}
              title="Reset match"
            >
              🔄 Reset Board
            </button>
            <button
              type="button"
              className="ctrl-btn ctrl-leave"
              onClick={handleExitMatchClick}
              title="Leave match"
            >
              🚪 Exit to Lobby
            </button>
            {roomCode && (
              <span className="room-id-tag">Room: {roomCode}</span>
            )}
          </div>

          {/* EXIT CONFIRMATION MODAL */}
          {showExitConfirmModal && (
            <div className="game-over-overlay">
              <div className="game-over-modal modal-defeat" style={{ maxWidth: '420px', textAlign: 'center' }}>
                <div className="game-over-icon">⚠️</div>
                <h2 className="game-over-headline" style={{ color: '#ff007f' }}>Exit Match?</h2>
                <p className="game-over-desc">
                  Are you sure you want to forfeit and exit? Exiting an active match ends the game for both players.
                </p>
                <div className="game-over-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-cyan"
                    onClick={() => setShowExitConfirmModal(false)}
                  >
                    Keep Playing
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-neon-magenta"
                    onClick={returnToLobby}
                  >
                    Yes, Forfeit & Exit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GAME OVER MODAL */}
          {isGameOver && (
            <div className="game-over-overlay">
              <div
                className={`game-over-modal ${
                  winner === mySymbol
                    ? 'modal-victory'
                    : winner === 'DRAW'
                    ? 'modal-draw'
                    : 'modal-defeat'
                }`}
              >
                <div className="game-over-icon">
                  {winner === mySymbol && '🏆'}
                  {winner === 'DRAW' && '🤝'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && '💀'}
                </div>

                <h2 className="game-over-headline">
                  {winner === mySymbol && 'VICTORY!'}
                  {winner === 'DRAW' && 'STALEMATE!'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && 'DEFEAT!'}
                </h2>

                <p className="game-over-desc">
                  {winner === mySymbol && 'Flawless execution! You dominated the grid.'}
                  {winner === 'DRAW' && 'A battle of masterminds! The board is completely tied.'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && 'Opponent completed three-in-a-row. Better luck next round!'}
                </p>

                <div className="game-over-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-cyan"
                    onClick={restartGame}
                  >
                    🔄 Play Again / Rematch
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Back to Lobby
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MATCH DISBANDED MODAL */}
      {isMatchDisbanded && (
        <div className="game-over-overlay">
          <div className="game-over-modal modal-defeat" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="game-over-icon">⚠️</div>
            <h2 className="game-over-headline" style={{ color: '#ffaa00' }}>Match Disbanded</h2>
            <p className="game-over-desc">
              ⚠️ Match Disbanded: {disbandMessage || 'Opponent left the match.'}
            </p>
            <div className="game-over-actions">
              <button
                type="button"
                className="mode-btn btn-neon-cyan"
                onClick={returnToLobby}
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Safe-Area Notification Toast */}
      {statusMessage && (
        <div className="tictactoe-floating-toast" role="status">
          <span>📢</span>
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};

export default TicTacToeLobby;
