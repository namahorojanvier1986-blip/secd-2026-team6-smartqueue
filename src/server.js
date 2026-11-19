// SmartQueue - M4 Server
const http = require('http');
const url = require('url');

let tickets = [];
let counter = 100;
let otpCode = "123456";

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (parsed.pathname === '/') {
        res.end(`<h1>🎫 SmartQueue - Welcome</h1><a href="/ticket"><button>Get Ticket</button></a> <a href="/queue"><button>View Queue</button></a> <a href="/staff"><button>Staff Login</button></a> <a href="/manager"><button>Manager Dashboard</button></a>`);
    }
    else if (parsed.pathname === '/ticket') {
        counter++;
        const ticket = { number: 'A-' + counter, status: 'Waiting', time: new Date().toLocaleTimeString() };
        tickets.push(ticket);
        res.end(`<h1>Your Ticket: ${ticket.number}</h1><p>Position: ${tickets.length}</p><a href="/">Back</a>`);
    }
    else if (parsed.pathname === '/queue') {
        let list = tickets.map(t => `<li>${t.number} - ${t.status}</li>`).join('');
        res.end(`<h1>Queue Now</h1><ul>${list || 'No one waiting'}</ul><a href="/">Back</a>`);
    }
    else if (parsed.pathname === '/staff') {
        if (parsed.query.otp === otpCode) {
            res.end(`<h1>✅ Staff Logged In!</h1><p>Next Ticket: ${tickets[0] ? tickets[0].number : 'None'}</p><a href="/">Back</a>`);
        } else {
            res.end(`<h1>Staff Login</h1><p>Demo OTP is: <b>123456</b></p><form><input name="otp" placeholder="Enter OTP"><button>Login</button></form>`);
        }
    }
    else if (parsed.pathname === '/manager') {
        res.end(`<h1>📊 Manager Dashboard</h1><p>Total Tickets Today: ${tickets.length}</p><p>Waiting: ${tickets.length}</p><p>Avg Wait: 5 min</p><a href="/">Back</a>`);
    }
    else res.end('<h1>404 Not Found</h1><a href="/">Home</a>');
});

server.listen(3000, () => console.log('SmartQueue running on http://localhost:3000'));