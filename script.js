import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Get references to HTML elements
const loginContainer = document.getElementById('login-container');
const mainDashboard = document.getElementById('main-dashboard');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

const profilePicEl = document.getElementById('profile-pic');
const usernameEl = document.getElementById('username');
const balanceAmountEl = document.getElementById('balance-amount');
const totalMembersEl = document.getElementById('total-members');
const pendingIdsEl = document.getElementById('pending-ids');

const submitIdBtn = document.getElementById('submit-id-btn');
const tradingIdInput = document.getElementById('trading-id-input');
const historyList = document.getElementById('history-list');

const withdrawalBtn = document.getElementById('withdrawal-btn');
const withdrawalAmountInput = document.getElementById('withdrawal-amount-input');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');


// --- 1. AUTHENTICATION ---

// Login function
loginBtn.addEventListener('click', () => {
    auth.signInWithPopup(googleProvider);
});

// Logout function
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Auth state listener: This is the main controller
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in
        loginContainer.style.display = 'none';
        mainDashboard.style.display = 'block';
        
        // Check if user exists in DB, if not, create them
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then(doc => {
            if (!doc.exists) {
                // First time login: create user profile
                userRef.set({
                    name: user.displayName,
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    balance: 0
                });
            }
        });

        // Load all data for this user
        loadUserData(user);

    } else {
        // User is logged out
        loginContainer.style.display = 'block';
        mainDashboard.style.display = 'none';
    }
});

// --- 2. LOAD USER DATA ---

function loadUserData(user) {
    // Set profile info
    profilePicEl.src = user.photoURL;
    usernameEl.innerText = user.displayName;

    // Listen to real-time data for this specific user
    const userDocRef = db.collection('users').doc(user.uid);

    // Balance Listener
    userDocRef.onSnapshot(doc => {
        balanceAmountEl.innerText = (doc.data()?.balance || 0).toFixed(2);
    });

    // Submitted IDs Listener (History & Stats)
    userDocRef.collection('submittedIDs').orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
        historyList.innerHTML = '';
        let approvedMembers = 0, pendingCount = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'approved') approvedMembers++;
            if (data.status === 'pending') pendingCount++;
            // ... (render logic for history list)
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<span>${data.tradingId}</span><span class="status ${data.status}">${data.status}</span>`;
            historyList.appendChild(item);
        });
        totalMembersEl.innerText = approvedMembers;
        pendingIdsEl.innerText = pendingCount;
    });

    // Withdrawal History Listener
    userDocRef.collection('withdrawals').orderBy('requestedAt', 'desc').onSnapshot(snapshot => {
        withdrawalHistoryList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<span>$${data.amount.toFixed(2)}</span><span class="status ${data.status}">${data.status}</span>`;
            withdrawalHistoryList.appendChild(item);
        });
    });
}


// --- 3. USER ACTIONS ---

// Submit Trading ID
submitIdBtn.addEventListener('click', () => {
    const tradingId = tradingIdInput.value.trim();
    if (!tradingId) return alert('Please enter an ID.');
    const user = auth.currentUser;
    if (!user) return;
    
    const userSubmittedIDsRef = db.collection('users').doc(user.uid).collection('submittedIDs');
    userSubmittedIDsRef.add({
        tradingId: tradingId,
        status: 'pending',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('ID submitted!');
        tradingIdInput.value = '';
    });
});

// Request Withdrawal
withdrawalBtn.addEventListener('click', () => {
    const amount = parseFloat(withdrawalAmountInput.value);
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');
    
    const currentBalance = parseFloat(balanceAmountEl.innerText);
    if (amount > currentBalance) return alert('Withdrawal amount cannot exceed your balance.');

    const user = auth.currentUser;
    if (!user) return;

    const userWithdrawalsRef = db.collection('users').doc(user.uid).collection('withdrawals');
    userWithdrawalsRef.add({
        amount: amount,
        status: 'pending',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('Withdrawal request submitted!');
        withdrawalAmountInput.value = '';
    });
});
