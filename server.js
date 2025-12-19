const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); 
app.use('/midi', express.static('midi')); 
app.use('/videos', express.static('videos')); // 記得開放 videos



// --- 輔助函式 ---

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn(`[Exec Warning] ${stderr}`);
                if (error.code !== 0) reject(error);
                else resolve(stdout);
            } else {
                resolve(stdout);
            }
        });
    });
}

function waitForNewFile(directory, startTime, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const checkInterval =1000;
        let elapsedTime = 0;
        console.log(`[Watcher] 開始監聽資料夾: ${directory}, 基準時間: ${startTime}`);

        const timer = setInterval(() => {
            elapsedTime += checkInterval;
            fs.readdir(directory, (err, files) => {
                if (err) { clearInterval(timer); reject(err); return; }

                const newFiles = files
                    .filter(file => file.startsWith('Piano-VFX') && file.endsWith('.mp4'))
                    .map(file => {
                        const filePath = path.join(directory, file);
                        const stats = fs.statSync(filePath);
                        return { file, mtime: stats.mtimeMs, size: stats.size };
                    })
                    .filter(fileObj => fileObj.mtime > (startTime - 5000))
                    .sort((a, b) => b.mtime - a.mtime);

                if (newFiles.length > 0 && newFiles[0].size > 0) {
                    console.log(`[Watcher] 發現新檔案: ${newFiles[0].file}`);
                    clearInterval(timer);
                    resolve(newFiles[0].file);
                }
            });

            if (elapsedTime >= timeout) {
                clearInterval(timer);
                reject(new Error("Timeout: 沒有發現新生成的影片檔案"));
            }
        }, checkInterval);
    });
}

// --- 渲染佇列系統 (Render Queue System) ---
// 只針對需要 "搶佔滑鼠/螢幕" 的任務 (TiMidity + AHK)
const renderQueue = [];
let isRendering = false;
let currentRenderingJob = null; // 追蹤正在執行的任務

// 防護機制變數
const userCooldowns = new Map(); // 記錄 IP 的冷卻時間: IP -> Timestamp
const activeIPs = new Set();     // 記錄目前正在排隊或渲染的 IP
const COOLDOWN_TIME = 60 * 1000; // 冷卻時間：60 秒
const AVG_RENDER_TIME = 60 * 1000; // 預估平均渲染時間：60 秒

// 取得客戶端 IP 的輔助函式
function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

const processRenderQueue = async () => {
    if (isRendering || renderQueue.length === 0) return;

    isRendering = true;
    const job = renderQueue.shift();
    currentRenderingJob = job; // 標記當前任務
    
    const { midiFilename, res, userIp } = job; // 取出 userIp
    
    // 從檔名 (melody_123.mid) 提取 timestamp (123)
    // 假設格式固定為 melody_TIMESTAMP.mid
    const timestamp = midiFilename.replace('melody_', '').replace('.mid', '');
    
    console.log(`[Render Queue] 開始處理渲染任務: ${midiFilename}`);

    const wavFilename = `melody_${timestamp}.wav`;
    const videoFilename = `melody_${timestamp}.mp4`; 

    const midiPath = path.join(__dirname, 'midi', midiFilename);
    const wavPath = path.join(__dirname, 'sounds', wavFilename);
    const videoDir = path.join(__dirname, 'videos');
    
    // 請確認路徑
    const ahkScriptPath = path.join(__dirname, 'scripts', 'render_video.ahk');
    const soundFontPath = path.join(__dirname, 'tools', 'FluidR3_GM.sf2'); 
    const timidityPath = 'tools/TiMidity++-2.15.0/timidity.exe'; 
    const ahkExePath = path.join(__dirname, 'scripts', 'AutoHotkeyU64.exe');

    try {
        // --- Step 1: 檢查 MIDI 是否存在 ---
        if (!fs.existsSync(midiPath)) {
            throw new Error(`找不到 MIDI 檔案: ${midiFilename}`);
        }

        // --- Step 2: TiMidity 轉檔 (MIDI -> WAV) ---
        console.log(`[Step 2] TiMidity 轉檔 WAV...`);
        const safeSoundFontPath = soundFontPath.replace(/\\/g, '/');
        const safeMidiPath = midiPath.replace(/\\/g, '/');
        const safeWavPath = wavPath.replace(/\\/g, '/');
        const safeTimidityPath = timidityPath.replace(/\\/g, '/');

        const timidityCommand = `"${safeTimidityPath}" "${safeMidiPath}" -Ow -o "${safeWavPath}" -x "soundfont \\"${safeSoundFontPath}\\""`;
        await executeCommand(timidityCommand);

        // --- Step 3: AHK 自動化渲染 ---
        console.log(`[Step 3] 啟動 AutoHotkey 自動化渲染...`);
        const renderStartTime = Date.now();
        const ahkCommand = `"${ahkExePath}" "${ahkScriptPath}" "${midiPath}" "${wavPath}" "${videoDir}"`;
        
        console.log(`執行 AHK 指令: ${ahkCommand}`);
        await executeCommand(ahkCommand);

        // --- Step 4: 等待影片輸出與重命名 ---
        console.log(`[Step 4] 等待影片輸出...`);
        const generatedFilename = await waitForNewFile(videoDir, renderStartTime);
        
        const originalVideoPath = path.join(videoDir, generatedFilename);
        const finalVideoPath = path.join(videoDir, videoFilename);
        
        await new Promise(r => setTimeout(r, 1000)); // 釋放鎖定
        
        // 如果目標檔案已存在，先刪除避免錯誤
        if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
        
        fs.renameSync(originalVideoPath, finalVideoPath);

        // 設定冷卻時間
        userCooldowns.set(userIp, Date.now() + COOLDOWN_TIME);

        console.log(`[Rename] 檔案已重新命名為: ${videoFilename}`);

        res.json({
            success: true,
            message: "影片生成成功",
            videoUrl: `http://localhost:${PORT}/videos/${videoFilename}`,
            filename: videoFilename
        });

    } catch (error) {
        console.error("Render Task Error:", error);
        res.status(500).json({ success: false, message: "渲染失敗", error: error.message });
    } finally {
        // 清理狀態
        activeIPs.delete(userIp); // 移除活躍 IP，允許該使用者重新排隊
        isRendering = false;
        currentRenderingJob = null;
        processRenderQueue();
    }
};


