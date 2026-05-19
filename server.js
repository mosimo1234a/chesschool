/*
 * ♟️ 우리반 공식 체스 플랫폼 (Class Chess - Neo Edition)
 * 프론트엔드와 백엔드가 모두 하나로 합쳐진 통합 싱글 파일 패키지입니다.
 * 이 파일 하나만 GitHub에 올리고 Render에 배포하면 전교생/우리반 친구들이 바로 접속해 사용할 수 있습니다.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const JWT_SECRET = "DEEBOT_CHESS_SECRET_KEY_2026";

// 메모리 기반 데이터베이스 (서버 재시작 전까지 유지)
let usersDB = [
    { username: "운영자", password: "123", rating: 1500 },
    { username: "김대원", password: "123", rating: 1400 }
];
let activeRooms = {}; 

// Elo 레이팅 계산 알고리즘
function calculateElo(winnerRating, loserRating) {
    const K = 32; 
    const ExpectedW = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const newWinner = Math.round(winnerRating + K * (1 - ExpectedW));
    const newLoser = Math.round(loserRating + K * (0 - (1 - ExpectedW)));
    return { newWinner, newLoser };
}

function broadcastLeaderboard() {
    const sortedList = [...usersDB]
        .map(u => ({ username: u.username, rating: u.rating }))
        .sort((a, b) => b.rating - a.rating);
    io.emit('leaderboard', sortedList);
}

// --- API 라우트 ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (usersDB.find(u => u.username === username)) {
        return res.status(400).json({ message: "이미 존재하는 학번 이름입니다." });
    }
    const newUser = { username, password, rating: 1000 }; 
    usersDB.push(newUser);
    
    const token = jwt.sign({ username }, JWT_SECRET);
    res.json({ token, username, rating: newUser.rating });
    broadcastLeaderboard();
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ message: "닉네임 또는 비밀번호가 틀렸습니다." });
    
    const token = jwt.sign({ username }, JWT_SECRET);
    res.json({ token, username, rating: user.rating });
});

app.post('/api/admin/adjust', (req, res) => {
    const token = req.headers.authorization;
    if(!token) return res.status(401).json({ message: "권한이 없습니다." });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if(decoded.username !== "운영자" && !decoded.username.includes("김대원")) {
            return res.status(403).json({ message: "운영자 전용 기능입니다." });
        }

        const { targetUsername, newRating } = req.body;
        const student = usersDB.find(u => u.username === targetUsername);
        if(!student) return res.status(404).json({ message: "해당 학생을 찾을 수 없습니다." });

        student.rating = newRating; 
        res.json({ success: true });
        broadcastLeaderboard(); 
    } catch(err) {
        res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
});

// --- 루트 페이지 접속 시 프론트엔드 HTML 동적 제공 ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>우리반 공식 체스 플랫폼 (Neo Edition)</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f2f4f6; }
        .toss-card { background: #ffffff; border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.02); }
        .toss-btn { border-radius: 14px; transition: all 0.2s ease; cursor: pointer; }
        .toss-btn:active { transform: scale(0.97); }
        
        .piece { width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat; background-position: center; cursor: grab; }
        .piece:active { cursor: grabbing; }
        .p-wP { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png'); }
        .p-wR { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png'); }
        .p-wN { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png'); }
        .p-wB { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png'); }
        .p-wQ { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png'); }
        .p-wK { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png'); }
        .p-bP { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png'); }
        .p-bR { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png'); }
        .p-bN { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png'); }
        .p-bB { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png'); }
        .p-bQ { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png'); }
        .p-bK { background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png'); }
    </style>
</head>
<body class="text-gray-900 min-h-screen flex flex-col items-center justify-start p-4">

    <header class="w-full max-w-5xl flex justify-between items-center py-4 px-6 toss-card mb-6">
        <h1 class="text-xl font-bold text-blue-600 tracking-tight">♟️ Class Chess</h1>
        <div id="user-profile" class="hidden flex items-center gap-4">
            <span id="profile-info" class="font-medium text-gray-700"></span>
            <button onclick="logout()" class="toss-btn bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 text-sm font-semibold">로그아웃</button>
        </div>
    </header>

    <main class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section class="lg:col-span-1 flex flex-col gap-6">
            <div id="auth-panel" class="toss-card p-6">
                <h2 class="text-lg font-bold mb-4">반 학생 인증</h2>
                <div class="space-y-3">
                    <input type="text" id="username" placeholder="학번 이름 (예: 60101김대원)" class="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500">
                    <input type="password" id="password" placeholder="비밀번호" class="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500">
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="handleAuth('login')" class="toss-btn bg-blue-500 hover:bg-blue-600 text-white p-3 font-semibold">로그인</button>
                        <button onclick="handleAuth('register')" class="toss-btn bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 font-semibold">회원가입</button>
                    </div>
                </div>
            </div>

            <div id="lobby-panel" class="toss-card p-6 hidden">
                <h2 class="text-lg font-bold mb-4">대국 제어실</h2>
                <div class="space-y-3">
                    <button onclick="createRoom()" class="toss-btn w-full bg-blue-500 hover:bg-blue-600 text-white p-3 font-semibold">새로운 대국 방 만들기</button>
                    <div class="flex gap-2">
                        <input type="text" id="room-input" placeholder="방 코드 입력" class="w-full p-3 border border-gray-200 rounded-xl focus:outline-none">
                        <button onclick="joinRoom()" class="toss-btn bg-gray-800 hover:bg-gray-900 text-white px-5 font-semibold">입장</button>
                    </div>
                </div>
            </div>

            <div class="toss-card p-6 overflow-hidden">
                <h2 class="text-lg font-bold mb-3 flex justify-between items-center">
                    <span>🏆 실시간 반 랭킹</span>
                    <span class="text-xs text-gray-400 font-normal">Elo Rating</span>
                </h2>
                <div class="overflow-y-auto max-h-[300px]">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="text-xs text-gray-400 border-b border-gray-100">
                                <th class="pb-2">순위</th>
                                <th class="pb-2">이름</th>
                                <th class="pb-2 text-right">레이팅</th>
                            </tr>
                        </thead>
                        <tbody id="leaderboard-rows" class="text-sm"></tbody>
                    </table>
                </div>
            </div>

            <div id="admin-panel" class="toss-card p-6 border-2 border-blue-100 bg-blue-50/30 hidden">
                <h2 class="text-md font-bold text-blue-700 mb-3">🛠️ 운영자 전용 제어판</h2>
                <div class="space-y-2">
                    <input type="text" id="admin-target" placeholder="수정할 학생 이름" class="w-full p-2 text-sm border border-gray-200 rounded-xl bg-white">
                    <input type="number" id="admin-score" placeholder="설정할 레이팅 점수" class="w-full p-2 text-sm border border-gray-200 rounded-xl bg-white">
                    <button onclick="submitAdminAdjust()" class="toss-btn w-full bg-blue-600 text-white p-2 text-sm font-semibold">점수 즉시 반영</button>
                </div>
            </div>
        </section>

        <section class="lg:col-span-2 flex flex-col items-center">
            <div class="toss-card p-6 w-full flex flex-col items-center justify-center">
                <div id="game-status" class="mb-4 text-center text-sm font-semibold text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
                    로그인 후 대국을 시작해 주세요.
                </div>
                <div id="board" class="grid grid-cols-8 grid-rows-8 w-full max-w-[500px] aspect-square border-4 border-gray-800 rounded-xl overflow-hidden shadow-inner bg-amber-50"></div>
            </div>
        </section>
    </main>

    <script>
        const socket = io(); // 같은 도메인이므로 자동으로 서버 주소 연결됨
        let chess = new Chess();
        let myToken = null;
        let myUsername = null;
        let currentRoom = null;
        let myColor = null; 
        let selectedSquare = null;

        window.onload = function() {
            buildBoard();
            initSocket();
        };

        function initSocket() {
            socket.on('leaderboard', (data) => { renderLeaderboard(data); });

            socket.on('room-joined', ({ roomId, color, fen }) => {
                currentRoom = roomId;
                myColor = color;
                chess.load(fen);
                document.getElementById('game-status').innerText = \`대국방 [ \${roomId} ] 입장 완료 - 당신은 [ \${color === 'w' ? '백진영' : '흑진영'} ] 입니다.\`;
                updateBoardUI();
            });

            socket.on('move-broadcast', (fen) => {
                chess.load(fen);
                updateBoardUI();
                checkGameEnd();
            });

            socket.on('game-over', ({ winner }) => {
                alert(\`게임 종료! 승자: \${winner}\`);
                document.getElementById('game-status').innerText = \`게임 종료! 승자: \${winner}\`;
            });

            socket.on('error-msg', (msg) => { alert(msg); });
        }

        async function handleAuth(type) {
            const usernameInput = document.getElementById('username').value.trim();
            const passwordInput = document.getElementById('password').value;

            if(!usernameInput || !passwordInput) return alert("학번 이름과 비밀번호를 입력해 주세요.");

            try {
                const res = await fetch(\`/api/auth/\${type}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput, password: passwordInput })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);

                myToken = data.token;
                myUsername = data.username;
                
                document.getElementById('auth-panel').classList.add('hidden');
                document.getElementById('lobby-panel').classList.remove('hidden');
                document.getElementById('user-profile').classList.remove('hidden');
                document.getElementById('profile-info').innerText = \`\${myUsername} (\${data.rating}점)\`;
                document.getElementById('game-status').innerText = "대기실 입장 완료. 방을 만들거나 코드를 입력하세요.";

                if(myUsername === "운영자" || myUsername.includes("김대원")) {
                    document.getElementById('admin-panel').classList.remove('hidden');
                }
            } catch (err) { alert(err.message); }
        }

        function logout() { location.reload(); }
        function createRoom() { if(!myToken) return; const roomId = Math.random().toString(36).substring(2, 7).toUpperCase(); socket.emit('create-room', { roomId, token: myToken }); }
        function joinRoom() { const roomId = document.getElementById('room-input').value.trim().toUpperCase(); if(!roomId) return alert("방 코드를 입력하세요."); socket.emit('join-room', { roomId, token: myToken }); }

        async function submitAdminAdjust() {
            const target = document.getElementById('admin-target').value.trim();
            const score = parseInt(document.getElementById('admin-score').value);
            if(!target || isNaN(score)) return alert(" 대상을 바르게 입력하세요.");

            try {
                const res = await fetch('/api/admin/adjust', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': myToken },
                    body: JSON.stringify({ targetUsername: target, newRating: score })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                alert("레이팅이 수정되었습니다.");
            } catch(err) { alert(err.message); }
        }

        function buildBoard() {
            const boardEl = document.getElementById('board');
            boardEl.innerHTML = '';
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const squareEl = document.createElement('div');
                    squareEl.classList.add('w-full', 'h-full', 'flex', 'items-center', 'justify-center', 'relative');
                    const isLight = (r + c) % 2 === 0;
                    squareEl.style.backgroundColor = isLight ? '#eeeed2' : '#769656';
                    
                    const squareName = String.fromCharCode(97 + c) + (8 - r);
                    squareEl.dataset.square = squareName;
                    squareEl.onclick = () => handleSquareClick(squareName);
                    boardEl.appendChild(squareEl);
                }
            }
        }

        function updateBoardUI() {
            const squares = document.querySelectorAll('[data-square]');
            squares.forEach(sq => {
                const sqName = sq.dataset.square;
                sq.innerHTML = ''; 
                sq.style.boxShadow = 'none';
                if(selectedSquare === sqName) sq.style.boxShadow = 'inset 0 0 0 4px #3b82f6';

                const piece = chess.get(sqName);
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.classList.add('piece', \`p-\${piece.color}\${piece.type.toUpperCase()}\`);
                    sq.appendChild(pieceEl);
                }
            });
        }

        function handleSquareClick(square) {
            if (!currentRoom || myColor !== chess.turn()) return;

            if (selectedSquare === null) {
                const piece = chess.get(square);
                if (piece && piece.color === myColor) {
                    selectedSquare = square;
                    updateBoardUI();
                }
            } else {
                const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
                if (move) {
                    updateBoardUI();
                    socket.emit('make-move', { roomId: currentRoom, fen: chess.fen(), token: myToken });
                    checkGameEnd();
                }
                selectedSquare = null;
                updateBoardUI();
            }
        }

        function checkGameEnd() {
            if (chess.game_over()) {
                let winner = '무승부';
                if (chess.in_checkmate()) winner = chess.turn() === 'w' ? '흑진영' : '백진영';
                socket.emit('game-over-signal', { roomId: currentRoom, winner, token: myToken });
            }
        }

        function renderLeaderboard(list) {
            const tbody = document.getElementById('leaderboard-rows');
            tbody.innerHTML = '';
            list.forEach((user, index) => {
                const tr = document.createElement('tr');
                tr.classList.add('border-b', 'border-gray-50', 'hover:bg-gray-50/50');
                tr.innerHTML = \`
                    <td class="py-3 font-semibold text-gray-400">\${index + 1}</td>
                    <td class="py-3 font-medium">\${user.username}</td>
                    <td class="py-3 text-right font-bold text-blue-600">\${user.rating}</td>
                \`;
                tbody.appendChild(tr);
            });
        }
    </script>
</body>
</html>
    `);
});

// --- 웹소켓 로직 ---
io.on('connection', (socket) => {
    broadcastLeaderboard();

    socket.on('create-room', ({ roomId, token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            activeRooms[roomId] = {
                white: decoded.username,
                black: null,
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            };
            socket.join(roomId);
            socket.emit('room-joined', { roomId, color: 'w', fen: activeRooms[roomId].fen });
        } catch(e) {}
    });

    socket.on('join-room', ({ roomId, token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const room = activeRooms[roomId];
            if (!room) return socket.emit('error-msg', '존재하지 않는 방입니다.');
            if (room.black) return socket.emit('error-msg', '이미 풀방입니다.');

            room.black = decoded.username;
            socket.join(roomId);
            socket.emit('room-joined', { roomId, color: 'b', fen: room.fen });
            io.to(roomId).emit('move-broadcast', room.fen);
        } catch(e) {}
    });

    socket.on('make-move', ({ roomId, fen }) => {
        const room = activeRooms[roomId];
        if (room) {
            room.fen = fen;
            socket.to(roomId).emit('move-broadcast', fen);
        }
    });

    socket.on('game-over-signal', ({ roomId, winner }) => {
        const room = activeRooms[roomId];
        if (!room) return;

        let whiteUser = usersDB.find(u => u.username === room.white);
        let blackUser = usersDB.find(u => u.username === room.black);

        if(whiteUser && blackUser) {
            if(winner.includes('백진영') || winner.includes('White')) {
                const { newWinner, newLoser } = calculateElo(whiteUser.rating, blackUser.rating);
                whiteUser.rating = newWinner; blackUser.rating = newLoser;
            } else if(winner.includes('흑진영') || winner.includes('Black')) {
                const { newWinner, newLoser } = calculateElo(blackUser.rating, whiteUser.rating);
                blackUser.rating = newWinner; whiteUser.rating = newLoser;
            }
            io.to(roomId).emit('game-over', { winner });
            broadcastLeaderboard();
        }
        delete activeRooms[roomId]; 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
