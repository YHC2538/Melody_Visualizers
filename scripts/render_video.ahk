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
Run, "D:\webdev_final\scripts\piano_vfx\piano_vfx\Piano VFX.exe"

WinWait, Piano VFX, , 5
if ErrorLevel
{
    MsgBox, Error: Cannot find Piano VFX's Window
    ExitApp
}

WinActivate, Piano VFX
WinWaitActive, Piano VFX
Sleep, 3000 

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
Sleep 700

; --- 6. 監控渲染 ---
; 等待 15 秒 (你可以根據生成長度調整這裡)
Sleep, 17500 

; 關閉程式
WinClose, Piano VFX
ExitApp