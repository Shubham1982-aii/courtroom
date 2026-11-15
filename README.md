# ⚖️ Kalesh Room — Rebuilt Self-Hosted Edition

A complete, self-hosted mock courtroom & voice deliberation web platform inspired by [kaleshroom.online](https://kaleshroom.online/).

Turn petty roommate fights, friend group disputes, and food crimes into hilarious, structured 5-round courtroom dramas with live voice, real-time jury voting, procedural sound effects, and final verdicts (*faislas*).

---

## 🚀 Features

* **Real-time Voice WebRTC Mesh:**
  * Free public STUN (`stun:stun.cloudflare.com:3478`).
  * Selective audio matrix: Petitioner, Defendant, and Judge speak; Jury and Audience listen.
  * Web Audio API RMS speech detection: glowing animated avatar rings when speaking.
* **Full Courtroom State Engine:**
  * **Round 1:** *Opening statements* (Accuser presents the case).
  * **Round 2:** *The defence* (Accused responds).
  * **Round 3:** *Rebuttal* (Rapid-fire 30s exchanges).
  * **Round 4:** *Jury vote* (Interactive voting ballot for jury/spectators).
  * **Round 5:** *The faisla* (Judge evaluates the vote and delivers the verdict card).
* **Interactive Gavel & Sound Synthesizer:**
  * Uses procedural Web Audio API synthesis for double-gavel strikes, dramatic objection brass chords, round bell chimes, and voting clicks. Zero external `.mp3` dependencies!
* **Dramatic "OBJECTION!" Action:**
  * Red screen shake animation, stinger sound effect, and room-wide alert.
* **Zero Bloat / Pure ES Modules:**
  * No heavy frameworks. Pure HTML5 + CSS3 + Vanilla JavaScript.

---

## 🛠️ Quick Start

```powershell
# Navigate to the project directory
cd E:\kalesh-room

# Install dependencies (only lightweight `ws` for WebSockets)
npm install

# Start the server
node server.js
```

Open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 👥 Testing with Multiple People or Browser Tabs

1. **Tab 1 (Petitioner / Creator):**
   * Open `http://localhost:3000`.
   * Click **"+ File a Kalesh"** or pick a practice case (e.g. *"Mere fries kisne khaye?"*).
   * Enter your name and click **"Open Courtroom"**.
   * Note the 6-character room code (e.g. `ABC123`).

2. **Tab 2 (Defendant):**
   * Open an Incognito/Private window or another browser tab to `http://localhost:3000`.
   * Click **"Join Courtroom"**.
   * Enter the room code, your name, and choose the **Defendant** role.

3. **Tab 3 (Judge / Jury):**
   * Open another tab and join as the **Judge** or **Jury**.
   * The Judge has controls to **"Start Court"**, **"Next Round"**, and **"Deliver Faisla"**.
