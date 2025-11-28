const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Make io accessible to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const slotRoutes = require('./routes/slots');
const userRoutes = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/users', userRoutes);

// Background Job: Check for expired slots every minute
setInterval(() => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000)).toISOString();

    const db = require('./database');
    db.run(`UPDATE slots SET status = 'free', booking_start_time = NULL, booked_by_user_id = NULL WHERE status = 'booked' AND booking_start_time < ?`, [fourHoursAgo], function (err) {
        if (err) console.error('Auto-expiry check error:', err.message);
        if (this.changes > 0) {
            io.emit('slot_update');
            console.log(`Auto-expired ${this.changes} slots.`);
        }
    });
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
