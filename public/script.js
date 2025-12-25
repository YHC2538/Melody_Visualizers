/* 背景動態邏輯 */
(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let notes = [];
    const notePath1 = new Path2D("M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z");
    const notePath2 = new Path2D("M18 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h6V3h-8z");
    const notePaths = [notePath1, notePath2];
    class Note {
        constructor() { this.init(); }
        init() {
            this.x = Math.random() * width; this.y = height + Math.random() * 100;
            this.size = Math.random() * 1.5 + 0.5; this.speed = Math.random() * 0.5 + 0.2;
            this.rotation = Math.random() * 360; this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            this.path = notePaths[Math.floor(Math.random() * notePaths.length)]; this.opacity = Math.random() * 0.4 + 0.2;
        }
        update() { this.y -= this.speed; this.rotation += this.rotationSpeed; if (this.y < -50) { this.init(); this.y = height + 50; } }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation); ctx.scale(this.size * 2, this.size * 2);
            ctx.shadowColor = "rgba(0, 0, 0, 0.1)"; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.fill(this.path);
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity + 0.1})`; ctx.lineWidth = 0.5; ctx.stroke(this.path);
            ctx.restore();
        }
    }
    function initCanvas() { resize(); const noteCount = Math.floor(width * 0.02); notes = []; for (let i = 0; i < noteCount; i++) { const note = new Note(); note.y = Math.random() * height; notes.push(note); } animate(); }
    function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; }
    function animate() { ctx.clearRect(0, 0, width, height); notes.forEach(note => { note.update(); note.draw(); }); requestAnimationFrame(animate); }
    window.addEventListener('resize', () => { resize(); }); initCanvas();
})();

/* Toast */
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    if (duration > 0) {
        setTimeout(() => { removeToast(toast); }, duration);
    }
    return toast;
}

function removeToast(toastElement) {
    if (!toastElement) return;
    toastElement.classList.remove('show');
    setTimeout(() => {
        if (toastElement.parentNode) toastElement.parentNode.removeChild(toastElement);
    }, 300);
}

/* 全域播放器控制&歷史紀錄管理 */
let isFloatingPlayerClosed = false;
function closeFloatingPlayer() {
    if (window.playerStop) window.playerStop();
    document.getElementById('floating-player').style.display = 'none';
    isFloatingPlayerClosed = true;
}

const STORAGE_KEY = 'melody_visualizer_creations';
const MAX_HISTORY = 10;
let currentHistoryIndex = -1;

function getHistory() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveCreationToHistory(midiFilename, params) {
    let history = getHistory();
    const newRecord = { id: Date.now(), date: new Date().toLocaleString(), midi: midiFilename, video: null, params: params };
    history.unshift(newRecord);
    if (history.length > MAX_HISTORY) history.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
}

function updateHistoryVideo(midiFilename, videoUrl) {
    let history = getHistory();
    const index = history.findIndex(item => item.midi === midiFilename);
    if (index !== -1) {
        history[index].video = videoUrl;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        renderHistory();
    }
}

function clearHistory() { document.getElementById('clear-history-modal').style.display = 'flex'; }

function confirmClearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    hideBottomPlayer();
    if (window.playerStop) window.playerStop();
    closeClearHistoryModal();
    showToast("紀錄已清除", "success");
    renderHomeShowcase();
}

function closeClearHistoryModal() { document.getElementById('clear-history-modal').style.display = 'none'; }

let pendingDeleteId = null;
function deleteCreation(id) { pendingDeleteId = id; document.getElementById('delete-single-modal').style.display = 'flex'; }
function closeDeleteSingleModal() { pendingDeleteId = null; document.getElementById('delete-single-modal').style.display = 'none'; }

function confirmDeleteSingle() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    let history = getHistory();
    if (currentHistoryIndex !== -1 && history[currentHistoryIndex] && history[currentHistoryIndex].id === id) {
        if (window.playerStop) window.playerStop();
        hideBottomPlayer();
        currentHistoryIndex = -1;
    }
    history = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
    renderHomeShowcase();
    closeDeleteSingleModal();
    showToast("創作已刪除", "success");
}

/* 影片播放視窗&最愛功能 */
function openVideoModal(url) {
    const modal = document.getElementById('video-playback-modal');
    const video = document.getElementById('modal-video-player');
    video.src = url;
    modal.style.display = 'flex';
    video.play();
}

function closeVideoModal() {
    const modal = document.getElementById('video-playback-modal');
    const video = document.getElementById('modal-video-player');
    video.pause();
    video.src = "";
    modal.style.display = 'none';
}

function toggleFavorite(id) {
    let history = getHistory();
    const index = history.findIndex(item => item.id === id);
    if (index !== -1) {
        history[index].isFavorite = !history[index].isFavorite;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        if (history[index].isFavorite) {
            showToast("已加入最愛，將顯示於首頁 Spotlight！", "success");
        } else {
            showToast("已取消最愛", "info");
        }
        renderHistory();
        renderHomeShowcase();
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const history = getHistory();

    if (history.length === 0) {
        list.innerHTML = '<p style="color:#666; text-align:center; padding: 20px;">尚無創作紀錄。</p>';
        return;
    }

    list.innerHTML = '';

    history.forEach((item, index) => {
        const hasVideo = !!item.video;
        const isFav = !!item.isFavorite;
        const paramText = `Key: ${document.querySelector(`#key option[value="${item.params.key}"]`)?.innerText || item.params.key} | ${item.params.scale} | ${item.params.tempo} BPM`;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'glass-btn-style';
        itemDiv.style.borderRadius = '16px';
        itemDiv.style.padding = '20px';
        itemDiv.style.cursor = 'pointer';

        itemDiv.onclick = function (e) {
            if (e.target.closest('button') || e.target.closest('a')) return;
            playHistoryIndex(index);
        };

        itemDiv.innerHTML = `
    <div class="history-card-inner">
        <div class="history-info-group">
            <div class="creation-icon-box"><i class="fas fa-music"></i></div>
            <div class="history-text-col">
                <div style="display:flex; align-items:center; gap:8px; width:100%;">
                    <h4 class="history-title">Creation #${item.id.toString().slice(-4)}</h4>
                    ${isFav ? '<i class="fas fa-heart" style="font-size:12px; color:#ff4081;"></i>' : ''}
                </div>
                <div style="font-size:12px; color:#666;">${item.date}</div>
                <div style="font-size:11px; color:#888; margin-top:4px;">${paramText}</div>
            </div>
        </div>

        <div class="history-actions-group">
            <button onclick="toggleFavorite(${item.id}); event.stopPropagation();" class="btn-favorite ${isFav ? 'active' : ''}" title="加到最愛">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>

            <div class="history-divider"></div>

            <button onclick="playHistoryIndex(${index}); event.stopPropagation();" class="player-circle-btn" style="width:40px; height:40px; font-size:14px; flex-shrink:0;" title="Play">
                <i class="fas fa-play"></i>
            </button>

            <div class="history-download-col">
                <a href="midi/${item.midi}" download="${item.midi}" onclick="event.stopPropagation()" class="action-btn" style="padding:5px 10px; font-size:11px; height:fit-content; border-radius:8px; display:flex; gap:5px; align-items:center; width:100%; justify-content:center;">
                    <i class="fas fa-download"></i> MIDI
                </a>
                ${hasVideo ? `<button onclick="openVideoModal('${item.video}'); event.stopPropagation();" class="action-btn" style="padding:5px 10px; font-size:11px; height:fit-content; border-radius:8px; display:flex; gap:5px; align-items:center; color:#2196f3; border-color:#bbdefb; width:100%; justify-content:center;">
                            <i class="fas fa-film"></i> 影片
                        </button>` : ''}
            </div>

            <button onclick="deleteCreation(${item.id}); event.stopPropagation();" class="action-btn history-delete-btn" style="width:40px; height:40px; padding:0; font-size:14px; color:#f44336; border-color:#ffcdd2; display:flex; justify-content:center; align-items:center; flex-shrink:0;" title="刪除">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </div>`;

        list.appendChild(itemDiv);
    });
}

function showBottomPlayer() {
    document.getElementById('bottom-player').classList.add('active');
    document.getElementById('creations-screen').classList.add('has-player');
    document.getElementById('floating-player').style.display = 'none';
}

function hideBottomPlayer() {
    document.getElementById('bottom-player').classList.remove('active');
    document.getElementById('creations-screen').classList.remove('has-player');
    document.getElementById('floating-player').style.display = 'none';
}

function showFloatingPlayer() {
    if (isFloatingPlayerClosed) return;
    document.getElementById('bottom-player').classList.remove('active');
    document.getElementById('floating-player').style.display = 'flex';
}

function validateInput(event) {
    const input = event.target;
    let value = parseInt(input.value);
    if (isNaN(value)) return;
    if (value < parseInt(input.min)) { value = parseInt(input.min); showToast(`${input.id === 'bars' ? '小節數' : 'BPM'} 最低為 ${input.min}`, "error"); }
    else if (value > parseInt(input.max)) { value = parseInt(input.max); showToast(`${input.id === 'bars' ? '小節數' : 'BPM'} 最高為 ${input.max}`, "error"); }
    setTimeout(() => { input.value = value; }, 200);
}

/* 成就系統 */
function updateBestScore(newScore) {
    const currentBest = parseInt(localStorage.getItem('melody_best_score') || 0);
    if (newScore > currentBest) {
        localStorage.setItem('melody_best_score', newScore);
        showToast("🏆 新紀錄！最佳成績已更新！", "success");
    }
    renderBestScore();
}
function renderBestScore() {
    const best = localStorage.getItem('melody_best_score');
    const display = document.getElementById('display-best-score');
    if (display) { display.innerText = best ? `${best} 分` : "尚未挑戰"; }
}

const ACHIEVEMENT_KEY = 'melody_achievements';
const SHOWCASE_KEY = 'melody_showcase';

const achievementsData = [
    { id: 'first_melody', title: '初試啼聲', desc: '生成您的第一首 MIDI 旋律', icon: 'fa-music', rarity: 'common' },
    { id: 'creator_novice', title: '創作新手', desc: '累積生成 5 次旋律', icon: 'fa-pencil-alt', rarity: 'rare' },
    { id: 'blues_traveler', title: '藍調旅人', desc: '使用 Blues 音階生成音樂', icon: 'fa-guitar', rarity: 'rare' },
    { id: 'speed_demon', title: '極速快感', desc: '生成 BPM 超過 180 的音樂', icon: 'fa-tachometer-alt', rarity: 'epic' },
    { id: 'slow_jam', title: '慢活時光', desc: '生成 BPM 低於 70 的音樂', icon: 'fa-couch', rarity: 'common' },
    { id: 'film_maker', title: '電影大師', desc: '成功渲染出一部影片', icon: 'fa-video', rarity: 'epic' },
    { id: 'pitch_perfect', title: '絕對音感', desc: '在 Expert 難度獲得滿分', icon: 'fa-crown', rarity: 'legendary' }
];

function getUnlockedAchievements() { const data = localStorage.getItem(ACHIEVEMENT_KEY); return data ? JSON.parse(data) : []; }
function getShowcaseItems() { const data = localStorage.getItem(SHOWCASE_KEY); return data ? JSON.parse(data) : []; }
function saveShowcaseItems(items) { localStorage.setItem(SHOWCASE_KEY, JSON.stringify(items)); renderHomeShowcaseBadges(); }

function unlockAchievement(id) {
    let unlocked = getUnlockedAchievements();
    if (!unlocked.includes(id)) {
        unlocked.push(id);
        localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(unlocked));
        const ach = achievementsData.find(a => a.id === id);
        if (ach) {
            showToast(`🏆 成就解鎖: ${ach.title}`, "success", 5000);
            let showcase = getShowcaseItems();
            if (showcase.length < 3) { showcase.push(id); saveShowcaseItems(showcase); }
        }
        renderHomeShowcaseBadges();
    }
}

function renderHomeShowcaseBadges() {
    const container = document.getElementById('home-showcase-display');
    const showcaseIds = getShowcaseItems();
    if (showcaseIds.length === 0) {
        container.innerHTML = `<div class="empty-showcase-placeholder"><i class="fas fa-plus-circle" style="margin-right:8px;"></i> 點擊下方按鈕來佈置您的展示櫃</div>`;
        return;
    }
    container.innerHTML = '';
    showcaseIds.forEach(id => {
        const ach = achievementsData.find(a => a.id === id);
        if (ach) {
            const badge = document.createElement('div');
            badge.className = 'badge-wrapper';
            badge.innerHTML = `<div class="badge-coin badge-${ach.rarity}"><i class="fas ${ach.icon}"></i></div><div class="badge-ribbon">${ach.title}</div>`;
            container.appendChild(badge);
        }
    });
}

function openAchievementsManager() { document.getElementById('achievements-manager-modal').style.display = 'flex'; renderManagerGrid(); }
function closeAchievementsManager() { document.getElementById('achievements-manager-modal').style.display = 'none'; }

function renderManagerGrid() {
    const grid = document.getElementById('manager-grid');
    const unlocked = getUnlockedAchievements();
    const showcase = getShowcaseItems();

    document.getElementById('showcase-counter').innerText = `目前展示: ${showcase.length} 個`;

    grid.innerHTML = '';
    achievementsData.forEach(ach => {
        const isUnlocked = unlocked.includes(ach.id);
        const isSelected = showcase.includes(ach.id);
        const card = document.createElement('div');
        card.className = `manage-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked-item' : ''}`;
        if (isUnlocked) { card.onclick = () => toggleShowcaseItem(ach.id); }
        card.innerHTML = `<div style="width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:20px;" class="badge-${ach.rarity} ${!isUnlocked ? 'badge-locked' : ''}"><i class="fas ${ach.icon}"></i></div><div><div style="font-weight:bold; color:#333;">${ach.title} ${!isUnlocked ? '<i class="fas fa-lock" style="font-size:10px; color:#999; margin-left:5px;"></i>' : ''}</div><div style="font-size:12px; color:#666;">${ach.desc}</div></div>`;
        grid.appendChild(card);
    });
}

