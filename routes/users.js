const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get My History
router.get('/history', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const sql = `
        SELECT t.id, b.title, b.author, t.issue_date, t.due_date, t.return_date, t.fine, t.status
        FROM transactions t
        JOIN books b ON t.book_id = b.id
        WHERE t.user_id = ?
        ORDER BY t.issue_date DESC
    `;

    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get All Transactions (Admin only)
router.get('/all-transactions', authenticateToken, (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const sql = `
        SELECT t.id, u.username, u.role, b.title, b.author, 
               t.issue_date, t.due_date, t.return_date, t.fine, t.status
        FROM transactions t
        JOIN books b ON t.book_id = b.id
        JOIN users u ON t.user_id = u.id
        ORDER BY t.issue_date DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
