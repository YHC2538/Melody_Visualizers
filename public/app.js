import { loadInstrument, loadAndPlayMIDI, play, pause, stop, seek, getCurrentTime, getDuration, listAvailableInstruments, INSTRUMENT_BASE_URLS, NOTE_MAP } from "./midiplayer.js";

window.playerStop = stop;
let isPlaying = false, isDragging = false, isLooping = false, isAutoPlay = true, updateInterval = null, isInstrumentLoaded = false;
let currentPlayerContext = 'history';
let isSwitchingInstrument = false;

const selectEl = document.getElementById('instrument-select');
const playBtn = document.getElementById('play-toggle-btn');
const seekBar = document.getElementById('seek-bar');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const statusEl = document.getElementById('player-status');
const bpPlayBtn = document.getElementById('bp-play-btn');
const bpLoopBtn = document.getElementById('bp-loop-btn');
const bpAutoBtn = document.getElementById('bp-auto-btn');
const bpSeekBar = document.getElementById('bp-seek-bar');
const bpCurrentTimeEl = document.getElementById('bp-current-time');
const bpTotalTimeEl = document.getElementById('bp-total-time');
const bpTrackTitle = document.getElementById('bp-track-title');
const bpTrackSubtitle = document.getElementById('bp-track-subtitle');
const bpInstrumentSelect = document.getElementById('bp-instrument-select');
const fpTitle = document.getElementById('fp-title');
const fpPlayBtn = document.getElementById('fp-play-btn');
const fpLoopBtn = document.getElementById('fp-loop-btn');
const fpAutoBtn = document.getElementById('fp-auto-btn');

/* 樂器選單*/
const fallbackInstruments = [
    "acoustic_grand_piano", "violin", "cello", "flute", "clarinet",
    "trumpet", "acoustic_guitar_nylon", "electric_guitar_clean"
];

const populateSelect = (el) => {
    if (!el) return;
    el.innerHTML = "";
    let list = [];
    try {
        if (typeof listAvailableInstruments === 'function') {
            list = listAvailableInstruments();
        }
    } catch (e) {
        console.warn("MidiPlayer instruments not ready:", e);
    }

    if (!list || !Array.isArray(list) || list.length === 0) {
        console.log("Using fallback instruments list.");
        list = fallbackInstruments;
    }

    list.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.text = (typeof inst === 'string') ? inst.replace(/_/g, ' ').toUpperCase() : inst;
        if (inst === 'acoustic_grand_piano') option.selected = true;
        el.appendChild(option);
    });
};

function initDropdowns() {
    const sel1 = document.getElementById('instrument-select');
    const sel2 = document.getElementById('bp-instrument-select');
    const sel3 = document.getElementById('test-instrument-select');
    const sel4 = document.getElementById('creation-instrument-select');

    populateSelect(sel1);
    populateSelect(sel2);
    populateSelect(sel3);
    if (sel4) populateSelect(sel4);
    console.log("Dropdowns initialized.");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdowns);
} else {
    initDropdowns();
}

/* 虛擬鋼琴切換樂器選單 */
const creationSelectEl = document.getElementById('creation-instrument-select');
if (creationSelectEl) {
    creationSelectEl.addEventListener('change', async (e) => {
        if (isSwitchingInstrument) return;

        const instName = e.target.value;

        isSwitchingInstrument = true;
        creationSelectEl.disabled = true;
        const loadingToast = showToast("正在切換創作樂器...", "info", 0);

        try {
            await loadCreationInstrument(instName);
            removeToast(loadingToast);
            showToast("樂器切換完成！", "success");
        } catch (err) {
            removeToast(loadingToast);
            showToast("切換失敗", "error");
            console.error(err);
        } finally {
            isSwitchingInstrument = false;
            creationSelectEl.disabled = false;
        }
    });
}

loadInstrument('acoustic_grand_piano').then(() => { isInstrumentLoaded = true; }).catch(e => console.error("Instrument load failed", e));

/* 測驗系統樂器&音訊邏輯 */
let testSampler = null;
const testVolume = new Tone.Volume(10);
const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.2 }).toDestination();

testVolume.connect(reverb);