function toggleShowcaseItem(id) {
    let showcase = getShowcaseItems();
    const index = showcase.indexOf(id);
    if (index !== -1) {
        showcase.splice(index, 1);
    } else {
        showcase.push(id);
    }
    saveShowcaseItems(showcase);
    renderManagerGrid();
}

/* Nav & 畫面切換邏輯 */
function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (show) { sidebar.classList.add('open'); overlay.classList.add('active'); }
    else { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
}

function toggleHelpModal(show) {
    const modal = document.getElementById('help-modal');
    if (modal) { modal.style.display = show ? 'flex' : 'none'; }
}

function goToScreen(id, forceScrollTop = true, autoOpenSidebar = true) {
    localStorage.setItem('melody_current_screen', id);

    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active'); s.classList.remove('animate-enter');
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(id);
    target.classList.add('active');
    target.classList.add('animate-enter');

    if (id === 'start-screen') {
        document.getElementById('nav-home').classList.add('active');
        renderHomeShowcase();
        renderHomeShowcaseBadges();
        if (forceScrollTop) target.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (id === 'creations-screen') {
        document.getElementById('nav-creations').classList.add('active');
        renderHistory();
        if (currentHistoryIndex !== -1) showBottomPlayer();
    }
    else {
        hideBottomPlayer();
        if (id === 'test-screen') {
            if (window.playerStop && currentHistoryIndex !== -1) {
                window.playerStop();
                hideBottomPlayer();
                document.getElementById('floating-player').style.display = 'none';
            }
        } else if (currentHistoryIndex !== -1) {
            showFloatingPlayer();
        } else {
            hideBottomPlayer();
        }
    }

    if (id === 'main-screen') {
        if (autoOpenSidebar) {
            setTimeout(() => toggleSidebar(true), 100);
        } else {
            toggleSidebar(false);
        }

        document.getElementById('floating-back-btn').style.display = 'block';
        const helpBtn = document.getElementById('help-fab-btn'); if (helpBtn) helpBtn.style.display = 'flex';
        const pianoBtn = document.getElementById('piano-trigger-btn'); if (pianoBtn) pianoBtn.style.display = 'flex';
    } else {
        toggleSidebar(false);
        document.getElementById('floating-back-btn').style.display = 'none';
        const helpBtn = document.getElementById('help-fab-btn'); if (helpBtn) helpBtn.style.display = 'none';
        const pianoBtn = document.getElementById('piano-trigger-btn'); if (pianoBtn) pianoBtn.style.display = 'none';
        if (window.closeCreationPiano) window.closeCreationPiano();
    }

    if (window.checkFloatingPlayerState) {
        window.checkFloatingPlayerState(id);
    }
}
function scrollToSection(sectionId) {
    goToScreen('start-screen', false);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (sectionId === 'features-section') document.getElementById('nav-features').classList.add('active');
    if (sectionId === 'creations-section') document.getElementById('nav-creations').classList.add('active');
    if (sectionId === 'achievements-section') document.getElementById('nav-achievements').classList.add('active');

    setTimeout(() => {
        const section = document.getElementById(sectionId);
        if (section) { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 50);
}

function setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); }
            else { entry.target.classList.remove('visible'); }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
}

