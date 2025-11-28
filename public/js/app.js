const socket = io();
const API_URL = '/api';

// State
let currentUser = null;
let token = localStorage.getItem('token');
let allSlots = []; // Store all slots for filtering

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    dashboard: document.getElementById('dashboard-view')
};

const forms = {
    login: document.getElementById('login-form'),
    addBook: document.getElementById('add-book-form')
};

const lists = {
    books: document.getElementById('book-list'),
    slots: document.getElementById('slot-list'),
    history: document.getElementById('history-list'),
    activeSlots: document.getElementById('active-slots')
};

// Init
if (token) {
    // Decode token to get user info (simplified)
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser = payload;
    showDashboard();
}

// Event Listeners
forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role-select').value;

    if (!role) {
        document.getElementById('login-error').textContent = 'Please select a role';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        token = data.token;
        localStorage.setItem('token', token);
        // Decode token to get full user info including ID
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUser = payload;
        showDashboard();
    } catch (err) {
        document.getElementById('login-error').textContent = err.message;
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    location.reload();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');

        if (btn.dataset.tab === 'history') {
            loadHistory();
        }
        if (btn.dataset.tab === 'fines' && currentUser.role === 'admin') {
            loadAllTransactions();
        }
    });
});

document.getElementById('book-search').addEventListener('input', (e) => {
    loadBooks(e.target.value);
});

// Slot filter and search
document.getElementById('slot-filter').addEventListener('change', () => {
    filterAndSearchSlots();
});

document.getElementById('slot-search').addEventListener('input', () => {
    filterAndSearchSlots();
});

forms.addBook.addEventListener('submit', async (e) => {
    e.preventDefault();
    const book = {
        title: document.getElementById('new-title').value,
        author: document.getElementById('new-author').value,
        location_floor: document.getElementById('new-floor').value,
        location_shelf: document.getElementById('new-shelf').value
    };

    await fetch(`${API_URL}/books`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(book)
    });

    alert('Book added!');
    forms.addBook.reset();
    loadBooks();
});

// Print Store Event Listeners
let selectedPrintFile = null;

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('print-upload-area');
    const fileInput = document.getElementById('print-file-input');
    const printBtn = document.getElementById('print-btn');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const fileSelected = document.getElementById('file-selected');
    const selectedFilename = document.getElementById('selected-filename');
    const selectedFilesize = document.getElementById('selected-filesize');
    const printStatus = document.getElementById('print-status');

    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border)';
            uploadArea.style.backgroundColor = 'transparent';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border)';
            uploadArea.style.backgroundColor = 'transparent';

            if (e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });

        printBtn.addEventListener('click', () => {
            if (selectedPrintFile) {
                simulatePrint();
            }
        });
    }

    function handleFileSelection(file) {
        selectedPrintFile = file;

        // Show file details
        uploadPlaceholder.style.display = 'none';
        fileSelected.style.display = 'block';
        selectedFilename.textContent = file.name;
        selectedFilesize.textContent = `${(file.size / 1024).toFixed(2)} KB`;

        // Enable print button
        printBtn.disabled = false;
        printBtn.style.cursor = 'pointer';
        printBtn.style.opacity = '1';

        // Hide previous status
        printStatus.style.display = 'none';
    }

    function simulatePrint() {
        // Show printing status
        printStatus.style.display = 'block';
        printStatus.style.background = 'var(--dark-lighter)';
        printStatus.style.border = '1px solid var(--primary)';
        printStatus.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 40px; height: 40px; border: 3px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div>
                    <p style="font-weight: 600; margin: 0;">Processing Print Job...</p>
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0.25rem 0 0 0;">Preparing "${selectedPrintFile.name}"</p>
                </div>
            </div>
        `;

        // Add spinner animation
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        // Simulate print completion after 2 seconds
        setTimeout(() => {
            printStatus.style.background = 'rgba(34, 197, 94, 0.1)';
            printStatus.style.border = '1px solid #22c55e';
            printStatus.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">✓</div>
                    <div>
                        <p style="font-weight: 600; margin: 0; color: #22c55e;">Print Job Sent Successfully!</p>
                        <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0.25rem 0 0 0;">Your document has been queued for printing</p>
                        <p style="color: var(--text-muted); font-size: 0.75rem; margin: 0.25rem 0 0 0; font-style: italic;">Job ID: PRT-${Date.now().toString().slice(-6)}</p>
                    </div>
                </div>
            `;

            // Reset after 3 seconds
            setTimeout(() => {
                selectedPrintFile = null;
                fileInput.value = '';
                uploadPlaceholder.style.display = 'block';
                fileSelected.style.display = 'none';
                printBtn.disabled = true;
                printBtn.style.cursor = 'not-allowed';
                printBtn.style.opacity = '0.5';

                // Hide status after a delay
                setTimeout(() => {
                    printStatus.style.display = 'none';
                }, 2000);
            }, 3000);
        }, 2000);
    }
});

