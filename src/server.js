// SmartQueue - M4 Server - Good File - MANAGER UPGRADED
const http = require('http');
const url = require('url');

let tickets = [];
let counter = 100;
let priorityCounter = 100;
let servedCount = 0;
let otpCode = "123456";

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (parsed.pathname === '/') {
        let nowServing = tickets.find(t => t.status === 'Serving') || { number: 'A-041' };
        res.end(`
    <div style="max-width:400px;margin:auto;font-family:sans-serif;border:2px solid #000;border-radius:20px;overflow:hidden">
    <div style="background:#0b4fd8;color:white;padding:10px;display:flex;justify-content:space-between"><b>☰ Smart<span style="color:yellow">Queue</span></b><span>🏠</span></div>
    <div style="background:#eef2ff;padding:10px;text-align:center"><b>CHOOSE LANGUAGE</b><br><br><button style="background:#0b4fd8;color:white;border-radius:20px;padding:5px 12px">ENG</button> <button style="border-radius:20px;padding:5px 12px">KINY</button> <button style="border-radius:20px;padding:5px 12px">FR</button> <button style="border-radius:20px;padding:5px 12px">SWAH</button></div>
    <div style="background:#ddd;margin:10px;border-radius:15px;padding:15px;text-align:center"><div style="color:#0b4fd8">Now Serving</div><h1 style="margin:5px;color:#0b4fd8">${nowServing.number}</h1><small>~ 16 minutes</small><div style="background:#fff3b0;border-radius:10px;padding:5px;margin-top:8px">• LIVE - 👥 5 ahead of you</div></div>
    <div style="display:flex;gap:8px;padding:0 10px"><a href="/ticket" style="flex:1"><button style="width:100%;background:#0b4fd8;color:white;border-radius:20px;padding:10px;border:none">🎫 Get my ticket</button></a><a href="/queue" style="flex:1"><button style="width:100%;background:#0aa06a;color:white;border-radius:20px;padding:10px;border:none">👀 Check status</button></a></div>
    <div style="padding:10px"><button style="width:100%;background:#ffd400;border-radius:20px;padding:10px;border:none;font-weight:bold">🎤 HEAR VOICE</button></div>
    <div style="padding:0 10px;display:flex;gap:5px"><input placeholder="🔍 Search Service..." style="flex:1;padding:8px;border-radius:20px;border:1px solid #0b4fd8"><button style="background:#0b4fd8;color:white;border-radius:50%;width:32px;height:32px;border:none">X</button></div>
    <div style="background:#fff7cc;border:1px solid orange;border-radius:12px;margin:10px;padding:10px;text-align:center"><b>⭐ ARE YOU PRIORITY? - CHOOSE ⭐</b><br><br><div style="display:flex;justify-content:space-around"><a href="/priority?type=Umusaza">👴<br><small>Umusaza<br>65+</small></a><a href="/priority?type=Pregnant">🤰<br><small>Pregnant</small></a><a href="/priority?type=Ubumuga">♿<br><small>Ubumuga</small></a><a href="/priority?type=VIP">👑<br><small>VIP</small></a><a href="/ticket">👤<br><small>Normal</small></a></div><div style="color:#b47b00;margin-top:8px">⚡ You get Priority - You will not wait long!</div></div>
    <div style="text-align:center;padding:5px">→ Select a service - Kanda Search urebe Services</div>
    <div style="display:flex;justify-content:space-around;text-align:center;padding:10px"><div>1️⃣<br><small>CHOOSE</small></div><div><b>➡️</b><br><b style="color:#0b4fd8">GET<br>TICKET</b></div><div>🚶<br><small>WAIT</small></div><div>🔔<br><small>CALLED</small></div></div>
    <div style="border:1px solid #ddd;border-radius:15px;margin:10px;padding:15px;text-align:center"><div>👤🎫</div><b>I'M CUSTOMER</b><br><small>Press here | WEB APP | USSD *348*123#</small></div>
    <div style="border:1px solid #ddd;border-radius:15px;margin:10px;padding:15px;text-align:center"><div>👤🔐</div><b>I'M STAFF</b><br><small><a href="/staff">TELLER / MANAGER / IT - Login + 🔐 OTP</a></small></div>
    </div>
    `);
    }
    else if (parsed.pathname === '/ticket') {
        counter++;
        const ticket = { number: 'A-' + counter, status: 'Waiting', time: new Date().toLocaleTimeString() };
        tickets.push(ticket);
        res.end(`<h1>Your Ticket: ${ticket.number}</h1><p>Position: ${tickets.length}</p><a href="/">Back</a>`);
    }
    else if (parsed.pathname === '/priority') {
        priorityCounter++;
        let pTicket = { number: 'P-' + priorityCounter, status: 'Waiting', type: 'Priority', reason: parsed.query.type || 'Priority' };
        tickets.unshift(pTicket);
        res.end(`<h1>⭐ Your Priority Ticket: ${pTicket.number}</h1><p>Reason: ${pTicket.reason}</p><p>Position: 1 - You will not wait long!</p><a href="/">Back</a>`);
    }
    else if (parsed.pathname === '/queue') {
        let list = tickets.map(t => `<li>${t.number} - ${t.status} ${t.reason ? '(' + t.reason + ')' : ''}</li>`).join('');
        res.end(`<h1>Queue Now</h1><ul>${list || 'No one waiting'}</ul><a href="/">Back</a>`);
    }
    else if (parsed.pathname === '/staff') {
        if (parsed.query.otp === otpCode) {
            res.end(`<h1>✅ Staff Logged In!</h1><p>Next Ticket: ${tickets[0] ? tickets[0].number : 'None'}</p><a href="/manager" style="background:blue;color:white;padding:10px;display:block;text-align:center;border-radius:10px;margin-top:10px;text-decoration:none;">📊 MANAGER DASHBOARD</a><br><a href="/">Back</a>`);
        } else {
            res.end(`<h1>Staff Login</h1><p>TELLER / MANAGER / IT</p><p>Demo OTP is: <b>123456</b></p><form><input name="otp" placeholder="Enter OTP"><button>Login</button></form>`);
        }
    }
    else if (parsed.pathname === '/next') {
        // Finish current serving
        let serving = tickets.find(t => t.status === 'Serving');
        if (serving) { serving.status = 'Served'; servedCount++; }
        // Call next waiting
        let next = tickets.find(t => t.status === 'Waiting');
        if (next) next.status = 'Serving';
        res.writeHead(302, { Location: '/manager' }); res.end();
    }
    else if (parsed.pathname === '/done') {
        let serving = tickets.find(t => t.status === 'Serving');
        if (serving) { serving.status = 'Served'; servedCount++; }
        res.writeHead(302, { Location: '/manager' }); res.end();
    }
    else if (parsed.pathname === '/reset') {
        tickets = []; servedCount = 0; counter = 100; priorityCounter = 100;
        res.writeHead(302, { Location: '/manager' }); res.end();
    }
    else if (parsed.pathname === '/manager') {
        let priorityCount = tickets.filter(t => t.number.startsWith('P-') && t.status !== 'Served').length;
        let normalCount = tickets.filter(t => t.number.startsWith('A-') && t.status !== 'Served').length;
        let waiting = tickets.filter(t => t.status === 'Waiting').length;
        let serving = tickets.find(t => t.status === 'Serving');
        let totalToday = tickets.length;
        let progress = totalToday > 0 ? Math.round((servedCount / totalToday) * 100) : 0;
        let list = tickets.map(t => {
            let color = t.status === 'Serving' ? '#0b4fd8' : t.status === 'Served' ? '#0aa06a' : t.number.startsWith('P-') ? '#e11d48' : '#333';
            let badge = t.status === 'Serving' ? '🔵 SERVING' : t.status === 'Served' ? '✅ SERVED' : '⏳ WAITING';
            return `<tr><td style="padding:10px;font-weight:bold;color:${color}">${t.number}</td><td>${t.reason || 'Normal'}</td><td>${t.time || '-'}</td><td><b>${badge}</b></td></tr>`;
        }).join('');

        res.end(`
        <div style="max-width:800px;margin:auto;font-family:sans-serif;padding:15px">
        <div style="background:#0b4fd8;color:white;padding:15px;border-radius:15px;display:flex;justify-content:space-between;align-items:center">
          <div><h1 style="margin:0">📊 Manager Dashboard</h1><small>SmartQueue - Live Monitoring | ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</small></div>
          <a href="/manager" style="background:white;color:#0b4fd8;padding:8px 15px;border-radius:20px;text-decoration:none;font-weight:bold">🔄 Refresh</a>
        </div>

        <div style="background:#fff3b0;border:2px solid #ffd400;border-radius:15px;padding:15px;text-align:center;margin:15px 0">
          <div style="font-size:14px;color:#666">NOW SERVING</div>
          <div style="font-size:48px;font-weight:bold;color:#0b4fd8;margin:5px">${serving ? serving.number : '---'}</div>
          <div>${serving ? 'Reason: ' + (serving.reason || 'Normal') : 'No one is being served'}</div>
          <div style="margin-top:10px">
            <a href="/next" style="background:#0b4fd8;color:white;padding:10px 20px;border-radius:20px;text-decoration:none;font-weight:bold">⏭️ CALL NEXT</a>
            <a href="/done" style="background:#0aa06a;color:white;padding:10px 20px;border-radius:20px;text-decoration:none;font-weight:bold;margin-left:10px">✅ FINISH SERVING</a>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px;background:#0b4fd8;color:white;padding:15px;border-radius:15px;text-align:center"><div>🎫 TOTAL TODAY</div><h1 style="margin:5px;font-size:36px">${totalToday}</h1><small>All tickets</small></div>
          <div style="flex:1;min-width:140px;background:#e11d48;color:white;padding:15px;border-radius:15px;text-align:center"><div>🔴 PRIORITY</div><h1 style="margin:5px;font-size:36px">${priorityCount}</h1><small>Umusaza / Ubumuga</small></div>
          <div style="flex:1;min-width:140px;background:#0aa06a;color:white;padding:15px;border-radius:15px;text-align:center"><div>🔵 NORMAL</div><h1 style="margin:5px;font-size:36px">${normalCount}</h1><small>Regular customers</small></div>
          <div style="flex:1;min-width:140px;background:#f59e0b;color:white;padding:15px;border-radius:15px;text-align:center"><div>⏳ WAITING</div><h1 style="margin:5px;font-size:36px">${waiting}</h1><small>In queue now</small></div>
          <div style="flex:1;min-width:140px;background:#7c3aed;color:white;padding:15px;border-radius:15px;text-align:center"><div>✅ SERVED</div><h1 style="margin:5px;font-size:36px">${servedCount}</h1><small>Finished</small></div>
        </div>

        <div style="background:#eef2ff;padding:15px;border-radius:15px;margin-top:15px">
          <b>📈 Performance Today: ${progress}% Done</b>
          <div style="background:#ddd;height:20px;border-radius:20px;overflow:hidden;margin-top:8px"><div style="width:${progress}%;background:#0aa06a;height:100%;text-align:center;color:white;font-size:12px;line-height:20px">${progress}%</div></div>
          <p style="margin:8px 0 0">⏱️ Avg Wait: 5 min &nbsp;|&nbsp; 👥 People in Queue: ${waiting + (serving ? 1 : 0)} &nbsp;|&nbsp; ⚡ Priority Rate: ${totalToday > 0 ? Math.round((tickets.filter(t => t.number.startsWith('P-')).length / totalToday) * 100) : 0}%</p>
        </div>

        <h3>📋 Full Queue List - Live</h3>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px #ddd">
          <tr style="background:#0b4fd8;color:white"><th style="padding:10px;text-align:left">Ticket</th><th style="text-align:left">Type</th><th style="text-align:left">Time</th><th style="text-align:left">Status</th></tr>
          ${list || '<tr><td colspan="4" style="padding:20px;text-align:center">No one waiting - Queue is empty 🎉</td></tr>'}
        </table>

        <div style="display:flex;gap:10px;margin-top:20px">
          <a href="/" style="flex:1;background:#eee;padding:12px;text-align:center;border-radius:10px;text-decoration:none;color:#333;font-weight:bold">🏠 Home</a>
          <a href="/staff?otp=123456" style="flex:1;background:#eee;padding:12px;text-align:center;border-radius:10px;text-decoration:none;color:#333;font-weight:bold">👤 Staff</a>
          <a href="/reset" onclick="return confirm('Reset all tickets?')" style="flex:1;background:#fee2e2;padding:12px;text-align:center;border-radius:10px;text-decoration:none;color:#e11d48;font-weight:bold">🗑️ Reset Day</a>
        </div>
        <p style="text-align:center;color:#888;font-size:12px;margin-top:15px">SmartQueue M4 - Manager can see everything live. Refresh to update.</p>
        </div>
        <script>setTimeout(()=>location.reload(), 10000);</script>
        `);
    }
    else res.end('<h1>404 Not Found</h1><a href="/">Home</a>');
});

server.listen(3000, () => console.log('Smart Queue running on http://localhost:3000'));