/* showcase 邏輯 */
function renderHomeShowcase() {
    const container = document.getElementById('home-showcase-container');
    const history = getHistory();
    if (history.length === 0) {
        container.innerHTML = `<div class="glass-btn-style" style="padding: 40px; border-radius: 20px; color: #888; max-width:600px; margin:0 auto;"><i class="fas fa-music" style="font-size: 40px; margin-bottom: 15px; opacity:0.3;"></i><p>您的創作旅程即將開始...</p><button onclick="goToScreen('main-screen')" class="action-btn" style="margin-top:15px; border-radius:30px;"><i class="fas fa-plus"></i> Create Now</button></div>`;
        return;
    }
    const favorites = history.filter(item => item.isFavorite);
    const spotlightItem = favorites.length > 0 ? favorites[0] : history[0];
    const isFeatured = favorites.length > 0;
    const recents = history.filter(item => item.id !== spotlightItem.id).slice(0, 3);
    const getParamText = (item) => `Key: ${item.params.key} | ${item.params.scale} | ${item.params.tempo} BPM`;

    let html = `<div class="creation-showcase-wrapper">`;
    html += `<div class="glass-btn-style spotlight-card" style="cursor: default;">
            <i class="fas fa-music spotlight-bg-icon"></i>
            <div style="width:100%;">
                <div class="spotlight-tag">${isFeatured ? '<i class="fas fa-heart"></i> FAVORITE PICK' : '<i class="fas fa-star"></i> LATEST DROP'}</div>
                <h3 style="font-size: 28px; margin: 10px 0; color: #333;">Creation #${spotlightItem.id.toString().slice(-4)}</h3>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;"><i class="far fa-clock"></i> ${spotlightItem.date.split(' ')[0]}</div>
            </div>
            <div style="width:100%; flex:1; display:flex; flex-direction:column; justify-content:flex-end;">
                ${spotlightItem.video ?
            `<div class="spotlight-video-container"><video src="${spotlightItem.video}" controls controlsList="nodownload"></video></div>` :
            `<div style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 15px; margin-bottom: 20px;"><div style="font-size: 13px; color: #555; font-weight:600;">Audio Parameters</div><div style="font-size: 12px; color: #777; margin-top:5px;">${getParamText(spotlightItem)}</div></div>
                         <div onclick="playHistoryIndex(${history.indexOf(spotlightItem)}); goToScreen('creations-screen');" style="display:flex; align-items:center; gap:10px; color: var(--primary-color); font-weight:bold; font-size:14px; cursor:pointer; width:fit-content;"><div style="width:40px; height:40px; border-radius:50%; background:var(--primary-color); color:white; display:flex; align-items:center; justify-content:center;"><i class="fas fa-play"></i></div>Listen Audio</div>`}
            </div>
        </div>`;

    if (recents.length > 0) {
        html += `<div class="recent-list">`;
        recents.forEach((item) => {
            const originalIndex = history.indexOf(item);
            html += `<div class="glass-btn-style recent-item" onclick="playHistoryIndex(${originalIndex}); goToScreen('creations-screen');">
            <div class="creation-icon-box" style="width: 45px; height: 45px; font-size: 18px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color:white; box-shadow: 0 4px 10px rgba(245, 87, 108, 0.3);"><i class="fas fa-compact-disc"></i></div>
            <div style="flex:1; text-align:left;">
                <div style="font-weight:bold; color:#333; font-size:14px;">Creation #${item.id.toString().slice(-4)}</div>
                <div style="font-size: 11px; color: #888;">${item.date.split(' ')[0]}</div>
            </div>
            ${item.isFavorite ? '<i class="fas fa-heart" style="color:#ff4081; font-size:14px; margin-right:5px;"></i>' : ''}
            <i class="fas fa-play-circle" style="color:#ddd; font-size:24px; transition:0.3s;" onmouseover="this.style.color='var(--primary-color)'" onmouseout="this.style.color='#ddd'"></i>
        </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="recent-list" style="justify-content:center;"><div class="glass-btn-style recent-item" onclick="goToScreen('main-screen')" style="height:100%; flex-direction:column; justify-content:center; text-align:center; gap:10px;"><div class="creation-icon-box" style="background:linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);"><i class="fas fa-plus"></i></div><div style="color:#555; font-weight:bold;">Create More</div><div style="font-size:12px; color:#888;">累積更多創作來填滿這個列表！</div></div></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

/* MIDI生成邏輯 */
async function generateMidi() {
    if (window.playerStop && typeof window.playerStop === 'function') window.playerStop();
    toggleSidebar(false);
    const params = {
        scale: document.getElementById('scale').value, key: document.getElementById('key').value,
        bars: document.getElementById('bars').value, tempo: document.getElementById('tempo').value,
        note_duration: document.getElementById('note_duration').value, octave: document.getElementById('octave').value,
        include_arpeggios: document.getElementById('include_arpeggios').checked ? 'on' : null,
        include_rests: document.getElementById('include_rests').checked ? 'on' : null,
        include_chords: document.getElementById('include_chords').checked ? 'on' : null
    };
    const visualLoader = document.getElementById('visual-loader');
    const placeholder = document.getElementById('placeholder-text');
    const dashboard = document.getElementById('result-dashboard');

    placeholder.style.display = 'none';
    document.getElementById('result-video').style.display = 'none';
    dashboard.style.display = 'none';
    visualLoader.style.display = 'flex';
    document.getElementById('status-text').innerText = "生成中...";

    try {
        const response = await fetch('api/generate-midi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await response.json();

        if (data.success) {
            window.currentMidiFilename = data.filename;
            saveCreationToHistory(data.filename, params);
            renderHomeShowcase();

            unlockAchievement('first_melody');
            if (getHistory().length >= 5) unlockAchievement('creator_novice');
            if (params.scale === 'Blues') unlockAchievement('blues_traveler');
            if (parseInt(params.tempo) >= 180) unlockAchievement('speed_demon');
            if (parseInt(params.tempo) <= 70) unlockAchievement('slow_jam');

            visualLoader.style.display = 'none';

            placeholder.style.display = 'block';
            placeholder.innerHTML = `<h3 style="color:#28a745;"><i class="fas fa-check-circle"></i> 生成成功！</h3><p>準備進行視覺化。</p>`;
            document.getElementById('status-text').innerText = "MIDI 已就緒";
            dashboard.style.display = 'grid';

            const midiLink = document.getElementById('midi-download-link');
            midiLink.href = data.midiUrl;
            midiLink.download = data.filename;
            const renderBtn = document.getElementById('render-video-btn');
            renderBtn.disabled = false;
            renderBtn.innerText = "渲染影片";
            showToast("MIDI 生成成功！", "success");
        } else { throw new Error(data.error); }
    } catch (error) {
        console.error(error);
        visualLoader.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<p style="color:red">錯誤: ${error.message}</p>`;
        showToast("生成失敗", "error");
    }
}

/* 參數重置 */
function resetParameters() {
    document.getElementById('scale').value = "Major Scale";
    document.getElementById('key').value = "0";
    document.getElementById('bars').value = "4";
    document.getElementById('tempo').value = "120";
    document.getElementById('note_duration').value = "0.5";
    document.getElementById('octave').value = "0";

    document.getElementById('include_arpeggios').checked = false;
    document.getElementById('include_rests').checked = false;
    document.getElementById('include_chords').checked = false;

    showToast("參數已重置為預設值", "info");
    document.querySelector('.sidebar').classList.add('flash-effect');
}

/* 影片渲染排程&輪詢邏輯 */
let pollInterval = null;

async function startRenderProcess() {
    if (!window.currentMidiFilename) { showToast("找不到 MIDI 檔案！", "error"); return; }

    const renderBtn = document.getElementById('render-video-btn');
    const visualLoader = document.getElementById('visual-loader');
    const placeholder = document.getElementById('placeholder-text');
    const videoEl = document.getElementById('result-video');
    const statusDiv = document.getElementById('render-status');
    const queueBox = document.getElementById('queue-status-container');
    const loaderText = visualLoader.querySelector('p');

    renderBtn.disabled = true;
    renderBtn.innerText = "請求中...";
    statusDiv.style.display = 'block';
    statusDiv.innerText = "加入佇列...";
    placeholder.style.display = 'none';
    videoEl.style.display = 'none';
    videoEl.pause();

    visualLoader.style.display = 'flex';
    queueBox.style.display = 'none';
    loaderText.innerText = "正在聯絡渲染引擎...";

    try {
        const response = await fetch('api/render-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ midiFilename: window.currentMidiFilename })
        });

        startQueuePolling(window.currentMidiFilename);

        const data = await response.json();

        if (data.status === 'queued') {
            updateQueueUI(data.position, data.waitTime);
            statusDiv.innerText = "排隊中...";
        }

        if (data.success) {
            stopQueuePolling();

            updateHistoryVideo(window.currentMidiFilename, data.videoUrl);
            unlockAchievement('film_maker');

            visualLoader.style.display = 'none';
            statusDiv.style.display = 'none';
            document.getElementById('visual-container').classList.add('has-result');

            videoEl.src = data.videoUrl;
            videoEl.style.display = 'block';
            videoEl.load();

            const videoLink = document.getElementById('video-download-link');
            videoLink.href = data.videoUrl;
            videoLink.download = data.filename;
            videoLink.style.display = 'flex';

            renderBtn.disabled = false;
            renderBtn.innerText = "再次渲染";
            showToast("渲染完成！", "success");
        } else if (data.status !== 'queued') {
            throw new Error(data.error || "Unknown Error");
        }

    } catch (error) {
        console.error(error);
        stopQueuePolling();

        showToast(error.message || "渲染請求失敗", "error", 5000);
        visualLoader.style.display = 'none';
        placeholder.style.display = 'block';
        renderBtn.disabled = false;
        renderBtn.innerText = "渲染影片";
        statusDiv.style.display = 'none';
    }
}

function updateQueueUI(position, waitTime) {
    const queueBox = document.getElementById('queue-status-container');
    const posEl = document.getElementById('queue-pos');
    const timeEl = document.getElementById('queue-time');
    const loaderText = document.querySelector('#visual-loader p');

    if (queueBox && posEl && timeEl) {
        queueBox.style.display = 'block';
        posEl.innerText = position !== undefined ? position : "--";
        timeEl.innerText = waitTime !== undefined ? waitTime : "計算中...";
        if (loaderText) {
            loaderText.innerText = "伺服器忙碌，排隊中...";
            loaderText.style.color = "#FF9800";
        }
    }
}

function startQueuePolling(filename) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`api/queue-status?filename=${filename}`);
            if (!res.ok) return;

            const statusData = await res.json();

            if (statusData.status === 'queued') {
                updateQueueUI(statusData.position, statusData.waitTime);
            } else if (statusData.status === 'rendering') {
                const queueBox = document.getElementById('queue-status-container');
                const loaderText = document.querySelector('#visual-loader p');
                if (queueBox) queueBox.style.display = 'none';
                if (loaderText) {
                    loaderText.innerText = "正在進行 4K 渲染 (Piano VFX)...";
                    loaderText.style.color = "#E91E63";
                }
            }
        } catch (e) {
            console.log("Polling logic error", e);
        }
    }, 2000);
}

function stopQueuePolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

/* 測驗系統邏輯 */
let currentTargetNote, score = 0, currentQuestion = 1, totalQuestions = 5;
let timeLeft = 10, isQuestionActive = false, availableNotes = [], maxAttempts = 1, usedAttempts = 0;
const DIFFICULTY_SETTINGS = {
    'Easy': { questions: 5, time: 20, attempts: 10, octaves: [4], scale: 'major' },
    'Normal': { questions: 10, time: 15, attempts: 5, octaves: [3, 4], scale: 'chromatic' },
    'Hard': { questions: 20, time: 10, attempts: 3, octaves: [3, 4, 5], scale: 'chromatic' },
    'Expert': { questions: 25, time: 5, attempts: 1, octaves: [2, 3, 4, 5, 6], scale: 'chromatic' }
};

function generateAvailableNotes(setting) {
    const notes = []; const allNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; const majorNotes = ["C", "D", "E", "F", "G", "A", "B"];
    setting.octaves.forEach(oct => {
        const noteSet = (setting.scale === 'major') ? majorNotes : allNotes;
        noteSet.forEach(n => { if (oct === 6 && n !== 'C') return; if (oct === 6 && n === 'C') notes.push(n + oct); else if (oct < 6) notes.push(n + oct); });
    }); return notes;
}

