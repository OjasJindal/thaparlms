const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Search Books (Public)
router.get('/search', authenticateToken, (req, res) => {
    const { query } = req.query;
    const sql = `
        SELECT b.*, t.user_id as borrowed_by_user_id
        FROM books b
        LEFT JOIN transactions t ON b.id = t.book_id AND t.status = 'borrowed'
        WHERE b.title LIKE ? OR b.author LIKE ?
    `;
    const params = [`%${query}%`, `%${query}%`];

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Borrow Book (Student/Faculty ONLY)
router.post('/borrow', authenticateToken, authorizeRole(['student', 'faculty']), (req, res) => {
    const { bookId } = req.body;
    const userId = req.user.id;

    db.serialize(() => {
        // Check availability
        db.get(`SELECT status FROM books WHERE id = ?`, [bookId], (err, book) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!book) return res.status(404).json({ error: 'Book not found' });
            if (book.status === 'borrowed') return res.status(400).json({ error: 'Book already borrowed' });

            // Update book status
            db.run(`UPDATE books SET status = 'borrowed' WHERE id = ?`, [bookId]);

            // Create transaction with due date (7 days from now)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            db.run(`INSERT INTO transactions (user_id, book_id, due_date) VALUES (?, ?, ?)`,
                [userId, bookId, dueDate.toISOString()]);

            // Emit real-time update
            req.io.emit('inventory_update', { bookId, status: 'borrowed' });
            res.json({ message: 'Book borrowed successfully', dueDate: dueDate.toISOString() });
        });
    });
});

// Return Book (Student/Faculty ONLY)
router.post('/return', authenticateToken, authorizeRole(['student', 'faculty']), (req, res) => {
    const { bookId } = req.body;
    const userId = req.user.id;

    db.serialize(() => {
        // Verify transaction and get due date
        db.get(`SELECT id, due_date FROM transactions WHERE user_id = ? AND book_id = ? AND status = 'borrowed'`,
            [userId, bookId], (err, tx) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!tx) return res.status(400).json({ error: 'No active borrow record found' });

                // Calculate fine if overdue (₹100 per day)
                let fine = 0;
                const now = new Date();
                const dueDate = new Date(tx.due_date);

                if (now > dueDate) {
                    // Calculate days overdue
                    const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
                    fine = daysOverdue * 100; // ₹100 per day
                }

                // Update book status
                db.run(`UPDATE books SET status = 'available' WHERE id = ?`, [bookId]);

                // Update transaction with fine
                db.run(`UPDATE transactions SET status = 'returned', return_date = CURRENT_TIMESTAMP, fine = ? WHERE id = ?`,
                    [fine, tx.id]);

                // Emit real-time update
                req.io.emit('inventory_update', { bookId, status: 'available' });

                const message = fine > 0
                    ? `Book returned. Fine charged: ₹${fine} (${Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24))} days overdue)`
                    : 'Book returned successfully';

                res.json({ message, fine });
            });
    });
});

// Add Book (Admin Only)
router.post('/', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { title, author, location_floor, location_shelf } = req.body;
    db.run(`INSERT INTO books (title, author, location_floor, location_shelf) VALUES (?, ?, ?, ?)`,
        [title, author, location_floor, location_shelf],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            // Emit update so lists refresh
            req.io.emit('inventory_update', { bookId: this.lastID, status: 'available' });
            res.json({ id: this.lastID, message: 'Book added' });
        }
    );
});

// Delete Book (Admin Only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const bookId = req.params.id;

    db.get(`SELECT status FROM books WHERE id = ?`, [bookId], (err, book) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!book) return res.status(404).json({ error: 'Book not found' });
        if (book.status === 'borrowed') return res.status(400).json({ error: 'Cannot delete a borrowed book' });

        db.run(`DELETE FROM books WHERE id = ?`, [bookId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update
            req.io.emit('inventory_update', { bookId, status: 'deleted' });
            res.json({ message: 'Book deleted' });
        });
    });
});

module.exports = router;
