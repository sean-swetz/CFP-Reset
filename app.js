// Reset 2026 - Main Application JavaScript
// CrossFit Prosperity - Nutrition & Fitness Challenge Tracker
// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, where, getDocs, updateDoc, increment, addDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// ===== FIREBASE CONFIGURATION =====
// REPLACE THESE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDbvV8uX5OnPRJChm6Q58ca7lyvHg2jqRo",
    authDomain: "reset-2026-tracker.firebaseapp.com",
    projectId: "reset-2026-tracker",
    storageBucket: "reset-2026-tracker.firebasestorage.app",
    messagingSenderId: "867262535384",
    appId: "1:867262535384:web:a9d18d62159c657f4ca9ad"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== ADMIN CONFIGURATION =====
// CHANGE THIS TO YOUR ADMIN EMAIL(S)
const ADMIN_EMAILS = [
    "seanswetz@pm.me",
    "another-admin@example.com"
];

// ===== GLOBAL STATE =====
let currentUser = null;
let isAdmin = false;
let allLeaderboardData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let isSearching = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loading').style.display = 'none';
});

// ===== AUTHENTICATION =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            
            // Load admin users from database
            await loadAdminUsers();
            
            // Check if current user is admin
            isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
            
            showApp();
        }
    } else {
        showAuthPage();
    }
});

function showApp() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('userGreeting').textContent = `Welcome, ${currentUser.name}!${isAdmin ? ' (Admin)' : ''}`;
    
    if (isAdmin) {
        document.getElementById('adminNavBtn').style.display = 'block';
        document.getElementById('editChallengeInfoBtn').style.display = 'block';
        document.getElementById('mobileAdminLink').style.display = 'block';
    }
    
    checkCheckinWindow();
    loadLeaderboard();
    loadCheckInCriteria();
    // showNotificationBanner();
}

function showAuthPage() {
    document.getElementById('authPage').style.display = 'block';
    document.getElementById('app').style.display = 'none';
}

// Auth tab switching
window.showAuthTab = function(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else if (tab === 'register') {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    } else if (tab === 'reset') {
        document.getElementById('resetForm').classList.add('active');
    }
    hideMessages();
};

function hideMessages() {
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').style.display = 'none';
}

function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showAuthSuccess(message) {
    const successDiv = document.getElementById('authSuccess');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 5000);
}

// Registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const btn = document.getElementById('registerBtn');

    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            name: name,
            email: email,
            totalPoints: 0,
            team: 'none',
            isCaptain: false,
            hiddenFromLeaderboard: false,
            registeredAt: new Date().toISOString()
        });

        showAuthSuccess('Account created successfully!');
        document.getElementById('registerForm').reset();
        setTimeout(() => window.showAuthTab('login'), 2000);
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showAuthError('This email is already registered. Please login instead.');
        } else if (error.code === 'auth/weak-password') {
            showAuthError('Password should be at least 6 characters.');
        } else {
            showAuthError('Registration failed. Please try again.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            showAuthError('Invalid email or password.');
        } else {
            showAuthError('Login failed. Please try again.');
        }
        btn.disabled = false;
        btn.textContent = 'Login';
    }
});

// Password Reset
document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const email = document.getElementById('resetEmail').value;
    const btn = document.getElementById('resetBtn');

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        await sendPasswordResetEmail(auth, email);
        showAuthSuccess('Password reset email sent! Check your inbox.');
        document.getElementById('resetForm').reset();
        setTimeout(() => window.showAuthTab('login'), 3000);
    } catch (error) {
        console.error('Reset error:', error);
        if (error.code === 'auth/user-not-found') {
            showAuthError('No account found with this email.');
        } else {
            showAuthError('Failed to send reset email. Please try again.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    }
});

// Logout
window.logout = async function() {
    try {
        await signOut(auth);
        currentUser = null;
        isAdmin = false;
        document.getElementById('loginForm').reset();
        document.getElementById('adminNavBtn').style.display = 'none';
    } catch (error) {
        console.error('Logout error:', error);
    }
};
async function loadMessages() {
    try {
        const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (querySnapshot.empty) {
            messagesContainer.innerHTML = '<p style="text-align: center; padding: 30px; color: #999;">No messages yet. Be the first to post!</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const msg = doc.data();
            const messageId = doc.id;
            const date = new Date(msg.timestamp);
            const timeAgo = getTimeAgo(date);
            
            const photoURL = msg.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.userName)}&background=9BFB02&color=000&size=40`;
            
            const teamBadge = msg.team && msg.team !== 'none'
                ? `<span class="team-badge team-${msg.team}">${msg.team.toUpperCase()}</span>`
                : '';
            
            const deleteBtn = isAdmin 
                ? `<button class="delete-message-btn" onclick="deleteMessage('${messageId}')">Delete</button>`
                : '';
            
            // Check if message has a GIF
            const messageContent = msg.gifUrl 
                ? `<div class="message-gif">
                     <img src="${msg.gifUrl}" alt="${msg.gifTitle || 'GIF'}" loading="lazy">
                     ${msg.gifTitle ? `<div class="gif-caption">${escapeHtml(msg.gifTitle)}</div>` : ''}
                   </div>`
                : `<div class="message-text">${escapeHtml(msg.text)}</div>`;
            
            html += `
                <div class="message-item">
                    <div class="message-header">
                        <div style="display: flex; align-items: center;">
                            <img src="${photoURL}" class="profile-photo small" alt="${msg.userName}">
                            <span class="message-author clickable-name" onclick="viewUserProfile('${msg.userId}')">${msg.userName}</span>
                            ${teamBadge}
                        </div>
                        <div>
                            <span class="message-timestamp">${timeAgo}</span>
                            ${deleteBtn}
                        </div>
                    </div>
                    ${messageContent}
                </div>
            `;
        });
        
        messagesContainer.innerHTML = html;
    } catch (error) {
        console.error('Load messages error:', error);
        document.getElementById('messagesContainer').innerHTML = 
            '<p style="text-align: center; padding: 30px; color: #ff6b6b;">Error loading messages</p>';
    }
}
// ===== NAVIGATION =====
window.showSection = function(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionName === 'checkin') {
    loadCheckInCriteria();
}
    if (sectionName === 'leaderboard') {
        loadLeaderboard();
    } else if (sectionName === 'teams') {
        loadTeamsPage();
    } else if (sectionName === 'locker') {
    loadWeeklyChallenge();
    loadMessages();
    initTeamChat();
    } else if (sectionName === 'profile') {
        loadUserProfile();
    } else if (sectionName === 'admin' && isAdmin) {
        loadAdminData();
    }
};

// ===== CHECK-IN FUNCTIONALITY =====
document.getElementById('checkinForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) return;

    const btn = document.getElementById('checkinBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        // Collect all checked criteria
        const checkedCriteria = {};
        document.querySelectorAll('.criteria-check:checked').forEach(checkbox => {
            const id = checkbox.id;
            const criteriaId = checkbox.id.includes('_') ? checkbox.id.split('_')[0] : checkbox.id;
            
            if (!checkedCriteria[criteriaId]) {
                checkedCriteria[criteriaId] = [];
            }
            checkedCriteria[criteriaId].push(id);
        });

        // Calculate total score
        let weeklyScore = 0;
        document.querySelectorAll('.criteria-check:checked').forEach(checkbox => {
            weeklyScore += parseInt(checkbox.dataset.points);
        });

        // Update user points
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            totalPoints: increment(weeklyScore),
            lastCheckin: new Date().toISOString()
        });

        // Save check-in
        await addDoc(collection(db, 'checkins'), {
            userId: currentUser.uid,
            name: currentUser.name,
            email: currentUser.email,
            weeklyScore: weeklyScore,
            criteriaData: checkedCriteria,
            timestamp: new Date().toISOString()
        });

        currentUser.totalPoints = (currentUser.totalPoints || 0) + weeklyScore;

        const successMsg = document.getElementById('checkinSuccess');
        successMsg.textContent = `Check-in submitted! You earned ${weeklyScore} points this week. Your total is now ${currentUser.totalPoints} points.`;
        successMsg.style.display = 'block';
        
        document.getElementById('checkinForm').reset();
        calculateDynamicScore();

        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 5000);

    } catch (error) {
        console.error('Check-in error:', error);
        alert('Failed to submit check-in. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Check-In';
    }
});

// Check-in window control
async function checkCheckinWindow() {
    try {
        const windowDoc = await getDoc(doc(db, 'settings', 'checkinWindow'));
        const isOpen = windowDoc.exists() ? windowDoc.data().isOpen !== false : true;
        
        const banner = document.getElementById('checkinWindowBanner');
        const form = document.getElementById('checkinForm');
        const submitBtn = document.getElementById('checkinBtn');
        
        if (!isOpen) {
            banner.innerHTML = `
                <div class="checkin-closed-banner">
                    <strong>🚫 Check-In Window is Currently Closed</strong>
                    Check back later or contact your gym administrator.
                </div>
            `;
            form.style.opacity = '0.5';
            form.style.pointerEvents = 'none';
            submitBtn.disabled = true;
        } else {
            banner.innerHTML = `
                <div class="checkin-open-banner">
                    ✅ Check-in window is open! Submit your weekly progress below.
                </div>
            `;
            form.style.opacity = '1';
            form.style.pointerEvents = 'auto';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Check window error:', error);
    }
}

window.toggleCheckinWindow = async function(open) {
    if (!isAdmin) return;

    try {
        await setDoc(doc(db, 'settings', 'checkinWindow'), {
            isOpen: open,
            lastUpdated: new Date().toISOString()
        });
        loadAdminData();
        checkCheckinWindow();
        alert(open ? 'Check-in window opened!' : 'Check-in window closed!');
    } catch (error) {
        console.error('Toggle window error:', error);
        alert('Failed to update check-in window');
    }
};

// ===== LEADERBOARD WITH PAGINATION =====

async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px;">Loading...</td></tr>';

    try {
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        
        allLeaderboardData = [];
        const teamTotals = {
            red: { points: 0, members: 0 },
            blue: { points: 0, members: 0 },
            green: { points: 0, members: 0 },
            yellow: { points: 0, members: 0 },
            purple: { points: 0, members: 0 },
            orange: { points: 0, members: 0 },
            pink: { points: 0, members: 0 },
            teal: { points: 0, members: 0 }
        };

        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            if (!userData.hiddenFromLeaderboard) {
                allLeaderboardData.push({ uid: doc.id, ...userData });
                
                const team = userData.team || 'none';
                if (teamTotals[team]) {
                    teamTotals[team].points += (userData.totalPoints || 0);
                    teamTotals[team].members += 1;
                }
            }
        });

        allLeaderboardData.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

        // Reset to page 1 when data reloads
        currentPage = 1;
        isSearching = false;
        
        displayTeamStandings(teamTotals);
        displayLeaderboardPage();
        
    } catch (error) {
        console.error('Leaderboard error:', error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px; color: #ff6b6b;">
            Error loading leaderboard: ${error.message}
        </td></tr>`;
    }
}
function displayTeamStandings(teamTotals) {
    const teamLeaderboard = document.getElementById('teamLeaderboard');
    
    const teams = Object.entries(teamTotals)
        .map(([name, data]) => ({ name, ...data }))
        .filter(team => team.members > 0)
        .sort((a, b) => b.points - a.points);

    if (teams.length === 0) {
        teamLeaderboard.innerHTML = '<p style="text-align: center; color: #999;">No teams assigned yet</p>';
        return;
    }

    teamLeaderboard.innerHTML = teams.map(team => `
        <div class="team-card team-${team.name}">
            <h3>${team.name.toUpperCase()} TEAM</h3>
            <div class="team-stat">${team.points} pts</div>
            <div class="team-members">${team.members} member${team.members !== 1 ? 's' : ''}</div>
        </div>
    `).join('');
}

