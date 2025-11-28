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

// Get All Users (Admin only)
router.get('/all', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const sql = `SELECT id, username, role, created_at FROM users ORDER BY created_at DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add New User (Admin only)
router.post('/add', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    if (!['student', 'faculty', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be student, faculty, or admin' });
    }

    // Check if username already exists
    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        // Hash password
        const bcrypt = require('bcrypt');
        const passwordHash = bcrypt.hashSync(password, 10);

        // Insert new user
        db.run(
            `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
            [username, passwordHash, role],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    message: 'User created successfully',
                    userId: this.lastID,
                    username,
                    role
                });
            }
        );
    });
});

// Delete User (Admin only)
router.delete('/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Check if user has active borrows
    db.get(
        `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status = 'borrowed'`,
        [userId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.count > 0) {
                return res.status(400).json({
                    error: 'Cannot delete user with active book borrowings. Ask them to return books first.'
                });
            }

            // Delete user
            db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({ message: 'User deleted successfully' });
            });
        }
    );
});

module.exports = router;
