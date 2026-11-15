import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// In-memory Room Storage
const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateCode() : code;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

const PHASES = [
  'Round 1: Ilzaam (Accusation & Receipts)',
  'Round 2: Jawab (The Defense)',
  'Round 3: Aamne-Saamne (30s Rebuttal)',
  'Round 4: Janata Ka Vote (Jury Deliberation)',
  'Round 5: Hukumnama (The Final Faisla)'
];

const PHASE_DURATIONS_SEC = [60, 60, 60, 45, 90]; // seconds per phase

function createRoomState(data) {
  const code = generateCode();
  const room = {
    code,
    title: data.title || 'Petty dispute',
    story: data.story || 'No details provided.',
    remedy: data.remedy || 'Fair resolution.',
    category: data.category || 'General disputes',
    a: data.a || 'Petitioner',
    b: data.b || 'Defendant',
    isPublic: !!data.isPublic,
    theme: data.theme || 'white',
    evidence: data.evidence || 'No formal exhibits filed yet.',
    createdAt: Date.now(),
    expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
    phase: 0,
    started: false,
    endsAt: 0,
    verdict: null,
    people: [],
    voteCounts: { a: 0, b: 0 },
    activity: [],
    sockets: new Map() // memberId -> WebSocket
  };

  rooms.set(code, room);
  return room;
}

function sanitizeState(room, forMemberId = null) {
  return {
    code: room.code,
    title: room.title,
    story: room.story,
    remedy: room.remedy,
    category: room.category,
    a: room.a,
    b: room.b,
    isPublic: room.isPublic,
    theme: room.theme,
    evidence: room.evidence,
    phase: room.phase,
    phases: PHASES,
    started: room.started,
    endsAt: room.endsAt,
    verdict: room.verdict,
    voteCounts: room.voteCounts,
    activity: room.activity.slice(-10),
    people: room.people.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      avatar: p.avatar || null,
      online: p.online,
      muted: p.muted,
      audioJoined: p.audioJoined,
      handRaised: p.handRaised,
      voted: !!p.voted
    }))
  };
}

function broadcastRoom(room, message, excludeMemberId = null) {
  const data = JSON.stringify(message);
  for (const [memberId, ws] of room.sockets.entries()) {
    if (memberId !== excludeMemberId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastState(room) {
  for (const [memberId, ws] of room.sockets.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'state',
        state: sanitizeState(room, memberId)
      }));
    }
  }
}

function addActivity(room, text, icon = 'CircleDot') {
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  room.activity.push({ text, icon, time });
  if (room.activity.length > 30) room.activity.shift();
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Helper response
  const json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // Parse JSON Body
  let body = {};
  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString();
      if (text) body = JSON.parse(text);
    } catch (e) {
      return json({ error: 'Invalid JSON request' }, 400);
    }
  }

  // API Routes
  if (url.pathname === '/api/public-cases' && req.method === 'GET') {
    const list = [];
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.isPublic && !room.verdict && room.expiresAt > now) {
        list.push({
          code: room.code,
          title: room.title,
          category: room.category,
          createdAt: room.createdAt,
          phase: room.phase,
          started: room.started,
          jurySeats: room.people.filter(p => p.role === 'jury').length,
          openRoles: ['judge', 'petitioner', 'defendant'].filter(r => !room.people.some(p => p.role === r))
        });
      }
    }
    return json({ cases: list });
  }

  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const room = createRoomState(body);
    const memberId = crypto.randomUUID();
    const token = generateToken();
    const creatorRole = body.creatorRole || 'petitioner';

    const member = {
      id: memberId,
      token,
      name: body.creatorName || (creatorRole === 'judge' ? 'Honorable Judge' : room.a),
      role: creatorRole,
      avatar: body.avatar || (creatorRole === 'judge' ? 'order-judge' : 'red-shades'),
      online: false,
      muted: false,
      audioJoined: false,
      handRaised: false
    };

    room.people.push(member);
    addActivity(room, `${member.name} filed the case and opened the courtroom.`, 'FolderOpen');

    return json({
      code: room.code,
      member: { id: member.id, name: member.name, role: member.role, token },
      state: sanitizeState(room, member.id)
    });
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})$/);
  if (roomMatch && req.method === 'GET') {
    const code = roomMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (!room) return json({ error: 'Room not found or expired.' }, 404);
    return json(sanitizeState(room));
  }

  const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/join$/);
  if (joinMatch && req.method === 'POST') {
    const code = joinMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (!room) return json({ error: 'Room not found or expired.' }, 404);

    let requestedRole = body.role || 'jury';
    const name = (body.name || 'Anonymous').trim().slice(0, 28);

    // Validate role capacity
    if (['judge', 'petitioner', 'defendant'].includes(requestedRole)) {
      const existing = room.people.find(p => p.role === requestedRole);
      if (existing && existing.online) {
        return json({ error: `The ${requestedRole} seat is already occupied.` }, 400);
      }
    } else if (requestedRole === 'jury') {
      const juryCount = room.people.filter(p => p.role === 'jury' && p.online).length;
      if (juryCount >= 5) requestedRole = 'audience';
    }

    const memberId = crypto.randomUUID();
    const token = generateToken();
    const member = {
      id: memberId,
      token,
      name,
      role: requestedRole,
      avatar: body.avatar || (requestedRole === 'judge' ? 'order-judge' : requestedRole === 'defendant' ? 'objection-lawyer' : 'chai-witness'),
      online: false,
      muted: false,
      audioJoined: false,
      handRaised: false
    };

    room.people.push(member);
    addActivity(room, `${member.name} joined as ${member.role}.`, 'LogIn');
    broadcastState(room);

    return json({
      code: room.code,
      member: { id: member.id, name: member.name, role: member.role, token },
      state: sanitizeState(room, member.id)
    });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404);
        return res.end('Not Found');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/socket$/);

  if (!match) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  const code = match[1].toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    socket.write('HTTP/1.1 404 Room Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  // Token authentication via Sec-WebSocket-Protocol or URL search params
  const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim());
  let token = url.searchParams.get('token');
  if (!token && protocols.length >= 2 && protocols[0] === 'kalesh-room') {
    token = protocols[1];
  }

  const member = room.people.find(p => p.token === token);
  if (!member) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req, room, member);
  });
});