function displayLeaderboardPage(dataToDisplay = null) {
    const data = dataToDisplay || allLeaderboardData;
    const tbody = document.getElementById('leaderboardBody');
    const mobileDiv = document.getElementById('leaderboardMobile');
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #999;">No members found</td></tr>';
        if (mobileDiv) mobileDiv.innerHTML = '';
        updatePaginationControls(0);
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageData = data.slice(startIndex, endIndex);

    // Build desktop table
    tbody.innerHTML = '';
    pageData.forEach((member, pageIndex) => {
        const actualIndex = startIndex + pageIndex;
        const row = tbody.insertRow();
        const rankClass = actualIndex < 3 ? `rank-${actualIndex + 1}` : '';
        const isCurrentUser = currentUser && member.uid === currentUser.uid;
        const teamBadge = member.team && member.team !== 'none' 
            ? `<span class="team-badge team-${member.team}">${member.team.toUpperCase()}</span>`
            : '';
        
        const photoURL = member.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=9BFB02&color=000&size=40`;
        
        row.style.background = isCurrentUser ? '#e8f5e9' : '';
        row.style.cursor = 'pointer';
        row.classList.add('profile-clickable');
        
        row.onclick = function() {
            viewUserProfile(member.uid);
        };
        
        row.innerHTML = `
            <td><span class="rank ${rankClass}">${actualIndex + 1}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${photoURL}" class="profile-photo small" alt="${member.name}">
                    <span>${member.name}${isCurrentUser ? ' (You)' : ''}</span>
                </div>
            </td>
            <td>${teamBadge || '<span style="color: #999;">No Team</span>'}</td>
            <td><strong>${member.totalPoints || 0} pts</strong></td>
        `;
    });

    // Build mobile view
    if (mobileDiv) {
        mobileDiv.innerHTML = '';
        pageData.forEach((member, pageIndex) => {
            const actualIndex = startIndex + pageIndex;
            const rankClass = actualIndex < 3 ? `rank-${actualIndex + 1}` : '';
            const isCurrentUser = currentUser && member.uid === currentUser.uid;
            const teamBadge = member.team && member.team !== 'none' 
                ? `<span class="team-badge team-${member.team}">${member.team.toUpperCase()}</span>`
                : '';
            
            const photoURL = member.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=9BFB02&color=000&size=60`;
            
            mobileDiv.innerHTML += `
                <div class="leaderboard-card ${isCurrentUser ? 'current-user' : ''} profile-clickable" onclick="viewUserProfile('${member.uid}')">
                    <div class="rank-mobile ${rankClass}">${actualIndex + 1}</div>
                    <img src="${photoURL}" class="profile-photo" alt="${member.name}">
                    <div class="user-info-mobile">
                        <div class="user-name-mobile">${member.name}${isCurrentUser ? ' (You)' : ''}</div>
                        ${teamBadge}
                    </div>
                    <div class="user-points-mobile">${member.totalPoints || 0}</div>
                </div>
            `;
        });
    }

    updatePaginationControls(totalPages);
}

function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');
    const pagination = document.getElementById('leaderboardPagination');

    if (!prevBtn || !nextBtn || !pageInfo || !pagination) return;

    if (totalPages <= 1 || isSearching) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

window.changePage = function(direction) {
    currentPage += direction;
    displayLeaderboardPage();
    
    // Scroll to top of leaderboard
    document.getElementById('leaderboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.searchLeaderboard = function(searchTerm) {
    searchTerm = searchTerm.toLowerCase().trim();
    
    if (!searchTerm) {
        // Clear search - show paginated view
        isSearching = false;
        currentPage = 1;
        displayLeaderboardPage();
        return;
    }

    // Filter results
    isSearching = true;
    const filteredData = allLeaderboardData.filter(member => 
        member.name.toLowerCase().includes(searchTerm)
    );

    // Show all filtered results (no pagination during search)
    const tbody = document.getElementById('leaderboardBody');
    const mobileDiv = document.getElementById('leaderboardMobile');
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #999;">No members found matching your search</td></tr>';
        if (mobileDiv) mobileDiv.innerHTML = '';
        document.getElementById('leaderboardPagination').style.display = 'none';
        return;
    }

    // Show all search results (no pagination)
    displayLeaderboardPage(filteredData);
};

