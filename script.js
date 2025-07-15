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
const copyBtn = document.getElementById('copy-btn');
const referralLinkInput = document.getElementById('referral-link');
const submitIdBtn = document.getElementById('submit-id-btn');
const tradingIdInput = document.getElementById('trading-id-input');
const historyList = document.getElementById('history-list');
const withdrawalBtn = document.getElementById('withdrawal-btn');
const withdrawalAmountInput = document.getElementById('withdrawal-amount-input');
const accountNameInput = document.getElementById('account-name-input');
const accountTypeInput = document.getElementById('account-type-input');
const accountNumberInput = document.getElementById('account-number-input');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');

// --- AUTHENTICATION LOGIC ---
loginBtn.addEventListener('click', () => auth.signInWithPopup(googleProvider));
logoutBtn.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.style.display = 'none';
        mainDashboard.style.display = 'block';
        setupUser(user);
    } else {
        loginContainer.style.display = 'block';
        mainDashboard.style.display = 'none';
    }
});

// --- USER SETUP & DATA LOADING ---
function setupUser(user) {
    const userRef = db.collection('users').doc(user.uid);
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
    loadAllUserDataFor(user);
}

function loadAllUserDataFor(user) {
    profilePicEl.src = user.photoURL;
    usernameEl.innerText = user.displayName;
    const userDocRef = db.collection('users').doc(user.uid);

    userDocRef.onSnapshot(doc => {
        balanceAmountEl.innerText = (doc.data()?.balance || 0).toFixed(2);
    });

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

// --- USER ACTIONS ---
copyBtn.addEventListener('click', () => {
    referralLinkInput.select();
    referralLinkInput.setSelectionRange(0, 99999);
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => { copyBtn.innerText = 'Copy Link'; }, 2000);
});

// === vvvv TABDEEL SHUDA CODE vvvv ===
submitIdBtn.addEventListener('click', () => {
    const tradingId = tradingIdInput.value.trim();
    if (!tradingId) return alert('Please enter an ID.');
    
    const user = auth.currentUser;
    if (!user) return;

    const submittedIDsRef = db.collection('users').doc(user.uid).collection('submittedIDs');

    // Step 1: Check if the ID already exists
    submittedIDsRef.where('tradingId', '==', tradingId).get().then(querySnapshot => {
        // Step 2: If querySnapshot is not empty, it means the ID was found
        if (!querySnapshot.empty) {
            alert('This ID has already been submitted.'); // User ko bataein
            return; // Function ko rokein
        }

        // Step 3: If ID does not exist, add it to the database
        submittedIDsRef.add({
            tradingId: tradingId,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('ID submitted!');
            tradingIdInput.value = '';
        }).catch(error => {
            console.error("Error submitting ID: ", error);
            alert("There was an error submitting the ID. Please try again.");
        });

    }).catch(error => {
        console.error("Error checking ID: ", error);
        alert("Could not verify the ID. Please check your connection and try again.");
    });
});
// === ^^^^ TABDEEL SHUDA CODE ^^^^ ===

withdrawalBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const amount = parseFloat(withdrawalAmountInput.value);
    const accountName = accountNameInput.value.trim();
    const accountType = accountTypeInput.value;
    const accountNumber = accountNumberInput.value.trim();

    if (!accountName || !accountNumber) return alert('Please fill all account details.');
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');
    
    const currentBalance = parseFloat(balanceAmountEl.innerText);
    if (amount > currentBalance) return alert('Withdrawal amount cannot exceed your balance.');

    const userWithdrawalsRef = db.collection('users').doc(user.uid).collection('withdrawals');
    const pendingQuery = await userWithdrawalsRef.where('status', '==', 'pending').get();
    
    if (!pendingQuery.empty) {
        return alert('You already have a withdrawal request in process. Please wait for it to be completed.');
    }
    
    userWithdrawalsRef.add({
        amount: amount,
        accountName: accountName,
        accountType: accountType,
        accountNumber: accountNumber,
        status: 'pending',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('Withdrawal request submitted successfully!');
        withdrawalAmountInput.value = '';
        accountNameInput.value = '';
        accountNumberInput.value = '';
    });
});