wss.on('connection', (ws, req, room, member) => {
  member.online = true;
  room.sockets.set(member.id, ws);

  addActivity(room, `${member.name} connected to the courtroom.`, 'Users');
  broadcastState(room);

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());

      // 1. WebRTC Signaling pass-through
      if (msg.type === 'signal' && msg.to) {
        const targetWs = room.sockets.get(msg.to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({
            type: 'signal',
            from: member.id,
            signal: msg.signal
          }));
        }
        return;
      }

      // 2. Courtroom Actions
      if (msg.type === 'action') {
        const action = msg.action;

        if (action === 'start-hearing') {
          if (member.role === 'judge' || room.people[0]?.id === member.id) {
            room.started = true;
            room.phase = 0;
            room.endsAt = Date.now() + PHASE_DURATIONS_SEC[0] * 1000;
            addActivity(room, `The court is now in session! Round 1: ${PHASES[0]}`, 'Gavel');
            broadcastRoom(room, { type: 'sound', sound: 'gavel' });
            broadcastState(room);
          }
        } else if (action === 'next-phase') {
          if (member.role === 'judge' || room.people[0]?.id === member.id) {
            if (room.phase < PHASES.length - 1) {
              room.phase++;
              room.endsAt = Date.now() + PHASE_DURATIONS_SEC[room.phase] * 1000;
              addActivity(room, `Phase ${room.phase + 1}: ${PHASES[room.phase]} begins.`, 'Gavel');
              broadcastRoom(room, { type: 'sound', sound: 'bell' });
              broadcastState(room);
            }
          }
        } else if (action === 'objection') {
          if (['judge', 'petitioner', 'defendant'].includes(member.role)) {
            addActivity(room, `${member.name} raised an OBJECTION!`, 'AlertCircle');
            broadcastRoom(room, {
              type: 'objection',
              name: member.name,
              role: member.role
            });
            broadcastRoom(room, { type: 'sound', sound: 'objection' });
          }
        } else if (action === 'raise-hand') {
          member.handRaised = !member.handRaised;
          addActivity(room, `${member.name} ${member.handRaised ? 'raised' : 'lowered'} their hand.`, 'Hand');
          broadcastState(room);
        } else if (action === 'vote') {
          if (room.phase === 3 && (member.role === 'jury' || member.role === 'audience') && !member.voted) {
            const choice = msg.choice; // 'a' or 'b'
            if (choice === 'a' || choice === 'b') {
              member.voted = choice;
              room.voteCounts[choice] = (room.voteCounts[choice] || 0) + 1;
              addActivity(room, `A juror cast a vote.`, 'Vote');
              broadcastRoom(room, { type: 'sound', sound: 'vote' });
              broadcastState(room);
            }
          }
        } else if (action === 'verdict') {
          if (member.role === 'judge' || room.people[0]?.id === member.id) {
            room.verdict = {
              winner: msg.winner, // 'a', 'b', or 'draw'
              winnerName: msg.winner === 'a' ? room.a : msg.winner === 'b' ? room.b : 'Draw (Compromise)',
              remedy: msg.remedy || room.remedy,
              deliveredAt: Date.now()
            };
            addActivity(room, `The Honourable Judge delivered the final FAISLA!`, 'Crown');
            broadcastRoom(room, { type: 'sound', sound: 'gavel' });
            broadcastState(room);
          }
        } else if (action === 'audio-join') {
          member.audioJoined = !!msg.joined;
          broadcastState(room);
        } else if (action === 'set-avatar') {
          member.avatar = msg.avatar;
          addActivity(room, `${member.name} chose avatar: ${msg.avatar}.`, 'Sparkles');
          broadcastState(room);
        } else if (action === 'set-evidence') {
          room.evidence = msg.evidence;
          addActivity(room, `${member.name} submitted new Exhibit Evidence.`, 'FolderOpen');
          broadcastState(room);
        } else if (action === 'set-theme') {
          room.theme = msg.theme;
          addActivity(room, `Courtroom theme changed to ${msg.theme}.`, 'Sparkles');
          broadcastState(room);
        } else if (action === 'sync-mute') {
          member.muted = !!msg.muted;
          broadcastState(room);
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    member.online = false;
    room.sockets.delete(member.id);
    addActivity(room, `${member.name} disconnected.`, 'LogOut');
    broadcastState(room);
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`⚖️  Kalesh Room Server Running at: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
