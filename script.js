import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// HTML Element References
const loginContainer = document.getElementById('login-container');
const mainDashboard = document.getElementById('main-dashboard');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const profilePicEl = document.getElementById('profile-pic');
const usernameEl = document.getElementById('username');
const balanceAmountEl = document.getElementById('balance-amount');
const totalMembersEl = document.getElementById('total-members');
const pendingIdsEl = document.getElementById('pending-ids');

// Referral Link Elements
const copyBtn = document.getElementById('copy-btn');
const referralLinkInput = document.getElementById('referral-link');

// Submit ID Elements
const submitIdBtn = document.getElementById('submit-id-btn');
const tradingIdInput = document.getElementById('trading-id-input');
const historyList = document.getElementById('history-list');

// Withdrawal Elements
const withdrawalBtn = document.getElementById('withdrawal-btn');
const withdrawalAmountInput = document.getElementById('withdrawal-amount-input');
const accountNameInput = document.getElementById('account-name-input');
const accountTypeInput = document.getElementById('account-type-input');
const accountNumberInput = document.getElementById('account-number-input');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');

// --- 1. AUTHENTICATION LOGIC ---
loginBtn.addEventListener('click', () => auth.signInWithPopup(googleProvider));
logoutBtn.addEventListener('click', () => auth.signOut());

// This is the main controller that runs when user logs in or out
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in
        loginContainer.style.display = 'none';
        mainDashboard.style.display = 'block';
        setupUser(user);
    } else {
        // User is logged out
        loginContainer.style.display = 'block';
        mainDashboard.style.display = 'none';
    }
});

// --- 2. USER SETUP & DATA LOADING ---
function setupUser(user) {
    const userRef = db.collection('users').doc(user.uid);
    // Check if user exists in our database, if not, create a profile.
    userRef.get().then(doc => {
        if (!doc.exists) {
            userRef.set({
                name: user.displayName,
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                balance: 0
            });
        }
    });
    // Set user's unique referral link
    // IMPORTANT: Change "your-main-domain.com" to your actual website domain if you get one. For now, it uses the GitHub URL.
    const siteURL = window.location.origin + window.location.pathname;
    referralLinkInput.value = `${siteURL}?ref=${user.uid}`;
    
    loadAllUserDataFor(user);
}

// This function starts all the real-time listeners for the logged-in user
function loadAllUserDataFor(user) {
    profilePicEl.src = user.photoURL;
    usernameEl.innerText = user.displayName;
    const userDocRef = db.collection('users').doc(user.uid);

    // Listener for Balance
    userDocRef.onSnapshot(doc => {
        balanceAmountEl.innerText = (doc.data()?.balance || 0).toFixed(2);
    });

    // Listener for Submitted IDs (History & Stats)
    userDocRef.collection('submittedIDs').orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
        historyList.innerHTML = '';
        let approvedMembers = 0, pendingCount = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'approved') approvedMembers++;
            if (data.status === 'pending') pendingCount++;
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<span>${data.tradingId}</span><span class="status ${data.status}">${data.status}</span>`;
            historyList.appendChild(item);
        });
        totalMembersEl.innerText = approvedMembers;
        pendingIdsEl.innerText = pendingCount;
    });

    // Listener for Withdrawal History
    userDocRef.collection('withdrawals').orderBy('requestedAt', 'desc').onSnapshot(snapshot => {
        withdrawalHistoryList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span>$${data.amount.toFixed(2)} to ${data.accountType}</span>
                <span class="status ${data.status}">${data.status}</span>`;
            withdrawalHistoryList.appendChild(item);
        });
    });
}

// --- 3. USER ACTIONS ---

// Action: Copy referral link
copyBtn.addEventListener('click', () => {
    referralLinkInput.select();
    referralLinkInput.setSelectionRange(0, 99999); // For mobile
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => { copyBtn.innerText = 'Copy Link'; }, 2000);
});

// Action: Submit a new Trading ID
submitIdBtn.addEventListener('click', () => {
    const tradingId = tradingIdInput.value.trim();
    if (!tradingId) return alert('Please enter an ID.');
    const user = auth.currentUser;
    if (!user) return;
    
    db.collection('users').doc(user.uid).collection('submittedIDs').add({
        tradingId: tradingId,
        status: 'pending',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('ID submitted!');
        tradingIdInput.value = '';
    });
});

// Action: Request a new Withdrawal
withdrawalBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Get all details from the form
    const amount = parseFloat(withdrawalAmountInput.value);
    const accountName = accountNameInput.value.trim();
    const accountType = accountTypeInput.value;
    const accountNumber = accountNumberInput.value.trim();

    // --- Validations ---
    if (!accountName || !accountNumber) return alert('Please fill all account details.');
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');
    
    const currentBalance = parseFloat(balanceAmountEl.innerText);
    if (amount > currentBalance) return alert('Withdrawal amount cannot exceed your balance.');

    // --- Rule: Check for existing pending withdrawal ---
    const userWithdrawalsRef = db.collection('users').doc(user.uid).collection('withdrawals');
    const pendingQuery = await userWithdrawalsRef.where('status', '==', 'pending').get();
    
    if (!pendingQuery.empty) {
        return alert('You already have a withdrawal request in process. Please wait for it to be completed.');
    }
    
    // --- If all checks pass, add the request to the database ---
    userWithdrawalsRef.add({
        amount: amount,
        accountName: accountName,
        accountType: accountType,
        accountNumber: accountNumber,
        status: 'pending',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('Withdrawal request submitted successfully!');
        // Clear the form fields
        withdrawalAmountInput.value = '';
        accountNameInput.value = '';
        accountNumberInput.value = '';
    });
});