// ===== TEAMS PAGE =====
async function loadTeamsPage() {
    const teamsContent = document.getElementById('teamsContent');
    teamsContent.innerHTML = '<p style="text-align: center; padding: 30px;">Loading teams...</p>';

    try {
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        
        const teamNamesDoc = await getDoc(doc(db, 'settings', 'teamNames'));
        const teamNames = teamNamesDoc.exists() ? teamNamesDoc.data() : {};
        
        const teamGroups = {
            red: [], blue: [], green: [], yellow: [],
            purple: [], orange: [], pink: [], teal: [], none: []
        };

        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            if (!userData.hiddenFromLeaderboard) {
                const team = userData.team || 'none';
                teamGroups[team].push({ uid: doc.id, ...userData });
            }
        });

        Object.keys(teamGroups).forEach(team => {
            teamGroups[team].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        });

        let html = '';

        const teamColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];
        const teamsWithMembers = teamColors
            .map(color => ({
                color,
                name: teamNames[color] || `${color.toUpperCase()} TEAM`,
                members: teamGroups[color],
                totalPoints: teamGroups[color].reduce((sum, m) => sum + (m.totalPoints || 0), 0)
            }))
            .filter(t => t.members.length > 0)
            .sort((a, b) => b.totalPoints - a.totalPoints);

        teamsWithMembers.forEach(({ color, name, members, totalPoints }) => {
            const captain = members.find(m => m.isCaptain);
            
            html += `
                <div class="team-detail-section">
                    <div class="team-header team-${color} collapsed" onclick="toggleTeamAccordion(this)">
                        <div>
                            <span class="team-color-label">🎨 ${color}</span>
                            <h3>${name}</h3>
                            ${captain ? `<div style="font-size: 0.9em; margin-top: 5px;">⭐ Captain: ${captain.name}</div>` : ''}
                        </div>
                        <div class="team-total">
                            <div class="label">${members.length} member${members.length !== 1 ? 's' : ''}</div>
                            <div class="points">${totalPoints} pts</div>
                        </div>
                    </div>
                    <div class="team-members-container">
                        <div class="team-members-grid">
                            ${members.map(member => {
                                const isCurrentUser = currentUser && member.uid === currentUser.uid;
                                const photoURL = member.photoURL || 
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=9BFB02&color=000&size=60`;
                                
                                return `
                                    <div class="member-card ${isCurrentUser ? 'current-user' : ''} profile-clickable" 
                                         style="border-left-color: var(--team-${color});"
                                         onclick="viewUserProfile('${member.uid}')">
                                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                            <img src="${photoURL}" class="profile-photo" alt="${member.name}">
                                            <div class="member-name">
                                                ${member.name}
                                                ${member.isCaptain ? '<span class="captain-badge">⭐ CAPTAIN</span>' : ''}
                                                ${isCurrentUser ? ' <span style="color: #9BFB02;">(You)</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="member-points">${member.totalPoints || 0} pts</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        if (teamGroups.none.length > 0) {
            html += `
                <div class="no-team-section">
                    <h3 style="color: #856404; margin-bottom: 15px;">⚠️ Unassigned Members (${teamGroups.none.length})</h3>
                    <div class="team-members-grid">
                        ${teamGroups.none.map(member => {
                            const isCurrentUser = currentUser && member.uid === currentUser.uid;
                            return `
                                <div class="member-card ${isCurrentUser ? 'current-user' : ''}" style="border-left-color: #ffc107;">
                                    <div class="member-name">
                                        ${member.name}
                                        ${isCurrentUser ? ' <span style="color: #9BFB02;">(You)</span>' : ''}
                                    </div>
                                    <div class="member-points">${member.totalPoints || 0} pts</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        if (teamsWithMembers.length === 0 && teamGroups.none.length === 0) {
            html = '<p style="text-align: center; padding: 50px; color: #999;">No teams or members yet!</p>';
        }

        teamsContent.innerHTML = html;

    } catch (error) {
        console.error('Load teams error:', error);
        teamsContent.innerHTML = '<p style="text-align: center; padding: 30px; color: #ff6b6b;">Error loading teams</p>';
    }
}

window.toggleTeamAccordion = function(header) {
    header.classList.toggle('collapsed');
    const container = header.nextElementSibling;
    container.classList.toggle('expanded');
};

// ===== LOCKER ROOM =====
async function loadWeeklyChallenge() {
    try {
        const challengeDoc = await getDoc(doc(db, 'settings', 'weeklyChallenge'));
        const challengeText = challengeDoc.exists() && challengeDoc.data().text 
            ? challengeDoc.data().text 
            : "No challenge set yet. Check back soon!";
        
        let formatted = challengeText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^• (.+)$/gm, '<li>$1</li>')
            .replace(/---/g, '<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 10px 0;">')
            .replace(/\n/g, '<br>');
        
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>');
        
        document.getElementById('challengeText').innerHTML = formatted;
        
        if (isAdmin) {
            document.getElementById('editChallengeBtn').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Load challenge error:', error);
        document.getElementById('challengeText').textContent = "Error loading challenge";
    }
}

window.editChallenge = async function() {
    if (!isAdmin) return;

    const currentText = document.getElementById('challengeText').textContent;
    document.getElementById('challengeEditorText').value = currentText;
    updateChallengePreview();
    document.getElementById('challengeEditorModal').classList.add('active');
};

window.closeChallengeEditor = function() {
    document.getElementById('challengeEditorModal').classList.remove('active');
};

window.insertText = function(before, after = '') {
    const textarea = document.getElementById('challengeEditorText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = textarea.value.substring(0, start) + before + selectedText + after + textarea.value.substring(end);
    
    textarea.value = newText;
    textarea.focus();
    
    if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length);
    } else {
        textarea.setSelectionRange(start + before.length, start + before.length);
    }
    
    updateChallengePreview();
};

function updateChallengePreview() {
    const text = document.getElementById('challengeEditorText').value;
    const preview = document.getElementById('challengePreview');
    
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^• (.+)$/gm, '<li>$1</li>')
        .replace(/---/g, '<hr style="border: 1px solid #e0e0e0; margin: 10px 0;">')
        .replace(/\n/g, '<br>');
    
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>');
    
    preview.innerHTML = formatted || '<em style="color: #999;">Preview will appear here...</em>';
}

window.saveChallengeFromEditor = async function() {
    if (!isAdmin) return;
    
    const text = document.getElementById('challengeEditorText').value.trim();
    
    if (!text) {
        alert('Please enter a challenge!');
        return;
    }
    
    try {
        await setDoc(doc(db, 'settings', 'weeklyChallenge'), {
            text: text,
            updatedBy: currentUser.email,
            updatedAt: new Date().toISOString()
        });
        
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^• (.+)$/gm, '<li>$1</li>')
            .replace(/---/g, '<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 10px 0;">')
            .replace(/\n/g, '<br>');
        
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>');
        
        document.getElementById('challengeText').innerHTML = formatted;
        closeChallengeEditor();
        alert('Challenge updated! ✅');
    } catch (error) {
        console.error('Update challenge error:', error);
        alert('Failed to update challenge: ' + error.message);
    }
};

// ===== UPDATED MESSAGE DISPLAY FUNCTIONS =====
// Updated loadMessages() for main Locker Room

// Updated loadTeamMessages() for team chat
async function loadTeamMessages() {
    if (!currentTeamChannel) {
        document.getElementById('teamMessagesContainer').innerHTML = 
            '<p style="text-align: center; padding: 30px; color: #999;">Select your team channel above to view messages</p>';
        return;
    }

    try {
        const q = query(
            collection(db, 'teamMessages'),
            where('team', '==', currentTeamChannel),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        const messagesContainer = document.getElementById('teamMessagesContainer');
        
        if (querySnapshot.empty) {
            messagesContainer.innerHTML = '<p style="text-align: center; padding: 30px; color: #999;">No messages yet. Be the first to post to your team!</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const msg = doc.data();
            const messageId = doc.id;
            const date = new Date(msg.timestamp);
            const timeAgo = getTimeAgo(date);
            
            const photoURL = msg.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.userName)}&background=9BFB02&color=000&size=40`;
            
            const deleteBtn = isAdmin 
                ? `<button class="delete-message-btn" onclick="deleteTeamMessage('${messageId}')">Delete</button>`
                : '';
            
            // Check if message has a GIF
            const messageContent = msg.gifUrl 
                ? `<div class="message-gif">
                     <img src="${msg.gifUrl}" alt="${msg.gifTitle || 'GIF'}" loading="lazy">
                     ${msg.gifTitle ? `<div class="gif-caption">${escapeHtml(msg.gifTitle)}</div>` : ''}
                   </div>`
                : `<div class="message-text">${escapeHtml(msg.text)}</div>`;
            
            html += `
                <div class="message-item">
                    <div class="message-header">
                        <div style="display: flex; align-items: center;">
                            <img src="${photoURL}" class="profile-photo small" alt="${msg.userName}">
                            <span class="message-author clickable-name" onclick="viewUserProfile('${msg.userId}')">${msg.userName}</span>
                        </div>
                        <div>
                            <span class="message-timestamp">${timeAgo}</span>
                            ${deleteBtn}
                        </div>
                    </div>
                    ${messageContent}
                </div>
            `;
        });
        
        messagesContainer.innerHTML = html;
    } catch (error) {
        console.error('Load team messages error:', error);
        document.getElementById('teamMessagesContainer').innerHTML = 
            '<p style="text-align: center; padding: 30px; color: #ff6b6b;">Error loading messages</p>';
    }
}


window.postMessage = async function() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    // Check for GIF preview
    const container = input.closest('.message-input');
    const gifPreview = container ? container.querySelector('.gif-preview') : null;
    const gifUrl = gifPreview ? gifPreview.dataset.gifUrl : null;
    const gifTitle = gifPreview ? gifPreview.dataset.gifTitle : null;
    
    // Must have either text or GIF
    if (!text && !gifUrl) {
        alert('Please enter a message or select a GIF!');
        return;
    }
    
    if (text.length > 500) {
        alert('Message too long! Keep it under 500 characters.');
        return;
    }
    
    const btn = document.getElementById('postMessageBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';
    
    try {
        const messageData = {
            text: text,
            userName: currentUser.name,
            userId: currentUser.uid,
            team: currentUser.team || 'none',
            photoURL: currentUser.photoURL || null,
            timestamp: new Date().toISOString()
        };
        
        // Add GIF data if present
        if (gifUrl) {
            messageData.gifUrl = gifUrl;
            messageData.gifTitle = gifTitle;
        }
        
        await addDoc(collection(db, 'messages'), messageData);
        
        input.value = '';
        document.getElementById('charCounter').textContent = '0 / 500';
        
        // Remove GIF preview
        if (gifPreview) {
            gifPreview.remove();
        }
        
        loadMessages();
    } catch (error) {
        console.error('Post message error:', error);
        alert('Failed to post message: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 Post Message';
    }
};

window.deleteMessage = async function(messageId) {
    if (!isAdmin) return;
    
    if (!confirm('Delete this message?')) return;
    
    try {
        await deleteDoc(doc(db, 'messages', messageId));
        loadMessages();
    } catch (error) {
        console.error('Delete message error:', error);
        alert('Failed to delete message');
    }
};

// Character counter
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            const counter = document.getElementById('charCounter');
            const length = this.value.length;
            counter.textContent = `${length} / 500`;
            counter.classList.toggle('warning', length > 450);
        });
    }
    
    const editor = document.getElementById('challengeEditorText');
    if (editor) {
        editor.addEventListener('input', updateChallengePreview);
    }
});

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== PROFILE FUNCTIONS =====
async function loadUserProfile() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            document.getElementById('profileNickname').value = userData.nickname || '';
            document.getElementById('profileMovement').value = userData.favoriteMovement || '';
            document.getElementById('profileVeggie').value = userData.favoriteVeggie || '';
            document.getElementById('profileGoal').value = userData.challengeGoal || '';
            
            if (userData.photoURL) {
                document.getElementById('profilePhotoDisplay').src = userData.photoURL;
            } else {
                const initials = currentUser.name.split(' ').map(n => n[0]).join('');
                document.getElementById('profilePhotoDisplay').src = 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=9BFB02&color=000&size=120`;
            }
        }
        updateNotificationStatus();

    } catch (error) {
        console.error('Load profile error:', error);
    }
}

window.saveProfile = async function() {
    const nickname = document.getElementById('profileNickname').value.trim();
    const movement = document.getElementById('profileMovement').value.trim();
    const veggie = document.getElementById('profileVeggie').value.trim();
    const goal = document.getElementById('profileGoal').value.trim();
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            nickname: nickname || null,
            favoriteMovement: movement || null,
            favoriteVeggie: veggie || null,
            challengeGoal: goal || null
        });
        
        currentUser.nickname = nickname;
        
        alert('Profile saved! ✅');
    } catch (error) {
        console.error('Save profile error:', error);
        alert('Failed to save profile: ' + error.message);
    }
};

window.uploadProfilePhoto = async function() {
    const fileInput = document.getElementById('photoUpload');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        alert('Photo too large! Please use an image under 5MB.');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPG, PNG, or GIF)');
        return;
    }
    
    try {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Uploading...';
        btn.disabled = true;
        
        let fileToUpload = file;
        if (file.size > 500 * 1024) {
            fileToUpload = await compressImage(file);
        }
        
        const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
        await uploadBytes(storageRef, fileToUpload);
        
        const photoURL = await getDownloadURL(storageRef);
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            photoURL: photoURL
        });
        
        document.getElementById('profilePhotoDisplay').src = photoURL;
        currentUser.photoURL = photoURL;
        
        alert('Photo uploaded! 📸');
        
        btn.textContent = originalText;
        btn.disabled = false;
    } catch (error) {
        console.error('Upload photo error:', error);
        alert('Failed to upload photo: ' + error.message);
        event.target.textContent = '📷 Upload Photo';
        event.target.disabled = false;
    }
};

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const maxDimension = 800;
                
                if (width > height && width > maxDimension) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    } else {
                        reject(new Error('Compression failed'));
                    }
                }, 'image/jpeg', 0.8);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

window.viewUserProfile = async function(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            alert('User not found');
            return;
        }
        
        const userData = userDoc.data();
        const displayName = userData.nickname || userData.name;
        const photoURL = userData.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=9BFB02&color=000&size=120`;
        
        const teamBadge = userData.team && userData.team !== 'none'
            ? `<span class="team-badge team-${userData.team}">${userData.team.toUpperCase()}</span>`
            : '';
        
        const modalContent = `
            <h2>${displayName} ${teamBadge}</h2>
            <div class="profile-container">
                <img src="${photoURL}" class="profile-photo large" alt="Profile Photo">
                <div>
                    <p style="font-size: 1.2em; font-weight: 600;">${userData.name}</p>
                    <p style="color: #666;">Total Points: <strong>${userData.totalPoints || 0}</strong></p>
                </div>
            </div>
            <div class="profile-info-grid">
                ${userData.favoriteMovement ? `
                <div class="profile-info-item">
                    <label>Favorite Movement</label>
                    <div class="value">${userData.favoriteMovement}</div>
                </div>` : ''}
                ${userData.favoriteVeggie ? `
                <div class="profile-info-item">
                    <label>Favorite Veggie</label>
                    <div class="value">${userData.favoriteVeggie}</div>
                </div>` : ''}
                ${userData.challengeGoal ? `
                <div class="profile-info-item">
                    <label>#1 Goal</label>
                    <div class="value">${userData.challengeGoal}</div>
                </div>` : ''}
            </div>
        `;
        
        document.getElementById('profileModalContent').innerHTML = modalContent;
        document.getElementById('profileModal').classList.add('active');
    } catch (error) {
        console.error('View profile error:', error);
        alert('Failed to load profile');
    }
};

