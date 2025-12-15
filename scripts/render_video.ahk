; scripts/render_video.ahk
; 優化版 v3 (解決輸入法亂碼問題)

; --- 0. 設定區 ---
SetTitleMatchMode, 2
CoordMode, Mouse, Window
SetKeyDelay, 50

; --- 參數讀取 ---
MidiPath = %1%
WavPath = %2%
VideoOutputPath = %3%

; 檢查參數
if (MidiPath = "")
{
    MsgBox, Error: 未接收到 MIDI 路徑參數
    ExitApp
}

; --- 1. 啟動程式 ---
Run, "scripts\piano_vfx\piano_vfx\Piano VFX.exe"

WinWait, Piano VFX, , 5
if ErrorLevel
{
    MsgBox, Error: Cannot find Piano VFX's Window
    ExitApp
}

WinActivate, Piano VFX
WinWaitActive, Piano VFX
Sleep, 4000 

; --- 2. 匯入 MIDI ---
Click, 60, 95
Sleep, 500

; 等待「開啟舊檔」視窗
WinWaitActive, ahk_class #32770, , 5
if ErrorLevel
{
    MsgBox, Error: MIDI selection window didn't come out.
    ExitApp
}

; 【修正重點 1】改用剪貼簿貼上，避開輸入法
Clipboard := MidiPath  ; 把路徑存入剪貼簿
ClipWait, 1            ; 等待剪貼簿準備好
Send, ^v               ; 傳送 Ctrl + V (貼上)
Sleep, 500
Send, {Enter}
Sleep, 500

; --- 3. 匯入 WAV ---
WinActivate, Piano VFX
Sleep, 500

Click, 60, 131
Sleep, 500

WinWaitActive, ahk_class #32770, , 5
if ErrorLevel
{
    MsgBox, Error: WAV selection window didn't come out.
    ExitApp
}

; 【修正重點 2】WAV 也要改成貼上
Clipboard := WavPath
ClipWait, 1
Send, ^v
Sleep, 500
Send, {Enter}
Sleep, 500

; --- 4. 從主 UI 點擊 Render---
WinActivate, Piano VFX
Click, 285, 242 
Sleep, 500

; --- 5. 設定 PATH 輸出資料夾路徑 ---
WinActivate, Piano VFX
Click, 88, 120
Sleep, 500

WinWaitActive, ahk_class #32770, , 5
if ErrorLevel
{
    MsgBox, Error: PATH selection window didn't come out.
    ExitApp
}
; 輸出路徑也要改成貼上
Clipboard := VideoOutputPath
ClipWait, 1
Send, ^v
Sleep, 500
Send, {Enter}
Sleep, 500
Send, {Enter}
Sleep, 300

; -- 6. click Render, 真正開始渲染
Click, 209, 115
Sleep 1000

; --- 6. 監控渲染 (deprecated) ---
; 等待 18.5 秒 (寫死的秒數,希望有其他辦法偵測)
; Sleep, 18500 

; --- 6. 監控渲染 (智能偵測修復版) ---

; 【修正 1】設定 Pixel 搜尋模式為「相對視窗」，這很重要！
CoordMode, Pixel, Window

; 【修正 2】使用 A_ScriptDir 確保路徑正確
TargetImage := A_ScriptDir . "\done_msg.png"

; 【除錯】檢查圖片是否存在 (這行能幫你確認是否路徑錯了)
if !FileExist(TargetImage)
{
    MsgBox, Error: 找不到特徵圖片! `n請確認檔案位於: %TargetImage%
    ExitApp
}

; 設定最大等待時間 (秒)
MaxWaitSeconds := 300
StartTime := A_TickCount

Loop
{
    ; 1. 檢查是否超時
    ElapsedTime := (A_TickCount - StartTime) / 1000
    if (ElapsedTime > MaxWaitSeconds)
    {
        MsgBox, Error: Rendering timed out (Image not found).
        break
    }

    ; 2. 搜尋圖片
    ; 說明: 0,0 到 視窗寬,視窗高。 *50 是容錯值
    ImageSearch, FoundX, FoundY, 0, 0, A_ScreenWidth, A_ScreenHeight, *50 %TargetImage%

    ; ErrorLevel = 0 (找到), 1 (沒找到), 2 (圖片檔有問題)
    if (ErrorLevel = 0)
    {
        ; 找到了！
        Sleep, 2000 
        Break
    }
    else if (ErrorLevel = 2)
    {
        MsgBox, Critical Error: ImageSearch 無法讀取圖片檔案 (ErrorLevel 2)
        ExitApp
    }

    Sleep, 1000
}

; --- 7. 結束程序 ---
WinClose, Piano VFX
WinWaitClose, Piano VFX, , 2
if ErrorLevel
{
    Process, Close, Piano VFX.exe
}
ExitApp