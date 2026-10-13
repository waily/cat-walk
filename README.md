# cat-walk

[English](#english) · [正體中文](#正體中文)

```
  /\_/\
 (=^.^=)                                            [Cat-walk:On]
```

---

## English

A Claude Code mod: a text cat walks, sleeps and gets dizzy above the prompt while
you wait for the AI, and beeps when the reply is done.

### Features

- **Walks above the prompt** at a speed that changes at random; stops now and then,
  falls asleep `(=-.-=) z z z`, twitches its ears, and sometimes reels around dizzy `(=@.@=)`.
- **Comes out by itself** when you send a prompt, or after a few idle seconds without typing.
- **Turns its back when you type**: it blushes `(=#.#=)` for 2 seconds, then turns its back `(     ) ~`
  and stands still until the idle time passes or the AI starts working.
- **Toggle** with the `[Cat-walk:On]` / `[Cat-walk:Off]` button at the right of the band, or `/cat`.
- **Beeps when the AI's reply is done** (default: 880 Hz for 0.10 s, then 1320 Hz for 0.15 s),
  and the cat smiles `(=^o^=)` for a moment. Only a reply that ended normally beeps: not Esc,
  an error or a refusal, and never a subagent's turn. `/cat` off silences the beep too.
- **Narrow terminals** (under 40 columns) show only the button.
- **Headless runs** (`claude -p`, the SDK) do not start the mod at all.
- **English and Traditional Chinese**: `/config` titles, the button and `/cat` follow your language.

### Install

```
/plugin install cat-walk --marketplace waily/cat-walk
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every project).

For development, clone the repository and load the folder directly:

```
git clone https://github.com/waily/cat-walk.git
claude --plugin-dir ./cat-walk
```

### Settings

Change them in `/config`. Each row is shown as `<title> · cat-walk`.

| Key | Default | Meaning |
| --- | --- | --- |
| `idleSeconds` | `30` | Seconds without typing before the cat walks out (`off` = never by itself) |
| `style` | `two-line` | `two-line`: ears on a row above the face. `one-line`: one row |
| `speedFastest` | `150` | Fastest speed, ms per column (smaller is faster) |
| `speedSlowest` | `450` | Slowest speed, ms per column |
| `beep` | `on` | Beep after the AI finishes a reply normally (`off` runs nothing) |
| `beepSequence` | `880:100,1320:150` | `Hz:ms` notes, comma separated; Hz `0` is a silent gap. Up to 12 notes, 10–1000 ms, 37–32767 Hz |
| `language` | `auto` | `auto`, `en` or `zh-TW` |

**Language.** `auto` follows Claude Code's own *Language* setting, then the `LC_ALL` /
`LC_MESSAGES` / `LANG` environment variables; anything that is not Traditional Chinese is
English. The row titles, the button and `/cat` are translated; the longer help text in a
setting's pop-up comes from the manifest and stays English, since Claude Code shows it as is.

### What it runs

The beep runs a local player through `$.process.run`, trying in order:
`powershell.exe` (Windows / WSL, `[console]::Beep`), `osascript` (macOS), `paplay` (Linux).
Only bounded integers parsed from `beepSequence` reach the command. If none works, it shows a
Claude Code notification instead. Set `beep` to `off` to run nothing. The beep plays on the
machine running Claude Code. Only PowerShell plays the exact `beepSequence`; `osascript`
plays the system beep once per note and `paplay` plays the system "complete" sound.
Turning the cat off with `/cat` silences only this mod's beep.

It changes no Claude Code settings and does not affect other plugins; it only reads its own
settings and, for `language: auto`, Claude Code's *Language* setting and the locale variables.

---

## 正體中文

一個 Claude Code mod：等待 AI 回覆時，提示框上方有一隻文字貓走來走去、睡覺、偶爾頭暈，
AI 回覆完畢時發出嗶聲提醒。

### 功能

- **在提示框上方散步**：速度隨機變化，偶爾停下、睡著 `(=-.-=) z z z`、抖耳朵，
  有時頭暈亂晃 `(=@.@=)`。
- **自己跑出來**：送出提問時，或閒置幾秒沒打字時出現。
- **打字時轉過身**：先害羞 `(=#.#=)` 2 秒，再轉成背面 `(     ) ~` 原地不動，
  直到閒置時間到或 AI 開始處理，才轉回來繼續走。
- **開關**：按右側的 `[Cat-walk:開啟]`／`[Cat-walk:關閉]` 按鈕，或輸入 `/cat`。
- **AI 回覆完畢時嗶聲**（預設：880 Hz 響 0.10 秒，再 1320 Hz 響 0.15 秒，由低到高），
  貓也會開心一下 `(=^o^=)`。只有正常回答完才響：按 Esc 中斷、出錯或拒絕都不響，
  subagent 也不會。`/cat` 關閉時嗶聲一併靜音。
- **終端機很窄**（不到 40 欄）時只顯示按鈕。
- **無介面模式**（`claude -p`、SDK）完全不啟動。
- **支援英文與正體中文**：`/config` 標題、按鈕和 `/cat` 的回應會依語系切換。

### 安裝

```
/plugin install cat-walk --marketplace waily/cat-walk
```

詢問是否加入 marketplace 時回答 `y`，再選擇範圍（選 user 範圍，每個專案都會載入）。

開發時可 clone 下來直接載入資料夾：

```
git clone https://github.com/waily/cat-walk.git
claude --plugin-dir ./cat-walk
```

### 設定

在 `/config` 中調整，每一列顯示為「標題 · cat-walk」。

| 設定 | 預設 | 說明 |
| --- | --- | --- |
| `idleSeconds` | `30` | 幾秒沒打字貓就自己走出來（`off` = 不自動出來） |
| `style` | `two-line` | `two-line`：耳朵在臉的上一行；`one-line`：只佔一行 |
| `speedFastest` | `150` | 最快速度，毫秒/格（越小越快） |
| `speedSlowest` | `450` | 最慢速度，毫秒/格 |
| `beep` | `on` | AI 正常回答完畢後嗶聲（`off` 則不執行任何指令） |
| `beepSequence` | `880:100,1320:150` | `頻率Hz:毫秒`，以逗號分隔；頻率 `0` 為靜音間隔。最多 12 個音，每個 10–1000 毫秒、37–32767 Hz |
| `language` | `auto` | `auto`、`en` 或 `zh-TW` |

**語言**：`auto` 會先看 Claude Code 自己的 *Language* 設定，再看環境變數
`LC_ALL`／`LC_MESSAGES`／`LANG`；不是正體中文就用英文。設定列的標題、按鈕和 `/cat`
會翻譯；設定彈出視窗裡較長的說明文字由 Claude Code 直接取自 manifest，因此維持英文。

### 會執行什麼

嗶聲透過 `$.process.run` 呼叫本機播放程式，依序嘗試：`powershell.exe`（Windows／WSL，
`[console]::Beep`）、`osascript`（macOS）、`paplay`（Linux）。傳給指令的只有從
`beepSequence` 解析出、經過範圍檢查的整數。全部失敗時改用 Claude Code 的通知。
把 `beep` 設為 `off` 就完全不執行。嗶聲在執行 Claude Code 的那台機器上播放。
只有 PowerShell 會照 `beepSequence` 播放；`osascript` 依音符數播放系統嗶聲，`paplay`
播放系統的「完成」音效。用 `/cat` 關閉時，只會靜音這個 mod 的嗶聲。

它不會修改 Claude Code 的任何設定，也不影響其他 plugin；只讀取自己的設定，以及在
`language: auto` 時讀取 Claude Code 的 *Language* 設定和語系環境變數。

---

## License / 授權

MIT © Waily Yang
