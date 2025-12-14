const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // 讓前端可以透過 http://localhost:3000 訪問
app.use('/midi', express.static('midi')); // 開放 MIDI 資料夾下載

// --- 簡單的佇列系統 (Queue System) ---
// 這是為了防止多個請求同時開啟 Piano VFX (未來功能)
// 目前先用來依序處理 Python 請求

const jobQueue = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || jobQueue.length === 0) return;

    isProcessing = true;
    const { params, res, timestamp } = jobQueue.shift();

    console.log(`[Queue] 開始處理任務: ${timestamp}`);

    try {
        // 1. 定義檔案路徑
        const filename = `melody_${timestamp}.mid`;
        const outputPath = path.join(__dirname, 'midi', filename);
        const scriptPath = path.join(__dirname, 'scripts', 'midigenapp_cli.py');

        // 2. 呼叫 Python 爬蟲
        console.log(`[Python] 執行爬蟲...`);
        const pythonProcess = spawn('python', [
            scriptPath,
            '--params', JSON.stringify(params),
            '--output', outputPath
        ]);

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            // Python 的 sys.stderr.write 會到這裡，用來顯示進度但不影響結果
            console.error(`[Python Log]: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            // 處理 Python 輸出的結果 (去除換行符號)
            const result = outputData.trim();

            if (code === 0 && fs.existsSync(result)) {
                console.log(`[Success] MIDI 生成於: ${result}`);
                
                // TODO: 下一步會在這裡加入 TiMidity 和 AutoHotkey 的呼叫邏輯
                
                // 目前先直接回傳 MIDI 下載連結
                res.json({
                    success: true,
                    message: "MIDI 生成成功",
                    midiUrl: `http://localhost:${PORT}/midi/${filename}`,
                    filename: filename
                });
            } else {
                console.error(`[Error] Python 腳本失敗: ${result}`);
                res.status(500).json({ success: false, message: "生成失敗", error: result });
            }
            
            // 任務結束，處理下一個
            isProcessing = false;
            processQueue();
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ success: false, error: error.message });
        isProcessing = false;
        processQueue();
    }
};

// --- API Routes ---
app.post('/api/generate', (req, res) => {
    const params = req.body;
    console.log("收到生成請求:", params);

    // 將請求加入佇列
    jobQueue.push({
        params,
        res,
        timestamp: Date.now()
    });

    console.log(`[Queue] 任務已加入，目前佇列長度: ${jobQueue.length}`);
    processQueue();
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // 確保資料夾存在
    if (!fs.existsSync('midi')) fs.mkdirSync('midi');
    if (!fs.existsSync('sounds')) fs.mkdirSync('sounds');
    if (!fs.existsSync('videos')) fs.mkdirSync('videos');
});