// Functions
function showDashboard() {
    views.login.classList.remove('active');
    views.dashboard.classList.add('active');
    document.getElementById('user-display').textContent = `${currentUser.username} (${currentUser.role})`;

    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
        document.body.classList.add('role-admin');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'inline-block');
        document.body.classList.remove('role-admin');
    }

    loadBooks();
    loadSlots();
}

async function loadBooks(query = '') {
    const res = await fetch(`${API_URL}/books/search?query=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const books = await res.json();

    lists.books.innerHTML = books.map(book => {
        let actionBtn = '';
        if (currentUser.role === 'admin') {
            actionBtn = `<button onclick="deleteBook(${book.id})" style="background-color: #ef4444;">Delete</button>`;
        } else {
            if (book.status === 'available') {
                actionBtn = `<button onclick="borrowBook(${book.id})">Borrow</button>`;
            } else {
                // Check if the current user borrowed this book
                if (book.borrowed_by_user_id == currentUser.id) {
                    actionBtn = `<button onclick="returnBook(${book.id})" class="secondary">Return</button>`;
                } else {
                    actionBtn = `<button disabled style="opacity: 0.5; cursor: not-allowed;">Borrowed</button>`;
                }
            }
        }

        return `
        <div class="card">
            <span class="status-badge status-${book.status}">${book.status}</span>
            <h3>${book.title}</h3>
            <p class="meta">by ${book.author}</p>
            <p class="meta">📍 Floor ${book.location_floor}, Shelf ${book.location_shelf}</p>
            ${actionBtn}
        </div>
    `}).join('');
}

async function loadSlots() {
    const res = await fetch(`${API_URL}/slots`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const slots = await res.json();

    // Store all slots for filtering
    allSlots = slots;

    // Apply current filter and search
    filterAndSearchSlots();

    // Update DevTools
    const bookedSlots = slots.filter(s => s.status === 'booked');
    lists.activeSlots.innerHTML = bookedSlots.length ? bookedSlots.map(s => `
        <div style="margin-top: 10px; padding: 10px; background: #374151; border-radius: 5px;">
            <span>${s.zone} - ${s.name}</span>
            <button onclick="simulateLeave(${s.id})" style="margin-top: 5px; background: #ef4444; font-size: 0.8rem;">Simulate Leave</button>
        </div>
    `).join('') : '<p>No active bookings to simulate.</p>';
}

function filterAndSearchSlots() {
    const filterValue = document.getElementById('slot-filter').value;
    const searchValue = document.getElementById('slot-search').value.toLowerCase();

    // Filter by status
    let filtered = allSlots;
    if (filterValue !== 'all') {
        filtered = allSlots.filter(slot => slot.status === filterValue);
    }

    // Search by seat name
    if (searchValue) {
        filtered = filtered.filter(slot =>
            slot.name.toLowerCase().includes(searchValue) ||
            slot.zone.toLowerCase().includes(searchValue)
        );
    }

    // Render filtered slots
    renderSlots(filtered);
}

function renderSlots(slots) {
    lists.slots.innerHTML = slots.map(slot => {
        let actionBtn = '';
        let timeDisplay = '';

        if (slot.status === 'booked') {
            const startTime = new Date(slot.booking_start_time);
            const endTime = new Date(startTime.getTime() + (4 * 60 * 60 * 1000));
            const now = new Date();
            const timeLeft = Math.max(0, Math.floor((endTime - now) / 60000)); // minutes

            timeDisplay = `<p class="meta">Expires in: ${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m</p>`;

            // Check if this slot is booked by the current user (use == for type coercion)
            const isMyBooking = slot.booked_by_user_id == currentUser.id;

            if (currentUser.role !== 'admin') {
                if (isMyBooking) {
                    // User can end their own session
                    actionBtn = `<button onclick="endSession(${slot.id})" class="secondary">End Session</button>`;
                } else {
                    // Slot is booked by someone else
                    actionBtn = `<button disabled>Occupied</button>`;
                }
            } else {
                actionBtn = `<button disabled>Occupied</button>`;
            }
        } else {
            timeDisplay = `<p class="meta">Max Duration: 4 Hours</p>`;
            if (currentUser.role !== 'admin') {
                // Check if user already has an active booking (use == for type coercion)
                const hasActiveBooking = slots.some(s => s.status === 'booked' && s.booked_by_user_id == currentUser.id);

                if (hasActiveBooking) {
                    actionBtn = `<button disabled title="You already have an active booking">Already Booked</button>`;
                } else {
                    actionBtn = `<button onclick="bookSlot(${slot.id})">Book Now</button>`;
                }
            } else {
                actionBtn = `<span class="meta">Admin View Only</span>`;
            }
        }

        return `
        <div class="card${slot.status === 'booked' && slot.booked_by_user_id == currentUser.id ? ' my-booking' : ''}">
            <span class="status-badge status-${slot.status}">${slot.status}</span>
            ${slot.status === 'booked' && slot.booked_by_user_id == currentUser.id ? '<span class="my-badge">Your Booking</span>' : ''}
            <h3>${slot.zone} - ${slot.name}</h3>
            ${timeDisplay}
            ${actionBtn}
        </div>
    `}).join('');

    // Show "no results" message if filtered list is empty
    if (slots.length === 0) {
        lists.slots.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No seats found matching your criteria.</p>';
    }
}

async function loadHistory() {
    const res = await fetch(`${API_URL}/users/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const history = await res.json();

    lists.history.innerHTML = history.map(item => {
        const issueDate = new Date(item.issue_date).toLocaleDateString();
        const dueDate = item.due_date ? new Date(item.due_date).toLocaleDateString() : '-';
        const returnDate = item.return_date ? new Date(item.return_date).toLocaleDateString() : '-';

        // Check if overdue (for borrowed books)
        const isOverdue = item.status === 'borrowed' && new Date() > new Date(item.due_date);
        const statusClass = item.status === 'borrowed' ? (isOverdue ? 'borrowed' : 'booked') : 'free';

        // Fine display
        const fineDisplay = item.fine > 0
            ? `<p class="meta" style="color: #ef4444; font-weight: 600;">💰 Fine: ₹${item.fine}</p>`
            : '';

        // Overdue warning for active borrows
        const overdueWarning = isOverdue
            ? `<p class="meta" style="color: #f59e0b; font-weight: 600;">⚠️ OVERDUE - Fine will apply!</p>`
            : '';

        return `
        <div class="card">
            <span class="status-badge status-${statusClass}">${item.status}</span>
            <h3>${item.title}</h3>
            <p class="meta">by ${item.author}</p>
            <p class="meta">📅 Issued: ${issueDate}</p>
            <p class="meta">📅 Due: ${dueDate}</p>
            <p class="meta">📅 Returned: ${returnDate}</p>
            ${fineDisplay}
            ${overdueWarning}
        </div>
    `}).join('');
}

// Actions
window.borrowBook = async (bookId) => {
    try {
        const res = await fetch(`${API_URL}/books/borrow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bookId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to borrow book');
        } else {
            loadBooks(document.getElementById('book-search').value);
        }
    } catch (err) {
        alert('Error borrowing book');
    }
};

window.returnBook = async (bookId) => {
    try {
        const res = await fetch(`${API_URL}/books/return`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bookId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to return book');
        } else {
            alert(data.message); // Show fine message if applicable
            loadBooks(document.getElementById('book-search').value);
        }
    } catch (err) {
        alert('Error returning book');
    }
};

window.bookSlot = async (slotId) => {
    try {
        const res = await fetch(`${API_URL}/slots/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ slotId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to book slot');
        } else {
            loadSlots();
        }
    } catch (err) {
        alert('Error booking slot');
    }
};

window.endSession = async (slotId) => {
    const res = await fetch(`${API_URL}/slots/end`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slotId })
    });
    const data = await res.json();
    if (!res.ok) alert(data.error);
};