function renderPiano() {
    const pianoContainer = document.getElementById('piano'); pianoContainer.innerHTML = '';
    const startOctave = 2; const endOctave = 6; const scaleNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let whiteKeyIndex = 0; const totalWhiteKeys = (endOctave - startOctave) * 7 + 1;
    for (let oct = startOctave; oct <= endOctave; oct++) {
        scaleNotes.forEach(note => {
            if (oct === endOctave && note !== 'C') return;
            const fullNote = note + oct; const isBlack = note.includes('#'); const key = document.createElement('div'); key.dataset.note = fullNote;
            if (!isBlack) {
                key.className = 'key white'; if (note === 'C') key.innerText = fullNote;
                setupKeyEvents(key); pianoContainer.appendChild(key); whiteKeyIndex++;
            } else {
                key.className = 'key black'; const blackKeyWidthPercent = 2; const leftPercent = (whiteKeyIndex / totalWhiteKeys * 100) - (blackKeyWidthPercent / 2); key.style.left = leftPercent + '%';
                setupKeyEvents(key); pianoContainer.appendChild(key);
            }
        });
    }
}

function setupKeyEvents(key) {
    key.addEventListener('mousedown', () => {
        if (!isQuestionActive) return;

        const note = key.dataset.note;
        if (window.playTestNote) { window.playTestNote(note); }

        key.classList.remove('wrong-fade');
        void key.offsetWidth;

        if (note === currentTargetNote) {
            clearInterval(window.timerInterval);
            key.classList.add('correct');
            score++;
            updateScore();
            isQuestionActive = false;

            document.getElementById('test-info-display').innerText = "Correct! " + note;
            document.getElementById('test-info-display').style.color = "#28a745";

            showNextButton();

        } else {
            usedAttempts++;
            updateAttemptDisplay();
            key.classList.add('wrong-fade');

            if (usedAttempts >= maxAttempts) {
                clearInterval(window.timerInterval);
                isQuestionActive = false;

                document.getElementById('test-info-display').innerText = `機會用盡! 答案是 ${currentTargetNote}`;
                document.getElementById('test-info-display').style.color = "#d81b60";

                const correctKey = document.querySelector(`.key[data-note="${currentTargetNote}"]`);
                if (correctKey) correctKey.classList.add('correct');

                showToast(`機會用盡！正確答案是 ${currentTargetNote}`, "error");
                showNextButton();
            } else {
                document.getElementById('test-info-display').innerText = "Wrong!";
                document.getElementById('test-info-display').style.color = "#f44336";
                showToast("答錯了！再試一次", "error");
            }
        }
    });
}

