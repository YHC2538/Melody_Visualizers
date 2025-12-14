# MidiGen 使用手冊

## 概述

MidiGen 是一個強大的 Python MIDI 音樂生成庫，支援音樂理論、隨機生成、人性化處理和 MIDI 檔案輸出。這個庫不僅可以創建固定的音樂模式，更重要的是具備豐富的隨機生成功能。

## 安裝

```bash
pip install midigen>=0.0.13
```

## 核心模組

### 1. 音符與調性 (Notes & Keys)

#### 基本音符
```python
from midigen.notes import Note
from midigen.keys import Key, Mode

# 基本音符 (C4 = 60)
Note.C        # 60
Note.C_SHARP  # 61 (也可以寫 Note.Db)
Note.D        # 62
# ... 以此類推

# 不同八度的音符
Note.C.value_for_octave(3)  # C3 = 48
Note.C.value_for_octave(5)  # C5 = 72
```

#### 調性與模式
```python
# 創建調性
c_major = Key(Note.C, Mode.Major)
a_minor = Key(Note.A, Mode.Minor)
d_dorian = Key(Note.D, Mode.Dorian)

# 獲取調內音符
c_major.note(1)  # C (主音)
c_major.note(5)  # G (屬音)
c_major.note(3)  # E (中音)

# 生成三和弦與七和弦
triad = c_major.triad()                    # [60, 64, 67] (C-E-G)
seventh = c_major.chord(extensions=[7])    # [60, 64, 67, 71] (C-E-G-B)

# 調性關係
relative_minor = c_major.relative_key(6)   # A minor
dominant = c_major.relative_key(5)         # G Mixolydian
```

### 2. 時間簽名與節拍 (Time & Measures)

```python
from midigen.time import TimeSignature, Measure

# 時間簽名
time_sig = TimeSignature(4, 4)  # 4/4 拍
waltz = TimeSignature(3, 4)     # 3/4 拍

# 創建小節模式
pattern = [
    [Note.C.value],           # 第一拍：C
    None,                     # 第二拍：休息
    [Note.E.value, Note.G.value],  # 第三拍：E+G 和弦
    None                      # 第四拍：休息
]

measure = Measure.from_pattern(
    pattern=pattern,
    time_signature=TimeSignature(4, 4),
    velocity=90,
    duration=0.5
)
```

### 3. 軌道與歌曲 (Tracks & Songs)

```python
from midigen.sequencer import Track, Song

# 從小節創建軌道
chord_progression = [2, 5, 1, 6]  # ii-V-I-vi
measures = [
    Measure.from_pattern(
        pattern=[key.relative_key(degree).triad()] * 4,
        time_signature=TimeSignature(4, 4),
        velocity=80
    )
    for degree in chord_progression
]

track = Track.from_measures(measures, channel=0, program=1)

# 組合多個軌道
song = Song([track])
song.to_midi('my_song.mid', tempo=120)
```

## 🎲 隨機生成功能

### 1. 馬可夫鏈音樂生成

MidiGen 的核心隨機生成功能基於馬可夫鏈算法：

```python
from midigen.markov import Graph
from midigen.keys import CMajor

# 創建音樂圖形
graph = Graph(
    key=CMajor,
    min_note=Note.C.value_for_octave(3),    # C3
    max_note=Note.C.value_for_octave(5),    # C5
    degrees=[1, 2, 3, 4, 5, 6, 7]          # 使用所有調內音
)

# 生成隨機序列
random_melody = graph.generate_sequence(length=16)
print(f"隨機旋律: {random_melody}")

# 為多個調性生成連貫的序列
keys = [
    Key(Note.C, Mode.Major),
    Key(Note.F, Mode.Major),
    Key(Note.G, Mode.Major),
    Key(Note.C, Mode.Major)
]

sequences = graph.sequences_for_keys(keys, notes_per_key=8)
```

### 2. 增強連接權重