window.closeProfileModal = function() {
    document.getElementById('profileModal').classList.remove('active');
};

window.onclick = function(event) {
    const modal = document.getElementById('profileModal');
    if (event.target === modal) {
        closeProfileModal();
    }
};

// ===== ADMIN FUNCTIONS =====
async function loadAdminData() {
    if (!isAdmin) return;

    try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const totalUsers = usersSnapshot.size;
        const visibleUsers = usersSnapshot.docs.filter(doc => !doc.data().hiddenFromLeaderboard).length;

        const checkinsQuery = query(collection(db, 'checkins'));
        const checkinsSnapshot = await getDocs(checkinsQuery);
        const totalCheckins = checkinsSnapshot.size;

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalCheckins').textContent = totalCheckins;
        document.getElementById('visibleUsers').textContent = visibleUsers;

        const windowDoc = await getDoc(doc(db, 'settings', 'checkinWindow'));
        const isOpen = windowDoc.exists() ? windowDoc.data().isOpen !== false : true;
        const statusEl = document.getElementById('windowStatus');
        if (statusEl) {
            statusEl.textContent = isOpen ? 'OPEN' : 'CLOSED';
            statusEl.className = 'window-status ' + (isOpen ? 'open' : 'closed');
        }

        const teamNamesDoc = await getDoc(doc(db, 'settings', 'teamNames'));
        if (teamNamesDoc.exists()) {
            const teamNames = teamNamesDoc.data();
            ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'].forEach(color => {
                const input = document.getElementById(`teamName_${color}`);
                if (input && teamNames[color]) {
                    input.value = teamNames[color];
                }
            });
        }

        const userList = document.getElementById('adminUserList');
        userList.innerHTML = '';

        const users = [];
        usersSnapshot.forEach((doc) => {
            users.push({ uid: doc.id, ...doc.data() });
        });

        users.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            
            const teamBadge = user.team && user.team !== 'none' 
                ? `<span class="team-badge team-${user.team}">${user.team.toUpperCase()}</span>`
                : '<span style="color: #999; font-size: 0.9em;">No Team</span>';
            
            const captainBadge = user.isCaptain 
                ? '<span class="captain-badge">⭐ CAPTAIN</span>'
                : '';

            const isUserAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
            
            const adminButtons = isUserAdmin
                ? `<span class="admin-badge">👑 ADMIN</span>
                   ${user.uid !== currentUser.uid ? `<button class="small-btn btn-danger" onclick="window.demoteFromAdmin('${user.email}', '${user.name}', '${user.uid}')">Remove Admin</button>` : ''}`
                : `<button class="promote-admin-btn" onclick="window.promoteToAdmin('${user.email}', '${user.name}', '${user.uid}')">👑 Make Admin</button>`;
                        
            userItem.innerHTML = `
                <div class="user-info">
                    <strong>${user.name}</strong> ${teamBadge} ${captainBadge}<br>
                    <small>${user.email} • ${user.totalPoints || 0} points</small>
                </div>
                <div class="user-actions">
                    <select class="team-select" onchange="window.assignTeam('${user.uid}', this.value)">
                        <option value="none" ${(!user.team || user.team === 'none') ? 'selected' : ''}>No Team</option>
                        <option value="red" ${user.team === 'red' ? 'selected' : ''}>🔴 Red</option>
                        <option value="blue" ${user.team === 'blue' ? 'selected' : ''}>🔵 Blue</option>
                        <option value="green" ${user.team === 'green' ? 'selected' : ''}>🟢 Green</option>
                        <option value="yellow" ${user.team === 'yellow' ? 'selected' : ''}>🟡 Yellow</option>
                        <option value="purple" ${user.team === 'purple' ? 'selected' : ''}>🟣 Purple</option>
                        <option value="orange" ${user.team === 'orange' ? 'selected' : ''}>🟠 Orange</option>
                        <option value="pink" ${user.team === 'pink' ? 'selected' : ''}>🩷 Pink</option>
                        <option value="teal" ${user.team === 'teal' ? 'selected' : ''}>🩵 Teal</option>
                    </select>
                    <button class="small-btn ${user.isCaptain ? 'btn-show' : 'btn-secondary'}" 
                            onclick="window.toggleCaptain('${user.uid}', ${!user.isCaptain})"
                            style="${user.isCaptain ? 'background: gold; color: #333;' : ''}">
                        ${user.isCaptain ? '⭐ Captain' : 'Make Captain'}
                    </button>
                    ${adminButtons}
                    ${user.hiddenFromLeaderboard 
                        ? `<button class="small-btn btn-show" onclick="window.toggleUserVisibility('${user.uid}', false)">Show</button>`
                        : `<button class="small-btn btn-hide" onclick="window.toggleUserVisibility('${user.uid}', true)">Hide</button>`
                    }
                </div>
            `;
            userList.appendChild(userItem);
        });

        loadAdjustmentUsers();
        loadAdjustmentHistory();
        loadCriteriaList();

    } catch (error) {
        console.error('Admin data error:', error);
    }
}