window.simulateLeave = async (slotId) => {
    await fetch(`${API_URL}/slots/simulate-leave`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slotId })
    });
};

window.deleteBook = async (bookId) => {
    if (!confirm('Are you sure you want to delete this book?')) return;

    await fetch(`${API_URL}/books/${bookId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    loadBooks();
};

// Load All Transactions (Admin only)
async function loadAllTransactions() {
    try {
        const res = await fetch(`${API_URL}/users/all-transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch transactions');
        }

        const transactions = await res.json();
        console.log('Loaded transactions:', transactions); // Debug log

        const container = document.getElementById('all-transactions');
        if (!container) return;

        container.innerHTML = transactions.map(tx => {
            const issueDate = new Date(tx.issue_date).toLocaleDateString();
            const dueDate = tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-';
            const returnDate = tx.return_date ? new Date(tx.return_date).toLocaleDateString() : '-';

            // Calculate potential fine for borrowed books
            let potentialFine = 0;
            let daysOverdue = 0;
            let isOverdue = false;

            if (tx.status === 'borrowed' && tx.due_date) {
                const now = new Date();
                const due = new Date(tx.due_date);
                if (now > due) {
                    daysOverdue = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
                    potentialFine = daysOverdue * 100;
                    isOverdue = true;
                }
            }

            const statusClass = tx.status === 'borrowed' ? 'booked' : 'free';

            // Fine Display Logic
            let fineSection = '';

            if (tx.fine > 0) {
                // Fine already paid/recorded
                fineSection = `<p class="meta" style="color: #ef4444; font-weight: 600; margin-top: 0.5rem;">💰 Fine Paid: ₹${tx.fine}</p>`;
            } else if (isOverdue) {
                // Overdue - Show potential fine and calculate button
                fineSection = `
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border);">
                        <p class="meta" style="color: #f59e0b; font-weight: 600;">⚠️ Overdue by ${daysOverdue} days</p>
                        <p class="meta" style="font-weight: 700; font-size: 1.1rem; color: var(--text);">Current Fine: ₹${potentialFine}</p>
                        <button onclick="alert('Fine Calculation:\\n\\nDue Date: ${dueDate}\\nToday: ${new Date().toLocaleDateString()}\\nDays Overdue: ${daysOverdue}\\nRate: ₹100/day\\n\\nTotal Fine: ₹${potentialFine}')" 
                            class="secondary" style="width: 100%; margin-top: 0.5rem; font-size: 0.875rem;">
                            Show Calculation Details
                        </button>
                    </div>
                `;
            }

            return `
            <div class="card">
                <span class="status-badge status-${statusClass}">${tx.status}</span>
                <h3>${tx.title}</h3>
                <p class="meta">by ${tx.author}</p>
                <p class="meta">👤 ${tx.username} (${tx.role})</p>
                <p class="meta">📅 Issued: ${issueDate}</p>
                <p class="meta">📅 Due: ${dueDate}</p>
                <p class="meta">📅 Returned: ${returnDate}</p>
                ${fineSection}
            </div>
        `}).join('');

        if (transactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No transactions found.</p>';
        }
    } catch (err) {
        console.error('Error loading transactions:', err);
        const container = document.getElementById('all-transactions');
        if (container) {
            container.innerHTML = `<p style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${err.message}</p>`;
        }
    }
}

// Socket.io Real-time Updates
socket.on('inventory_update', () => {
    loadBooks(document.getElementById('book-search').value);
});

socket.on('slot_update', () => {
    loadSlots();
});