```python
# 強化特定音程連接
graph = Graph(key=CMajor).strengthen_connections([
    (CMajor.note(1), CMajor.note(5)),  # 主音到屬音
    (CMajor.note(5), CMajor.note(1)),  # 屬音回主音
    (CMajor.note(7), CMajor.note(1)),  # 導音到主音
], weight=5.0)

# 生成更有調性感的旋律
tonal_melody = graph.generate_sequence(32)
```

### 3. 隨機貝斯線生成

```python
# 專門為貝斯聲部生成
bass_graph = Graph(
    key=CMajor,
    min_note=Note.E.value_for_octave(1),
    max_note=Note.E.value_for_octave(3),
    degrees=[1, 5]  # 只使用主音和屬音
)

bass_patterns = bass_graph.sequences_for_keys(
    [Key(Note.C, Mode.Major), Key(Note.F, Mode.Major)],
    notes_per_key=4
)
```

## 🎵 人性化處理

MidiGen 提供多種人性化效果，讓機器生成的音樂更自然：

### 1. 搖擺節奏 (Swing)
```python
from midigen.humanize import swing

# 添加搖擺感
swung_measure = measure.mutate(lambda m: swing(m, swing=0.1))
```

### 2. 時間隨機化
```python
from midigen.humanize import randomize_time, randomize_velocity

# 輕微的時間偏移，模擬真人演奏
humanized = measure.mutate(lambda m: randomize_time(m, beat_frac=0.02))

# 力度變化
dynamic = measure.mutate(lambda m: randomize_velocity(m, frac=0.1))
```

### 3. 音符丟失 (Dropout)
```python
from midigen.humanize import dropout

# 隨機丟失一些音符，創造空間感
sparse = measure.mutate(lambda m: dropout(m, dropout_frac=0.2))
```

### 4. 脈衝效果
```python
from midigen.humanize import pulse

# 創造強弱拍對比
pulsed = measure.mutate(lambda m: pulse(m, ducking=0.3))
```

## 🥁 節奏模式

```python
from midigen import rhythm

# 預設節奏模式
kick_pattern = rhythm.four_on_the_floor()          # 四四拍底鼓
hihat_pattern = rhythm.straight_16ths()            # 十六分音符踩鎽
clave_pattern = rhythm.son_clave()                 # 森巴克拉維
brush_pattern = rhythm.brushes()                   # 刷子節奏

# 組合鼓軌
drum_track = Track.from_measures([
    kick_pattern, hihat_pattern, clave_pattern
], channel=9, stack=True, name='drums')
```

## 🎼 完整的隨機音樂生成範例