async function startTest() {
    await Tone.start(); const difficulty = document.getElementById('difficulty-select').value; const setting = DIFFICULTY_SETTINGS[difficulty];
    totalQuestions = setting.questions; timeLeft = setting.time; maxAttempts = setting.attempts; availableNotes = generateAvailableNotes(setting);
    currentQuestion = 1; score = 0; renderPiano(); goToScreen('test-screen'); loadNewQuestion();
}

function loadNewQuestion() {
    isQuestionActive = true; const difficulty = document.getElementById('difficulty-select').value; const setting = DIFFICULTY_SETTINGS[difficulty]; timeLeft = setting.time; usedAttempts = 0;
    document.querySelectorAll('.key').forEach(k => k.classList.remove('correct', 'wrong-fade')); document.getElementById('next-q-btn').style.display = 'none';
    document.getElementById('question-indicator').innerText = `第 ${currentQuestion} / ${totalQuestions} 題`; document.getElementById('test-info-display').innerText = "請聆聽..."; document.getElementById('test-info-display').style.color = "#333";
    updateScore(); updateAttemptDisplay();
    currentTargetNote = availableNotes[Math.floor(Math.random() * availableNotes.length)]; setTimeout(() => playCurrentNote(), 500); startTimer();
}

function startTimer() {
    if (window.timerInterval) clearInterval(window.timerInterval); document.getElementById('timer-display').innerText = timeLeft;
    window.timerInterval = setInterval(() => {
        timeLeft--; document.getElementById('timer-display').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(window.timerInterval); isQuestionActive = false;
            document.getElementById('test-info-display').innerText = "Time's Up! 答案是 " + currentTargetNote; document.getElementById('test-info-display').style.color = "#d81b60";
            const correctKey = document.querySelector(`.key[data-note="${currentTargetNote}"]`); if (correctKey) correctKey.classList.add('correct'); showNextButton();
        }
    }, 1000);
}