window.toggleUserVisibility = async function(userId, hide) {
    if (!isAdmin) return;

    try {
        await updateDoc(doc(db, 'users', userId), {
            hiddenFromLeaderboard: hide
        });
        loadAdminData();
        loadLeaderboard();
    } catch (error) {
        console.error('Toggle visibility error:', error);
        alert('Failed to update user visibility');
    }
};

window.assignTeam = async function(userId, team) {
    if (!isAdmin) return;

    try {
        await updateDoc(doc(db, 'users', userId), {
            team: team
        });
        loadAdminData();
        loadLeaderboard();
    } catch (error) {
        console.error('Assign team error:', error);
        alert('Failed to assign team');
    }
};

window.toggleCaptain = async function(userId, makeCaptain) {
    if (!isAdmin) return;

    try {
        await updateDoc(doc(db, 'users', userId), {
            isCaptain: makeCaptain
        });
        loadAdminData();
        loadTeamsPage();
    } catch (error) {
        console.error('Toggle captain error:', error);
        alert('Failed to update captain status');
    }
};

window.updateTeamName = async function(color, name) {
    if (!isAdmin) return;

    try {
        const teamNamesRef = doc(db, 'settings', 'teamNames');
        const teamNamesDoc = await getDoc(teamNamesRef);
        const currentNames = teamNamesDoc.exists() ? teamNamesDoc.data() : {};
        currentNames[color] = name || null;
        
        await setDoc(teamNamesRef, currentNames);
        loadTeamsPage();
    } catch (error) {
        console.error('Update team name error:', error);
        alert('Failed to update team name');
    }
};

async function loadAdjustmentUsers() {
    if (!isAdmin) return;
    
    try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        const select = document.getElementById('adjustmentUser');
        select.innerHTML = '<option value="">Select User...</option>';
        
        const users = [];
        usersSnapshot.forEach((doc) => {
            users.push({ uid: doc.id, ...doc.data() });
        });
        
        users.sort((a, b) => a.name.localeCompare(b.name));
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.uid;
            option.textContent = `${user.name} (${user.totalPoints || 0} pts)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Load adjustment users error:', error);
    }
}

window.applyPointAdjustment = async function() {
    if (!isAdmin) return;
    
    const userId = document.getElementById('adjustmentUser').value;
    const points = parseInt(document.getElementById('adjustmentPoints').value);
    const reason = document.getElementById('adjustmentReason').value.trim();
    
    if (!userId) {
        alert('Please select a user');
        return;
    }
    
    if (isNaN(points) || points === 0) {
        alert('Please enter a point value (positive or negative)');
        return;
    }
    
    if (!reason) {
        alert('Please enter a reason for the adjustment');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            totalPoints: increment(points)
        });
        
        await addDoc(collection(db, 'pointAdjustments'), {
            userId: userId,
            points: points,
            reason: reason,
            adjustedBy: currentUser.email,
            timestamp: new Date().toISOString()
        });
        
        document.getElementById('adjustmentUser').value = '';
        document.getElementById('adjustmentPoints').value = '';
        document.getElementById('adjustmentReason').value = '';
        
        alert(`${points > 0 ? 'Added' : 'Subtracted'} ${Math.abs(points)} points!`);
        
        loadAdjustmentHistory();
        loadAdjustmentUsers();
        loadLeaderboard();
    } catch (error) {
        console.error('Point adjustment error:', error);
        alert('Failed to adjust points: ' + error.message);
    }
};

async function loadAdjustmentHistory() {
    if (!isAdmin) return;
    
    try {
        const q = query(collection(db, 'pointAdjustments'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const historyDiv = document.getElementById('adjustmentHistory');
        
        if (querySnapshot.empty) {
            historyDiv.innerHTML = '<h4 style="margin-bottom: 10px;">Recent Adjustments</h4><p style="color: #999; text-align: center; padding: 20px;">No adjustments yet</p>';
            return;
        }
        
        let html = '<h4 style="margin-bottom: 10px;">Recent Adjustments</h4>';
        
        const userNames = {};
        for (const adjustDoc of querySnapshot.docs) {
            const adj = adjustDoc.data();
            if (!userNames[adj.userId]) {
                const userDoc = await getDoc(doc(db, 'users', adj.userId));
                if (userDoc.exists()) {
                    userNames[adj.userId] = userDoc.data().name;
                }
            }
        }
        
        querySnapshot.forEach((adjustDoc) => {
            const adj = adjustDoc.data();
            const date = new Date(adj.timestamp);
            const timeAgo = getTimeAgo(date);
            const userName = userNames[adj.userId] || 'Unknown User';
            const pointsClass = adj.points > 0 ? 'positive' : 'negative';
            const pointsSign = adj.points > 0 ? '+' : '';
            
            html += `
                <div class="adjustment-item ${pointsClass}">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>${userName}</strong>
                        <strong style="color: ${adj.points > 0 ? '#9BFB02' : '#ff6b6b'};">
                            ${pointsSign}${adj.points} pts
                        </strong>
                    </div>
                    <div style="color: #666; font-size: 0.95em;">${adj.reason}</div>
                    <div style="color: #999; font-size: 0.85em; margin-top: 5px;">
                        ${timeAgo} • by ${adj.adjustedBy}
                    </div>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
    } catch (error) {
        console.error('Load adjustment history error:', error);
    }
}

window.promoteToAdmin = async function(email, name, userId) {
    if (!isAdmin) return;
    
    const confirmed = confirm(
        `Promote ${name} (${email}) to admin?\n\nThey will have admin access immediately!`
    );
    
    if (!confirmed) return;
    
    try {
        await setDoc(doc(db, 'adminUsers', userId), {
            email: email,
            name: name,
            promotedBy: currentUser.email,
            promotedAt: new Date().toISOString()
        });
        
        if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
            ADMIN_EMAILS.push(email.toLowerCase());
        }
        
        loadAdminData();
        
        alert(`✅ ${name} is now an admin!`);
    } catch (error) {
        console.error('Promote to admin error:', error);
        alert('Failed to promote to admin: ' + error.message);
    }
};

