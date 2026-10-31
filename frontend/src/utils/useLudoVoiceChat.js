import { useState, useRef, useEffect, useCallback } from 'react';
import { ludoSocket } from '../services/ludoSocket';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useLudoVoiceChat = ({ sessionId, playerId, myColor, playerName, isSoloAI }) => {
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState({
    RED: false,
    GREEN: false,
    YELLOW: false,
    BLUE: false,
  });
  const [voiceError, setVoiceError] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // targetPlayerId -> RTCPeerConnection
  const audioElementsRef = useRef(new Map()); // targetPlayerId -> HTMLAudioElement
  const peerColorsRef = useRef(new Map()); // targetPlayerId -> color
  const animFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map()); // playerId/myColor -> AnalyserNode

  // Cleanup all connections
  const disconnectVoice = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Broadcast leave
    if (sessionId && !isSoloAI) {
      ludoSocket.sendRoomEvent(sessionId, {
        type: 'WEBRTC_SIGNAL',
        signalType: 'LEAVE_VOICE',
        fromPlayerId: playerId,
        fromColor: myColor,
      });
    }

    // Stop local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // Ignore
      }
    });
    peerConnectionsRef.current.clear();

    // Remove remote audio elements
    audioElementsRef.current.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {
        // Ignore
      }
    });
    audioElementsRef.current.clear();
    peerColorsRef.current.clear();

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }
    analysersRef.current.clear();

    setIsVoiceConnected(false);
    setIsMicMuted(false);
    setIsDeafened(false);
    setSpeakingPlayers({ RED: false, GREEN: false, YELLOW: false, BLUE: false });
  }, [sessionId, playerId, myColor, isSoloAI]);

  // Speaking level detector loop
  const startVolumeAnalysis = useCallback(() => {
    const checkVolumes = () => {
      const activeSpeaking = { RED: false, GREEN: false, YELLOW: false, BLUE: false };

      analysersRef.current.forEach((analyser, key) => {
        try {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Threshold for speaking
          if (avg > 15) {
            // key can be color or playerId
            const color = key.length > 2 && ['RED', 'GREEN', 'YELLOW', 'BLUE'].includes(key)
              ? key
              : peerColorsRef.current.get(key) || myColor;
            if (activeSpeaking[color] !== undefined) {
              activeSpeaking[color] = true;
            }
          }
        } catch {
          // Ignore
        }
      });

      setSpeakingPlayers(activeSpeaking);
      animFrameRef.current = requestAnimationFrame(checkVolumes);
    };

    animFrameRef.current = requestAnimationFrame(checkVolumes);
  }, [myColor]);

  // Connect Voice
  const connectVoice = useCallback(async () => {
    if (isSoloAI) {
      setVoiceError('Voice chat is available in multiplayer rooms with online players.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Audio device access is not supported in this browser environment.');
      return;
    }

    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setIsVoiceConnected(true);
      setIsMicMuted(false);
      setIsDeafened(false);

      // Setup audio analyzer for local mic
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analysersRef.current.set(myColor, analyser);
        startVolumeAnalysis();
      }

      // Broadcast JOIN_VOICE to all in room
      ludoSocket.sendRoomEvent(sessionId, {
        type: 'WEBRTC_SIGNAL',
        signalType: 'JOIN_VOICE',
        fromPlayerId: playerId,
        fromColor: myColor,
        fromName: playerName,
      });
    } catch (err) {
      console.warn('[LudoVoice] Failed to get user media:', err);
      setVoiceError('Microphone permission denied or device unavailable.');
      disconnectVoice();
    }
  }, [isSoloAI, sessionId, playerId, myColor, playerName, startVolumeAnalysis, disconnectVoice]);

  // Create peer connection helper
  const createPeerConnection = useCallback((remotePlayerId, remoteColor) => {
    if (peerConnectionsRef.current.has(remotePlayerId)) {
      return peerConnectionsRef.current.get(remotePlayerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remotePlayerId, pc);
    if (remoteColor) peerColorsRef.current.set(remotePlayerId, remoteColor);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && sessionId) {
        ludoSocket.sendRoomEvent(sessionId, {
          type: 'WEBRTC_SIGNAL',
          signalType: 'ICE_CANDIDATE',
          targetPlayerId: remotePlayerId,
          fromPlayerId: playerId,
          candidate: event.candidate,
        });
      }
    };

    // Remote Track Handling
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audio = audioElementsRef.current.get(remotePlayerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        audioElementsRef.current.set(remotePlayerId, audio);
      }
      audio.srcObject = remoteStream;
      audio.muted = isDeafened;
      audio.play().catch(() => {});

      // Add analyzer for remote speaking indicator
      if (audioContextRef.current) {
        try {
          const source = audioContextRef.current.createMediaStreamSource(remoteStream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analysersRef.current.set(remotePlayerId, analyser);
        } catch {
          // Ignore
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerConnectionsRef.current.delete(remotePlayerId);
        const el = audioElementsRef.current.get(remotePlayerId);
        if (el) {
          el.pause();
          el.remove();
          audioElementsRef.current.delete(remotePlayerId);
        }
        analysersRef.current.delete(remotePlayerId);
      }
    };

    return pc;
  }, [sessionId, playerId, isDeafened]);

  // Process incoming WebRTC signals
  const handleWebRTCSignal = useCallback(async (signal) => {
    if (!signal || signal.fromPlayerId === playerId) return;

    const { signalType, fromPlayerId, fromColor, targetPlayerId, offer, answer, candidate } = signal;

    if (signalType === 'JOIN_VOICE') {
      // If we are connected, create offer to the newly joined peer
      if (localStreamRef.current) {
        const pc = createPeerConnection(fromPlayerId, fromColor);
        try {
          const createdOffer = await pc.createOffer();
          await pc.setLocalDescription(createdOffer);
          ludoSocket.sendRoomEvent(sessionId, {
            type: 'WEBRTC_SIGNAL',
            signalType: 'OFFER',
            targetPlayerId: fromPlayerId,
            fromPlayerId: playerId,
            fromColor: myColor,
            offer: createdOffer,
          });
        } catch (err) {
          console.warn('[LudoVoice] Error creating offer:', err);
        }
      }
    } else if (signalType === 'OFFER' && targetPlayerId === playerId) {
      if (!localStreamRef.current) {
        // Not in voice chat
        return;
      }
      const pc = createPeerConnection(fromPlayerId, fromColor);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const createdAnswer = await pc.createAnswer();
        await pc.setLocalDescription(createdAnswer);
        ludoSocket.sendRoomEvent(sessionId, {
          type: 'WEBRTC_SIGNAL',
          signalType: 'ANSWER',
          targetPlayerId: fromPlayerId,
          fromPlayerId: playerId,
          fromColor: myColor,
          answer: createdAnswer,
        });
      } catch (err) {
        console.warn('[LudoVoice] Error handling offer:', err);
      }
    } else if (signalType === 'ANSWER' && targetPlayerId === playerId) {
      const pc = peerConnectionsRef.current.get(fromPlayerId);
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.warn('[LudoVoice] Error setting remote description for answer:', err);
        }
      }
    } else if (signalType === 'ICE_CANDIDATE' && targetPlayerId === playerId) {
      const pc = peerConnectionsRef.current.get(fromPlayerId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // Ignore ICE errors
        }
      }
    } else if (signalType === 'LEAVE_VOICE') {
      const pc = peerConnectionsRef.current.get(fromPlayerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(fromPlayerId);
      }
      const el = audioElementsRef.current.get(fromPlayerId);
      if (el) {
        el.pause();
        el.remove();
        audioElementsRef.current.delete(fromPlayerId);
      }
      analysersRef.current.delete(fromPlayerId);
      peerColorsRef.current.delete(fromPlayerId);
      if (fromColor) {
        setSpeakingPlayers((prev) => ({ ...prev, [fromColor]: false }));
      }
    }
  }, [playerId, myColor, sessionId, createPeerConnection]);

  // Toggle Mic
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextState = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextState;
    });
    setIsMicMuted(nextState);
  }, [isMicMuted]);

  // Toggle Deafen / Speaker Mute
  const toggleDeafen = useCallback(() => {
    const nextState = !isDeafened;
    audioElementsRef.current.forEach((audio) => {
      audio.muted = nextState;
    });
    setIsDeafened(nextState);
  }, [isDeafened]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      disconnectVoice();
    };
  }, [disconnectVoice]);

  return {
    isVoiceConnected,
    isMicMuted,
    isDeafened,
    speakingPlayers,
    voiceError,
    connectVoice,
    disconnectVoice,
    toggleMic,
    toggleDeafen,
    handleWebRTCSignal,
  };
};

export default useLudoVoiceChat;
