// Step 1: Import Firebase config
import { firebaseConfig } from './firebase-config.js';

// Step 2: Initialize Firebase and Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Step 3: Get references to HTML elements
const copyBtn = document.getElementById('copy-btn');
const submitIdBtn = document.getElementById('submit-id-btn');
const tradingIdInput = document.getElementById('trading-id-input');
const referralLinkInput = document.getElementById('referral-link');
const historyList = document.getElementById('history-list');
const totalMembersEl = document.getElementById('total-members');
const pendingIdsEl = document.getElementById('pending-ids');
const balanceAmountEl = document.getElementById('balance-amount');

// --- EVENT LISTENERS ---

// Copy Button
copyBtn.addEventListener('click', () => {
    referralLinkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
});

// Submit Trading ID Button
submitIdBtn.addEventListener('click', async () => {
    const tradingId = tradingIdInput.value.trim().toUpperCase();
    if (tradingId === '') {
        alert('Please enter a Trading ID.');
        return;
    }
    
    submitIdBtn.disabled = true;
    submitIdBtn.innerText = 'Checking...';

    const existingIdQuery = await db.collection("submittedIDs").where("tradingId", "==", tradingId).get();

    if (!existingIdQuery.empty) {
        alert('This Trading ID has already been submitted before.');
        submitIdBtn.disabled = false;
        submitIdBtn.innerText = 'Submit for Approval';
        return;
    }

    db.collection("submittedIDs").add({
        tradingId: tradingId,
        status: "pending",
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("ID Submitted Successfully! Waiting for admin approval.");
        tradingIdInput.value = '';
    })
    .catch((error) => {
        console.error("Error adding document: ", error);
        alert("Error: Could not submit ID. Please try again.");
    })
    .finally(() => {
        submitIdBtn.disabled = false;
        submitIdBtn.innerText = 'Submit for Approval';
    });
});


// --- REAL-TIME DATA LISTENERS ---

// Listener 1: Get Transaction History and Stats
db.collection("submittedIDs").orderBy("submittedAt", "desc").onSnapshot((querySnapshot) => {
    historyList.innerHTML = ''; 
    let totalMembers = 0;
    let pendingCount = 0;

    if (querySnapshot.empty) {
        historyList.innerHTML = '<p class="loading-text">No history found.</p>';
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // We will now count only APPROVED members as "Total Members"
        if (data.status === 'approved') {
            totalMembers++;
        }
        if (data.status === 'pending') {
            pendingCount++;
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        const date = data.submittedAt?.toDate().toLocaleDateString() || '';
        const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);

        historyItem.innerHTML = `
            <span>${data.tradingId} <small>(${date})</small></span>
            <span class="status ${data.status}">${statusText}</span>
        `;
        historyList.appendChild(historyItem);
    });

    // Update stats
    totalMembersEl.innerText = totalMembers;
    pendingIdsEl.innerText = pendingCount;
});


// Listener 2: Get Manual Balance from Admin setting
db.collection("admin").doc("dashboard").onSnapshot((doc) => {
    if (doc.exists) {
        const balance = doc.data().balance || 0;
        balanceAmountEl.innerText = balance.toFixed(2);
    } else {
        console.log("Admin balance document not found!");
        balanceAmountEl.innerText = "0.00";
    }
});
