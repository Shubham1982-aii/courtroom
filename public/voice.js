import { canSpeak, canListen, canConnectAudio } from './audio-policy.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }
];

export class VoiceMesh {
  constructor(me, sendSignal, onLevel, onStatus) {
    this.me = me;
    this.sendSignal = sendSignal; // (toMemberId, signalData) => void
    this.onLevel = onLevel;       // (memberId, level) => void
    this.onStatus = onStatus;     // (message) => void

    this.peers = new Map();       // memberId -> { pc, stream, candidates: [] }
    this.localStream = null;
    this.active = false;
    this.muted = false;
    this.meterCleanup = null;
  }

  async start() {
    if (this.active) return;
    this.active = true;

    if (canSpeak(this.me.role)) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        // Set up real-time audio volume monitoring for local user
        this.meterCleanup = monitorAudioLevel(this.localStream.getAudioTracks()[0], level => {
          this.onLevel(this.me.id, level);
        });

        this.onStatus('Microphone active.');
      } catch (err) {
        console.warn('Microphone access denied or unavailable:', err);
        this.onStatus('Microphone unavailable (Listening only).');
      }
    } else {
      this.onStatus('Listening to courtroom proceedings.');
    }
  }

  setMute(mute) {
    this.muted = mute;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  async syncPeers(people) {
    if (!this.active) return;

    const eligible = people.filter(p => p.id !== this.me.id && p.online && canConnectAudio(this.me.role, p.role));
    const eligibleIds = new Set(eligible.map(p => p.id));

    // Remove obsolete peers
    for (const [id, entry] of this.peers.entries()) {
      if (!eligibleIds.has(id)) {
        entry.pc.close();
        if (entry.audioEl) entry.audioEl.remove();
        this.peers.delete(id);
      }
    }

    // Connect to new eligible peers
    for (const person of eligible) {
      if (!this.peers.has(person.id)) {
        await this.createPeer(person);
      }
    }
  }

  async createPeer(person) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audioEl = new Audio();
    audioEl.autoplay = true;

    const entry = { pc, audioEl, person };
    this.peers.set(person.id, entry);

    // Add local tracks if allowed to speak
    if (canSpeak(this.me.role) && this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote tracks
    pc.ontrack = event => {
      audioEl.srcObject = event.streams[0];
      monitorAudioLevel(event.streams[0].getAudioTracks()[0], level => {
        this.onLevel(person.id, level);
      });
    };

    // ICE Candidate gathering
    pc.onicecandidate = event => {
      if (event.candidate) {
        this.sendSignal(person.id, { candidate: event.candidate });
      }
    };

    // Polite peer pattern: initiator is chosen deterministically by UUID comparison
    const isInitiator = this.me.id < person.id;
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.sendSignal(person.id, { description: pc.localDescription });
        } catch (err) {
          console.error('Error creating offer:', err);
        }
      };
    }
  }

  async handleSignal(fromMemberId, signal) {
    const entry = this.peers.get(fromMemberId);
    if (!entry) return;

    const pc = entry.pc;
    try {
      if (signal.description) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
        if (signal.description.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(fromMemberId, { description: pc.localDescription });
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error('Error handling WebRTC signal:', err);
    }
  }

  close() {
    this.active = false;
    if (this.meterCleanup) this.meterCleanup();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    for (const entry of this.peers.values()) {
      entry.pc.close();
      if (entry.audioEl) entry.audioEl.remove();
    }
    this.peers.clear();
  }
}

// Real-time audio energy measurement
export function monitorAudioLevel(track, onMeasure) {
  if (!track) return () => {};
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      onMeasure(Math.min(1, rms * 4));
    }, 120);

    return () => {
      clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