window.demoteFromAdmin = async function(email, name, userId) {
    if (!isAdmin) return;
    
    if (userId === currentUser.uid) {
        alert("You can't demote yourself!");
        return;
    }
    
    const confirmed = confirm(`Remove admin access from ${name}?`);
    
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'adminUsers', userId));
        
        const index = ADMIN_EMAILS.indexOf(email.toLowerCase());
        if (index > -1) {
            ADMIN_EMAILS.splice(index, 1);
        }
        
        loadAdminData();
        
        alert(`✅ ${name}'s admin access has been removed.`);
    } catch (error) {
        console.error('Demote from admin error:', error);
        alert('Failed to remove admin access: ' + error.message);
    }
};

async function loadAdminUsers() {
    try {
        const adminQuery = query(collection(db, 'adminUsers'));
        const adminSnapshot = await getDocs(adminQuery);
        
        const hardcodedAdmins = ADMIN_EMAILS.slice();
        ADMIN_EMAILS.length = 0;
        
        hardcodedAdmins.forEach(email => ADMIN_EMAILS.push(email));
        
        adminSnapshot.forEach((doc) => {
            const adminData = doc.data();
            if (!ADMIN_EMAILS.includes(adminData.email.toLowerCase())) {
                ADMIN_EMAILS.push(adminData.email.toLowerCase());
            }
        });
    } catch (error) {
        console.error('Load admin users error:', error);
    }
}

// CSV Export Functions
window.exportUsersCSV = async function() {
    if (!isAdmin) return;

    try {
        const usersQuery = query(collection(db, 'users'), orderBy('totalPoints', 'desc'));
        const usersSnapshot = await getDocs(usersQuery);

        let csv = 'Name,Email,Team,Total Points,Hidden from Leaderboard,Registered At,Last Check-in\n';

        usersSnapshot.forEach((doc) => {
            const user = doc.data();
            csv += `"${user.name}","${user.email}","${user.team || 'none'}",${user.totalPoints || 0},${user.hiddenFromLeaderboard ? 'Yes' : 'No'},"${user.registeredAt || ''}","${user.lastCheckin || ''}"\n`;
        });

        downloadCSV(csv, 'reset-2026-users.csv');
    } catch (error) {
        console.error('Export users error:', error);
        alert('Failed to export users');
    }
};

window.exportCheckinsCSV = async function() {
    if (!isAdmin) return;

    try {
        const checkinsQuery = query(collection(db, 'checkins'), orderBy('timestamp', 'desc'));
        const checkinsSnapshot = await getDocs(checkinsQuery);

        let csv = 'Name,Email,Weekly Score,Protein Days,Water Days,Classes,Recovery Days,Weekly Challenge,Alcohol Days,Late Days,Missed Check-in,Timestamp\n';

        checkinsSnapshot.forEach((doc) => {
            const checkin = doc.data();
            const d = checkin.details || {};
            csv += `"${checkin.name}","${checkin.email}",${checkin.weeklyScore},${d.protein || 0},${d.water || 0},${d.classes || 0},${d.recovery || 0},${d.weekly || 0},${d.alcohol || 0},${d.late || 0},${d.missed || 0},"${checkin.timestamp}"\n`;
        });

        downloadCSV(csv, 'reset-2026-checkins.csv');
    } catch (error) {
        console.error('Export check-ins error:', error);
        alert('Failed to export check-ins');
    }
};

window.exportTeamData = async function(teamColor) {
    if (!isAdmin) return;

    try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);

        let csv = 'Name,Email,Team,Total Points,Hidden from Leaderboard,Registered At,Last Check-in\n';

        usersSnapshot.forEach((doc) => {
            const user = doc.data();
            if (user.team === teamColor) {
                csv += `"${user.name}","${user.email}","${user.team || 'none'}",${user.totalPoints || 0},${user.hiddenFromLeaderboard ? 'Yes' : 'No'},"${user.registeredAt || ''}","${user.lastCheckin || ''}"\n`;
            }
        });

        if (csv.split('\n').length <= 2) {
            alert(`No members found on ${teamColor} team`);
            return;
        }

        downloadCSV(csv, `reset-2026-${teamColor}-team.csv`);
    } catch (error) {
        console.error('Export team error:', error);
        alert('Failed to export team data');
    }
};

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// ===== EDITABLE CRITERIA SYSTEM =====

// Load criteria for check-in form
async function loadCheckInCriteria() {
    try {
        const q = query(collection(db, 'criteria'), orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        
        const container = document.getElementById('dynamicCriteria');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p style="text-align: center; padding: 30px; color: #999;">No criteria available yet. Contact your admin!</p>';
            return;
        }
        
        let html = '';
        const earns = [];
        const deductions = [];
        
        querySnapshot.forEach((doc) => {
            const criteria = { id: doc.id, ...doc.data() };
            if (criteria.points >= 0) {
                earns.push(criteria);
            } else {
                deductions.push(criteria);
            }
        });
        
        // Earn points section
        if (earns.length > 0) {
            html += '<h3 style="color: #9BFB02; margin: 30px 0 15px 0;">💪 Earn Points</h3>';
            earns.forEach(criteria => {
                html += renderCheckInCriteria(criteria);
            });
        }
        
        // Deductions section
        if (deductions.length > 0) {
            html += '<h3 style="color: #ff6b6b; margin: 30px 0 15px 0;">⚠️ Deductions</h3>';
            deductions.forEach(criteria => {
                html += renderCheckInCriteria(criteria);
            });
        }
        
        container.innerHTML = html;
        
        // Add event listeners to all checkboxes
        document.querySelectorAll('#dynamicCriteria input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', calculateDynamicScore);
        });
        
        calculateDynamicScore();
        
    } catch (error) {
        console.error('Load check-in criteria error:', error);
        document.getElementById('dynamicCriteria').innerHTML = 
            '<p style="text-align: center; padding: 30px; color: #ff6b6b;">Error loading criteria</p>';
    }
}