async function loadTestInstrument(name) {
    if (testSampler) { testSampler.disconnect(); testSampler.dispose(); }
    await Tone.start();
    return new Promise((resolve) => {
        testSampler = new Tone.Sampler({
            urls: NOTE_MAP,
            baseUrl: INSTRUMENT_BASE_URLS[name],
            release: 1,
            onload: () => { console.log(`Test instrument ${name} loaded`); resolve(); }
        }).connect(testVolume);
    });
}
loadTestInstrument('acoustic_grand_piano');

const testSelectEl = document.getElementById('test-instrument-select');
if (testSelectEl) {
    testSelectEl.addEventListener('change', async (e) => {
        const instName = e.target.value;
        testSelectEl.disabled = true;
        const loadingToast = showToast("正在切換樂器...", "info", 0);
        try { await loadTestInstrument(instName); removeToast(loadingToast); showToast("樂器切換完成！", "success"); }
        catch (err) { removeToast(loadingToast); showToast("切換失敗", "error"); }
        testSelectEl.disabled = false;
    });
}

window.playTestNote = function (note) {
    if (testSampler && testSampler.loaded) { testSampler.triggerAttackRelease(note, "8n", undefined, 1); }
    else { const synth = new Tone.Synth().toDestination(); synth.triggerAttackRelease(note, "8n", undefined, 1); }
};

window.setGlobalVolume = function (val) {
    const volumeValue = parseInt(val);
    if (volumeValue === 0) { Tone.getDestination().volume.rampTo(-Infinity, 0.1); }
    else { const db = 20 * Math.log10(volumeValue / 100); Tone.getDestination().volume.rampTo(db, 0.1); }
};
window.setGlobalVolume(80);

