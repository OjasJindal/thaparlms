const db = require('./database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const initDB = async () => {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Books Table
        db.run(`CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            location_floor INTEGER,
            location_shelf TEXT,
            status TEXT DEFAULT 'available' CHECK(status IN ('available', 'borrowed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Slots Table (Dynamic Booking)
        // zone: e.g., "Floor 1"
        // name: e.g., "Seat 1"
        // booking_start_time: NULL if free, DATETIME if booked
        db.run(`CREATE TABLE IF NOT EXISTS slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'free' CHECK(status IN ('free', 'booked')),
            booking_start_time DATETIME,
            booked_by_user_id INTEGER,
            FOREIGN KEY(booked_by_user_id) REFERENCES users(id)
        )`);

        // Transactions Table
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            return_date DATETIME,
            due_date DATETIME,
            fine INTEGER DEFAULT 0,
            status TEXT DEFAULT 'borrowed' CHECK(status IN ('borrowed', 'returned')),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(book_id) REFERENCES books(id)
        )`);

        console.log('Tables created.');

        // Seed Admin User
        const adminPassword = 'admin123';
        const hash = bcrypt.hashSync(adminPassword, SALT_ROUNDS);

        db.run(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
            ['admin', hash, 'admin'],
            (err) => {
                if (err) console.error('Error seeding admin:', err.message);
                else console.log('Admin user seeded.');
            }
        );

        // Seed Students (student1 - student5)
        const commonPassword = 'password123';
        const commonHash = bcrypt.hashSync(commonPassword, SALT_ROUNDS);

        for (let i = 1; i <= 5; i++) {
            db.run(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
                [`student${i}`, commonHash, 'student'],
                (err) => {
                    if (err) console.error(`Error seeding student${i}:`, err.message);
                }
            );
        }

        // Seed Faculty (faculty1 - faculty3)
        for (let i = 1; i <= 3; i++) {
            db.run(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
                [`faculty${i}`, commonHash, 'faculty'],
                (err) => {
                    if (err) console.error(`Error seeding faculty${i}:`, err.message);
                }
            );
        }
        console.log('Sample students and faculty seeded.');

        // Seed Sample Books
        const books = [
            ['The Great Gatsby', 'F. Scott Fitzgerald', 1, 'A1'],
            ['1984', 'George Orwell', 1, 'A2'],
            ['Clean Code', 'Robert C. Martin', 2, 'B1']
        ];

        const stmt = db.prepare(`INSERT OR IGNORE INTO books (title, author, location_floor, location_shelf) VALUES (?, ?, ?, ?)`);
        books.forEach(book => {
            stmt.run(book, (err) => {
                if (err) console.error('Error seeding book:', err.message);
            });
        });
        stmt.finalize(() => console.log('Sample books seeded.'));

        // Seed Slots (Resources only, no time slots)
        const slots = [];

        // 4 Floors, 10 Seats each
        for (let floor = 1; floor <= 4; floor++) {
            for (let seat = 1; seat <= 10; seat++) {
                slots.push([`Floor ${floor}`, `Seat ${seat}`]);
            }
        }

        // 6 Discussion Rooms
        for (let room = 1; room <= 6; room++) {
            slots.push(['Discussion Area', `Room ${room}`]);
        }

        const slotStmt = db.prepare(`INSERT OR IGNORE INTO slots (zone, name) VALUES (?, ?)`);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            slots.forEach(slot => {
                slotStmt.run(slot, (err) => {
                    if (err) console.error('Error seeding slot:', err.message);
                });
            });
            db.run("COMMIT", () => {
                slotStmt.finalize(() => console.log(`Seeded ${slots.length} slots.`));
            });
        });

        // Seed an overdue transaction for demo purposes
        setTimeout(() => {
            const now = new Date();
            const issueDate = new Date(now);
            issueDate.setDate(issueDate.getDate() - 12); // Borrowed 12 days ago

            const dueDate = new Date(issueDate);
            dueDate.setDate(dueDate.getDate() + 7); // Due 7 days after issue = 5 days overdue

            // First mark book as borrowed
            db.run(`UPDATE books SET status = 'borrowed' WHERE id = 1`, (err) => {
                if (err) {
                    console.error('Error updating book status:', err.message);
                    return;
                }

                // Create overdue transaction
                db.run(
                    `INSERT INTO transactions (user_id, book_id, issue_date, due_date, status, fine) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [2, 1, issueDate.toISOString(), dueDate.toISOString(), 'borrowed', 0],
                    function (err) {
                        if (err) {
                            console.error('Error creating overdue transaction:', err.message);
                        } else {
                            const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
                            console.log(`✅ Overdue transaction created (${daysOverdue} days overdue, ₹${daysOverdue * 100} fine expected)`);
                        }
                    }
                );
            });
        }, 1000); // Wait for other seeds to complete
    });
};

initDB();