function renderCheckInCriteria(criteria) {
    const isDeduction = criteria.points < 0;
    const itemClass = isDeduction ? 'challenge-item deduction-item' : 'challenge-item';
    const pointsClass = isDeduction ? 'challenge-points deduction-points' : 'challenge-points';
    const pointsLabel = `${criteria.points > 0 ? '+' : ''}${criteria.points} pts${criteria.type === 'daily' ? '/day' : ''}`;
    
    if (criteria.type === 'daily') {
        return `
            <div class="${itemClass}" data-criteria-id="${criteria.id}">
                <div class="challenge-header">
                    <span class="challenge-name">${criteria.name}</span>
                    <span class="${pointsClass}">${pointsLabel}</span>
                </div>
                <div class="days-grid">
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_mon" class="criteria-check" data-points="${criteria.points}">
                        <label>Mon</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_tue" class="criteria-check" data-points="${criteria.points}">
                        <label>Tue</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_wed" class="criteria-check" data-points="${criteria.points}">
                        <label>Wed</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_thu" class="criteria-check" data-points="${criteria.points}">
                        <label>Thu</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_fri" class="criteria-check" data-points="${criteria.points}">
                        <label>Fri</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_sat" class="criteria-check" data-points="${criteria.points}">
                        <label>Sat</label>
                    </div>
                    <div class="day-checkbox">
                        <input type="checkbox" id="${criteria.id}_sun" class="criteria-check" data-points="${criteria.points}">
                        <label>Sun</label>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Weekly single checkbox
        const checkboxClass = isDeduction ? 'single-checkbox deduction' : 'single-checkbox';
        return `
            <div class="${itemClass}" data-criteria-id="${criteria.id}">
                <div class="challenge-header">
                    <span class="challenge-name">${criteria.name}</span>
                    <span class="${pointsClass}">${pointsLabel}</span>
                </div>
                <div class="${checkboxClass}">
                    <input type="checkbox" id="${criteria.id}" class="criteria-check" data-points="${criteria.points}">
                    <label for="${criteria.id}">Completed</label>
                </div>
            </div>
        `;
    }
}

function calculateDynamicScore() {
    let total = 0;
    
    document.querySelectorAll('.criteria-check:checked').forEach(checkbox => {
        const points = parseInt(checkbox.dataset.points);
        total += points;
    });
    
    document.getElementById('totalScore').textContent = `Total Weekly Score: ${total} points`;
}

// Load criteria for admin panel
async function loadCriteriaList() {
    if (!isAdmin) return;
    
    try {
        const q = query(collection(db, 'criteria'), orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        
        const criteriaList = document.getElementById('criteriaList');
        
        if (querySnapshot.empty) {
            criteriaList.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No criteria yet. Click "Add New Criteria" to create one!</p>';
            return;
        }
        
        let html = '';
        querySnapshot.forEach((doc) => {
            const criteria = { id: doc.id, ...doc.data() };
            html += renderCriteriaItem(criteria);
        });
        
        criteriaList.innerHTML = html;
    } catch (error) {
        console.error('Load criteria error:', error);
    }
}

function renderCriteriaItem(criteria) {
    const isDeduction = criteria.points < 0;
    const typeLabel = criteria.type === 'daily' ? '📅 Daily' : '📋 Weekly';
    const pointsLabel = `${criteria.points > 0 ? '+' : ''}${criteria.points} pts${criteria.type === 'daily' ? '/day' : ''}`;
    
    return `
        <div class="criteria-item ${isDeduction ? 'deduction' : ''}">
            <div class="criteria-header">
                <div class="criteria-info">
                    <div class="criteria-name-display">${criteria.name}</div>
                    <div class="criteria-details">${typeLabel} • ${pointsLabel}</div>
                </div>
                <div class="criteria-actions">
                    <button class="icon-btn" onclick="editCriteria('${criteria.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="icon-btn" onclick="deleteCriteria('${criteria.id}', '${criteria.name}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="criteria-edit-form" id="edit-${criteria.id}">
                <div class="criteria-form-row">
                    <input type="text" class="criteria-input" id="name-${criteria.id}" value="${criteria.name}" placeholder="Criteria name">
                    <input type="number" class="criteria-input" id="points-${criteria.id}" value="${criteria.points}" placeholder="Points">
                </div>
                <div class="criteria-form-row">
                    <select class="criteria-input" id="type-${criteria.id}">
                        <option value="daily" ${criteria.type === 'daily' ? 'selected' : ''}>Daily (7 checkboxes)</option>
                        <option value="weekly" ${criteria.type === 'weekly' ? 'selected' : ''}>Weekly (single checkbox)</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn btn-secondary" onclick="saveCriteria('${criteria.id}')" style="flex: 1;">
                        💾 Save
                    </button>
                    <button class="btn" onclick="cancelEdit('${criteria.id}')" style="flex: 1; background: #999;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Add new criteria
window.addNewCriteria = async function() {
    if (!isAdmin) return;
    
    const name = prompt('Criteria name (e.g., "Hit Protein Goal"):');
    if (!name) return;
    
    const points = prompt('Points value (use negative for deductions):');
    if (!points) return;
    
    const type = confirm('Is this a DAILY criteria?\n\nClick OK for Daily (7 checkboxes)\nClick Cancel for Weekly (single checkbox)') ? 'daily' : 'weekly';
    
    try {
        // Get current max order
        const q = query(collection(db, 'criteria'), orderBy('order', 'desc'));
        const snapshot = await getDocs(q);
        const maxOrder = snapshot.empty ? 0 : snapshot.docs[0].data().order;
        
        await addDoc(collection(db, 'criteria'), {
            name: name,
            points: parseInt(points),
            type: type,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        });
        
        alert('Criteria added! ✅');
        loadCriteriaList();
        
    } catch (error) {
        console.error('Add criteria error:', error);
        alert('Failed to add criteria: ' + error.message);
    }
};

// Edit criteria
window.editCriteria = function(id) {
    const form = document.getElementById(`edit-${id}`);
    form.classList.toggle('active');
};

window.cancelEdit = function(id) {
    const form = document.getElementById(`edit-${id}`);
    form.classList.remove('active');
};

window.saveCriteria = async function(id) {
    if (!isAdmin) return;
    
    const name = document.getElementById(`name-${id}`).value;
    const points = parseInt(document.getElementById(`points-${id}`).value);
    const type = document.getElementById(`type-${id}`).value;
    
    if (!name || isNaN(points)) {
        alert('Please fill in all fields!');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'criteria', id), {
            name: name,
            points: points,
            type: type,
            updatedAt: new Date().toISOString()
        });
        
        alert('Criteria updated! ✅');
        loadCriteriaList();
        
    } catch (error) {
        console.error('Save criteria error:', error);
        alert('Failed to save: ' + error.message);
    }
};

// Delete criteria
window.deleteCriteria = async function(id, name) {
    if (!isAdmin) return;
    
    const confirmed = confirm(`Delete "${name}"?\n\nThis will remove it from future check-ins.`);
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'criteria', id));
        alert('Criteria deleted! ✅');
        loadCriteriaList();
    } catch (error) {
        console.error('Delete criteria error:', error);
        alert('Failed to delete: ' + error.message);
    }
};
// ===== MOBILE MENU =====
window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobileNavMenu');
    const overlay = document.getElementById('mobileNavOverlay');
    const hamburger = document.getElementById('hamburgerMenu');
    
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
};

window.mobileShowSection = function(sectionName) {
    // Close mobile menu
    toggleMobileMenu();
    
    // Show section
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');

    if (sectionName === 'checkin') {
        loadCheckInCriteria();
    }
    if (sectionName === 'leaderboard') {
        loadLeaderboard();
    } else if (sectionName === 'teams') {
        loadTeamsPage();
    } else if (sectionName === 'locker') {
         loadWeeklyChallenge();
        loadMessages();
        initTeamChat();
    } else if (sectionName === 'profile') {
        loadUserProfile();
    } else if (sectionName === 'admin' && isAdmin) {
        loadAdminData();
    }
};
// ===== TEAM CHAT SYSTEM =====
let currentTeamChannel = null;

