import requests
import time
import os
import sys
import json
import argparse

# 繼承原本的 Class，但稍作修改以適應 CLI
class MIDIGENClient:
    def __init__(self):
        self.base_url = "https://midigen.app"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Referer': 'https://midigen.app/melody-generator/',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded'
        })
    
    def generate_midi(self, params):
        # 為了避免 log 汙染 Node.js 的輸出，我們可以把一般的 print 輸出到 stderr
        # 只有最後的結果輸出到 stdout
        sys.stderr.write(f"正在生成 MIDI，參數: {params}\n")
        
        # 模擬人類操作的延遲 (可根據需求縮短)
        time.sleep(0.3)
        
        payload = {
            'scale': params.get('scale', 'Major Scale'),
            'key': params.get('key', '0'),
            'bars': params.get('bars', '4'),
            'tempo': params.get('tempo', '120'),
            'note_duration': params.get('note_duration', '0.5'),
            'octave': params.get('octave', '0'),
            'include_arpeggios': 'on' if params.get('include_arpeggios') == 'on' else None,
            'include_rests': 'on' if params.get('include_rests') == 'on' else None,
            'include_chords': 'on' if params.get('include_chords') == 'on' else None,
            # 其他預設值
            'arpeggio_mode': '1',
            'rests_mode': 'default',
            'chords_mode': 'normal'
        }
        
        payload = {k: v for k, v in payload.items() if v is not None}
        
        try:
            response = self.session.post(f"{self.base_url}/generate", data=payload, timeout=30)
            if response.status_code == 200 and response.content[:4] == b'MThd':
                return response.content
            else:
                sys.stderr.write(f"Error: Status {response.status_code}\n")
                return None
        except Exception as e:
            sys.stderr.write(f"Exception: {e}\n")
            return None

    def save_midi(self, midi_data, filename):
        if midi_data:
            try:
                os.makedirs(os.path.dirname(filename), exist_ok=True)
                with open(filename, 'wb') as f:
                    f.write(midi_data)
                return True
            except Exception as e:
                sys.stderr.write(f"Save Error: {e}\n")
                return False
        return False

if __name__ == "__main__":
    # 解析命令列參數
    parser = argparse.ArgumentParser()
    parser.add_argument('--params', type=str, required=True, help='JSON string of parameters')
    parser.add_argument('--output', type=str, required=True, help='Output filename')
    args = parser.parse_args()

    try:
        params = json.loads(args.params)
        output_path = args.output
        
        client = MIDIGENClient()
        midi_data = client.generate_midi(params)
        
        if midi_data:
            if client.save_midi(midi_data, output_path):
                # 這是最重要的：成功時只 print 檔案路徑，讓 Node.js 抓取
                print(output_path) 
            else:
                print("ERROR: SAVE_FAILED")
        else:
            print("ERROR: GEN_FAILED")
            
    except Exception as e:
        print(f"ERROR: {e}")