```python
import random
from midigen.notes import Note
from midigen.keys import Key, Mode
from midigen.time import TimeSignature, Measure
from midigen.sequencer import Song, Track
from midigen.markov import Graph
from midigen.humanize import *
from midigen import rhythm

def generate_random_song():
    # 隨機選擇調性
    root_notes = [Note.C, Note.D, Note.E, Note.F, Note.G, Note.A, Note.B]
    modes = [Mode.Major, Mode.Minor, Mode.Dorian, Mode.Mixolydian]
    
    key = Key(random.choice(root_notes), random.choice(modes))
    tempo = random.randint(80, 140)
    
    # 隨機和弦進行
    progressions = [
        [1, 4, 5, 1],      # I-IV-V-I
        [1, 6, 4, 5],      # I-vi-IV-V
        [6, 4, 1, 5],      # vi-IV-I-V (流行進行)
        [2, 5, 1, 6],      # ii-V-I-vi (爵士進行)
        [1, 7, 6, 6],      # I-vii-vi-vi
        [1, 3, 6, 4]       # I-iii-vi-IV
    ]
    
    progression = random.choice(progressions)
    
    # 生成和弦軌道
    chord_measures = []
    for degree in progression:
        rel_key = key.relative_key(degree)
        chord_pattern = [rel_key.chord(extensions=[7])] * 4
        
        measure = Measure.from_pattern(
            pattern=chord_pattern,
            time_signature=TimeSignature(4, 4),
            velocity=random.randint(50, 80),
            duration=0.7
        )
        
        # 隨機人性化處理
        if random.random() > 0.5:
            measure = measure.mutate(lambda m: swing(m, random.uniform(0.02, 0.08)))
        if random.random() > 0.3:
            measure = measure.mutate(lambda m: randomize_velocity(m, random.uniform(0.05, 0.15)))
            
        chord_measures.append(measure)
    
    chords = Track.from_measures(chord_measures, channel=0, program=1)
    
    # 生成隨機旋律
    melody_graph = Graph(
        key=key,
        min_note=key.note(1).value_for_octave(4),
        max_note=key.note(1).value_for_octave(6),
        degrees=list(range(1, 8))
    )
    
    # 強化調性連接
    melody_graph.strengthen_connections([
        (key.note(i), key.note(1)) for i in range(2, 8)  # 所有音回到主音
    ], weight=3.0)
    
    melody_keys = [key.relative_key(deg) for deg in progression]
    melody_sequences = melody_graph.sequences_for_keys(melody_keys, notes_per_key=8)
    
    melody_measures = []
    for seq in melody_sequences:
        measure = Measure.from_pattern(
            pattern=[[note] if random.random() > 0.2 else None for note in seq],
            time_signature=TimeSignature(4, 4),
            velocity=random.randint(80, 110),
            duration=random.uniform(0.3, 0.8)
        )
        
        # 隨機效果
        measure = measure.mutate(lambda m: dropout(m, random.uniform(0.1, 0.3)))
        measure = measure.mutate(lambda m: randomize_time(m, random.uniform(0.01, 0.03)))
        
        melody_measures.append(measure)
    
    melody = Track.from_measures(melody_measures, channel=1, program=random.randint(1, 40))
    
    # 隨機貝斯線
    bass_graph = Graph(
        key=key,
        min_note=key.note(1).value_for_octave(2),
        max_note=key.note(1).value_for_octave(4),
        degrees=[1, 5, 3]  # 主音、屬音、中音
    )
    
    bass_sequences = bass_graph.sequences_for_keys(melody_keys, notes_per_key=4)
    bass_measures = [
        Measure.from_pattern(
            pattern=[[note] for note in seq],
            time_signature=TimeSignature(4, 4),
            velocity=random.randint(90, 120),
            duration=0.8
        )
        for seq in bass_sequences
    ]
    
    bass = Track.from_measures(bass_measures, channel=2, program=33)  # Acoustic Bass
    
    # 隨機鼓點
    drum_patterns = [
        rhythm.four_on_the_floor(),
        rhythm.straight_16ths(),
        rhythm.son_clave()
    ]
    
    drums = Track.from_measures([
        random.choice(drum_patterns).mutate(
            lambda m: randomize_velocity(m, 0.2)
        ) for _ in range(len(progression))
    ], channel=9, stack=True)
    
    # 組成歌曲
    song = Song([chords, melody, bass, drums])
    
    # 生成檔名
    filename = f"random_song_{random.randint(1000, 9999)}.mid"
    song.to_midi(f"generate/output/{filename}", tempo=tempo)
    
    return filename, key, tempo, progression

# 生成隨機音樂
if __name__ == "__main__":
    for i in range(5):
        filename, key, tempo, progression = generate_random_song()
        print(f"生成: {filename}")
        print(f"調性: {key}")
        print(f"速度: {tempo} BPM")
        print(f"進行: {progression}")
        print("-" * 40)
```

## 🎹 樂器支援

MidiGen 支援 GM (General MIDI) 標準的 128 種樂器：