window.switchTeamChannel = function(teamColor) {
    currentTeamChannel = teamColor;
    
    // Update button states
    document.querySelectorAll('.team-channel-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show channel name
    const teamNames = {
        red: '🔴 Red Team',
        blue: '🔵 Blue Team',
        green: '🟢 Green Team',
        yellow: '🟡 Yellow Team',
        purple: '🟣 Purple Team',
        orange: '🟠 Orange Team',
        pink: '🩷 Pink Team',
        teal: '🩵 Teal Team'
    };
    document.getElementById('currentChannelName').textContent = `Current Channel: ${teamNames[teamColor]}`;
    
    // Show message input if user is on this team
    if (currentUser.team === teamColor || isAdmin) {
        document.getElementById('teamMessageInput').style.display = 'block';
    } else {
        document.getElementById('teamMessageInput').style.display = 'none';
    }
    
    loadTeamMessages();
};

window.postTeamMessage = async function() {
    const input = document.getElementById('teamMessageText');
    const text = input.value.trim();
    
    // Check for GIF preview - UPDATED LINE
    const container = input.closest('.message-input');
    const gifPreview = container ? container.querySelector('.gif-preview') : null;
    const gifUrl = gifPreview ? gifPreview.dataset.gifUrl : null;
    const gifTitle = gifPreview ? gifPreview.dataset.gifTitle : null;
    
    // Must have either text or GIF
    if (!text && !gifUrl) {
        alert('Please enter a message or select a GIF!');
        return;
    }
    
    if (text.length > 500) {
        alert('Message too long! Keep it under 500 characters.');
        return;
    }
    
    if (!currentTeamChannel) {
        alert('Please select a team channel first!');
        return;
    }
    
    if (currentUser.team !== currentTeamChannel && !isAdmin) {
        alert('You can only post to your own team channel!');
        return;
    }
    
    const btn = document.getElementById('postTeamMessageBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';
    
    try {
        const messageData = {
            text: text,
            userName: currentUser.name,
            userId: currentUser.uid,
            team: currentTeamChannel,
            photoURL: currentUser.photoURL || null,
            timestamp: new Date().toISOString()
        };
        
        // Add GIF data if present
        if (gifUrl) {
            messageData.gifUrl = gifUrl;
            messageData.gifTitle = gifTitle;
        }
        
        await addDoc(collection(db, 'teamMessages'), messageData);
        
        input.value = '';
        document.getElementById('teamCharCounter').textContent = '0 / 500';
        
        // Remove GIF preview
        if (gifPreview) {
            gifPreview.remove();
        }
        
        loadTeamMessages();
    } catch (error) {
        console.error('Post team message error:', error);
        alert('Failed to post message: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 Post to Team';
    }
};

window.deleteTeamMessage = async function(messageId) {
    if (!isAdmin) return;
    if (!confirm('Delete this team message?')) return;
    
    try {
        await deleteDoc(doc(db, 'teamMessages', messageId));
        loadTeamMessages();
    } catch (error) {
        console.error('Delete team message error:', error);
        alert('Failed to delete message');
    }
};

// Initialize team chat when locker room loads
function initTeamChat() {
    // Show user's team channel button
    if (currentUser.team && currentUser.team !== 'none') {
        const userTeamBtn = document.querySelector(`.team-channel-btn.team-${currentUser.team}`);
        if (userTeamBtn) {
            userTeamBtn.style.display = 'block';
            userTeamBtn.classList.add('active');
            currentTeamChannel = currentUser.team;
            switchTeamChannel(currentUser.team);
        }
    }
    
    // If admin, show all team buttons
   // If admin, show all team buttons
if (isAdmin) {
    console.log('Admin detected, showing all team buttons');
    document.querySelectorAll('.team-channel-btn').forEach(btn => {
        btn.style.display = 'block';
    });
    }
}

// Character counter for team messages
document.addEventListener('DOMContentLoaded', function() {
    const teamMessageInput = document.getElementById('teamMessageText');
    if (teamMessageInput) {
        teamMessageInput.addEventListener('input', function() {
            const counter = document.getElementById('teamCharCounter');
            const length = this.value.length;
            counter.textContent = `${length} / 500`;
            counter.classList.toggle('warning', length > 450);
        });
    }
});
// ===== WEEKLY WINNERS SYSTEM =====

window.announceWeeklyWinners = async function() {
    if (!isAdmin) return;
    
    const confirmed = confirm('This will post the weekly winners to the Locker Room. Continue?');
    if (!confirmed) return;
    
    try {
        // Get all users
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        let topIndividual = { name: 'None', points: 0, team: 'none' };
        const teamTotals = {
            red: { points: 0, members: 0, name: 'Red Team' },
            blue: { points: 0, members: 0, name: 'Blue Team' },
            green: { points: 0, members: 0, name: 'Green Team' },
            yellow: { points: 0, members: 0, name: 'Yellow Team' },
            purple: { points: 0, members: 0, name: 'Purple Team' },
            orange: { points: 0, members: 0, name: 'Orange Team' },
            pink: { points: 0, members: 0, name: 'Pink Team' },
            teal: { points: 0, members: 0, name: 'Teal Team' }
        };
        
        // Calculate individual and team winners
        usersSnapshot.forEach((doc) => {
            const user = doc.data();
            if (user.hiddenFromLeaderboard) return;
            
            const points = user.totalPoints || 0;
            
            // Track top individual
            if (points > topIndividual.points) {
                topIndividual = {
                    name: user.name,
                    points: points,
                    team: user.team || 'none'
                };
            }
            
            // Track team totals
            const team = user.team || 'none';
            if (teamTotals[team]) {
                teamTotals[team].points += points;
                teamTotals[team].members += 1;
            }
        });
        
        // Find winning team
        let topTeam = { name: 'None', points: 0, members: 0 };
        Object.entries(teamTotals).forEach(([color, data]) => {
            if (data.members > 0 && data.points > topTeam.points) {
                topTeam = {
                    name: data.name,
                    points: data.points,
                    members: data.members,
                    color: color
                };
            }
        });
        
        // Get week number (weeks since Jan 1, 2026)
        const startDate = new Date('2026-01-01');
        const today = new Date();
        const weekNumber = Math.floor((today - startDate) / (7 * 24 * 60 * 60 * 1000)) + 1;
        
        // Create announcement message
        const announcement = `🏆 WEEK ${weekNumber} WINNERS! 🏆

🥇 TOP PERFORMER
${topIndividual.name} with ${topIndividual.points} points!

🏅 WINNING TEAM
${topTeam.name.toUpperCase()} with ${topTeam.points} points (${topTeam.members} members)

Keep crushing it! Next week starts now! 💪`;
        
        // Post to main Locker Room
        await addDoc(collection(db, 'messages'), {
            text: announcement,
            userName: '🏆 Weekly Winners Bot',
            userId: 'system',
            team: 'none',
            photoURL: null,
            timestamp: new Date().toISOString()
        });
        
        alert('Weekly winners announced! 🎉');
        loadMessages();
        
    } catch (error) {
        console.error('Announce winners error:', error);
        alert('Failed to announce winners: ' + error.message);
    }
};

// ===== GIPHY INTEGRATION =====
// Add this to your app.js file

const GIPHY_API_KEY = 'J0YCFCoA6FVyERMMdZsQ2tqak05QhycA';

// Global state for GIF modal
let currentGifContext = null; // 'main' or 'team'

// Open Giphy modal
window.openGiphyModal = function(context) {
    currentGifContext = context; // 'main' or 'team'
    document.getElementById('giphyModal').classList.add('active');
    document.getElementById('giphySearchInput').value = '';
    document.getElementById('giphyResults').innerHTML = '';
    loadTrendingGifs();
};

// Close Giphy modal
window.closeGiphyModal = function() {
    document.getElementById('giphyModal').classList.remove('active');
    currentGifContext = null;
};

// Load trending GIFs on modal open
async function loadTrendingGifs() {
    const resultsDiv = document.getElementById('giphyResults');
    resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">Loading trending GIFs...</p>';
    
    try {
        const response = await fetch(
            `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
        );
        const data = await response.json();
        displayGiphyResults(data.data);
    } catch (error) {
        console.error('Load trending GIFs error:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #ff6b6b;">Failed to load GIFs</p>';
    }
}

// Search GIFs
window.searchGiphy = async function() {
    const searchTerm = document.getElementById('giphySearchInput').value.trim();
    
    if (!searchTerm) {
        loadTrendingGifs();
        return;
    }
    
    const resultsDiv = document.getElementById('giphyResults');
    resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px;">Searching...</p>';
    
    try {
        const response = await fetch(
            `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=20&rating=pg-13`
        );
        const data = await response.json();
        
        if (data.data.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No GIFs found. Try another search!</p>';
            return;
        }
        
        displayGiphyResults(data.data);
    } catch (error) {
        console.error('Search Giphy error:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #ff6b6b;">Search failed. Please try again.</p>';
    }
};

// Display GIF results in grid
function displayGiphyResults(gifs) {
    const resultsDiv = document.getElementById('giphyResults');
    
    resultsDiv.innerHTML = gifs.map(gif => `
        <div class="gif-item" onclick="selectGif('${gif.images.fixed_height.url}', '${gif.title.replace(/'/g, "\\'")}', '${currentGifContext}')">
            <img src="${gif.images.fixed_height.url}" alt="${gif.title}" loading="lazy">
        </div>
    `).join('');
}

// Select a GIF and show preview
window.selectGif = function(gifUrl, gifTitle, context) {
    console.log('selectGif called!');
    console.log('gifUrl:', gifUrl);
    console.log('gifTitle:', gifTitle);
    console.log('context:', context);
    
    closeGiphyModal();
    
    if (context === 'main') {
        showGifPreview('messageInput', gifUrl, gifTitle);
    } else if (context === 'team') {
        showGifPreview('teamMessageInput', gifUrl, gifTitle);
    }
};

// Show GIF preview in message area
function showGifPreview(inputId, gifUrl, gifTitle) {
    console.log('showGifPreview called with:', inputId);
    
    // Get the textarea
    const textarea = document.getElementById(inputId === 'messageInput' ? 'messageInput' : 'teamMessageText');
    
    if (!textarea) {
        console.error('Textarea not found!', inputId);
        return;
    }
    
    // Get the parent container (the .message-input div)
    const container = textarea.closest('.message-input');
    
    if (!container) {
        console.error('Container not found!');
        return;
    }
    
    console.log('Container found:', container);
    
    // Remove any existing preview
    const existingPreview = container.querySelector('.gif-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview element
    const preview = document.createElement('div');
    preview.className = 'gif-preview';
    preview.innerHTML = `
        <div style="position: relative; display: inline-block; margin: 10px 0;">
            <img src="${gifUrl}" alt="${gifTitle}" style="max-width: 200px; border-radius: 8px; display: block;">
            <button onclick="removeGifPreview('${inputId}')" type="button" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 16px; line-height: 1;">×</button>
            <div style="font-size: 0.85em; color: #666; margin-top: 5px;">${gifTitle}</div>
        </div>
    `;
    
    // Store GIF data as attributes
    preview.dataset.gifUrl = gifUrl;
    preview.dataset.gifTitle = gifTitle;
    
    // Insert preview between textarea and footer
    const footer = container.querySelector('.message-input-footer');
    container.insertBefore(preview, footer);
    
    console.log('Preview added!');
}

// Remove GIF preview
window.removeGifPreview = function(inputId) {
    const textarea = document.getElementById(inputId === 'messageInput' ? 'messageInput' : 'teamMessageText');
    if (!textarea) return;
    
    const container = textarea.closest('.message-input');
    if (!container) return;
    
    const preview = container.querySelector('.gif-preview');
    if (preview) {
        preview.remove();
    }
};


// Add Enter key support for Giphy search
document.addEventListener('DOMContentLoaded', function() {
    const giphyInput = document.getElementById('giphySearchInput');
    if (giphyInput) {
        giphyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchGiphy();
            }
        });
    }
});
// Call updateNotificationStatus when profile loads
// Add this to your loadUserProfile() function at the end:
// updateNotificationStatus();

// Show notification banner on login
// Add this to your showApp() function at the end:
// showNotificationBanner();
// Initialize score display

