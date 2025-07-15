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
    const tradingId = tradingIdInput.value.trim().toUpperCase(); // Standardize to uppercase
    if (tradingId === '') {
        alert('Please enter a Trading ID.');
        return;
    }
    
    // Disable button to prevent multiple clicks
    submitIdBtn.disabled = true;
    submitIdBtn.innerText = 'Checking...';

    // Rule: Check if ID already exists
    const existingIdQuery = await db.collection("submittedIDs").where("tradingId", "==", tradingId).get();

    if (!existingIdQuery.empty) {
        alert('This Trading ID has already been submitted before.');
        submitIdBtn.disabled = false;
        submitIdBtn.innerText = 'Submit for Approval';
        return; // Stop the function
    }

    // If ID is unique, add it to Firestore
    db.collection("submittedIDs").add({
        tradingId: tradingId,
        status: "pending", // Default status
        submittedAt: firebase.firestore.FieldValue.serverTimestamp() // Current time
    })
    .then(() => {
        alert("ID Submitted Successfully! Waiting for admin approval.");
        tradingIdInput.value = ''; // Clear input box
    })
    .catch((error) => {
        console.error("Error adding document: ", error);
        alert("Error: Could not submit ID. Please try again.");
    })
    .finally(() => {
        // Re-enable the button in any case
        submitIdBtn.disabled = false;
        submitIdBtn.innerText = 'Submit for Approval';
    });
});


// --- REAL-TIME DATA DISPLAY ---

// This function runs automatically whenever data in "submittedIDs" collection changes
db.collection("submittedIDs").orderBy("submittedAt", "desc").onSnapshot((querySnapshot) => {
    historyList.innerHTML = ''; // Clear old list
    let totalMembers = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    if (querySnapshot.empty) {
        historyList.innerHTML = '<p class="loading-text">No history found.</p>';
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalMembers++; 

        if (data.status === 'pending') {
            pendingCount++;
        }
        if (data.status === 'approved') {
            approvedCount++;
        }
        
        // Create HTML for each history item
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

    // Update balance (Example: $1 for each approved member)
    const newBalance = approvedCount * 1.00;
    balanceAmountEl.innerText = newBalance.toFixed(2);
});