```python
from midigen.instruments import INSTRUMENTS

# 常用樂器程式號
piano = INSTRUMENTS['Acoustic Grand Piano']  # 1
guitar = INSTRUMENTS['Acoustic Guitar (steel)']  # 26
bass = INSTRUMENTS['Acoustic Bass']  # 33
strings = INSTRUMENTS['String Ensemble 1']  # 49
trumpet = INSTRUMENTS['Trumpet']  # 57
flute = INSTRUMENTS['Flute']  # 74
kalimba = INSTRUMENTS['Kalimba']  # 109

# 在軌道中使用樂器
track = Track.from_measures(measures, channel=0, program=piano)
```

## 🎛️ 命令行工具

MidiGen 還提供命令行介面：

```bash
# 基本和弦進行
python -m midigen.generate -k C -c maj7 m7 maj7 m7 -o output.mid -t 100

# 添加效果
python -m midigen.generate -k F -c "Imaj7" "vi7" "IVmaj7" "V7" \
    --swing 0.05 --randomize 0.02 --loop 2 -o jazz.mid
```

## 總結

MidiGen **並非**只能產生固定音樂，實際上它具備強大的隨機生成能力：

### 隨機生成功能包括：
1. **馬可夫鏈旋律生成** - 基於機率的音符序列
2. **隨機和弦進行選擇** - 從多種進行中隨機選擇
3. **隨機調性和速度** - 動態選擇音樂參數
4. **隨機人性化效果** - 時間、力度、音符的隨機變化
5. **隨機樂器選擇** - 從 128 種 MIDI 樂器中選擇
6. **隨機節奏模式** - 多種鼓點組合

### 固定功能包括：
1. **音樂理論架構** - 調性、音階、和弦理論
2. **MIDI 標準支援** - 標準的 MIDI 檔案格式
3. **樂器映射** - GM 標準樂器對照

MidiGen 是一個平衡了音樂理論嚴謹性和創作隨機性的強大工具，既可以創作結構化的音樂，也能生成充滿驚喜的隨機作品。

## 進階技巧

### 1. 自定義權重系統
```python
# 創建具有特定風格偏好的生成器
jazz_weights = [0.1, 0.3, 0.2, 0.4, 0.5, 0.3, 0.2]  # 偏愛某些音程
jazz_graph = Graph(key=CMajor, edge_weights=jazz_weights)
```

### 2. 多層次隨機化
```python
def multi_humanize(measure):
    """應用多層人性化效果"""
    effects = [
        (swing, random.uniform(0.02, 0.06)),
        (randomize_time, random.uniform(0.01, 0.03)),
        (randomize_velocity, random.uniform(0.05, 0.15)),
        (dropout, random.uniform(0.05, 0.2)),
        (pulse, random.uniform(0.1, 0.3))
    ]
    
    result = measure
    for effect, amount in effects:
        if random.random() > 0.3:  # 70% 機率應用每個效果
            result = result.mutate(lambda m: effect(m, amount))
    
    return result
```

### 3. 風格化生成器
```python
def generate_ambient_music():
    """生成環境音樂風格"""
    key = Key(random.choice([Note.C, Note.F, Note.G]), Mode.Major)
    
    # 使用延展音色
    pad_sounds = [89, 90, 91, 92, 93, 94, 95, 96]  # Pad 音色
    
    # 緩慢的和弦變化
    progression = [1, 4, 6, 5]
    
    # 長音符，低力度
    measures = [
        Measure.from_pattern(
            pattern=[key.relative_key(deg).chord()] * 2,  # 較少密度
            velocity=random.randint(30, 50),  # 輕柔力度
            duration=2.0  # 長音符
        )
        for deg in progression
    ]
    
    return Track.from_measures(
        measures, 
        program=random.choice(pad_sounds)
    )
```

這個使用手冊展示了 MidiGen 的完整功能範圍，從基礎的音樂理論操作到進階的隨機生成技術，證明它是一個功能豐富且靈活的音樂創作工具。