// --- API Routes ---

// 1. 生成 MIDI (獨立處理，不卡 Queue)
app.post('/api/generate-midi', async (req, res) => {
    const params = req.body;
    const timestamp = Date.now();
    const midiFilename = `melody_${timestamp}.mid`;
    const midiPath = path.join(__dirname, 'midi', midiFilename);
    const scriptPath = path.join(__dirname, 'scripts', 'midigenapp_cli.py');

    console.log(`[MIDI API] 收到生成請求: ${midiFilename}`);

    try {
        await new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [
                scriptPath,
                '--params', JSON.stringify(params),
                '--output', midiPath
            ]);
            
            // 簡單的 log 處理
            pythonProcess.stdout.on('data', (d) => console.log(`[Python]: ${d}`));
            pythonProcess.stderr.on('data', (d) => console.error(`[Python Err]: ${d}`));

            pythonProcess.on('close', (code) => {
                if (code === 0 && fs.existsSync(midiPath)) resolve();
                else reject(new Error("Python script execution failed"));
            });
        });

        console.log(`[MIDI API] 生成成功: ${midiFilename}`);
        res.json({
            success: true,
            message: "MIDI 生成成功",
            midiUrl: `http://localhost:${PORT}/midi/${midiFilename}`,
            filename: midiFilename, // 回傳檔名供下一步使用
            timestamp: timestamp
        });

    } catch (error) {
        console.error("MIDI Gen Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. 渲染影片 (加入防護邏輯)
app.post('/api/render-video', (req, res) => {
    const { midiFilename } = req.body;
    const userIp = getClientIp(req);
    
    if (!midiFilename) return res.status(400).json({ success: false, error: "缺少 MIDI 檔名" });

    // --- 防護檢查 1: 是否已經在排隊或執行中 ---
    if (activeIPs.has(userIp)) {
        return res.status(429).json({ 
            success: false, 
            error: "您已經有一個影片正在渲染或排隊中，請耐心等候。" 
        });
    }

    // --- 防護檢查 2: 冷卻時間 ---
    const cooldownEnd = userCooldowns.get(userIp);
    if (cooldownEnd && Date.now() < cooldownEnd) {
        const waitSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000);
        return res.status(429).json({ 
            success: false, 
            error: `伺服器忙碌，請等待 ${waitSeconds} 秒後再試。` 
        });
    }

    console.log(`[Render API] 收到渲染請求: ${midiFilename} (IP: ${userIp})`);

    // 加入活躍名單
    activeIPs.add(userIp);

    // 加入佇列 (附帶 IP)
    renderQueue.push({
        midiFilename,
        res,
        userIp // 記錄是誰請求的
    });

    console.log(`[Queue] 渲染任務已加入，目前排隊數: ${renderQueue.length}`);
    processRenderQueue();
});

// 3. 【新增】查詢排隊狀態 API
app.get('/api/queue-status', (req, res) => {
    const userIp = getClientIp(req);
    const { filename } = req.query; // 前端傳來它正在等的檔案名稱

    // 檢查是否正在渲染
    if (currentRenderingJob && currentRenderingJob.userIp === userIp && currentRenderingJob.midiFilename === filename) {
        return res.json({ status: 'rendering', position: 0, waitTime: '處理中...' });
    }

    // 檢查在佇列中的位置
    const queueIndex = renderQueue.findIndex(job => job.userIp === userIp && job.midiFilename === filename);

    if (queueIndex !== -1) {
        // 在隊伍中 (前面還有 queueIndex 個人 + 正在渲染的那 1 個)
        // 順位 = index + 1
        const position = queueIndex + 1;
        // 預估時間 = (排在前面的人數 + 正在做的那個人) * 平均時間
        // 如果現在沒有人在做 (isRendering=false)，就少算一個
        const pendingJobsCount = isRendering ? (queueIndex + 1) : (queueIndex); 
        const estimatedSeconds = pendingJobsCount * (AVG_RENDER_TIME / 1000);
        
        return res.json({ 
            status: 'queued', 
            position: position, 
            waitTime: `${Math.ceil(estimatedSeconds)} 秒` 
        });
    }

    // 找不到紀錄 (可能是做完了，或根本沒請求)
    return res.json({ status: 'unknown', position: -1, waitTime: '--' });
});


// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (!fs.existsSync('midi')) fs.mkdirSync('midi');
    if (!fs.existsSync('sounds')) fs.mkdirSync('sounds');
    if (!fs.existsSync('videos')) fs.mkdirSync('videos');
});