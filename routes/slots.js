const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get All Slots (and check for expiry)
router.get('/', authenticateToken, (req, res) => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000)).toISOString();

    db.serialize(() => {
        // Auto-expire slots booked more than 4 hours ago
        db.run(`UPDATE slots SET status = 'free', booking_start_time = NULL, booked_by_user_id = NULL WHERE status = 'booked' AND booking_start_time < ?`, [fourHoursAgo], function (err) {
            if (err) console.error('Auto-expiry error:', err.message);
            if (this.changes > 0) {
                // If we expired some slots, we should ideally emit an update, but for now the GET request will return the fresh state
                req.io.emit('slot_update');
            }
        });

        db.all(`SELECT * FROM slots ORDER BY zone, name`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Book Slot (Student/Faculty ONLY) - "Book Now"
router.post('/book', authenticateToken, authorizeRole(['student', 'faculty']), (req, res) => {
    const { slotId } = req.body;
    const userId = req.user.id;
    const now = new Date().toISOString();

    db.serialize(() => {
        // First, check if user already has an active booking
        db.get(`SELECT id FROM slots WHERE booked_by_user_id = ? AND status = 'booked'`, [userId], (err, existingBooking) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existingBooking) return res.status(400).json({ error: 'You already have an active seat booking. Please end your current session first.' });

            // Check availability of the requested slot
            db.get(`SELECT status FROM slots WHERE id = ?`, [slotId], (err, slot) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!slot) return res.status(404).json({ error: 'Slot not found' });
                if (slot.status === 'booked') return res.status(400).json({ error: 'Slot already booked' });

                // Update slot status
                db.run(`UPDATE slots SET status = 'booked', booked_by_user_id = ?, booking_start_time = ? WHERE id = ?`, [userId, now, slotId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Emit real-time update
                    req.io.emit('slot_update', { slotId, status: 'booked', userId });
                    res.json({ message: 'Slot booked successfully' });
                });
            });
        });
    });
});

// End Session (Student/Faculty ONLY)
router.post('/end', authenticateToken, authorizeRole(['student', 'faculty']), (req, res) => {
    const { slotId } = req.body;
    const userId = req.user.id;

    db.run(`UPDATE slots SET status = 'free', booked_by_user_id = NULL, booking_start_time = NULL WHERE id = ? AND booked_by_user_id = ?`, [slotId, userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Slot not booked by you or already free' });

        // Emit real-time update
        req.io.emit('slot_update', { slotId, status: 'free', userId: null });
        res.json({ message: 'Session ended successfully' });
    });
});

// Auto-dismiss Simulation (DevTools)
router.post('/simulate-leave', authenticateToken, (req, res) => {
    const { slotId } = req.body;

    db.run(`UPDATE slots SET status = 'free', booked_by_user_id = NULL, booking_start_time = NULL WHERE id = ?`, [slotId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Emit real-time update
        req.io.emit('slot_update', { slotId, status: 'free', userId: null });
        res.json({ message: 'Slot freed (simulated)' });
    });
});

module.exports = router;