function playCurrentNote() { if (window.playTestNote) { window.playTestNote(currentTargetNote); } }
function updateScore() { document.getElementById('live-score').innerText = `得分: ${score}`; }
function updateAttemptDisplay() { document.getElementById('attempt-display').innerText = `點擊: ${usedAttempts} / ${maxAttempts}`; }
function showNextButton() { const btn = document.getElementById('next-q-btn'); if (currentQuestion < totalQuestions) { btn.innerText = "下一題"; btn.onclick = nextQuestion; } else { btn.innerText = "查看結果"; btn.onclick = showResults; } btn.style.display = 'block'; }
function nextQuestion() { currentQuestion++; loadNewQuestion(); }
function showResults() {
    document.getElementById('result-score').innerText = `${score} / ${totalQuestions}`;
    document.getElementById('result-modal').style.display = 'flex';
    updateBestScore(score);

    const difficulty = document.getElementById('difficulty-select').value;

    if (score === totalQuestions && totalQuestions > 0 && difficulty === 'Expert') {
        unlockAchievement('pitch_perfect');
        showToast("太神了！傳說級成就「絕對音感」已解鎖！", "success", 6000);
    }
}
function endTest() { document.getElementById('quit-modal').style.display = 'flex'; }
function confirmQuit() { clearInterval(window.timerInterval); closeQuitModal(); goToScreen('start-screen'); }
function closeQuitModal() { document.getElementById('quit-modal').style.display = 'none'; }
function closeResultModal() { document.getElementById('result-modal').style.display = 'none'; goToScreen('start-screen'); }

const canvasEl = document.getElementById('bg-canvas'); const ctxEl = canvasEl.getContext('2d');
function resize() { canvasEl.width = window.innerWidth; canvasEl.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);

/* 應用程式初始化 */
window.onload = function () {
    setupScrollReveal();
    document.getElementById('bars').addEventListener('change', validateInput);
    document.getElementById('tempo').addEventListener('change', validateInput);

    renderHomeShowcase();
    renderHomeShowcaseBadges();
    renderBestScore();

    const lastScreen = localStorage.getItem('melody_current_screen');

    if (lastScreen && document.getElementById(lastScreen)) {
        goToScreen(lastScreen, false);
    } else {
        goToScreen('start-screen');
    }
};