/* 使用者指南視窗控制 */
window.openGuideModal = function () {
    const modal = document.getElementById('guide-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}
window.closeGuideModal = function () {
    const modal = document.getElementById('guide-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

/* 底部播放器 */
window.playHistoryIndex = async function (index) {
    currentPlayerContext = 'history';
    const history = getHistory();
    if (index < 0 || index >= history.length) return;

    currentHistoryIndex = index;
    const item = history[index];
    const titleText = `Creation #${item.id.toString().slice(-4)}`;

    if (bpTrackTitle) bpTrackTitle.innerText = titleText;
    if (bpTrackSubtitle) {
        const keyName = document.querySelector(`#key option[value="${item.params.key}"]`)?.innerText || item.params.key;
        bpTrackSubtitle.innerText = `${keyName} - ${item.params.scale}`;
    }
    if (fpTitle) fpTitle.innerText = titleText;

    stop(); isPlaying = false; updatePlayButtons(false);

    const isCreationsPage = document.getElementById('creations-screen').classList.contains('active');
    if (isCreationsPage) { showBottomPlayer(); } else { hideBottomPlayer(); showFloatingPlayer(); }

    const loadingToast = showToast(`正在載入 ${titleText}...`, "info", 0);
    try {
        await Tone.start();
        const instrumentName = document.getElementById('bp-instrument-select')?.value || 'acoustic_grand_piano';
        await loadInstrument(instrumentName);

        const response = await fetch(`midi/${item.midi}`);
        if (!response.ok) throw new Error("找不到檔案");
        const arrayBuffer = await response.arrayBuffer();

        await loadAndPlayMIDI(arrayBuffer);
        removeToast(loadingToast);
        showToast("載入完成，開始播放", "success");

        isPlaying = true; updatePlayButtons(true); startUpdateLoop();
    } catch (error) {
        removeToast(loadingToast); console.error(error); showToast("播放失敗: " + error.message, "error");
    }
};

/* 底層播放器樂器切換 */
if (bpInstrumentSelect) {
    bpInstrumentSelect.addEventListener('change', async (e) => {
        if (isSwitchingInstrument) return;

        const instName = e.target.value;
        const wasPlaying = isPlaying;

        isSwitchingInstrument = true;
        bpInstrumentSelect.disabled = true;
        const loadingToast = showToast("正在切換樂器...", "info", 0);

        try {
            if (wasPlaying) {
                stop();
                isPlaying = false;
                updatePlayButtons(false);
            }

            await loadInstrument(instName);

            removeToast(loadingToast);
            showToast("樂器切換完成", "success");

        } catch (err) {
            removeToast(loadingToast);
            console.error(err);
            showToast("切換失敗: " + err.message, "error");
        } finally {
            isSwitchingInstrument = false;
            bpInstrumentSelect.disabled = false;
        }
    });
}

/* 播放控制 */
window.toggleBottomPlay = function () {
    if (currentPlayerContext === 'preview') {
        if (isPlaying) { pause(); isPlaying = false; updatePlayButtons(false); }
        else { play(); isPlaying = true; updatePlayButtons(true); startUpdateLoop(); }
        const fpPlayBtn = document.getElementById('fp-play-btn');
        if (fpPlayBtn) fpPlayBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    } else {
        if (isPlaying) { pause(); isPlaying = false; updatePlayButtons(false); }
        else {
            if (Tone.Transport.seconds > 0) { play(); isPlaying = true; updatePlayButtons(true); startUpdateLoop(); }
            else if (currentHistoryIndex !== -1) { window.playHistoryIndex(currentHistoryIndex); }
        }
    }
};

window.prevTrack = function () { if (currentHistoryIndex < getHistory().length - 1) { window.playHistoryIndex(currentHistoryIndex + 1); } else { showToast("已經是最後一首了", "error"); } }
window.nextTrack = function () { if (currentHistoryIndex > 0) { window.playHistoryIndex(currentHistoryIndex - 1); } else { showToast("已經是第一首了", "error"); } }

/* 循環與自動播放切換 */
window.toggleLoop = function () {
    isLooping = !isLooping;
    const updateBtnState = (btn, active) => { if (!btn) return; if (active) btn.classList.add('active'); else btn.classList.remove('active'); };
    updateBtnState(bpLoopBtn, isLooping); updateBtnState(fpLoopBtn, isLooping);
    showToast(isLooping ? "開啟循環播放" : "關閉循環播放", "success");
}

window.toggleAutoPlay = function () {
    isAutoPlay = !isAutoPlay;
    const updateBtnState = (btn, active) => { if (!btn) return; if (active) btn.classList.add('active'); else btn.classList.remove('active'); };
    updateBtnState(bpAutoBtn, isAutoPlay); updateBtnState(fpAutoBtn, isAutoPlay);
    showToast(isAutoPlay ? "開啟自動播放" : "關閉自動播放", "success");
}

function updatePlayButtons(playing) {
    const icon = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    if (bpPlayBtn) bpPlayBtn.innerHTML = icon;
    if (playBtn) playBtn.innerText = playing ? "⏸" : "▶";
    if (fpPlayBtn) fpPlayBtn.innerHTML = icon;
    if (statusEl) statusEl.innerText = playing ? "播放中 ♪" : "已暫停";
}

/* 預覽模式播放按鈕 */
if (playBtn) {
    playBtn.addEventListener('click', async () => {
        if (!window.currentMidiFilename) { alert("請先生成 MIDI 檔案！"); return; }
        await Tone.start();
        if (!isPlaying) {
            try {
                currentPlayerContext = 'preview';
                playBtn.disabled = true;
                if (Tone.Transport.seconds === 0 || !isInstrumentLoaded) {
                    statusEl.innerText = "載入 MIDI...";
                    if (!isInstrumentLoaded) {
                        const instName = selectEl.value || 'acoustic_grand_piano';
                        await loadInstrument(instName);
                        isInstrumentLoaded = true;
                    }
                    const midiUrl = `midi/${window.currentMidiFilename}`;
                    const res = await fetch(midiUrl);
                    if (!res.ok) throw new Error("找不到檔案");
                    const buf = await res.arrayBuffer();
                    await loadAndPlayMIDI(buf);
                } else { play(); }
                isPlaying = true; updatePlayButtons(true); seekBar.disabled = false; startUpdateLoop();
            } catch (e) {
                console.error(e); statusEl.innerText = "播放錯誤"; togglePlayState(true);
            } finally { playBtn.disabled = false; }
        } else { togglePlayState(false); }
    });
}

/* 預覽模式樂器切換邏輯 */
if (selectEl) {
    selectEl.addEventListener('change', async (e) => {
        if (isSwitchingInstrument) return;

        const statusEl = document.getElementById('player-status');
        const instName = e.target.value;
        const wasPlaying = isPlaying;

        isSwitchingInstrument = true;
        selectEl.disabled = true;
        statusEl.innerText = "載入音色中...";

        const loadingToast = showToast("正在切換音色...", "info", 0);

        try {
            if (wasPlaying) {
                stop();
                isPlaying = false;
                updatePlayButtons(false);
            }

            await loadInstrument(instName);

            isInstrumentLoaded = true;
            statusEl.innerText = "音色已切換";
            removeToast(loadingToast);

        } catch (err) {
            console.error(err);
            statusEl.innerText = "音色載入失敗";
            removeToast(loadingToast);
            showToast("切換失敗", "error");
        } finally {
            isSwitchingInstrument = false;
            selectEl.disabled = false;
        }
    });
}

/* 進度條&時間顯示 */
function togglePlayState(resetToStart = false) {
    if (resetToStart) { stop(); isPlaying = false; updatePlayButtons(false); if (seekBar) seekBar.value = 0; if (currentTimeEl) currentTimeEl.innerText = "0:00"; }
    else { pause(); isPlaying = false; updatePlayButtons(false); }
    stopUpdateLoop();
}

/* 進度條拖曳 */
if (seekBar) {
    seekBar.addEventListener('mousedown', () => { isDragging = true; });
    seekBar.addEventListener('touchstart', () => { isDragging = true; });
    seekBar.addEventListener('change', (e) => { seek(e.target.value / 100); isDragging = false; });
    seekBar.addEventListener('input', (e) => { const duration = getDuration(); if (duration > 0) currentTimeEl.innerText = formatTime(duration * (e.target.value / 100)); });
}
if (bpSeekBar) {
    bpSeekBar.addEventListener('mousedown', () => { isDragging = true; });
    bpSeekBar.addEventListener('touchstart', () => { isDragging = true; });
    bpSeekBar.addEventListener('change', (e) => { seek(e.target.value / 100); isDragging = false; });
    bpSeekBar.addEventListener('input', (e) => { const duration = getDuration(); if (duration > 0) bpCurrentTimeEl.innerText = formatTime(duration * (e.target.value / 100)); });
}

/* 播放進度更新迴圈 */
function startUpdateLoop() {
    if (updateInterval) cancelAnimationFrame(updateInterval);
    function update() {
        if (!isPlaying) return; const now = getCurrentTime(); const total = getDuration();
        if (total > 0) {
            const progress = (now / total) * 100; const timeStr = formatTime(now); const totalStr = formatTime(total);
            if (totalTimeEl) totalTimeEl.innerText = totalStr; if (!isDragging && seekBar) { seekBar.value = progress; currentTimeEl.innerText = timeStr; }
            if (bpTotalTimeEl) bpTotalTimeEl.innerText = totalStr; if (!isDragging && bpSeekBar) { bpSeekBar.value = progress; bpCurrentTimeEl.innerText = timeStr; }
            if (now >= total - 0.1) {
                if (isLooping) { seek(0); if (bpSeekBar) bpSeekBar.value = 0; if (bpCurrentTimeEl) bpCurrentTimeEl.innerText = "0:00"; if (seekBar) seekBar.value = 0; if (currentTimeEl) currentTimeEl.innerText = "0:00"; }
                else { if (isAutoPlay) { if (currentHistoryIndex !== -1 && currentHistoryIndex > 0) { window.nextTrack(); } else { togglePlayState(true); } } else { togglePlayState(true); } return; }
            }
        } updateInterval = requestAnimationFrame(update);
    } update();
}
function stopUpdateLoop() { if (updateInterval) cancelAnimationFrame(updateInterval); }
function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return "0:00"; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; }

/* 創作模式虛擬鋼琴 */
let creationSampler = null;
let isCreationPianoRendered = false;

async function loadCreationInstrument(name) {
    if (creationSampler) { creationSampler.disconnect(); creationSampler.dispose(); }
    await Tone.start();
    return new Promise((resolve) => {
        creationSampler = new Tone.Sampler({
            urls: NOTE_MAP, baseUrl: INSTRUMENT_BASE_URLS[name], release: 1,
            onload: () => { console.log(`Creation instrument ${name} loaded`); resolve(); }
        }).toDestination();
    });
}

window.toggleCreationPiano = async function () {
    const win = document.getElementById('floating-piano-app'); if (!win) return;
    const isActive = win.classList.contains('active');
    if (isActive) { window.closeCreationPiano(); } else {
        await Tone.start();
        if (!creationSampler) { const loadingToast = showToast("正在初始化樂器...", "info", 0); await loadCreationInstrument('acoustic_grand_piano'); removeToast(loadingToast); }
        if (!isCreationPianoRendered) { renderCreationPiano(); isCreationPianoRendered = true; }
        win.classList.add('active');
    }
}

window.closeCreationPiano = function () {
    const win = document.getElementById('floating-piano-app');
    if (win) win.classList.remove('active');
}

function renderCreationPiano() {
    const container = document.getElementById('creation-piano-keys');
    if (!container) return;
    container.innerHTML = '';
    const startOctave = 2; const endOctave = 6; const scaleNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let whiteKeyIndex = 0; const totalWhiteKeys = (endOctave - startOctave) * 7 + 1;

    for (let oct = startOctave; oct <= endOctave; oct++) {
        scaleNotes.forEach(note => {
            if (oct === endOctave && note !== 'C') return;
            const fullNote = note + oct; const isBlack = note.includes('#'); const key = document.createElement('div'); key.dataset.note = fullNote;
            if (!isBlack) {
                key.className = 'key white'; if (note === 'C') key.innerText = fullNote;
                setupCreationKeyEvents(key, fullNote); container.appendChild(key); whiteKeyIndex++;
            } else {
                key.className = 'key black'; const blackKeyWidthPercent = 2; const leftPercent = (whiteKeyIndex / totalWhiteKeys * 100) - (blackKeyWidthPercent / 2); key.style.left = leftPercent + '%';
                setupCreationKeyEvents(key, fullNote); container.appendChild(key);
            }
        });
    }
}

function setupCreationKeyEvents(key, note) {
    const play = () => { if (creationSampler && creationSampler.loaded) { creationSampler.triggerAttack(note); } key.classList.add('active'); if (!key.classList.contains('black')) key.style.transform = 'translateY(2px)'; };
    const release = () => { if (creationSampler && creationSampler.loaded) { creationSampler.triggerRelease(note); } key.classList.remove('active'); if (!key.classList.contains('black')) key.style.transform = ''; };
    key.addEventListener('mousedown', play); key.addEventListener('mouseup', release); key.addEventListener('mouseleave', release);
    key.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }); key.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
}

/* 互動式導覽 */
let preTourState = {
    hasMidi: false
};

function simulateGeneratedState(active) {
    const dashboard = document.getElementById('result-dashboard');
    const placeholder = document.getElementById('placeholder-text');

    if (active) {
        if (placeholder) placeholder.style.display = 'none';
        if (dashboard) {
            dashboard.style.display = 'grid';
            dashboard.style.opacity = '1';
            dashboard.style.transform = 'none';
            dashboard.classList.add('tour-no-animation');
        }
    } else {
        if (!window.currentMidiFilename) {
            if (placeholder) placeholder.style.display = 'block';
            if (dashboard) {
                dashboard.style.display = 'none';
                dashboard.classList.remove('tour-no-animation');
            }
        }
    }
}

const tourSteps = [
    {
        elementId: 'sidebar',
        title: '1. 調整參數 (Parameters)',
        text: '這裡是控制中心。設定音階、調性、BPM，調整完畢後請看下一步。',
        position: 'right',
        action: () => { toggleSidebar(true); simulateGeneratedState(false); }
    },
    {
        elementId: 'gen-midi-btn',
        title: '2. 生成 MIDI (Generate)',
        text: '設定完成後，點擊這裡！AI 會立即為您生成一段獨一無二的旋律。',
        position: 'right',
        action: () => {
            toggleSidebar(true);
            setTimeout(() => {
                const targetBtn = document.getElementById('gen-midi-btn');
                if (targetBtn) targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    },
    {
        elementId: 'result-dashboard',
        title: '3. 預覽與渲染 (Preview)',
        text: '（模擬生成畫面）生成後側邊欄會收起。您可以在此試聽，滿意後點擊「渲染影片」。',
        position: 'top',
        action: () => { toggleSidebar(false); simulateGeneratedState(true); }
    },
    {
        elementId: 'piano-trigger-btn',
        title: '4. 虛擬鋼琴 (Virtual Piano)',
        text: '想要自己加入靈感嗎？點擊右側這個按鈕，隨時喚醒虛擬鍵盤進行創作。',
        position: 'left',
        action: () => {
            toggleSidebar(false);
            simulateGeneratedState(true);
            const btn = document.getElementById('piano-trigger-btn');
            if (btn) btn.style.display = 'flex';
        }
    },
    {
        elementId: 'visual-container',
        title: '5. 開始創作吧！',
        text: '現在您已經熟悉流程了。按下結束，開始您的音樂視覺化之旅！',
        position: 'center',
        action: () => { toggleSidebar(false); simulateGeneratedState(true); }
    }
];

let currentTourIndex = 0;
let tourLoopId = null;

function startTourLoop() {
    if (tourLoopId) cancelAnimationFrame(tourLoopId);

    function update() {
        const step = tourSteps[currentTourIndex];
        const target = document.getElementById(step.elementId);
        const spotlight = document.getElementById('tour-spotlight');
        const tooltip = document.getElementById('tour-tooltip');

        if (target && spotlight.classList.contains('active')) {
            const rect = target.getBoundingClientRect();

            const padding = 2;
            spotlight.style.width = (rect.width + padding * 2) + 'px';
            spotlight.style.height = (rect.height + padding * 2) + 'px';
            spotlight.style.top = (rect.top - padding) + 'px';
            spotlight.style.left = (rect.left - padding) + 'px';

            const style = window.getComputedStyle(target);
            spotlight.style.borderRadius = style.borderRadius;

            if (tooltip.style.display !== 'none') {
                positionTooltip(target, tooltip, step.position);
            }
        }
        tourLoopId = requestAnimationFrame(update);
    }
    update();
}

window.startTour = function () {
    if (!document.getElementById('main-screen').classList.contains('active')) {
        goToScreen('main-screen');
    }
    currentTourIndex = 0;

    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.style.display = 'none';

    document.getElementById('tour-spotlight').classList.add('active');
    document.getElementById('tour-tooltip').style.display = 'flex';

    showTourStep();
    startTourLoop();
}

window.nextTourStep = function () {
    if (currentTourIndex < tourSteps.length - 1) {
        currentTourIndex++;
        showTourStep();
    } else {
        window.endTour();
    }
}

window.endTour = function () {
    if (tourLoopId) cancelAnimationFrame(tourLoopId);
    document.getElementById('tour-spotlight').classList.remove('active');
    document.getElementById('tour-tooltip').style.display = 'none';
    simulateGeneratedState(false);
}

function showTourStep() {
    const step = tourSteps[currentTourIndex];
    if (step.action) step.action();

    setTimeout(() => {
        const target = document.getElementById(step.elementId);
        if (target) {
            document.getElementById('tour-title').innerText = step.title;
            document.getElementById('tour-content').innerText = step.text;
            document.getElementById('tour-counter').innerText = `${currentTourIndex + 1}/${tourSteps.length}`;

            const nextBtn = document.getElementById('tour-next-btn');
            if (currentTourIndex === tourSteps.length - 1) {
                nextBtn.innerText = "Finish";
                nextBtn.onclick = window.endTour;
            } else {
                nextBtn.innerText = "Next";
                nextBtn.onclick = window.nextTourStep;
            }
        }
    }, 300);
}

function positionTooltip(target, tooltip, positionPref) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 20;
    let top, left;

    if (positionPref === 'center') {
        top = (window.innerHeight / 2) - (tooltipRect.height / 2);
        left = (window.innerWidth / 2) - (tooltipRect.width / 2);
    } else if (positionPref === 'right') {
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + margin;
    } else if (positionPref === 'left') {
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - margin;
    } else if (positionPref === 'top') {
        top = rect.top - tooltipRect.height - margin;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    } else {
        top = rect.bottom + margin;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    }

    if (left < 10) left = 10;
    if (top < 10) top = 10;
    if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 10;
    if (top + tooltipRect.height > window.innerHeight) top = window.innerHeight - tooltipRect.height - 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

/* 可拖曳視窗 */
function makeElementDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();

        pos3 = e.clientX;
        pos4 = e.clientY;

        element.style.transition = "none";

        const rect = element.getBoundingClientRect();
        element.style.transform = "none";
        element.style.left = rect.left + "px";
        element.style.top = rect.top + "px";
        element.style.margin = 0;

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newLeft + 100 > window.innerWidth) newLeft = window.innerWidth - 100;
        if (newTop + 50 > window.innerHeight) newTop = window.innerHeight - 50;

        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        element.style.transition = "";
    }
}

const draggablePanel = document.getElementById("floating-piano-app");
const dragHandle = document.querySelector("#floating-piano-app .studio-header");

if (draggablePanel && dragHandle) {
    makeElementDraggable(draggablePanel, dragHandle);
}