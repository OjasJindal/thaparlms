const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./library.db');

// Create an overdue transaction to demonstrate fine calculation
const now = new Date();
const issueDate = new Date(now);
issueDate.setDate(issueDate.getDate() - 12); // Borrowed 12 days ago

const dueDate = new Date(issueDate);
dueDate.setDate(dueDate.getDate() + 7); // Due 7 days after issue = 5 days ago

const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
const expectedFine = daysOverdue * 100;

db.serialize(() => {
    // Update book status
    db.run(`UPDATE books SET status = 'borrowed' WHERE id = 1`, (err) => {
        if (err) console.error('Error updating book:', err);
    });

    // Create overdue transaction
    db.run(
        `INSERT INTO transactions (user_id, book_id, issue_date, due_date, status, fine) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [2, 1, issueDate.toISOString(), dueDate.toISOString(), 'borrowed', 0],
        function (err) {
            if (err) {
                console.error('Error creating transaction:', err);
                db.close();
                return;
            }

            console.log('\n✅ Overdue transaction created!');
            console.log('═══════════════════════════════════════');
            console.log(`📚 Book: Harry Potter (ID: 1)`);
            console.log(`👤 Borrowed by: student1 (ID: 2)`);
            console.log(`📅 Issued: ${issueDate.toLocaleDateString()}`);
            console.log(`⚠️  Due: ${dueDate.toLocaleDateString()}`);
            console.log(`⏰ Today: ${now.toLocaleDateString()}`);
            console.log(`📊 Days Overdue: ${daysOverdue} days`);
            console.log(`💰 Expected Fine: ₹${expectedFine}`);
            console.log('═══════════════════════════════════════');
            console.log('\n🎯 Refresh browser and login as:');
            console.log('   • admin (admin123) - See fine in "Fines" tab');
            console.log('   • student1 (student123) - See fine in "My History"\n');

            db.close();
        }
    );
});
