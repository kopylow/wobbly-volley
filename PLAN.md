# Wobbly Volley: build plan

A mod for Claude Code. A small volleyball game in the style of Blobby Volley appears in the band above the prompt while Claude works on a turn, so waiting time becomes play time.

* Status: design finished on 2026-10-06. M0 (project setup) done on 2026-10-06. M1 (prototypes P1 and P2) done on 2026-10-06: architecture A is chosen. D3 widened on 2026-10-06: held keys also on WSL, Linux and macOS (section 11). M2 (P4 on Windows) done on 2026-10-06: held keys pass on Windows. M3 (core) done on 2026-10-06. M4 (drawing) done on 2026-10-06. D3 changed on 2026-10-06 by the user: WASD is the only movement and the mouse only clicks, so M6's key work moved into M5; taps were tried and dropped, and where no key helper runs there is no game. M5 (play with WASD) done on 2026-10-06. M7 (turn lifecycle) done on 2026-10-07. M8 (persistence and command) done on 2026-10-07: the standing and the record live in `$.store`, `/volley` has all its forms, and the mod loads in every session on this machine (D12). M2b waits on the rounds on the other machines; M9 is next. M9 (AI levels) is built since 2026-10-09 and waits for the user's verdict on easy and hard before its tick (section 9). On 2026-10-12 WSL passed its M2b round and held keys ship there; the mod loads in WSL sessions too, with the standing shared (section 4). Also on 2026-10-12 the blobs got a new look, round jelly that wobbles as it walks, which the user chose to keep (section 11). Later that day M10's first part was built: eyes that follow the ball, the countdown and the final score as the message line pulsing with each beat (big digits were tried first and were too much for the user), the winner hopping on the win screen, hints that fit the narrowest court, and the tuning sheet `tools/tune.ts`. The user then found easy and hard working well, saw a level changed in `/config` show on the score row, and found the feel good with the constants as they are, so **M9 and M10 are done on 2026-10-12** (section 9). **M11 (release preparation) is done on 2026-10-12** too: version 1.0.0, `README.md`, the marketplace file, and the AI under a name for each level, Pudding, Jelly and Gummy (the user's choice; 3.2, section 11). Every milestone but M2b is ticked; M2b still waits on the CachyOS round and the friend. For the public repo the user settled three points the same day: the mod is renamed from Claudey Volley to **Wobbly Volley** (D11), the license is MIT, and this file was cleaned for release, with the history starting anew at one release commit in a new repo (section 11). **The repo went public the same day: Wobbly Volley 1.0.0 is released** at `kopylow/wobbly-volley`. Later on 2026-10-12 the user settled **online play for version 2** (D14 to D22): section 13 designs it, and milestones M12 to M21 build it. None of them is started.
* All API facts in this file were checked against Claude Code **2.1.291**. On 2.1.292 (2026-10-06) the types' text on what M5 uses is unchanged, and on 2.1.295 (2026-10-09) what M9 uses reads the same (section 11). M10 uses no API the earlier milestones did not, and passes on 2.1.296 (2026-10-12). M11 read the facts on sharing again in the reference of 2.1.296 (5.1 rows 30 and 87), and before the release in the public docs (row 88). The facts for online play (5.1 rows 89 to 91) come from the types of 2.1.296 (2026-10-12).
* Project folder: `C:\projects\ClaudeyVolley` (the mod sits at its root).

---

## 0. Start here (for a session that starts cold)

1. Read this whole file once. Sections 3 (decisions) and 6 (architecture) are binding, and from M12 on section 13 (online play) as well.
2. Load the `plugin-authoring` skill with the Skill tool and read its `reference.md`. The skill names the path of the types file `claude-code.d.ts`. Its first line names the build that wrote it.
   * The skill tells you to write mods into a session folder under `~\.claude\dev-mods\`. **Ignore that for this project.** The mod lives in the project folder and loads from there (D12). If the engine asks "Enable hot reloading for this session?", the answer does not matter for this project.
3. If that build is not 2.1.291, check the facts in section 5 again before relying on them (grep each name in the types file, run `claude plugin test .`). Write what changed into section 11.
4. From M1 on, check that the mod is loaded: the session should have been started with `.\dev.ps1` from the project folder (see 6.2). Since M8 every session on this machine loads it through `CLAUDE_CODE_PLUGIN_DIRS` (section 4), and `.\dev.ps1` still works beside that (one load). If `/volley` is unknown, ask the user to restart Claude through `dev.ps1`. Files saved during a turn reload when that turn ends. Writing code, `validate` and `test` work without the mod loaded; only the manual checks need it.
5. Open section 9, take the first milestone that is neither ticked nor marked waiting, and do only that one.
6. Before calling it done, run the checks in section 8 and the milestone's own test.
7. Update this file: tick the milestone, fill section 10 if it was a prototype, and note every deviation from the plan with its reason in section 11. Then commit.

Rules for this file:

* The decisions in section 3 are closed. Do not reopen them. If an API fact makes one of them impossible, stop, tell the user plainly, offer the closest thing that works, and record the outcome in section 11.
* The API is early access. The types file is the authority, this file is the map.
* Keep the game core (`core/`) free of any `claude-code` import. That rule is what keeps input sources swappable and the core testable.

---

## 1. Goal and scope of version 1

**Goal.** Single player volleyball against an AI opponent (named Claude until M11, since then Pudding, Jelly or Gummy by its level, 3.2), drawn in the band above the prompt of the terminal, appearing by itself during long turns and stepping aside when Claude is done.

**In version 1**

* One human (left, blue) against the AI (right, orange).
* Court in the `AbovePrompt` band, terminal surface only.
* WASD steers your blob through one input interface (D3): held keys through a helper process. Helpers are planned for Windows, WSL, Linux and macOS, and each ships only once it was measured on its system. Where none runs there is no game: the band says so in one line. The mouse only clicks: start, resume, the next match.
* Automatic appearance a few seconds into a turn, paused until the first click.
* Rally scoring to 11 with two clear. The match carries over between turns and sessions. An all time record is kept.
* Three AI levels, chosen in `/config`, each under a name of its own: Pudding, Jelly, Gummy.
* Light polish: eyes that follow the ball, an arrow marking a ball above the view, a countdown that pulses with each beat, a win screen whose line with the final score pulses while the winner hops, and blobs of round jelly with a shine and a shade that wobble as they walk and take off (the user's choices, 2026-10-12).
* `/volley` with `on`, `off`, `reset`, `stats`.
* Settings in `/config`: on or off, delay, AI level. (A fourth, the control scheme, went with D3's change in M5: no setting chooses the keys, 3.2.)
* Private GitHub repo, with marketplace file and README prepared in the last milestone.

**Explicitly left out of version 1**

* Multiplayer of any kind. Version 2 adds online play (section 13).
* Sound.
* The desktop Code tab, VS Code and mobile (the mod draws nothing there).
* A docked side pane variant.
* Adaptive AI strength.
* Ball trail, squash and stretch beyond the blob's wobble (the ball, a stretch in a jump), particles, color themes.
* Play over SSH. No helper runs there, so the band says the game needs one (D3).
* Anything that needs more rights than the user has. The mod never asks for root and never changes a group.
* Exact resume of a rally after the court was closed (the point is replayed instead).

---

## 2. Vocabulary

* **Band**: the engine's `AbovePrompt` site directly above the prompt input.
* **Court**: the game picture inside the band, plus its score row and hint row.
* **World pixel**: the game's unit. One world pixel is one terminal column wide and half a row tall, drawn with half block characters, so pixels are close to square.
* **Rally**: play from a serve until a point is scored. **Match**: rallies until one side has 11 with two clear.
* **Hooks module**: `hooks/register.tsx`, runs in the hooks worker, has `$`.
* **Surface module**: `hooks/court.tsx`, the code behind the `Client` element. It runs on the drawing thread, has no `$`, and talks to the hooks module through `post` and props.
* **Helper**: the key state script for the system the mod runs on (6.12; `helper/keys.ps1` on Windows and WSL), a process the mod starts to read real key state.
* **Kit**: the test kit behind `claude plugin test`.
* **Claude**: in the code and in this file the AI's side (`claude`, the orange blob on the right). On the court the AI goes by its level's name since M11: Pudding (easy), Jelly (medium), Gummy (hard). The only "Claude" a player still reads is Claude Code itself, in the marker of D5.

For online play (section 13):

* **Lobby**: the public ntfy.sh topic where waiting players find each other (13.6).
* **Code**: a player's friend code, which is also their ID, such as `4F2K-M9XD-7QAB` (13.5).
* **Nickname**: the name a player shows to their opponents (13.5).
* **Meeting**: the time two players are connected and play. A match may take several meetings (D17).
* **Seat**: which side of the sim a player has in a meeting; the one whose code sorts first has `you` (13.10).
* **Rival**: a person one has played; the standing against them and the record are kept (13.12).
* **Net helper**: `helper/net.ps1` or `helper/net.py`, the process that talks to the network and runs the key helper as its child (13.9).
* **Step line**: an `S` line of the net helper, one step of a meeting with both players' inputs (13.8).

---

## 3. Decisions

### 3.1 Settled in the interview (closed)

| # | Topic | Decision | Reason |
|---|---|---|---|
| D1 | Where the court sits | In the band above the prompt (`AbovePrompt`). | The band is placed at any width. The user's window is about 115 columns, below the 144 column floor for a pane opened unasked, and it is tall, so rows are to spare. |
| D2 | Surfaces | Terminal in version 1. Desktop later. On every other surface the band hook returns `next(e)`. Drawing sits behind one small renderer interface, and the court drawn by the `Client` is preferred if the prototype shows it is smooth. | The user plays in the terminal and that is where testing is possible. Desktop has no `Raster`, and its paint cannot be verified from the types. The preference keeps desktop reachable without a rewrite. |
| D3 | Controls | **WASD only (the user, 2026-10-06).** A and D run while held, W jumps, a longer hold jumps higher; nothing else moves the blob, and the mouse only clicks (start, resume, the next match). Held keys come through a helper process. Helpers for Windows, WSL (the Windows helper, started from Linux through `powershell.exe`), Linux (X11, and Wayland for a user in the `input` group) and macOS; a helper ships only if it was measured on its system and passed. Where no helper runs (SSH, Wayland without the group, a system not measured yet, a session the daemon runs) there is no game, and the band says why in one line. | The user wants clean key response, and on 2026-10-06 asked for it on Linux and macOS too. The mod API has no key release, so the helper goes around the terminal. The arrows are Claude Code's: ← on an empty prompt sends the session to the background, and a mod cannot bind the arrows (5.1 row 71). The user then chose WASD as the only movement, the mouse clicking only, and after trying taps (presses only, no release) found them unplayable (section 11, M5). The `input` group route was announced to the user without objection. |
| D4 | Appearance and opt in | About 5 seconds into a turn (setting `delaySeconds`) the full court opens in the band, paused, showing the standing and "click to play". One click starts the rally and gives the game the keyboard. Until then the prompt keeps the keyboard. `/volley` and the band's `[-]` hide it. | Waiting time becomes play time by default, short turns stay untouched, and nothing takes the keyboard unasked. |
| D5 | Turn ends during a rally | The court shows a clear "Claude is done" marker, the current rally plays out (cut off after 10 seconds), then the match pauses, the court closes and the standing is kept. | No point is lost to an interruption, and the answer waits at most one rally. |
| D6 | Dialogs and typing ahead | A permission prompt or question dialog pauses the match at once and closes the court. Esc (to type ahead) pauses the match, the court stays visible, a click resumes. | The dialog needs the room and the keyboard. Announced to the user during the interview without objection. |
| D7 | Rules | Rally scoring. A match is won at 11 with two clear. It pauses at turn end, resumes at the next turn, and is saved after every point so it survives closing Claude Code. An all time record of matches and points is kept. Basics: at most three touches per side, the ball hovers above the server until touched, the winner of a rally serves. | Turns are short, so every rally should count and a match must survive them. |
| D8 | AI | Three fixed levels (easy, medium, hard) as a picker in `/config`. The AI predicts the landing point with the same physics. Levels differ in reaction delay, aiming error, top speed and shot placement. | Predictable, testable, and the user picks the challenge. |
| D9 | Look and size | Wide court that fills the band's width (about 110 columns on the user's window) and 24 rows, drawn with half block characters. | The user's choice: more room to run. |
| D10 | Sound | None in version 1. | `$.audio.play` is silent on Windows, and the key helper already carries the one unproven piece of this version. |
| D11 | Name and sharing | Mod name `wobbly-volley`, shown as "Wobbly Volley", command `/volley`. Git from the first milestone, a private repo, marketplace file and README in the last milestone, public when the user decides; the public repo is `kopylow/wobbly-volley`. Until the release on 2026-10-12 the mod was called Claudey Volley (`claudey-volley`); the user renamed it before the first public install, and this file uses the new name throughout, in older entries too (section 11). | The build spans several sessions, so history and backup pay at once. Going public stays a one step decision. The name rhymes with Blobby Volley and names the blobs' wobble, and it stays clear of Claude's name, which Anthropic asks third party products not to build on. |
| D12 | Loading | While building: sessions start through `dev.ps1`, which runs `claude --plugin-dir C:\projects\ClaudeyVolley`. Once the game is playable (end of M8): the folder goes into `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of the user's `~\.claude\settings.json`. | A half built game never disturbs real work sessions. |
| D13 | Finish | Core plus light polish (see section 1). | Feels like a real game without delaying the first playable build. |
| D14 | Online play and matchmaking (version 2) | Players are matched with people automatically, in a public lobby. Personal friend codes can be exchanged, and friends are matched first (the user, 2026-10-12). | The user wants automatic matchmaking and a friend system. |
| D15 | No server of our own | Matchmaking runs over a free public service, ntfy.sh (13.6). The game runs directly between the two players: peer to peer over UDP, with public STUN servers for hole punching (13.7). The user accepted a third party as the meeting point (2026-10-12). | Server capacity is small or none. A free meeting point costs nothing to run, and the game's traffic never passes through it. |
| D16 | Bound to the waiting time | The court opens during turns as in version 1, and you play the AI until a person is found; that match then takes the AI's place (the user, 2026-10-12). | Waiting time stays play time, and an empty lobby costs nothing, since the AI is always there. |
| D17 | Leaving and meeting again | When one player's turn ends (their Claude is done), the match is saved on both sides. When the same two meet again, the saved standing is loaded and the match goes on. Statistics are kept per opponent, by their ID (the user, 2026-10-12). | Two players rarely wait at the same time for long, so a match must survive many short meetings. |
| D18 | Every system | Online play works on Windows, WSL, Linux and macOS, and between any two of them (the user, 2026-10-12). | The user's wish. The simulation computes the same on every system (6.3), and both helper languages follow one contract (13.9). |
| D19 | Nicknames | Every player has a nickname, which the opponent sees on the court (the user, 2026-10-12). | The user's wish; a friend code is no name. |
| D20 | Opt in | Online play is a row in `/config`, off by default (the designer's recommendation, accepted by the user on 2026-10-12). | Version 1 promised that nothing opens a network connection, and in the lobby a player meets strangers who see their address. |
| D21 | Pause limit | A pause in a meeting that lasts longer than 15 seconds counts as leaving: the match is saved as after a turn end (the designer's recommendation, accepted by the user on 2026-10-12). | A dialog or a glance elsewhere must not end a meeting, and a player who has gone must not hold the other one. |
| D22 | Helpers for online play | The network part is written twice: in PowerShell for Windows and WSL, in Python for Linux and macOS. On macOS online play needs a real `python3` (the Xcode command line tools or an install of its own); play against the AI does not (the designer's recommendation, accepted by the user on 2026-10-12, and refined the same day so that the key helpers stay as they are, 13.9). | JXA has no plain UDP socket, and one compiled binary for all systems would break the README's promise that the helpers can be read (13.15). |

### 3.2 Defaults set by the designer (not asked, the user may change them)

* The human plays on the left, the AI on the right.
* The AI's names (the user's choice, 2026-10-12, M11): Pudding at easy, Jelly at medium, Gummy at hard, from soft to firm jelly as the levels get harder. The score row, "Point for Jelly", the win screen's "Jelly wins 9 : 11" and `/volley stats` use the name of the level set in `/config`, and the level's word stays beside it on the score row. A level changed during a match changes the name with it and keeps the score. Until M11 the opponent was called Claude; with names of its own, "Claude" on the court means Claude Code alone (the marker of D5).
* The human serves first in every new match.
* Palette: the sky is the terminal's own background, ground `#3f6b4a` with a lighter top line `#5f9a6a`, net `#d0d0d0`, ball `#f2f2f2`, human blob `#4aa3ff`, AI blob `#d97757`, eyes white with a dark pupil. Each blob has a shine and a shade of its own colour: `#a5d4ff` and `#2f7fd6` for the human, `#f2b39b` and `#b45a3d` for the AI (2026-10-12).
* Court size limits: width is `bodyColumns` clamped to 60 to 160 columns. The court itself is 24 rows, plus the score row and the hint row, so the band needs 26. When `maxRows` is short the court shrinks down to 16 rows (18 with both text rows). Below that only one line shows: "Wobbly Volley needs a taller window". Below 60 columns, likewise: "Wobbly Volley needs a wider window" (M4). The court's `Client` draws that line itself, one row high, and the game holds still until the room is back, then goes on where it stopped (the user's check of M4, 2026-10-06).
* A resize during a rally voids the rally. It is served again by the same server.
* When the court closes during a rally for any reason other than the rally ending, the rally is void and served again next time.
* `/volley` alone toggles the court at any time, also outside a turn (free play). A court opened that way stays until toggled off. `/volley off` hides the court and mutes automatic appearance for the rest of the session. `/volley on` ends the mute and shows the court. The lasting switch is the `/config` row `enabled`.
* `/volley on` shows a court that stays, as the toggle does. The toggle shows a court while muted too, and leaves the mute as it is. The mute lives in `$.state`, so it ends with the session: at `/clear` and at a restart (M8).
* `/volley reset` starts the next match at 0:0 with you serving and keeps the record; the match it ends is not counted. It works with the court shown or hidden (M8).
* Several sessions at once: each session plays its own match in `$.state`. Each point is written to `$.store` and the last write wins. A new session picks up whatever was saved last. The record is updated by read, change, write, against the store, which every call reads afresh (5.1 row 82). The score row takes up what other sessions counted whenever the court opens, and `/volley stats` reads the record from the store (M8).
* A store write that fails is tried again with the next point and at the session's end, which writes nothing else (M8).
* The helper runs only while the court is shown: the court's posts keep it running, and it stops within about 1.5 s after they stop (6.12).
* On Wayland the helper is an opt in for users in the `input` group. The README says that this group lets every program of that user read all keys. Without the group the helper says so and exits (6.12), and the band says the game cannot read held keys there.
* No setting chooses the keys: a game without the helper would have no movement (D3). Version 1 has no switch for those who would rather not run a process that reads keys; for them the answer is not to enable the mod, and the README says what the helper reads (6.12).
* A click after a pause runs the three beat countdown with everything frozen, then the rally goes on exactly where it stopped. The user's choice, 2026-10-06.
* The countdown runs only after a click (start, resume, the next match). Between points the next serve follows the 1 s point display at once; the ball hovers until the server touches it, so nobody is rushed. The user's choice, 2026-10-06.
* A click during the win screen starts the next match's countdown at once.
* The game pauses when the terminal window loses the focus and when the keyboard leaves the court (Esc, typing into the prompt); a click resumes after the countdown. The user's choice, 2026-10-06, built in M5 (6.8).
* The look of M10 (the user's choices, 2026-10-12): each eye is two white pixels side by side, and the pupil takes the one on the ball's side. The countdown and the win screen keep their message line as before ("3", "You win 11 : 7"), and it pulses: in each beat of 0.5 s it is drawn bold for a third, plain for a third and dim for a third (big digits were the first choice, and on sight the user found them too much). For the win screen's 3 s the winner hops, a hop per beat, and the loser lies flat. The other messages stay still.
* The hint row says, by phase (M10, set by the designer): before the first click "Click to play. A and D run, W jumps; hold W to jump higher."; in play "A and D run, W jumps. Esc once hands the keys to the prompt."; paused "Click to resume. /volley hides the court."; on the win screen "Click for the next match. /volley hides the court."; while the helper is not trusted "Waiting for the key helper; then A and D run, W jumps."; and the marker of D5 after a turn end. Each fits the narrowest court, 60 columns.
* At a turn end only a rally plays out (D5): a court in its countdown, its point display or its win screen closes at once. The marker is the hint row in bold orange. `enabled` switched off in `/config` while a court that opened by itself shows closes it at the reload the change brings; a `/volley` court stays (M7).

Online play (section 13), set by the designer on 2026-10-12; the user may change them:

* `online` is a picker: `off`, `friends` (matched with friends only) and `everyone` (friends first, then anyone) (13.13).
* Only a court that opened by itself in a turn enters the lobby. A court opened with `/volley` plays the AI only, since D16 binds online play to the waiting time (13.6).
* The pairing order: friends, then players one has an unfinished match with, then everyone else, the longest waiting first (13.6).
* Each player sees themself on the left in blue and the opponent on the right in orange. The opponent's nickname, or a friend's label, takes the AI's name on the score row, and the ping stands beside it (13.11).
* The match's width is the smaller of the two courts', and in a new match the `you` seat serves first in odd numbered matches (13.10).
* After a meeting, and after the win screen within one, play goes on with the countdown and no click: the keyboard is still the court's (13.10).
* The nickname follows one rule, and until a player sets one it is "Blob" and the first four characters of their code (13.5).
* `/volley block` ends a meeting under way at once (13.5).
* Of the rivals who are not friends, the store keeps the 100 met last (13.12).
* The lobby's pacing: a poll every 6 s, at most 200 messages a day per machine, one searching session per machine (13.6).
* The times: an offer runs out after 15 s, punching after 10 s, the AI rally before a meeting after 10 s, the wait for the other side's start after 15 s, a silent connection after 3 s; a candidate who let an offer run out is skipped for 2 minutes, a pair that failed to connect for 10 (13.6 to 13.10).

---

## 4. Facts about the user's machine (found, not asked)

The machine the mod was built and measured on. Cleaned for the public repo on 2026-10-12 (the user's choice): what the design relies on stays, and paths under the user's home are written with `~`.

* Windows 11, Windows Terminal with the default font.
* The terminal window is about 115 columns by 68 rows. **Estimate only.** Prototype P1 logs the real `bodyColumns` and `maxRows`.
* Claude Code 2.1.291, started from the terminal (`CLAUDE_CODE_ENTRYPOINT=cli`). No `CLAUDE_CODE_NO_FLICKER=0` is set, so sessions use the fullscreen layout and the terminal reports the mouse.
* At the start `~\.claude\settings.json` had no `env` block, and no `CLAUDE_CODE_PLUGIN_DIRS` was set anywhere.
* Since 2026-10-07 (end of M8, D12): the `env` block of that file sets `CLAUDE_CODE_PLUGIN_DIRS` to `C:\projects\ClaudeyVolley`, and the leftover `pluginConfigs."wobbly-volley@inline"` values are gone, so the `/config` defaults apply. The mod's store is `~\.claude\plugins\store\wobbly-volley_inline-f8cd336459db.json` (since the rename, section 11).
* Since 2026-10-12 (section 11): in Ubuntu-24.04, `~/.claude/settings.json` sets `CLAUDE_CODE_PLUGIN_DIRS` to `/mnt/c/projects/ClaudeyVolley`, and `~/.claude/plugins/store` is a symlink to the Windows store folder, so WSL and Windows sessions share the standing, and every other plugin's store with it. The store file has the same name on both sides.
* Windows PowerShell 5.1 at `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`, PowerShell 7.6 as `pwsh`. Machine execution policy: RemoteSigned.
* Defender real time protection is on.
* Node 24 is installed, `tsc` is not (use `npx -y -p typescript tsc`, which fetched TypeScript 7.0.2 on 2026-10-06).
* git 2.55 and `gh`.
* git has no `init.defaultBranch`, so a plain `git init` gives `master` (this repo uses `main`). `core.autocrlf` is true.
* `claude` in PowerShell is the npm shim `%APPDATA%\npm\claude.ps1`, which starts `...\node_modules\@anthropic-ai\claude-code\bin\claude.exe`. A `.ps1` runs inside the calling PowerShell, so a session started through `dev.ps1` keeps the process chain below.
* Process chain of a session: `WindowsTerminal.exe` (has the window) → `powershell.exe` → `claude.exe` → children.

Measured for the helper idea (outside any mod, plain PowerShell):

* A script that calls `GetAsyncKeyState` and `GetForegroundWindow` through `Add-Type` ran without being blocked by Defender.
* The very first start took about 11 seconds once (probably the scanner's first look). Later starts were ready about 0.5 seconds after launch (0.25 s PowerShell start, 0.24 s `Add-Type`).
* With `timeBeginPeriod(1)` and a 2 ms sleep the loop polled about 334 times a second. Without it, about 64 times a second.

Measured while planning M1 (2026-10-06):

* The locale is German: PowerShell prints decimal commas (`3,0 s`). Every script output the mod parses uses whole numbers.
* In Windows PowerShell 5.1 one `Get-CimInstance Win32_Process` lookup costs about 0.4 s (four parent hops took 1.6 s). That matters for the helper's walk up to the terminal window (M6).
* 20 logical processors. A `claude.exe` session used 7.2% of one core over 3 s mid-turn.

Found for held keys on other systems (2026-10-06):

* WSL 2.7.14 with WSLg. The default distribution is Ubuntu-24.04.
* In Ubuntu-24.04: Python 3.12.3, no Node (`claude` resolves to the Windows npm shim under `/mnt/c`), no `/dev/input`, `WAYLAND_DISPLAY` is `wayland-0`, `DISPLAY` is `:0`, `XDG_SESSION_TYPE` is empty, and `ctypes` finds `libX11.so.6`.
* From inside it `powershell.exe` is on the path, and one start with `-NoProfile` took 473 ms. The keyboard of a WSL session belongs to Windows.
* Not checked on any machine: whether macOS wants the Input Monitoring permission for polling key state. It belongs to M2b.

Found for the Linux machine (2026-10-06, read from Windows):

* CachyOS runs on the same PC. Windows mounts its partition **read only**, on purpose, so the building session on Windows cannot write there; the project reaches Linux through the repo.
* The user there is in the `input` group, which the Wayland route of D3 needs.
* KDE Plasma with both a Wayland session (`plasma.desktop`) and an X11 session (`plasmax11.desktop`).
* `python` 3.14.6, `libX11.so.6`, `git`, `nodejs` 26.4.0 and `github-cli` 2.97.0.
* Claude Code 2.1.283 from the pacman package `claude-code` (`/usr/bin/claude` runs `/opt/claude-code/bin/claude` with updates off). That is older than the 2.1.291 this file was checked against (section 0, step 3).

---

## 5. API facts the design relies on

Source marks: **T** = declaration and doc comment in the types file of build 2.1.291. **R** = the skill's `reference.md`. **D** = Claude Code's online docs (code.claude.com/docs). **K** = run in the test kit during the design session with a throwaway probe plugin. **M** = measured on this machine.

### 5.1 Verified

| # | Fact | Source |
|---|---|---|
| 1 | `turn.start` fires when a model turn of the main loop begins. Input `{ text, turnId }`. A subagent's run raises none. Observe only, return `next(e)`. | T |
| 2 | `turn.complete` fires when a turn ends. Input has `reason` (`answer`, `aborted`, `refusal`, `error`), `turnId`, `durationMs`, and `agentId` only for a subagent's turn. Return `next(e)`. | T |
| 3 | `on('ui.render', { component: 'AbovePrompt' }, hook)` draws the band. One instance. Raised on terminal and desktop only. Props: `isWorking`, `maxRows`, `bodyColumns`, `hasSurvey`, `scroll`, `view`. The hook returns a tree, or `next(e)` to draw nothing. The band is placed at any width. | T, K |
| 4 | Band height: its slot is capped at half the terminal's rows, the prompt included. A tree taller than `maxRows` scrolls. The engine draws `[-]` beside the tree. The person collapses the band with `[-]` or ctrl+x ctrl+a and focuses it with a click or ctrl+x tab. | T |
| 5 | `Client` element exists on terminal and desktop. Props: `key`, `module` (a string literal path relative to the hooks file), `props` (JSON, at most 100,000 characters), `width`, `height`. The instance keeps its state and timers across redraws while a `Client` under the same key stays in the tree. | T, K |
| 6 | A surface module's default export is `(props, surface) => tree`. `surface` has `elements` (the terminal table without `Client`, `Raster`, `Image`), `state`, `setState` (redraw on the next frame), `columns`, `rows`, `every(ms, fn)`, `onPointer(fn)`, `onKey(fn)`, `post(data)`. One call may take a second at most. Tree bounds: 20,000 nodes, 32 deep, 100,000 characters. A `setState` on each of three renders in a row with no event between unmounts the instance. | T, K |
| 7 | A surface module may import other files of the plugin with a normal `import` (the probe imported `../core/sim`). | K |
| 8 | Pointer events over a `Client`: `down`, `move`, `up`, `enter`, `leave`, with `x`, `y` in cells of the region and `button`. Hover moves arrive without a button. After a `down` the instance holds the pointer until `up`, past its edges too. Fractional positions (`fine`) exist only on kitty, Ghostty, iTerm2, WezTerm and foot, so not on Windows Terminal. | T |
| 9 | Key events for a `Client`: `{ key, ctrl?, shift?, meta? }`, presses only, no release. They arrive only while a click has given the instance the focus. Escape never arrives: it returns the focus to the prompt. | T |
| 10 | `surface.post(data)` reaches the hooks module as `ui.message` (`e.data`). At most one per frame, and a later post in the same frame replaces an undelivered one. A hook that returns `{ props }` hands the instance its next props with no render pass. | T (post reaching the hook: K) |
| 11 | `Raster` is terminal only. It is a leaf with no `hover` and no `onPress`. Up to 512 x 256 cells. `cells` is base64 of little endian u32 triplets `[codePoint, foreground, background]`, a color is `0x00RRGGBB`, `0x01000000` means the terminal default. `$.ui.blit({ requestId, key, cells })` repaints it with no render pass, up to 120 a second taken, about 60 shown. A `Client` cannot contain a `Raster`. A band holding `Text`, `Client` and `Raster` side by side validates. | T, K |
| 12 | `Text` takes `color` and `backgroundColor` as a theme key or any color string (hex `#rrggbb` validated in the kit). `Text` nests inside `Text`. | T, K |
| 13 | `Box` with `position: 'absolute'` and cell offsets paints over the siblings before it. | T |
| 14 | `$.clock.after(ms, fn)` and `$.clock.every(ms, fn)` return `{ cancel }`. A reload drops them. `$.clock.now()` gives epoch milliseconds. | T |
| 15 | `$.state.get/set` hold named values for the session, declared in `types/index.d.ts` as `interface PluginState { 'wobbly-volley': { ... } }` and named in `plugin.json` as `"types"`. A read while drawing subscribes the drawing. No write while drawing. The values survive a hot reload. `atom`, `read`, `update` come from `'claude-code'`. A contract file may export types only (`export {}` is refused). | T, K |
| 16 | `$.store.get/set/delete/keys` keep JSON across sessions, at most 4 MiB. | T |
| 17 | `$.command.register({ name, description, argumentHint, immediate })` in `session.start`. `immediate: true` lets the command run while a turn is in flight. A `command.run` hook answers `{ text }`, and the model also reads that text. | T |
| 18 | Manifest `userConfig` fields of the shape `{ type: 'string' or 'number' or 'boolean', title, description, default, options }` validate. The values arrive as `options` in `register(on, options)` with defaults filled in. A string field with `options` is a picker in `/config`; a stored value outside its `options` counts as unset, so the default applies (T, 2.1.295). A change reloads the module. | R, T, K |
| 19 | `$.process.spawn({ argv, cwd, env, input })` returns an async stream of `{ stream, text }` pieces (text as it came, not cut at lines) and then `{ code, signal }`. No shell. `input` is one string written to stdin, which is then closed. The child dies when the loop is left, when `next.signal` aborts, or when the module unloads. The loop may run on after the hook that started it returned. CLI only. | T |
| 20 | `$.plugin.root` is the plugin's absolute directory. | T |
| 21 | `$.audio.play` plays through `afplay` on macOS. On Windows and Linux it plays nothing. | T |
| 22 | `classic.PermissionRequest` fires when a permission dialog is requested (`tool_name`, `tool_input`). No event marks the dialog closing. `tool.call` wraps the permission prompt and the tool: `await next(e)` settles when the tool has finished. | T |
| 23 | `prompt.edit` fires when the person edits the prompt box. | T |
| 24 | `session.start` fires once per process for each loaded plugin and again at every fresh load of it (a reload). `session.end` fires at exit. | T |
| 25 | A hook has 10 seconds of its own time per dispatch. A hook that throws or overruns is skipped and the chain goes on. | T |
| 26 | Fullscreen is the default terminal layout. `CLAUDE_CODE_NO_FLICKER=0` or tmux gives the main screen instead. Clicks are reported in the fullscreen terminal. `e.viewport.isFullscreen` says which. | T |
| 27 | `claude --plugin-dir <folder>` loads a plugin for one session. `CLAUDE_CODE_PLUGIN_DIRS` does the same from the process environment or from the `env` block of `~/.claude/settings.json`. The folder is watched: a save reloads the module, and saves made during the session's own turn reload once when the turn ends. | R |
| 28 | `claude plugin validate <dir>` lists the hooks, the `$` calls, the surface modules and the state keys, and warns about a missing `author`. | K |
| 29 | `claude plugin test <dir>` runs `*.test.ts` files. `import { test, expect, mock } from 'claude-code/testing'`. `$.ui.mount({ plugin, surface, component, props, viewport })` returns a handle with `find`, `findAll`, `drawn`, `press`, `key`, `pointer`, `post`, `advance`, `resize`, `unmount`. `mock.clock`, `mock.store` and `mock.env` answer those nouns from memory. `test(name, { options }, body)` sets `userConfig` values. Tests have no fs, network or process: a hook the test registers stands for the engine (for example `on('process.spawn', ...)`; this part is from R and was not run in the probe). | T, K, R |
| 30 | Sharing: a repo with `.claude-plugin/marketplace.json` (`{ name, owner, plugins: [{ name, source: './' }] }`) is a marketplace. Install line: `/plugin install wobbly-volley --marketplace kopylow/wobbly-volley`, typed at the prompt of a terminal session; the person answers `y` to add the marketplace, picks a scope (user first) and sets the `userConfig` options, and the mod is active with no reload. The same on 2.1.296 (M11). | R |
| 31 | Panes (not used in version 1): opened unasked a pane is placed only from 144 columns, from 110 once the person opened that id themselves. | T |
| 32 | `claude plugin validate` checks `userConfig` strictly: `type` is one of `string`, `number`, `boolean`, `directory`, `file`; a `default` outside its `options` is an error; an unknown key is an error; `min` and `max` are accepted on a number field. Without `author` it warns. | K (2026-10-06) |
| 33 | In the kit nothing answers `session.start` or `command.register`. A test that calls `$.session.start` answers both with its own `on(...)` hooks, otherwise the plugin's hook is skipped ("no implementation for command.register"). | K (2026-10-06) |
| 34 | A test's `$.command.run` takes the whole `CommandRunInput`: `command`, `args`, `origin`, `presentation` (in a session the engine stamps the last two). | T, K (2026-10-06) |
| 35 | `claude -p "/volley" --plugin-dir <dir>` runs a plugin command with no model turn (cost 0, about 70 ms). Even this headless load lays `.claude-plugin/types/` (with its own `.gitignore` holding `*`) and writes a root `tsconfig.json` that extends `.claude-plugin/types/tsconfig.json`, whose include is `hooks`, `types` and `tests`. | K (2026-10-06) |
| 36 | A test file may import values from the hooks module (`import { VERSION } from '../hooks/register'`). | K (2026-10-06) |
| 37 | `performance.now()` is a declared global of hooks and surface modules; `Date` comes from the ES library. Both advance on the drawing thread and agree within 1 ms per second; `Date.now()` works in the hooks module too. | T, M (2026-10-06) |
| 38 | `$.ui.invalidate('ui.render')` redraws at most 10 times a second, 30 in the terminal for an expanded band; `$.state.set` redraws at the redraw rate. The band hook alone cannot animate a court. | T |
| 39 | `$.ui.ask` raises the engine's own AskUserQuestion dialog as a `tool.call` that skips the calling plugin's own hooks. | T, M (2026-10-06) |
| 40 | `prompt.edit` carries the key that made the edit (`e.key`, in `onKey`'s shape), absent for a paste or a burst. | T, M (2026-10-06) |
| 41 | `ui.focus` is the focus ring over Buttons, Inputs and Selects in a site. No event marks the keyboard leaving a `Client`: Esc, a hidden band and a dialog raised none. | T, M (2026-10-06) |
| 42 | `$.process.run(argv, { cwd, env, stdin, timeoutMs })` runs a host command once (30 s default timeout) and resolves `{ exitCode, stdout, stderr }`. | T |
| 43 | A click into a `Client` takes the keyboard: every key reaches `onKey`, none the prompt. Names: letters as typed, `left`, `right`, `up`, `down`, `space`. A held key repeats after about 500 ms, then every 32 ms. One event can carry several typed letters (`"aw"`). The first Esc returns the keyboard to the prompt; a second Esc interrupts a running turn. | M (2026-10-06) |
| 44 | Hover moves, `enter` and `leave` reach a `Client` without the focus. | M (2026-10-06) |
| 45 | A `Client` unmounts when the band hook leaves it out, when the person collapses the band with `[-]`, and while a dialog is up (AskUserQuestion and `$.ui.ask` in P1, a permission prompt in M7); a fresh instance with empty state mounts afterwards and does not get the keyboard back by itself. The surface module's own variables survive a remount. | M (2026-10-06, 2026-10-07) |
| 46 | The band is asked again on every width step and on a height change, and about 0.1 s after `turn.start` and `turn.complete`. `bodyColumns` is the viewport's columns less 5; `maxRows` 29 at 70 terminal rows. A width change keeps the `Client` instance. | M (2026-10-06) |
| 47 | `surface.every(16)` ticks about 58 times a second (longest gap per second: median 22 ms, worst 112 ms). While the terminal window is not focused the frame clock runs at a steady 30 and returns at once. A post answered with `{ props }` reaches the `Client` after a median 18.6 ms. | M (2026-10-06) |
| 48 | A `Client` that redraws a 110 x 24 half block court on every tick draws 58 times a second, also while a turn streams, at about 0.5 ms of module time per draw and a tree of about 6,800 characters and 61 nodes. | M (2026-10-06) |
| 49 | `claude plugin validate` refuses a module that passes `$` to a function not declared at the top of the file (a function declaration, or a const bound to one). Shared state travels beside `$` in one object. | K (2026-10-06) |
| 50 | A session the engine moves to the background (its daemon's `--bg-pty-host`: a fork with `--fork-session --resume`, an `--agent` session) loads the `--plugin-dir` plugin too, draws its band in a pty of its own and runs its `Client`s unseen. | M (2026-10-06) |
| 51 | The types name no field for the host system and none for the terminal window having the focus. `isFocused` exists for a `Pane` only (the pane holding the keyboard). | T (2026-10-06) |
| 52 | `$.process.spawn` starts `powershell.exe -File` from the hooks module on Windows. Each line the helper writes arrives as a piece of its own: 0 ms after the helper's time stamp at the median, 2 ms at the 95th percentile, 16 ms at worst (515 lines). | M (2026-10-06) |
| 53 | The spawned child ends when the loop is left (at the next piece after the stop request: 249 and 275 ms here, with a heartbeat every 500 ms), when the module reloads, and when the session is quit (it then reads as exit code 1). | M (2026-10-06) |
| 54 | Touching a file in the plugin folder without changing it also reloads the module. Done during the session's own turn, the reload came when the turn ended. | M (2026-10-06) |
| 55 | While a `Client` holds the keyboard, its `onKey` press arrives between 3 ms before and 9 ms after the moment a key state helper sees the key go down (178 presses). | M (2026-10-06) |
| 56 | A session can be continued in a session the engine's daemon runs while the person goes on working in it: that session's `Client` took clicks and keys. The old transcript ends with `continued-in`; the new process carries `--fork-session` under a `--bg-pty-host` process, and its chain of parents ends at `WmiPrvSE.exe` and `services.exe` with no window above it. The old process runs on until it is quit, with no `Client` mounted. The cause, found in M5: the left arrow on an empty prompt, which opens agent view (row 71); P4's key tests pressed it. | M (2026-10-06) |
| 57 | `claude plugin test` finds `*.test.ts` in subfolders of `tests` too and runs each file in a process of its own (`claude plugin test --file <file> <dir>`). A test imports plain files of the plugin (`../core/sim`), and `tsc -p .` checks them through that import. | K (2026-10-06) |
| 58 | A test fails after 5000 ms (`timeoutMs` raises it), but a synchronous endless loop is never stopped: the run hangs and its processes stay until killed. Tests give every loop a limit. | T, K (2026-10-06) |
| 59 | The kit's matchers: `toBe`, `toEqual`, `toStrictEqual`, `toMatchObject`, `toContain`, `toHaveLength`, `toBeGreaterThan(OrEqual)`, `toBeLessThan(OrEqual)`, `toThrow` and their kin. No `toBeCloseTo`: float checks use explicit bounds. | T (2026-10-06) |
| 60 | A test has `structuredClone`, `performance`, `Date` and `Math.random`, and no `Bun`, `process` or `navigator`. The same float steps gave bit for bit the same result in the kit and in Node 24. | K (2026-10-06) |
| 61 | In a test nothing lies beneath the plugins for `ui.render`: a band hook's `next(e)` fails the mount ("no implementation for ui.render") unless the test answers it. The test's own hook must return an element (`$.ui.resolve(e).Box({})`, drawn as `{ type: 'Box' }`); `null` is refused as "not a tree element". | K (2026-10-06) |
| 62 | The `$` a test holds has no `state` and no `env` noun. A plugin's `$.env.get` with no `mock.env` throws ("no implementation for env.get") and the hook is skipped. | K (2026-10-06) |
| 63 | A mounted band follows the plugin's own `$.state.set` with no redraw call: a toggle removes the `Client`, and the next one mounts a fresh instance. `redraw` with new props hands the `Client` new props, but its region keeps the viewport's size until `resize`. | K (2026-10-06) |
| 64 | `ui.advance(ms)` fires a `Client`'s `every` timers, while `performance.now()` and `Date.now()` move only by the real time the run takes (about 4 ms for 160 ms advanced). Time based code is moved in tests by a tick clock. | K (2026-10-06) |
| 65 | `find({ text, in })` matches an element's whole shown text with its nested `Text`s, and finds each nested `Text` on its own too. | K (2026-10-06) |
| 66 | A drawn tree serializes as `{"type":"Text","props":{...},"children":[...]}`: a row `Text` with `wrap` costs 56 characters plus its children, a coloured run 57 plus its text, 85 with a background, a plain string 3 plus its text. | K (2026-10-06) |
| 67 | A hooks module imports plain files from another folder of the plugin (`../core/draw`); validate and the kit load it. | K (2026-10-06) |
| 68 | A real `Client` has its region's size at its first call (six mounts in P1: 110 or 114 by 24, never 0). | M (2026-10-06, from `p1-band.json`) |
| 69 | A test raises `prompt.edit` with `$.prompt.edit(e)`: the kit has it, though its `Engine` type lists no `edit` (a cast reaches it). As with `ui.render`, a plugin hook's `next(e)` needs a hook of the test's beneath it ("no implementation for prompt.edit"); `{ text: e.text, cursor: e.cursor }` will do. | K (2026-10-06) |
| 70 | An `expect` costs about 80 µs in the kit: 180,000 of them inside a loop of AI play took about 14 s, the same play without them well under a second. Tests collect in their loops and assert once. | K (2026-10-06) |
| 71 | The left arrow on an empty prompt moves a foreground session to the background and opens agent view ("Your conversation moved to the background"); `/config leftArrowOpensAgents=false` turns that off. While a pane or the band has the keyboard, Tab and the arrows are Claude Code's (moving between controls, scrolling): "A mod can't bind Tab or the arrow keys to anything else, so a game steers with `w`, `a`, `s`, and `d`." P1 still saw the arrows reach `onKey` after a click. On this machine each ← on an empty prompt forked the session into one the daemon runs (`--fork-session --resume` under `--bg-pty-host`), as in row 56. | D, M (2026-10-06, M5) |
| 72 | A test stands in for a spawned process with an async generator on `process.spawn` (`on('process.spawn', async function* ($, e) { ... })`) that yields `{ stream, text }` pieces and returns `{ value: { code, signal } }`; a bare `{ code, signal }` is refused ("returned neither { value } nor { deny }"). While it waits on `mock.clock` (`clock.sleep`), no act of the kit waits for it; the hooks module's `$.clock` timers run on that clock too, and the court's frame clock on the band's own `advance`. When the plugin leaves its loop, the generator's `finally` runs at its next `yield`. | K (2026-10-06) |
| 73 | A change to the `userConfig` of `plugin.json` reaches a running `--plugin-dir` session: after the edit its `/config` offered the new picker (the user stored a value only the new one had), and changing the row reloaded the module, which ended the key helper (row 53). A stored value of a field the manifest no longer declares is ignored at load: a headless `/volley` loaded with such a value left in `settings.json`. | M (2026-10-06) |
| 74 | In a test `$.turn.start` and `$.turn.complete` run the plugin's hooks, but a plugin hook's `next(e)` fails ("no implementation for turn.start") unless the test answers beneath it: `{ turnId: e.turnId }` and `{ text: e.answer }` will do. `turn.complete` carries `agentId` only for a subagent's turn (T). | T, K (2026-10-07) |
| 75 | `register(on, options)` gets the `userConfig` values with the defaults filled in (`{"enabled":true,"delaySeconds":5,"difficulty":"medium"}`). The kit loads the module afresh for each test, with that test's `options`; a second `$.session.start` in one test runs the hook again on the same load, so the kit cannot stage a reload. | K (2026-10-07) |
| 76 | A `$.clock.after` timer of the hooks module fires on `mock.clock`, and its `$.state.set` redraws a mounted band (a 5 s timer: no `Client` at 4.9 s, one at 5.1 s), as a command's does (row 63). | K (2026-10-07) |
| 77 | A hooks module registers each event once without a matcher: a second `on('session.start', ...)` refuses the whole module at load ("registered twice without a matcher"). Hooks with a matcher (`command.run` `{ command }`) may share an event. | K (2026-10-07) |
| 78 | A hooks module's `console.log` does not reach the output of `claude plugin test`, a test file's does. A probe reads the module's log back through a `command.run` hook of its own. | K (2026-10-07) |
| 79 | `/clear` ends the session (`session.end` with reason `clear`), and the process goes on under a new session id with the same module instance: `$.state` is empty again (a value back to `undefined` at version 0), and no `session.start` fires. | T, M (2026-10-07) |
| 80 | `session.end` has about 1.5 s for its whole chain, at an exit and at `/clear` (`next.budget.ms` 1,499 to 1,500); a `$.store.set` in it took 0 to 1 ms and was read back afterwards. In the kit it has the plain 10 s, and a test answers it beneath (`{ sessionId }`). | M, K (2026-10-07) |
| 81 | The store is one JSON file per plugin, `<config folder>\plugins\store\<name>_<source>-<hash>.json`. A folder load is the source `inline`, through `--plugin-dir` and through `CLAUDE_CODE_PLUGIN_DIRS` alike, and a copy of the plugin in another folder used the same file. `settings.json` keys the `/config` values the same way (`pluginConfigs."wobbly-volley@inline"`). | M (2026-10-07) |
| 82 | `$.store` reads the file at every call: a session kept open read another process's write, and its own write of another key left that write in place. | M (2026-10-07) |
| 83 | A folder named both in `CLAUDE_CODE_PLUGIN_DIRS` and by `--plugin-dir` loads once. | M (2026-10-07) |
| 84 | A `$.state.get` after a `$.state.set` reads the new value: in the same dispatch (kit and a real session), and in a dispatch chained behind another one's write (kit). | K, M (2026-10-07) |
| 85 | In the kit a plugin's `$.store` call with nothing beneath fails its hook ("no implementation for store.get"). The test's `$` has no `store` noun, and a `store.set` hook of the test's beside `mock.store` refuses the module ("registered twice"). A test answers the store's events itself (`{ value }`) over a `Map` it reads. A store write that throws fails the hook that made it. | K (2026-10-07) |
| 86 | In the kit a band hook may read `$.store` while drawing. The test's `$` has no `ui.message`; `band.post(data, { in })` posts as the `Client` would, and the hooks module's answer reaches it. | K (2026-10-07) |
| 87 | `claude plugin validate <folder>` reads `.claude-plugin/marketplace.json` in the same run as the manifest and the module, and passes with `--strict` too on a manifest that carries `displayName`, `homepage`, `repository`, `keywords` and an author `url`. `claude plugin marketplace add <folder>` and `claude plugin install <name>@<marketplace>` install from a folder; such a plugin is read from that folder, not from a copy (`claude plugin list` says `Read from:`), while an install from a repository runs a copy under `<config folder>\plugins\cache\<marketplace>\<name>\<version>\`. With `CLAUDE_CONFIG_DIR` set to an empty folder both commands and a headless `claude -p "/volley"` touch that folder alone. | R, K, M (2026-10-12) |
| 88 | The docs describe the API of this section in public (code.claude.com/docs/en/plugins/mods/overview and the pages beside it): hooks modules, events, the mods API, the test kit. Mods are on by default, in the terminal from 2.1.287 and in the desktop app from 2.1.286, and `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, the switch of the early access, is ignored since. Publishing through one's own marketplace needs no submission: with `marketplace.json` in the repository the plugin is published, for everyone who can clone the repository. With `version` set, `claude plugin update` gives users a new copy only when it changed. A published plugin's `name` is permanent for its installs, and a `renames` map in the marketplace file migrates them. `claude plugin tag` makes a `{name}--v{version}` tag, needed only when other plugins declare a version range on this one. The install line with `--marketplace` needs 2.1.275 at the prompt and 2.1.292 from the shell (`claude plugin install <name> --marketplace <owner>/<repo>`). `claude plugin validate` also holds a plugin's name against Anthropic's own (an error for a name that starts with `claude-`, `anthropic-` or `cc-plugin-`, a warning for `claude` or `anthropic` as a whole word elsewhere); `wobbly-volley` draws neither. | D (2026-10-12) |
| 89 | The `crypto` global of hooks and surface modules declares `subtle.digest`, `randomUUID` and `getRandomValues`, nothing more: no key generation, key agreement, signing or encryption. The module may hold more at run time, but the types are the authority, so online play brings TweetNaCl (13.5). | T (2.1.296, 2026-10-12) |
| 90 | `$.http.fetch(url, { method, headers, body, auth, socketPath })` goes through the host, http or https to whatever the host reaches unless the organization's web-fetch policy refuses it. The body is text, and the call resolves `{ status, ok, headers, text }` (header names in lower case) once the whole body is read. Its options have no timeout and no abort signal. | T (2.1.296, 2026-10-12) |
| 91 | `$.fs.write(path, text)` writes the whole file and makes its folders as needed; an absolute path is used as given, a relative one from the working directory. A write over 4 MiB rejects, and so does a network location. Where a plugin may write is an `fs.*` hook's to say. | T (2.1.296, 2026-10-12) |

Kit quirks found:

* A `key` on a `Text` is not an address. Find text with `{ type: 'Text', text: /.../ }`. Use `{ in: 'court' }` to search what the `Client` drew.
* Before the first `ui.resize`, a `Client` in the kit reads the viewport size as its `columns` and `rows`.
* `ui.advance(160)` fired a `surface.every(16)` timer 10 times.
* A test's `$` carries the engine's events, not every method a hooks module's `$` has: `$.command.list` is missing there.
* A mounted band's `key` on a `Client` that has no `onKey` listener does nothing and says nothing, so no kit test can tell whether a listener is set.
* The props a `ui.message` hook answers to a post reach the `Client` only when the act that made the post ends: through one `advance(300)` every tick saw the old props, and a key press made before it met the helper's mask 300 ms late. A test that needs the court to see new props before it acts gives them an act of their own (`tests/kit.ts`, `hold`).
* A `Client` the band leaves out and draws again moments later can come back with its old instance: after `/volley` off and on, the court in 2 of 6 runs still held its earlier game. A session draws the band at once, and there a hide and a show give a fresh instance (P1). A test that needs a fresh court mounts the band anew (`tests/band.test.ts`, `reopen`).

### 5.2 Not settled by the types (the prototypes in section 7 answer these)

P1 and P2 answered the band, clock, pointer, keyboard, Esc, `[-]`, dialog and draw rate questions on 2026-10-06 (5.1 rows 37 to 50, section 10). P4 on Windows answered the delay through `$.process.spawn` on 2026-10-06 (rows 52 to 56). Still open:

* Whether `$.process.spawn` starts `powershell.exe` from a Linux session, which the WSL route needs (M2b). From a bash in WSL it works, and the helper's walk reaches `WindowsTerminal.exe` through the session's `wsl.exe` (section 10). Through `$.process.spawn` not checked yet.
* How the mod can tell a session nobody sees from the one the person looks at (5.1 rows 50 and 56). Being run by the daemon is not the test: P4 showed such a session in use, and `isInteractive` of `session.start` is true under every REPL (T, 2.1.292). Since M5 the question is smaller on Windows: in a session the daemon runs the helper finds no window and writes `E nowindow`, and the band then draws one line in place of the court, so no court should run there for longer than the helper's start (about a second). Since M7 the court opens by itself, so a long turn in such a session opens one too; the same line follows. Expected from P4 and the kit test, not yet seen in a real background session. Such sessions came from ← on an empty prompt (5.1 row 71); on 2026-10-07 `leftArrowOpensAgents` was `false` in `~/.claude.json` and no `--bg-pty-host` session ran on this machine.
* Whether a `Raster` stacked over a `Client` lets the pointer through (only for fallback B, which is not being built).

Open for online play (section 13):

* Whether a `$.http.fetch` that gets no answer ever ends, and how long it holds a hook or a loop that waits on it (row 90 names no timeout). P6.
* Whether `$.http.fetch` to ntfy.sh meets any prompt or policy in a plain session. P6.
* Whether a hooks module loads a vendored ES module the size of TweetNaCl, whether validate accepts it, and how fast `nacl.box` runs there. P6.
* Whether `$.fs.write` may write into the system's temp folder, and from WSL through `/mnt/c`, and how soon a helper that watches the file sees the write. P5.
* Whether a kit test can answer `http.fetch` and `fs.write` with hooks of its own, as it answers `process.spawn` (row 72). M15 and M16.

---

## 6. Architecture

This section describes architecture A. Prototype P2 passed on 2026-10-06 (section 10), so A is what gets built. Section 6.13 keeps fallback B on record. The core, the rules, the AI and the tests are the same in both.

### 6.1 Overview

```
 drawing thread                        hooks worker                         host system
┌───────────────────────────┐  post   ┌────────────────────────────┐ stdout ┌─────────────┐
│ hooks/court.tsx (Client)  │ ──────→ │ hooks/register.tsx         │ ←───── │ helper/     │
│  frame clock, pointer,    │ report  │  turn events, band hook,   │ lines  │ keys.*      │
│  key presses, drawing     │ ←────── │  /volley, settings,        │        │ real key    │
│  uses core/* (game, AI,   │  props  │  $.state, $.store,         │        │ state       │
│  draw)                    │         │  helper stream (keys.ts)   │        └─────────────┘
└───────────────────────────┘         └────────────────────────────┘
```

* The **surface module** owns the running game: it steps the simulation, asks the input sources, and draws.
* The **hooks module** owns everything around it: when the court is shown, the standing between turns and sessions, the command, the settings, and the helper process.
* The **core** is plain TypeScript with no `claude-code` import. Both modules import from it.
* Online play (section 13) adds the net helper beside the key helper and an online match in the hooks module. With `online` off none of it runs.

### 6.2 Files

```
C:\projects\ClaudeyVolley\
  PLAN.md                    this file
  README.md                  what it is, the install line, play, rules, the key helper per system (M11)
  LICENSE                    MIT (2026-10-12)
  dev.ps1                    starts Claude with the mod loaded
  dev.sh                     the same on Linux and macOS
  .gitignore                 ignores .claude-plugin/types/ (the engine writes it) and .claude/settings.local.json
  tsconfig.json              written by the engine at the first load, extends .claude-plugin/types/tsconfig.json
  .claude\
    workflow.md              the workflow in short, for the backlog skills
  .claude-plugin\
    plugin.json              name, displayName, version, description, author, homepage, repository, license, keywords, types, userConfig
    marketplace.json         makes the repo a marketplace with the mod as its one entry (M11)
  hooks\
    hooks.json               { "modules": ["./register.tsx"] }
    register.tsx             hooks module
    court.tsx                surface module (the Client)
    protocol.ts              CourtProps and CourtReport (6.10), shared by both modules, and the report's reader
    focus.ts                 whether the terminal window has the focus, read from the frame clock (6.8, M5)
    lifecycle.ts             the settings, and what a fresh load does with the turn it finds (6.9, M7)
    standing.ts              the record after a match, the words and answers of /volley (6.9, M8)
    keys.ts                  the helper's lines, their reader and the key state, and which helper a system starts (the spawn needs `$` and lives in register.tsx)
  core\
    constants.ts             all tunable numbers
    types.ts                 Sim, Rally, Blob, Ball, Input, Game, Phase, Match
    rng.ts                   seeded generator (xorshift32)
    sim.ts                   step(sim, inputs): physics and collisions
    game.ts                  phases, scoring, serve, match end
    input.ts                 InputSource, KeysSource (held keys), PointerSource (the AI steers with it)
    ai.ts                    AiSource and its three levels (medium from M5, easy and hard from M9)
    draw.ts                  game → Frame (grid of palette indices) plus text overlays
    encode.ts                Frame → rows of text runs, and Frame → Raster cells
  tools\
    tune.ts                  the tuning sheet: what the constants give in play, run in Node, outside the mod and tsc (M10)
  helper\                    one key state helper per system (6.12)
    keys.ps1                 Windows and WSL
    keys.py                  Linux (plan, M2b)
    keys.js                  macOS, run by osascript (plan, M2b)
  types\
    index.d.ts               the $.state contract
  tests\
    command.test.ts          /volley (M0), the bare toggle (M4), all its forms from M8
    standing.test.ts         the record after a match, the words and answers of /volley (M8)
    store.test.ts            the standing in the store across sessions, a reset reaching a shown court (M8)
    rng, sim, game, input    the core tests (M3), one *.test.ts each
    draw, encode             the drawing tests (M4), the blob's look and its wobble (2026-10-12), the eyes, the pulsing line and the win screen (M10)
    ai                       the AI: medium (M5), the three levels and their placements (M9)
    focus, protocol          the focus watch and the report's reader (M5)
    keys, helper             the helper's lines, and the helper's life in the kit (M5), the pick of the system and the start in WSL (M2b)
    band.test.ts             the band and the court's Client in the kit (M4)
    lifecycle.test.ts        the court opening by itself in a turn and closing at its end, the reload path, the settings (M7)
    support.ts               helpers the core tests share
    kit.ts                   what the kit tests of the court share: the engine beneath, a Windows session with a stand-in helper, readers of the drawing (M5), turns (M7), a WSL session with a stand-in `wslpath` (M2b), readers of the message and of how it is drawn while it pulses (M10)
    *.test.ts
  prototypes\
    p1-band\ p2-client-court\ p3-raster-court\ p4-key-helper\   each a tiny plugin
    results\                 measurements the prototypes write (P4: one file per system)
```

`dev.ps1`: with no arguments it runs `claude --plugin-dir <project folder>`. With `-Only <prototype name>` it loads only `prototypes\<name>`, because two mods drawing the band at once would hide each other. Further arguments pass through to `claude`. `dev.sh` does the same on Linux and macOS, with `-Only` as its first argument.

### 6.3 Core: world and physics

Coordinates: `x` grows to the right from the left wall, `y` grows upward from the ground. A blob's position is the bottom center of its body. The ball's position is its center. All positions are floats. Drawing rounds them.

World size: width `W` = court columns (60 to 160). The view shows `2 * rows` pixels of height (48 at 24 rows). There is no ceiling: a ball above the view keeps flying and an arrow in the top row marks its column.

Fixed step: `DT = 1/60` second. All state changes happen in `step`. The core never reads a clock and never calls `Math.random`: randomness comes from the seeded generator inside the state. Same state and same inputs give the same result, which later network play needs. The sim touches its state only with `+ - * /`, `Math.sqrt`, `Math.abs`, `Math.min` and `Math.max`, which IEEE 754 rounds exactly on every engine, so the result is the same on every machine (no `Math.hypot`, trigonometry or fractional powers). Every state value is plain JSON.

Starting constants (`core/constants.ts`). They are derived from Blobby Volley's proportions at roughly one tenth scale. No code or art is taken from Blobby Volley. All of them are open to tuning in M10.

| Constant | Start value | Meaning |
|---|---|---|
| `BLOB_W`, `BLOB_H` | 8, 8.5 px | body size |
| blob circles | lower: center 3.4 above the feet, radius 3.4. upper: center 6.2 above the feet, radius 2.4 | collision shape |
| `BALL_R` | 3 px | ball radius |
| `NET_H`, `NET_R` | 17 px, 1 px | net height and half width, round top |
| `RUN_SPEED` | `(W / 2) / 1.3` px/s | crossing the own half takes 1.3 s |
| `JUMP_SPEED` | 109 px/s | upward speed at take off |
| `GRAVITY_HELD` | 247 px/s² | while rising with jump held (apex 23.2 px in 60 steps a second; 24.1 by the continuous formula) |
| `GRAVITY` | 370 px/s² | otherwise (a tap reaches 15.7 px; 16.1 by the formula) |
| `BALL_GRAVITY` | 155 px/s² | |
| `BALL_HIT_SPEED` | `sqrt(0.75 * W * BALL_GRAVITY)` px/s | every blob hit sets the ball to this speed, so a 45 degree hit flies three quarters of the court |
| `SERVE_Y` | 26 px | height of the hovering ball |
| `TOUCH_GAP` | 6 ticks | contact free ticks before a new touch counts |
| `MAX_TOUCHES` | 3 | per side per possession |
| `WOBBLE_STEPS` | 16 | steps of one wobble of a blob, a squash and back, which only the drawing reads (6.7) |

One step, in this order:

1. Blobs: `vx = run * RUN_SPEED`, move, clamp to the own half (no blob crosses the net). On the ground with jump held: `vy = JUMP_SPEED`. In the air: gravity (`GRAVITY_HELD` while rising with jump held, else `GRAVITY`), move, land at `y = 0`. The wobble (2026-10-12): a blob on the ground that moved at least half of a full run step, or that takes off, sets one going once the last is over. `blob.wobble` counts its steps from 1 to `WOBBLE_STEPS - 1` and is 0 at rest; a blob pressing against the net or a wall moves no more and comes to rest, and a serve puts both at rest. Nothing in play reads the count.
2. Ball: if the serve hover is on, it does not move. Otherwise gravity, then move.
3. Ball against each blob circle: on overlap, push the ball out along the line between the centers, set its velocity to `BALL_HIT_SPEED` along that line, end the serve hover, count a touch if the gap rule allows.
4. Ball against the side walls: reflect `vx`.
5. Ball against the net (a vertical capsule): push out, reflect about the contact normal.
6. Touch rule: a fourth touch in a row by one side scores for the other side. The count resets when the other side touches.
7. Ball against the ground: the rally ends. The side on which it landed loses the point.

`step(sim, inputs)` returns `{ scored: side or none, hit: side or none }`.

### 6.4 Core: game phases and rules (`core/game.ts`)

Phases: `idle` (paused before the first click, shows "click to play"), `countdown` (three beats of 0.5 s, then play), `rally`, `point` (1 s, shows who scored), `matchEnd` (win screen for 3 s or until a click), `paused` (frozen exactly, shows "paused, click to resume").

* `tick(game, inputs)` advances one step in the current phase and returns events: `point`, `matchEnd`, `rallyOver`. Only `rally` steps the sim; every other phase is frozen. Timers count steps, since the core reads no clock: countdown 3 beats of 30, point 60, win screen 180, the cut after a turn end 600.
* `dispatch(game, action)` takes actions from the shell: `start`, `pause`, `turnDone`, `reset(match)`, `resize(w)`. Both change the game in place.
* Scoring: every rally gives a point, and the winner serves. A match ends when a side has at least 11 and leads by 2. Then the record is updated (by the hooks module, from the report), the final score is kept for the win screen, the standing returns to 0:0 with you serving and `number` plus one, and the phase is `matchEnd`, then `idle`.
* Serve: both blobs return to their home positions (`W/4` and `3W/4`), the ball hovers above the server.
* `start` (a click): from `idle` or `paused` to `countdown`; during the win screen it sets up the next match's serve and starts its countdown. After the countdown the sim goes on with what it holds: a fresh serve, or the rally a pause froze (3.2).
* After a point: 60 steps of `point` with the sim frozen where the ball landed, then the scorer's serve is set up and `rally` begins with no countdown (3.2).
* `pause`: in `countdown` or `rally`, `paused` with the sim as it is; in `point`, the next serve is set up first; ignored in `idle`, `paused` and `matchEnd`.
* `turnDone` during `rally`: the rally continues for at most 10 seconds (600 steps; a second `turnDone` keeps the first deadline). A point inside that time counts and `rallyOver` follows at once; when the time runs out the rally is void and the same side serves again. Either way the game reports `rallyOver` and goes to `paused`. A `pause` while the cut runs ends it the same way, so the hooks module never waits on a frozen rally. In any other phase `turnDone` reports `rallyOver` at once, and a `countdown` or `point` turns into `paused` with a fresh serve.
* `resize(w)`: the width is clamped to 60 to 160, and an unchanged width does nothing. A new width sets up the serve again by the same server: a rally is void and goes to `countdown` (or, while the cut runs, ends as above), and a paused rally is void too.
* `reset(match)`: the new match the shell hands (0:0, you serve, `number` plus one) waiting in `idle`; `rallyOver` if a cut was running. The shell makes the match, so the court takes exactly the hooks module's standing (M8).

### 6.5 Input: one interface for every player

```ts
type Input = { run: number; jump: boolean }      // one per side per tick; run from -1 to 1, clamped by step
interface InputSource { next(game: Game, side: Side): Input }
```

`step` receives two `Input` values and does not know where they came from. Sources:

* `KeysSource`: holds the helper's key mask. `run` = D minus A, `jump` = W down.
* `PointerSource`: holds a column (in world pixels) and a button. `run` points toward the column at full speed and shrinks within the last step's reach, so the blob lands on the column exactly and never jitters (the motion P2 used). The AI steers with it; since D3 changed in M5 the human no longer does.
* `AiSource`: see 6.6. Its speed factor is a `run` below 1.
* Later, a remote source can deliver inputs that arrived over a network. Nothing else has to change.

The human's source is the helper's held keys (`KeysSource`). While the helper is not trusted its mask is 0, so the blob stands, and a rally holds still until it is trusted again (6.8).

### 6.6 AI (`core/ai.ts`)

The AI is an `InputSource`, so it moves under the same limits as the human.

M4's demo ran a stand-in, `ChaseSource`, which walked toward a point 3 ± 2.5 px behind the ball. M5 replaced it with `AiSource` and removed it.

* It predicts where the ball will come down on its side by stepping a copy of the ball forward with the same physics (walls and net included) until the ball falls through 11 px, about where a standing blob meets it.
* If the ball will land on the human's side, it walks back to its home position.
* It steers the shot by where it stands: a hit sends the ball along the line between the centres, so a stand a few pixels behind the ball sends it forward. It weighs stands 0 to 6 px behind that point and plays each one out with the sim's own steps (`flyBall`, `moveBlob`, `collideBlob` from `sim.ts`): the ball against a blob waiting there, which jumps for it when the AI means to, until the ball is past the net and lower than its top, from where it only comes down a few pixels further on, or until it lands. The plan so sees the shot play will make, jumps included, and about where it comes down (`shots` in `ai.ts`, M9).
* It plans again only every `reactionMs`, so between plans it acts on an old prediction.
* It adds an aiming error to its stand, drawn afresh for each new ball (a touch or a serve), together with its mind to jump and the random stand of the easy level. Its own hovering serve gets no error: that ball waits for it, so an error there could leave it hovering for ever.
* It jumps for a ball that is high and close, with a level dependent chance drawn for each new ball; a hovering serve it always jumps for.

| | easy | medium | hard |
|---|---|---|---|
| `reactionMs` | 350 (21 steps) | 200 (12 steps) | 80 (5 steps) |
| aiming error | up to 7 px | up to 4 px | up to 1 px |
| speed factor | 0.75 | 0.9 | 1.0 |
| jump chance | 0.2 | 0.6 | 0.9 |
| placement | random side of the ball | sends it over the net | aims away from the human's blob |
| name on the court (`player`, M11) | Pudding | Jelly | Gummy |

Placement as built (M9; "over" means the shot comes down at least 2 px past the middle):

* **easy**: a stand drawn once per ball, anywhere from 3 px in front of the ball (toward the net) to 6 px behind it, with no shot played out. Its own hovering serve it plans as medium does, since a random stand could leave that ball hovering for ever.
* **medium**: of the stands whose shot goes over it takes the middle one, which leaves its aiming error the most room (M5).
* **hard**: of the stands whose shot goes over, the one whose ball comes down furthest from where the other blob stands at the plan: deep while the human waits at the net, short while the human waits at the back.
* Each level that weighs shots takes, when none goes over, the stand whose shot gets furthest.

Tuned in M9 with AI against AI runs and a human proxy (section 11): medium is about even with the user (the user's choice; its error was 3 px until M9), easy beatable, hard demanding. M10 tunes by play. In 1,080 points each, hard beats easy in 95% of points, medium beats easy in 77% and hard beats medium in 81%.

### 6.7 Drawing (`core/draw.ts`, `core/encode.ts`)

* `draw(game, view)` paints into a `Frame`: a `Uint8Array` of palette indices (0 is the sky), `W` wide and `2 * rows` high, plus a list of text overlays laid over the court's cells (the phase messages, M5 onward). An overlay may carry a `weight`, `bold` or `dim`, while its line pulses (M10). `view` is the court's `rows` and `rival`, the name the AI plays under: the game does not know the level, so the court hands the name in for "Point for Jelly" and "Jelly wins 9 : 11" (M11).
* Ground: 4 px at the bottom, its top pixel row lighter; 2 px when 4 would leave less air than the hovering serve needs (`SERVE_Y + BALL_R + 1` = 30 px), which only a 16 row court does. World row `y` is pixel row `h - ground - 1 - floor(y)`.
* Sprites, stamped at the floored position. The blob is painted from art in `draw.ts`, one letter for each pixel (body, shine, shade, eye, pupil): round jelly `BLOB_W` = 8 px wide and 9 high, so it stands flush at the walls and the net, and its top keeps to the collision circles. The side toward the net and the sole lie in the shade, the shine sits at the back of the head, and Claude's blob is the mirror image. Its 8 columns run from 4 left of the blob's floored column to 3 right of it. Until 2026-10-12 the blob was its two collision circles sampled at pixel centres (7 px wide, a pear; section 11). Eyes (M10): two white pixels side by side in the head's third row, and the dark pupil takes the one on the ball's side: the left one while `ball.x` lies left of the eye's middle, else the right one. That holds for both blobs, in every frame and phase, with the ball above the view too. Until M10 the pupil sat toward the net. The ball is the disc `dx² + dy² <= r² + r` (7 by 7; `r²` alone gives it a pointed top). The net: the columns whose centres lie within `NET_R` of the middle, `NET_H` high, drawn over the blobs.
* The wobble (2026-10-12): `blob.wobble` (6.3) picks one of three frames on the same feet: at rest, one row lower (8 by 8), and flat and wide (10 by 7). Over a wobble's steps the squash rises and falls back: the frame at rest for the counts 0, 1 and 15, the middle one for 2 to 5 and 11 to 14, the flat one for 6 to 10. A blob that keeps walking wobbles four times a second. The flat frame reaches 1 px past the body on each side: at the net that pixel lies behind the net, at a wall it is dropped.
* The pulsing line (M10): the countdown's digit and the win screen's "You win 11 : 7" stay the message line in the terminal's own text colour, and pulse. `pulse(step)` gives the weight `step` steps into a beat of `BEAT_STEPS` (30, 0.5 s): `bold` for the first third, none for the second, `dim` for the last, so the line lights up and fades with every beat. The countdown counts its steps from the start of each digit's beat, the win screen from the match's end. Attributes rather than colours of the mod's, so the pulse reads on a dark and a light theme alike. The other messages carry no weight. Big digits of 2 by 2 world pixels over the net were built first and replaced the same day (section 11).
* The win screen (M10): for its 3 s the winner hops (`hop`, from the steps since the match ended: 25 steps in the air up to `HOP_PX` = 6 px, then 2 steps in the flat frame and 3 in the middle one, a hop every `HOP_STEPS` = 30, in step with the pulse) and the loser lies in the flat frame. Drawing only: the sim stays where the last point left it. The hop stays below the message line on every court height.
* A ball wholly above the view is drawn as an arrow at its column: a 1 px tip over a 3 px base in the top two pixel rows, in the ball's colour. Pixels, not a glyph, so no font can widen the row. A ball partly above shows what is in view.
* `encodeRuns(frame, palette)` turns the frame into rows of runs `{ text, fg, bg }`. Each cell holds two pixels: `▀` with the upper pixel as foreground and the lower as background. Sky is the terminal's own background, so a sky pixel sets no color. A cell with sky above and color below uses `▄` with the color as foreground, two equal pixels `█`. Overlays replace their cells, cut at the court's edge, and a pulsing overlay's cells carry its weight into their runs (M10). Neighbouring cells with equal colors and weight merge into one run.
* Size guard: at most 900 coloured runs per frame (`MAX_COLORED_RUNS`); past that the rest of the frame is drawn blank. With the costs of 5.1 row 66 a 160 x 24 court stays near 85,000 characters of the `Client`'s 100,000. A real frame uses at most about 30 runs and 6,000 characters.
* The surface module turns each row into one `Text` holding a bare string for each plain run and a nested `Text` for each coloured or weighted one, a weight drawn as `bold` or `dimColor` (M10). With a mostly empty sky this is a few runs per row.
* `encodeCells(frame, palette)` produces `Raster` cells from the same frame. It is only written if fallback B is needed, but `encode.ts` is the one place where a frame becomes output. That is the renderer interface of D2.

Layout inside the `Client`, top to bottom: a score row ("You 3 : 5 Jelly", the AI by its level's name since M11, then the level, matches won and lost), the court rows, a hint row (keys, "Claude is done", "Esc once hands the keys to the prompt"; the texts in 3.2). The score and hint rows are rows of their own, not overlays.

### 6.8 Surface module (`hooks/court.tsx`)

* First call: builds the game from `props.match`, the width from `surface.columns`, the seed and the level. Starts `surface.every(16, onTick)`, sets `onPointer` and `onKey` (P1 measured the keys after a click with a listener set; in M5 they move nothing).
* `onTick`: asks the time base how much time passed, runs that many fixed steps (at most 5 per tick), posts the report, calls `setState` to draw. It posts on every tick, also when nothing changed, because the hooks module's reply to a post is how fresh key state reaches the `Client` (6.9, `ui.message`). Only a rally asks the input sources, so a paused court spares the AI's planning.
* Time base: real time from `performance.now()`, which is monotonic (P1 found it and `Date.now()` equal; a step of the system clock would freeze or skip play under `Date.now()`). With the prop `clock: 'tick'` every tick counts as 16 ms, with `clock: 'away'` as 32.5 ms, the background rate. Tests use these clocks, since the kit's `advance` moves timers but not the time (5.1 row 64).
* Room: the module measures its own region with `courtSize`, as the band hook does. Without room for the court it draws the one line of 3.2, pauses the game and holds it: no steps, and no resize from the narrow width, so a click after the room is back resumes the rally where it stopped (M5).
* `onPointer`: only a `down` of the left button counts. It starts, resumes or opens the next match, and hands the court the keyboard. The mouse moves nothing (D3). Without room the pointer is ignored.
* `onKey`: a press of A, D or W is noted for the 150 ms rule below; the presses move nothing themselves. Named keys (Space, End, the arrows) count as no letter, and one event may carry several letters (P1).
* New props: a new `keys` value updates the `KeysSource`. A higher `doneSeq` dispatches `turnDone`. A higher `cmd.seq` dispatches the command. A changed `level` swaps the AI level. A `match` with a higher `number` than the court's dispatches `reset` with it: `/volley reset` started a new match (M8). Otherwise the court's own match runs ahead of the props, never behind.
* Turn end (M7): the `doneSeq` the court mounts with counts as seen, as `cmd.seq` does. `turnDone` gives a rally the 10 s cut and pauses any other phase at once (6.4). Each tick, while no cut runs, `closed` takes up the highest `doneSeq` taken, and the report carries it (6.10). While the cut runs the hint row shows the marker of D5 in bold orange: "Claude is done: this rally plays out, then the court closes."
* The game state is one mutable object kept in `surface.state`. `setState` gets a new wrapper with a frame counter so the engine draws again.

When the keys leave the court (M5):

* Play pauses when the helper reports Esc going down, when it reports the terminal leaving the front, when the hooks module sends a pause (it saw `prompt.edit`), and when the helper reports A, D or W going down but no press of that letter reaches `onKey` within 150 ms (the keys are going somewhere else; P4 measured the press 3 ms before to 9 ms after the helper's change). Only changes of the mask count, since the props a click meets may be a frame old, and only between masks of a trusted helper: while it is not trusted (starting, or started anew after a reload ended the old one) its mask of 0 says nothing about the window, and a rally holds still with no pause, going on by itself once the helper is trusted again.
* Only a click resumes, and a click hands the court the keyboard, so a running rally always has it and the helper's keys may move the blob. The armed flag of the design is therefore not needed (section 11, M5).

Pause on leaving (3.2, M5):

* The window: no API field says whether the terminal window has the focus (5.1 row 51), but the frame clock does. P1 and P2 measured about 58 ticks a second with the focus and a steady 30 (gaps of 32 to 33 ms) without it, back at once on return. `hooks/focus.ts` counts a gap of 26 to 40 ms as slow; the window counts as gone once 12 of the last 16 gaps were slow (about 0.4 s at the background rate) and as back once at most 4 were, and in between the verdict stands. Only the change to gone pauses, so the click that brings the window back is not paused again. The numbers come from P1's seconds (section 11, M5); a busy turn in the user's check of M5 is their test. Where a helper runs, its foreground bit says the same.
* The keyboard: no event marks it leaving a `Client` (5.1 row 41). The hooks module sees the next `prompt.edit` and sends the pause command (6.9); Esc itself is seen only by a helper. Before the first click the prompt has the keyboard, and the pause it sends meets a court that waits anyway.

### 6.9 Hooks module (`hooks/register.tsx`)

Hooks and what each does:

| Hook | Work |
|---|---|
| `session.start` | Register `/volley` (`immediate: true`). Take in the saved `match` and `record` from `$.store` where `$.state` has none (`standing`, M8). `/volley`, the delay's timer and `ui.message` do the same first, since `/clear` empties `$.state` and raises no `session.start` (5.1 row 79); a court opens only through them. At every load, a reload included, `afterLoad` (`hooks/lifecycle.ts`) reads `band` and `turn` from `$.state`: a court that opened by itself closes when `enabled` went off, and when its turn ended it lets its rally run out as at `turn.complete`, since a turn that saved a file in the plugin's folder reloads the module as it ends (5.1 row 27); a turn still running with the band hidden arms the delay timer for what is left of the delay. Return `next(e)`. |
| `turn.start` | Store the turn in `$.state` (`id`, `startedAt`, `working: true`, `doneSeq` kept). Cancel a pending close: a court whose rally still runs out stays for this turn. If `enabled`: `$.clock.after(delaySeconds * 1000)` shows the court (a new seed, `manual: false`) if the same turn is still running and the band is hidden and not muted. Timers are never cancelled: each checks its own turn when it fires. Return `next(e)`. |
| `turn.complete` | Ignore turns with an `agentId`. Set `working: false` (the delay timer of this turn then finds it ended and does nothing), and if the court is shown and was not opened by `/volley` raise `doneSeq` in the same write; a `/volley` court never sees the turn end (3.2). Such a court that posted within the last second gets up to 11 seconds to report `closed` up to that `doneSeq` (6.8); one that did not (collapsed with `[-]`, behind a dialog, the line in place of the court) closes at once, since no rally runs there. A fresh load that has not heard from the court yet gives it a second to post, and closes it then if it did not (`finish`, also for the reload path). Return `next(e)`. |
| `ui.render` `{ component: 'AbovePrompt' }` | Where no key helper runs (none for the system, or it ended by itself), draw one line that says why in place of the court (D3). Draw the court only when all of these hold: the surface is `terminal`, the band state is `court`, no survey holds the band. In every other case return `next(e)`. To draw: size the court from `e.props.bodyColumns` and `e.props.maxRows` (`courtSize` in `core/draw.ts`) and return a `Box` with the one `Client` (`key="court"`, `module="./court.tsx"`, props from `courtProps()`), or, when the court does not fit, the same `Client` one row high, which shows the line of 3.2 (left out, it would come back as a new instance with a new game, 5.1 row 45). Reads `$.state`, so a state change draws again. Never writes. |
| `ui.message` | Validate the report (`readReport` in `protocol.ts`); a report starts the helper when none runs (6.12). A report below the session's match number is ignored: that court has not yet taken up the new match of a reset (6.8). If the standing changed: write `$.state` and save it to `$.store`; when the match number rose by one, count `lastMatch` (the match and its points) onto the store's record, which another session may have raised, and save that too (M8). Reports are taken one after another, so a match end is counted once. While a close is pending: once the report's `closed` reaches the turn's `doneSeq` and no turn started since, close the court (M7). Always return `{ props: courtProps() }` so the `Client` gets fresh key state without a render pass. |
| `ui.fault` | Log the reason with `$.ui.log(..., { to: 'debug' })` and hide the court (in place since M4). |
| `command.run` `{ command: 'volley' }` | Handle `on`, `off`, `reset`, `stats` and the bare toggle (see 3.2). Answer one short line; any other word gets the version and the forms. A court that opens gets a new seed and the store's record (M8). `reset` writes the next match to `$.state` and `$.store`, and a shown court takes it up from its props (6.8). `stats` reads the record from the store. |
| `classic.PermissionRequest`, `tool.call` | Not hooked (M7). The engine unmounts the court under a dialog (5.1 row 45) and mounts a fresh one, waiting for its first click, as soon as the dialog closes; a delay that runs out meanwhile shows the court then, and a turn end meanwhile closes it at once, since it posts nothing. The plan had a dialog flag here, from before P1 (section 11, M7). |
| `prompt.edit` | Raise the pause command so the game pauses, at every edit and without reading `$.state` first, since the hook sits in the path of every typed key; a court mounted later takes the command as seen. Return `next(e)` unchanged. |
| `session.end` | Wait for the reports being taken, then save what a failed write left pending, and nothing else (M8): every point is saved as it comes, and a blind save would put this session's standing over a newer one another session saved since. The whole chain has about 1.5 s (5.1 row 80). Return `next(e)`. |

`$` calls used: `$.ui.resolve`, `$.ui.log`, `$.ui.invalidate` (only if a state write is not enough), `$.state.get/set`, `$.store.get/set`, `$.clock.after/every/now`, `$.command.register`, `$.process.spawn`, `$.plugin.root`, `$.env.get("OS")` and `$.env.get("WSL_DISTRO_NAME")` (which pick the helper), `$.process.run` (`wslpath -w` in WSL; `uname` joins when M2b ships the Linux and macOS helpers, 6.12), and `$.env.get("WOBBLY_VOLLEY_CLOCK")` (the test seam for the tick clock).

Band states: `hidden` and `court`. Flags in `$.state`: `muted` (set by `/volley off`), `manual` (opened by `/volley`, so not closed at turn end).

Settings (`userConfig` in `plugin.json`, each a row in `/config`; every field shape below validated in the design probe):

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | boolean | `true` | The court appears by itself during long turns. |
| `delaySeconds` | number | `5` | Seconds into a turn before it appears. |
| `difficulty` | string, `options: ["easy", "medium", "hard"]` | `"medium"` | AI level, drawn as a picker. `readSettings` reads it (any other value as `medium`), and `courtProps` hands it to the court as `level` (M9). |

A change in `/config` reloads the module with the new values (5.1, row 18).

### 6.10 Protocol between the two modules

Props, hooks module to `Client` (plain JSON):

```ts
type CourtProps = {
  v: 1
  match: VolleyMatch                  // the standing at mount; the Client owns it while mounted; a higher number replaces it (M8)
  record: VolleyRecord                // for the score row
  level: 'easy' | 'medium' | 'hard'
  doneSeq: number                     // rises at a main turn.complete that closes this court (M7)
  keys: { ok: boolean; mask: number }  // bit 0 A, 1 D, 2 W, 3 Esc, 4 terminal in foreground (6.12)
  cmd: { seq: number; kind: 'none' | 'pause' }
  clock: 'wall' | 'tick' | 'away'     // the last two are test clocks (6.8)
  seed: number
}
```

`cmd.seq` only rises. The hooks module sets it to the larger of `seq + 1` and `Date.now()`, so a reload, which starts the module's values over, cannot send it back. The `Client` does a command whose `seq` is above the highest it has seen, and takes the one it mounts with as seen.

Report, `Client` to hooks module (one per frame at most):

```ts
type CourtReport = {
  v: 1
  frame: number
  phase: Phase
  match: VolleyMatch
  lastMatch: { winner: 'you' | 'claude'; you: number; claude: number } | null   // how the last match the Client saw end ended
  closed: number                      // the highest doneSeq whose rally is over (M7)
}
```

`CourtProps` and `CourtReport` live in `hooks/protocol.ts`, with `readReport`, which reads a post field by field. Each field comes with the milestone that uses it: M4 passed `{ v, clock, seed }`; M5 adds `match`, `record`, `cmd` (kind `pause`) and `keys`, and reports `{ v, frame, phase, match, lastMatch }`; M7 adds `doneSeq` and reports `closed`; M8 carries a reset in `match.number`, so `cmd` keeps the kinds `none` and `pause`; M9 adds `level`.

`doneSeq` lives in `$.state` (`turn`), so a reload cannot send it back. `closed` names the turn end it answers: a court that ends its rally after one turn end and still reports it when the next turn ends is not taken for done with the new one.

`lastMatch` with `match.number` names the match that ended: when a report's number is one above the stored one, the hooks module counts `lastMatch` into the record once, whichever instance sends it and after a reload too. A reset clears `lastMatch`, so an abandoned match is not counted.

The report is always a full snapshot and never a list of events. A post can be replaced by a later one in the same frame, and a snapshot makes that harmless. The hooks module compares it with the last one it saw.

### 6.11 State and persistence

Contract (`types/index.d.ts`):

```ts
export type VolleyMatch = { v: 1; you: number; claude: number; server: 'you' | 'claude'; number: number }
export type VolleyRecord = { v: 1; won: number; lost: number; pointsFor: number; pointsAgainst: number }
export type VolleyTurn = { id: string; startedAt: number; working: boolean; doneSeq: number }
export type VolleyBand = { mode: 'hidden' | 'court'; muted: boolean; manual: boolean }

declare module 'claude-code' {
  interface PluginState {
    'wobbly-volley': { match: VolleyMatch; record: VolleyRecord; turn: VolleyTurn; band: VolleyBand }
  }
}
```

* `number` in `VolleyMatch` is the match's running number: 1 for the first match, plus one at each match end and at a reset.
* The core keeps its own `Match` of the same shape in `core/types.ts`: the contract file may hold no import, and the core may not import the contract, which augments `claude-code`. A type check in `tests/game.test.ts` holds the two equal, so tsc fails when one changes alone.
* `$.state` (this session; survives a hot reload, emptied by `/clear`, 5.1 row 79): the four values above.
* `$.store` (across sessions): `match` and `record`, written after every point. A value with an unknown `v` is ignored and replaced by a fresh one. The store is the plugin's own file under the config folder, named by the plugin and its source, `inline` for a folder load (5.1 row 81). A write that fails stays pending and is tried again with the next save and at `session.end` (M8).
* Module variables (lost on reload, by design): timers, the helper stream, the latest key mask, the court's seed, the latest command, the queue that takes reports one after another, and the pending store writes.
* `Client` state (lost when the court closes): the running rally.

### 6.12 Key helper (`helper/keys.*`, `hooks/keys.ts`)

There is one helper script per system. The lines it writes to stdout are the contract: `keys.ts` picks the script and reads those lines, and knows nothing else about the system.

| System | Script | Reads | State |
|---|---|---|---|
| Windows | `helper/keys.ps1` | `GetAsyncKeyState`, and `GetForegroundWindow` for the foreground | passed P4 (M2, section 10) |
| WSL | `helper/keys.ps1`, started from Linux through `powershell.exe` | the same, because the keyboard of a WSL session belongs to Windows | passed P4 (M2b, section 10) |
| Linux | `helper/keys.py` | `XQueryKeymap` through `ctypes` on an X11 session, the key state of the keyboards under `/dev/input` on Wayland (an opt in, 3.2) | written, not measured (M2b) |
| macOS | `helper/keys.js`, run by `osascript` | `CGEventSourceKeyState` | written, not measured (M2b) |

The Windows and WSL routes are measured. Linux and macOS are plans until M2b has measured them, and a helper ships only if it passed there (D3).

* Picking the helper (`pickSystem` and `helperArgv` in `keys.ts`, looked up once per module load by `lookUp` in `register.tsx`): if `OS` is `Windows_NT` it is Windows, else a set `WSL_DISTRO_NAME` makes it WSL, and both start the Windows helper. Elsewhere none ships yet and there is no game; when M2b passes Linux or macOS, `uname` through `$.process.run` joins to tell them apart.
* Start in WSL: the same argv, with the script's Windows path from `wslpath -w <$.plugin.root>/helper/keys.ps1` through `$.process.run` (`C:\projects\ClaudeyVolley\helper\keys.ps1` for the folder under `/mnt/c`). Where `wslpath` gives no path the band says the helper "could not start".
* Started by the court's posts: a post while none runs starts it, where one ships. Stopped when the posts stop (a hidden or collapsed court, a dialog): a watch every 500 ms finds no post for a second, and the loop leaves at the next piece of output, which the heartbeat brings, so within about 1.5 s. A helper that ends by itself (an `E` line, a crash) is not started again in that module load, and the band shows why in place of the court (`stopped` in `keys.ts` words the `E` line). While `keys.ok` is false the mask is 0 and the hint row says the court waits for the helper.
* Start on Windows: `$.process.spawn({ argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', <$.plugin.root>\helper\keys.ps1] })`. The policy flag applies to that one process only and is there for machines whose policy forbids script files.
* The Windows script compiles one C# class with `Add-Type` and runs it. It takes one snapshot of all processes and walks up its parents to the first one with a main window: the terminal. It calls `timeBeginPeriod(1)` and loops with a 2 ms sleep. Each pass it asks which process owns the window in front (`GetForegroundWindow`, `GetWindowThreadProcessId`), and only when that is the terminal does it read `GetAsyncKeyState` for exactly four keys (A, D, W, Esc; eight until D3 dropped the arrows and Space in M5). Every window and tab of the terminal's process counts as in front. Time stamps come from `GetSystemTimePreciseAsFileTime`. Without a window above it (a session the daemon runs, 5.1 row 56) it writes `E nowindow`.
* The Linux script (Python 3.7 or later, no packages) picks its backend by the session: `evdev` when `XDG_SESSION_TYPE` is `wayland` or `WAYLAND_DISPLAY` is set, else `x11` when `DISPLAY` is set, else `E nodisplay` (SSH, a text console). `x11`: the terminal is the first parent process that owns a window in `_NET_CLIENT_LIST` (by `_NET_WM_PID`; none, as under tmux or `ssh -X`: `E nowindow`); every 20 ms it asks `_NET_ACTIVE_WINDOW` whose window is in front, and only then reads `XQueryKeymap`. `evdev`: it opens the readable devices under `/dev/input` that have an A key and reads their key state with `EVIOCGKEY` each pass, looking at the four keys only, and rescans for new keyboards with every heartbeat; none readable: `E noinput` (not in the `input` group). It checks its parent with each heartbeat.
* The macOS script (JXA) takes the first parent process that is a regular app as the terminal, asks `NSWorkspace` for the app in front, and only then reads `CGEventSourceKeyState`. The run loop turns between passes (2 ms), so the app in front stays current. It checks its parent with every fourth heartbeat; a closed pipe ends `osascript` at the next write. Unmeasured: whether it needs the Input Monitoring permission, and terminals whose shells run under a server process of their own (iTerm2's `iTermServer` has `launchd` as its parent, which would give `E nowindow`).
* Output, the same for every helper, one line per change: `K <mask> <unix ms>` (the mask bits of 6.10). While the terminal is not in the foreground the mask is 0. A heartbeat `H <unix ms>` goes out every 500 ms; the first line is one, once the helper is ready. A helper that cannot work writes `E <word>` once and exits, for example on Wayland without the `input` group. The script also exits when its parent process is gone (checked with each heartbeat) or a write fails. Readers ignore any other line. stderr carries diagnostics only (the Windows script: one `start` line with its startup times and the chain of parents).
* A helper that cannot tell which window is in front (Wayland) always sets bit 4. The 150 ms rule of 6.8 is then the only guard.
* `keys.ts` buffers the stream text, splits it at line ends, and keeps the latest mask. `keys.ok` turns true with the helper's first `K` line, not its first `H`, which comes before it. No heartbeat for 2 seconds sets `keys.ok` to false until the helper speaks again, which brings back its last `K` mask (it writes one only on a change). An `E` line and the helper's end clear the mask for good, so the next helper starts from nothing.
* What no helper does: it reads no other keys, stores nothing, and opens no network connection. The README must say what it reads and why. (Online play's net helper, 13.9, is the one process that talks to the network, and only with `online` on. It runs the key helper as its child and leaves it as it is.)

### 6.13 Fallback architecture B (only if P2 fails)

* The simulation runs in the hooks module on `$.clock.every(16)`. The court is a `Raster` in the band, repainted with `$.ui.blit` from `encodeCells`.
* Helper keys arrive in the hooks module directly.
* The pointer needs a `Client`. Try a `Raster` in an absolute `Box` over a `Client` of the same size. If the pointer does not come through, use a `Client` strip as tall as the hint row under the court: the pointer's column in the strip steers.
* Core, rules, AI, protocol values and tests stay as they are. Desktop then needs its own renderer later.

---

## 7. Risky parts and prototypes

Each prototype is a tiny plugin of its own under `prototypes\`. It shows its measurements in the band and writes them to `prototypes\results\<name>.json` with `$.fs.write`, so the building session can read the numbers itself. The user's part is to click, press keys and judge by eye. Results go into section 10.

**P1 band probe** (`p1-band`). A band with a 24 row `Client` that logs every event. It answers:

* the real `bodyColumns`, `maxRows` and viewport,
* ticks per second of `surface.every(16)` over 10 seconds, with the shortest and longest gap,
* whether `Date.now()` works and advances in a surface module,
* whether hover moves arrive without focus,
* whether a `down` takes the keyboard, and whether letters typed afterwards stay out of the prompt box (compare `$.prompt.read()`),
* whether the first Esc only returns the focus (watch for a `turn.complete` with reason `aborted`),
* whether the keyboard returns to the prompt when the band stops drawing the `Client`,
* what `[-]` does to the `Client`,
* what happens when a dialog opens while the `Client` holds the focus (a probe command schedules `$.ui.ask` with `$.clock.after(5000, ...)`, and the user clicks into the `Client` before it fires).

Prototypes carry no `*.test.ts` files, so the mod's own `claude plugin test .` never runs them.

**P2 court drawn by the Client** (`p2-client-court`). The full size court from text runs with two moving blobs and a bouncing ball, redrawn every tick, while a real turn streams output above it. Measured: draws per second, the longest gap between draws, CPU of the `claude` process over 10 seconds, and the user's verdict on flicker and tearing.

* Pass: at least 30 draws a second sustained, no visible tearing, pointer movement feels immediate, CPU under 50% of one core (the user's line, 2026-10-06).
* Also checked: the draw rate while the terminal window is in the background, to explain the 31 a second stretches P1 found.
* Result, 2026-10-06: pass on every line (section 10). P3 is not built.
* Pass means architecture A. Fail means build P3 and use fallback B.

**P3 Raster court** (`p3-raster-court`), only if P2 fails. The same scene through `Raster` and `$.ui.blit` on `$.clock.every(16)`. Measured: blits taken per second and their jitter. Tried: the two pointer arrangements of 6.13.

**P4 key helper** (`p4-key-helper`). The helper script, started through `$.process.spawn`. Measured over about 200 key events:

* time from spawn to the first heartbeat,
* delay from the helper's time stamp to `$.clock.now()` in the hooks module (median and 95th percentile),
* the further delay until the `Client` has the new mask through a post reply,
* two keys held at once, and release,
* silence while another window is in front,
* no helper process left behind after a reload, after the court hides, and after the session ends,
* no objection from Defender.
* Pass: median key to `Client` at most 50 ms, 95th percentile at most 100 ms, no process left behind.
* Fail: the key scheme cannot ship as decided in D3. Stop and ask the user (pointer only, or tap keys as a stopgap).
* The probe picks the helper by system as 6.12 says, and its result file carries the system in its name (section 10). M2 measures Windows. M2b repeats it on WSL, Linux and macOS: first the bare script in a terminal, then the probe, with the same pass line. A system that fails there has no game (D3).
* Result on Windows, 2026-10-06: pass on every line (section 10).

**P4 on the other systems (M2b).** The project reaches another machine through the repo: `git clone https://github.com/kopylow/wobbly-volley.git ClaudeyVolley`. A session there starts cold with section 0; the person's part is the same as on Windows. Per system:

* **Linux (CachyOS).** First the bare script: in a terminal in the project folder, `python3 helper/keys.py`, press the eight keys, watch the `K` lines, Ctrl+C. It picks evdev in a Wayland session and X11 in an X11 one (`--backend` overrides). Then the probe: `./dev.sh -Only p4-key-helper`, `/p4 on`, the steps in the box. Do both in a Plasma (Wayland) session, then log in to Plasma (X11) and do both again. Results land in `prototypes/results/p4-key-helper-linux.json`; each load is an entry of its own, and the helper's `start` line names the backend. On Wayland the foreground bit is always set (6.12), so step 6 shows keys from other windows: expected, recorded, and not a fail.
* **WSL.** In an Ubuntu-24.04 tab of Windows Terminal: `cd /mnt/c/projects/ClaudeyVolley && ~/.local/bin/claude --plugin-dir prototypes/p4-key-helper` (`claude` alone starts the Windows build there, section 11). For the reload step, the session itself touches `prototypes/p4-key-helper/hooks/register.tsx`.
* **macOS (the friend).** First the bare script: `osascript -l JavaScript helper/keys.js` in the terminal, press the keys, Ctrl+C. If no key ever shows, look under System Settings, Privacy & Security, Input Monitoring for the terminal app. Then `./dev.sh -Only p4-key-helper` and the steps. Also watch the helper's CPU and memory in Activity Monitor for a minute.
* After a round on another machine, its session commits the result file and pushes (or the file is sent back), and section 10 gets the system's row.

Other risks without a prototype of their own:

* **Esc habit.** If the first Esc returns the focus and a second one interrupts the turn, a player who mashes Esc cancels Claude's work. The hint row must say "Esc once". P1 shows the exact behavior.
* **No event for a dialog closing.** Resolved in M7: the engine itself takes the court away under a dialog and brings a fresh one back as the dialog closes (5.1 row 45), so the mod needs no event (6.9).
* **Reload on a settings change.** Changing a `/config` row reloads the module, which drops timers and the helper. `session.start` after the reload rebuilds them from `$.state` (6.9).
* **Background sessions.** A session the engine moved to the background loads the mod and would draw the court unseen (5.1 row 50, section 11). M7 has to keep the court, and the key helper with it, out of such sessions. P4 found that a session the daemon runs can also be the one the person works in (5.1 row 56): there the Windows helper finds no window and writes `E nowindow`, so since M5 the band says the game cannot read held keys there. ← on an empty prompt makes such sessions (5.1 row 71); `/config leftArrowOpensAgents=false` stops it.
* **Wide courts.** Run speed and hit speed scale with the width (6.3), but the feel on a 160 column court is untested until M10.
* **First helper start.** It took 11 seconds once on this machine. The hint row says the court waits for it; a click counts down meanwhile, and the keys move once it is ready. In P4 five starts took 0.5 to 0.95 s.
* **Sharing later.** A script that reads key state may alarm antivirus tools on other machines. The README has to be open about it, and say that the game needs it.

**Online play (section 13).** Two more prototypes, built as the others: a tiny plugin each under `prototypes\`, their numbers in `prototypes\results\`, their findings in section 10.

**P5 net helper** (`p5-net`, with the first `helper/net.ps1` of 13.9 and `tools/netpair.ts`). First the bare script, then the probe plugin, which starts the helper as the mod will, writes its control file and logs its lines. It answers:

* STUN: whether both servers answer, how fast, and whether their two mappings agree (`A nat`) on this network and on a phone hotspot.
* Windows Defender Firewall: whether a `powershell.exe` that binds UDP and sends first raises its dialog, and what punching does after "Allow" and after "Cancel".
* The control file: whether `$.fs.write` writes into the helper's temp folder, on Windows and from WSL through `/mnt/c`, and the delay from the write to the helper acting on it (median, 95th percentile).
* The key helper as its child: whether `keys.ps1` under `net.ps1` still finds the terminal, and how much later its `K` lines reach the hooks module than without the net helper in between.
* Punching between two helpers: on one network (a second machine, or WSL with mirrored networking); IPv6 between two homes; IPv4 between two homes; one side on a phone hotspot. For each: connected or not, the time to `C up`, which candidates won.
* Lockstep over 5 minutes at the delay picked: steps released per second, stalls (how many, the longest), with no loss and with `-Drop 5`; the step lines of both sides compared line by line.
* Cost: CPU and memory of the net helper and its child together.
* Cleanup: no net helper and no child left after the probe stops, after a reload and after quitting Claude.
* Pass: STUN and the control file work; one network and at least one route between two homes connect within 5 s; both sides' step lines are identical; with a round trip up to 60 ms and no loss, fewer than 1% of steps stall; the two processes use under 3% of one core together; nothing is left behind. A hotspot that does not connect is expected and no fail.
* Fail: stop and ask the user. The ways out are a relay (section 12, a service of our own after all) or online play on one network only.
* `tools/netpair.ts` runs here first: two `net.ps1` on this machine with scripted keys.

**P6 lobby** (`p6-lobby`). A probe plugin whose `/p6` command publishes to and polls a private topic on ntfy.sh through `$.http.fetch`, run in two sessions with config folders of their own. It answers:

* the time from a publish in one session to the poll that sees it in the other, and what the answers' headers say,
* what a `fetch` to an address that never answers does: how long until it rejects, and what happens to a hook dispatch and to a loop of its own that wait on it (5.1 row 90),
* whether anything prompts or refuses on the way,
* TweetNaCl: whether the vendored ES module loads in the hooks worker and passes validate, and how long `keyPair`, `box`, `box.open` and `box.before` take there.
* Pass: a message is seen in the other session at the next poll; a `fetch` that hangs can be given up after 10 s without holding anything else; each TweetNaCl call takes under 50 ms.
* Fail: stop and ask the user (another meeting point, 13.15).
* P6 provokes no 429 on purpose: the service is free, and repeated excess can ban the address. The kit tests the back off against a stand-in instead.

Other risks of online play, without a prototype of their own:

* **ntfy.sh changes its limits, its terms or goes away.** The lobby is one URL; the README names the service. A second meeting point is an idea for later (section 12).
* **Several machines behind one address** (an office, a household) share ntfy's limits, which the lease cannot coordinate across machines. The back off of 13.6 keeps them from being banned.
* **The same result on every system** (D18). 6.3 argues it, and the pinned hashes of section 8 prove it on each system the kit runs on. ECMAScript calls `Math.sqrt` implementation approximated; every engine in use takes the processor's correctly rounded square root, and the pinned hash test is what tells.
* **Networks that cannot be punched through** (13.7). Such pairs play the AI and are not paired again for 10 minutes.
* **Firewall dialogs** on Windows (P5) and from the macOS application firewall when it is on (M20).
* **macOS without Python** (D22): no online play there, said in one line.
* **A desync** despite equal versions: the hashes end the meeting and log it.
* **Flooding of the public topic**: matchmaking stops, the game does not (13.14).

---

## 8. How it is tested

Run all three before ticking any milestone from M3 on:

1. `claude plugin validate .` passes (warnings are read, errors are fixed).
2. `claude plugin test .` is green.
3. Type check: `npx -y -p typescript tsc -p .` once the engine has laid `.claude-plugin\types\` beside the mod (it does at every load: a session through `dev.ps1`, or the headless line in `.claude\workflow.md`). The root `tsconfig.json` includes `hooks`, `types` and `tests`, so `core\` is checked through the files that import it. From M3 on, if no such file imports a core file, give the root `tsconfig.json` its own `include` with `core` added.

Automatic tests (`tests\*.test.ts`, kit facts in section 5):

* **Core** (no kit features needed, only `test` and `expect`): gravity and jump heights, the blob stays in its half, wall and net bounces, hit speed, the touch rule, ground scoring, scoring to 11 with two clear, serve order, the 10 second cut after `turnDone`, void rally on resize, same seed and inputs give the same state after 10,000 steps. The wobble (2026-10-12): walking keeps it going, at the slowest level's pace too, pressing against the net lets it run out, a take-off from a stand sets it, a slow creep and walking in the air set none, a serve puts both blobs at rest, and a blob without a count is at rest.
* **AI**: in 200 seeded rallies hard beats easy in at least 80 percent, medium lies between, no rally runs longer than 60 seconds of game time, the AI never leaves its half. M5 checks medium alone: it takes its serve within a second and sends it over, its plan without an aiming error sends more than three in four touches over the net, with its error more than 64% over 1,000 touches a width, it plays itself with points for both sides and rallies under 3 minutes, and it wins nearly every point against a player who only serves. As built in M9: every level takes its serve within a second and sends it over in at least 19 of 20 seeds; the plan with an error of 3 px (medium's until M9) sends more than 64% over; medium against itself scores for both sides with rallies under 90 s; in 200 rallies on the three widths hard beats easy in at least 80% and medium beats easy in at least 65%, neither with a rally over 60 s, and hard beats medium in at least 65% with none over 3 minutes; in each pairing no blob leaves its half and the stronger level's touches cross more often. The 60 s line binds the pairings with easy only: a rally ends at the first fault, so between two sides that rarely fail its longest grows with the number of rallies (section 11, M9). The placements are checked on one ball: medium takes the middle stand that goes over, hard the one whose ball comes down furthest from the other blob (deep with that blob at the net, short with it at the back), easy a stand from 3 px in front to 6 px behind as its draw says, and its own serve as medium plans it; easy keeps the stand it drew for a ball until it touches it.
* **Focus watch** (M5): the foreground clock with stalls, busy stretches and a steady 50 or 22 frames a second never counts as gone; the background rate does, once and within half a second; back in front clears it.
* **Report** (M5): a report reads back as posted, anything else a post could carry is dropped.
* **Drawing**: a known state gives the expected runs, sky sets no color, the arrow shows for a ball above the view, overlays land in the right cells. The blob (2026-10-12): its picture pixel by pixel and Claude's as the mirror image, each blob's shine a lighter and its shade a darker tone of its own colour, the squash over a wobble's steps on the same feet, and flush at the net, with the net over what a squash pushes past it. (M10) Each pupil on the ball's side of its eye, for both blobs, in all three frames, with the ball in view and above it. The pulse, a third bold, a third plain, a third dim of each beat; the countdown's message line "3", "2", "1" each pulsing once in the order bold, plain, dim, ten steps each; the win screen's "You win 11 : 7" and "Jelly wins 9 : 11" pulsing six times; the other messages still. (M11) The AI's point and its win name it as the view says, each level by its own name: Pudding, Jelly, Gummy. The winner's hop over the 3 s, one every `HOP_STEPS` up to `HOP_PX` and below the message line, the loser flat, and `draw` leaving the game as it was. A pulsing overlay's weight goes into runs of its own.
* **Band and Client** (kit, `$.ui.mount` on `terminal`): the band draws nothing when hidden, draws the court when shown, sizes it from `bodyColumns` and `maxRows`, falls back to one line when too small. A pointer `down` starts the countdown. (M5) Held keys through the stand-in helper steer and jump, a longer W jumps higher, where no helper runs the band shows its line, a serve leads to a point on the score row, a whole match ends on the win screen and counts in the record, `prompt.edit` pauses and a click resumes exactly, the background clock pauses once, no room pauses, and a court opened anew shows the standing. (M9) The level of `/config` shows on the score row; the kit cannot change it under a mounted court (5.1 row 75), so the swap after a `/config` change is the user's check. (M10) Each countdown digit is drawn bold, then plain, then dim within its beat, and every hint and the marker fit 60 columns. (M11) At hard the score row says Gummy, and after your serve with nothing behind it the point is "Point for Gummy". The kit reads the phase message without the half blocks in its row (`message`: a high ball or the net's top may share the row once the constants move), and how its run is drawn (`weight`: bold, dim or plain). With the tick clock (`mock.env` sets `WOBBLY_VOLLEY_CLOCK=tick`) `ui.advance` moves the game. On `desktop` the hook returns `next(e)`.
* **Store** (M8; the store beneath is the stand-in of `tests/kit.ts` over a `Map`, since a test can neither read `mock.store` nor watch it, 5.1 row 85): the point a rally ends in is saved; a court in a new session shows the saved standing and record; a match end counts once, onto what another session counted meanwhile; the court's opening shows what other sessions counted since; `/volley reset` shows 0 : 0 on a shown court at once, with typing after it or not, and a late report of the old match is not taken back; a failed write costs the court nothing and the next save and the session end save what it left; a session end with nothing pending writes nothing.
* **Lifecycle** (`mock.clock`, M7): the court shows only after `delaySeconds` of a running turn (the default and a value from the options), waiting for a click while the prompt keeps typing; not for a shorter turn, not when disabled, not after `/volley off` (M8), which also hides a court that opened by itself; `/volley on` ends the mute with a court that stays past the turn end, and the toggle shows a court while muted and leaves the mute. `turn.complete` with an `agentId` changes nothing. After a main `turn.complete` a court waiting for its click closes at once; a rally plays out under the marker and the court closes when it ends; a court that does not post closes at once, one that stops posting afterwards closes at 11 seconds and not at 10.9. A `/volley` court stays. A turn that starts while the rally runs out keeps the court, and its end closes it. A reload during the wait lets the rally run out under the marker; one during a turn opens it when the turn's own delay runs out. The rally after a turn end waits for a helper not trusted and still plays out. `readSettings` and every branch of `afterLoad`. The kit cannot stage a fresh load (5.1 row 75), so the second a fresh load gives a court it has not heard from is the user's check.
* **Helper stream**: a test hook on `process.spawn` yields lines in odd pieces (half lines, several lines at once). The parser gives the right masks, and a missing heartbeat or an `E` line clears `keys.ok`. (M5) In the kit the stand-in helper waits on `mock.clock` (5.1 row 72): the court's post starts the Windows helper, held D runs and release stops, a key without its press pauses within 150 ms, Esc and the front leaving pause and a click with stale props does not, it stops after the posts stop and starts again, an `E` line puts the line that says why in place of the court, Space counts as no press of A, and silence for 2 s, which holds a rally still with no pause until the helper speaks again. (M2b) In a WSL distribution the court's post asks `wslpath` once and starts the Windows helper by the path it gives, and a held key moves the blob; a `wslpath` that fails, whatever it wrote, or that answers with no path puts "it could not start" in place of the court and starts no helper. Outside WSL the kit's stand-in `wslpath` fails, as a system without it does, so a Windows court that asked it would have no game.
* **Command**: each `/volley` form through `$.command.run`; `stats` with the standing saved by an earlier session, after a `session.start` and with no `session.start` at all (an empty state, as after `/clear`), and with a record another session raised; `reset` with no court; a saved value of an unknown `v` (M8); `stats` at easy naming Pudding (M11).
* **Standing** (M8, pure): the record after a match, `same`, the words of `/volley` in any case and spacing, the reset and stats lines; the store's values read as the report's are (`protocol.test.ts`).

Manual checks (the user, in a session started with `dev.ps1`; the milestone says which apply):

* The court appears about 5 seconds into a long turn and not during a short one.
* Before the first click, typing goes to the prompt.
* A click starts the countdown. Held keys run, release stops at once, run and jump work together, a longer hold jumps higher.
* Esc pauses and the prompt takes typing again. A click resumes.
* When the turn ends, the marker shows, the rally finishes, the court closes, the prompt has the keyboard.
* The standing is the same at the next turn, after a reload, after `/clear` and after restarting Claude Code (M8).
* A permission prompt closes the court at once.
* After the session ends, no `powershell.exe` helper is left (`Get-Process powershell`).
* Resize the window during a rally: the court adapts and the point is served again.
* Another window in front pauses the game within about half a second; a long busy turn in front never does (M5).
* The countdown and the win screen's line pulsing with each beat, the eyes following the ball, the hopping winner and the flat loser (M10).

**Online play (section 13).** Automatic tests, by milestone:

* **Core** (M14): input bytes to `Input`s, the flag bits masked; each seat's pause and resume, the game running only with neither paused, the countdown after the last resume, the pause limit at 900 paused steps ending the meeting on both seats alike; a `done` from one seat giving the 600 step cut and the end at `rallyOver`; a `leave` voiding the rally; the next match counting down by itself after the win screen; the first serve by match number. `stateHash`: the same game gives the same hash, a change of any field gives another. **Pinned hashes**: 10,000 steps of seeded AI against AI on 60, 110 and 160 columns end in three fixed hashes, written into the test. They hold the core's arithmetic to one result on every system the suite runs on (D18), and they change only with a deliberate change of the core, which then belongs to a new version.
* **Drawing** (M14): the `claude` seat's picture is the exact mirror of the `you` seat's, with the colours swapped so each sees themself in blue on the left; a match narrower than the court is centred with blank columns beside it.
* **Identity and people** (M15): the code of a known key; codes read with and without dashes, in lower case, with I, L and O; the nickname rule on accepted and refused names, and a stranger's name cleaned; the default nickname; labels; the cap on rivals; every new `/volley` form, as the command tests of version 1.
* **Sealing** (M15): a box opens for its receiver, not for anyone else; a box that names a `from` other than its key's code, one older than 60 s, and one with a nonce seen before are dropped.
* **Lobby** (M16, against a stand-in lobby on `http.fetch`): the message reader drops anything malformed or oversized; presence by `hello`, `bye` and the 6 minutes; the pairing order; mutual offers settle on the lower code; `friends` mode refuses strangers; blocked codes never; an offer that runs out and the skips of 2 and 10 minutes; the bucket, never more than ntfy allows; a 429 and its `Retry-After`, doubling up to 15 minutes; a request given up after 10 s; the day's count; the lease between two sessions over the store stand-in.
* **Net lines** (M17): the reader takes `K`, `H`, `E`, `P`, `A`, `C`, `S`, `X`, `T` and `N` in odd pieces and ignores anything else; the control file is written as 13.9 says, its number only rising.
* **The meeting in the kit** (M17, M18; a stand-in lobby, a stand-in net helper on `process.spawn` as in 5.1 row 72, the store and `fs.write` answered by the test, the tick clock): with `online` off no request goes out and the key helper starts as before; on, the first click brings a `hello`; an offer from the stand-in is answered and the helper gets `peer`; `C up` and the end of the AI rally bring `start`; step lines move both blobs and a point is saved under the rival's code; Esc, `prompt.edit` and a silent court each send `pause`, a click sends `resume`; the 15 s limit ends the meeting; a turn end sends `done`, the rally plays out, the standing is saved and the court closes; `C lost` voids the rally and saves; a hash mismatch ends the meeting; meeting the same rival again resumes the standing that is further on; the score row shows the nickname and the ping; the court of the `claude` seat is mirrored.
* **Helpers** (M13, M19): `tools/netpair.ts` runs two net helpers on one machine with scripted keys for a minute, with no loss and with 5%, and compares their step lines: `net.ps1` with `net.ps1` on Windows, `net.py` with `net.py` in WSL, and `net.ps1` against `net.py` across Windows and WSL.

Manual checks of online play (the user, with a second player or a scripted one, `WOBBLY_VOLLEY_NET_SCRIPT`; the milestone says which apply):

* With `online` off, no `net.ps1` runs and `/volley` says nothing about online play.
* `/volley code` and `/volley name`; a friend added by code is matched before a stranger.
* A match against a person on another machine: both see themselves on the left, the ping on the score row, a pause by either side stops both, a click by the one who paused resumes.
* A dialog during a meeting pauses both; one closed within 15 s lets play go on, one held longer ends the meeting with the standing saved.
* A turn end on one side: the rally plays out on both courts, that court closes, the other plays Jelly again.
* The same two meet again and the match goes on at its score.
* `/volley block` ends the meeting, and the blocked player is not matched again.
* After the session ends, no net helper and no key helper is left (`Get-Process powershell`).

---

## 9. Milestones

Each one fits a single session. Do them in order. A milestone that waits on another machine or person carries "waiting <on whom>" in its line and is skipped until that round is in.

* [x] **M0 Project setup.** `git init`, `.gitignore`, `dev.ps1`, a skeleton that loads: `plugin.json` (with `author` and the four `userConfig` fields), `hooks.json`, a `register.tsx` that registers `/volley` and answers with the version, `types/index.d.ts`, one trivial test. Create the private repo `kopylow/wobbly-volley` and push, after asking the user once. **Done when** validate and test pass, `/volley` answers in a session started with `dev.ps1`, and the repo holds the first commit. Done 2026-10-06 (estimate 1.5 h).
* [x] **M1 Prototypes P1 and P2** (and P3 if P2 fails). **Done when** every question of P1 and the P2 verdict are written into section 10, and the choice between architecture A and B is recorded in section 11. Done 2026-10-06 (estimate 7 h; P3 was not needed).
* [x] **M2 Prototype P4 on Windows.** Built so that the helper is picked by system and the line format of 6.12 is the contract. Measured on Windows. **Done when** the delays and the checks of P4 are in section 10 and the pass or fail is recorded. On a fail the user has decided how D3 changes. Done 2026-10-06 (estimate 6 h): held keys pass on Windows.
* [ ] **M2b P4 on the other systems.** WSL, Linux on CachyOS, and macOS through the user's friend, who has Claude Code. For each: first the bare script in a terminal, then the P4 probe, with the same pass line as P4 (steps in section 7). A system that fails has no game; one that passes gets its pick in `helperArgv` (6.12) right then. Once it waits on the user or the friend it is marked waiting and M3 goes on. **Done when** each of the three has its pass or fail in section 10. Estimate 8 h of building plus the rounds on the other machines. State 2026-10-06: `helper/keys.py`, `helper/keys.js` and `dev.sh` written; the WSL bare run passed; the rounds are open. State 2026-10-12: **WSL passed and ships** (section 10, section 11). **Waiting on the user** (the CachyOS round, put off by the user's choice on 2026-10-06) **and the friend** (macOS; how the friend gets the private repo is still open). M3 goes on meanwhile.
* [x] **M3 Core.** `constants`, `types`, `rng`, `sim`, `game`, `input` with the core tests of section 8. **Done when** the tests are green and no file under `core\` imports `claude-code`. Done 2026-10-06 (estimate 10 h): 41 core tests; `game.ts` and `input.ts` are complete, M5 and M6 wire them into the `Client`.
* [x] **M4 Drawing.** `draw`, `encode`, the bare `/volley` toggle, and a `court.tsx` that shows an AI against AI demo (a placeholder AI that walks under the ball is enough) when `/volley` toggles the band. **Done when** the drawing tests are green, the kit mounts the band and finds the score text, and the user confirms the picture looks right and adapts to a resize. Done 2026-10-06 (estimate 8 h): 68 tests; the arrow for a high ball came along from M10, and a band without room holds the game instead of restarting it (the user's check).
* [x] **M5 Playable with WASD.** The phases and input sources of M3 wired into the `Client`, the medium AI, score row and hint row, the pause on leaving (3.2, 6.8: the window losing the focus, and `prompt.edit`). Since the user's choice of WASD (D3, 2026-10-06) also M6's key work: `keys.ts`, the Windows helper (the only one that passed P4), the `KeysSource` in the `Client`, the pauses when the keys leave (6.8), and the line in place of the court where no helper runs. **Done when** the user has played a full match to 11 through `/volley` with WASD, the tests are green, the manual key checks pass, including "no helper left behind", and the user's verdict on taps is in section 11. Done 2026-10-06 (estimate 9 h, and 5 more for the keys): 97 tests; the user played a full match, the pauses worked, a reload ended the helper, and taps were dropped.
* [x] **M6 Held keys.** Moved into M5 on 2026-10-06 with the user's choice of WASD (D3, section 11); nothing is left here. The helpers of M2b ship as their rounds pass (6.12).
* [x] **M7 Turn lifecycle.** Delay after `turn.start`, finish the rally after `turn.complete`, dialogs, the `enabled` and `delaySeconds` settings, the reload path in `session.start` (the pause on `prompt.edit` moved to M5). **Done when** the lifecycle tests are green and the manual checks for appearing, turn end, Esc and dialogs pass. Done 2026-10-07 (estimate 8 h): 115 tests; dialogs ride on the engine (no dialog hooks), the user's checks passed in a fresh session.
* [x] **M8 Persistence and command.** The `$.state` contract in full, `$.store` for match and record, `/volley on`, `off`, `reset`, `stats`. **Done when** the standing survives a reload and a restart of Claude Code and the command tests are green, and the lifecycle test that a muted band opens no court by itself (moved here from M7, which had no `/volley off`) is green. **Then go global:** propose adding `"env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\projects\\ClaudeyVolley" }` to the user's `settings.json` and do it after the user agrees. Done 2026-10-07 (estimate 7 h): 141 tests; the user's six checks passed (a reload, `/clear` and a restart kept the standing); the mod loads in every session.
* [x] **M9 AI levels.** `AiSource` in full, the three levels, the `difficulty` picker. **Done when** the AI tests are green and the user finds easy beatable and hard demanding. State 2026-10-12: built on 2026-10-09 (6.6 and section 11; 152 tests, 12 deliberate breaks) and committed without the tick. Open, both the user's: the verdict on easy and hard, and the check that a level changed in `/config` under an open court shows on the score row (section 8). Estimate for what is left: 1 h, and 1 to 2 h for each tuning round the verdict asks for. The verdict comes in M10's second part, after the constants are tuned, since a tuning change moves the levels (section 11, M10). **The user's verdict, 2026-10-12, on the constants as they are: easy and hard work well.** The `/config` check passed the same day: a level changed under an open court shows on the score row. M10 moved no constant, so the verdict stands. Done 2026-10-12 (the estimate of 1 h for what was left held; no tuning round was needed).
* [x] **M10 Polish and tuning.** Eyes that follow the ball, countdown digits, the win screen, final hint texts (the arrow for a high ball came with M4). One tuning pass of the constants together with the user. **Done when** the user signs off on the feel and all tests are green. In two parts (2026-10-12): the first, the look, needs nobody; the second is one play session with the user that tunes the constants with `tools/tune.ts` beside it, then takes M9's verdict, then ticks both. Estimate 11 to 12 h in all: about 8 h for the first part, 3 to 4 h for the second, and 1 to 2 h for each further round (about 1 h for a constant of movement, 1.5 to 2 h for `SERVE_Y` or `NET_H`). State 2026-10-12: the first part is built (3.2, 6.7, section 11; 171 tests, 22 deliberate breaks and 12 more after the big digits gave way to the pulsing line) and committed without the tick. The second part was short: the user found the feel good as it is and moved no constant, so `tools/tune.ts` stays ready for a later round. Done 2026-10-12 (about 8 h for the first part, under 1 h for the second; estimate 11 to 12 h). The open check of 2026-10-07, whether a court keeps its `Client` across a reload, stays open: with no constant moved there was no reload with a court shown to watch.
* [x] **M11 Release preparation.** `README.md` (what it is, install line, controls, settings, an open section on the key helper that names per system what held keys need and whether they were tested), `.claude-plugin\marketplace.json`, version 1.0.0, a final validate. **Done when** validate reads the marketplace file without errors and the repo is pushed. Making the repo public is the user's step. Done 2026-10-12 (estimate 4 to 5 h, and 1 h more for the AI's names, which the user chose on the way: Pudding, Jelly, Gummy): 173 tests, 7 deliberate breaks; validate reads the marketplace file, plain and strict; an install from the folder and one from GitHub, each into a throwaway config, answered as 1.0.0 (section 11). The points left to the user for the public repo were settled the same day (section 11): the mod is renamed to Wobbly Volley, the license is MIT, this file is cleaned for release, and the public history starts with one release commit.

Version 2, online play (section 13). Prototypes first, as in version 1: the parts that may not work at all come before the parts that surely do.

* [ ] **M12 Prototype P5, the net helper on Windows.** `helper/net.ps1` in full (13.7 to 13.9) with its test modes, `tools/netpair.ts`, and the probe plugin `p5-net` (section 7). Measured on this machine, on one network with a second machine or WSL, and between two homes (the friend, or a phone hotspot for the side that may not connect). **Done when** every question of P5 has its finding in section 10 and the pass or fail is recorded; on a fail, the user has decided how 13.1 changes. The part between two homes may wait on the friend: then the milestone is marked waiting and M13 goes on.
* [ ] **M13 Prototype P6, the lobby.** The probe plugin `p6-lobby` (section 7): ntfy.sh through `$.http.fetch` between two sessions on a private topic, a `fetch` that hangs, TweetNaCl in the hooks worker. **Done when** every question of P6 has its finding in section 10 and the pass or fail is recorded; on a fail, the user has decided how 13.6 changes.
* [ ] **M14 Core for online play.** `core/online.ts` (seats, step input, flags, pauses, the pause limit, `done`, the ends, `stateHash`) and the seat's view in `draw.ts` (mirror, own colour, a narrower match), with the tests of section 8 and the pinned hashes. **Done when** the tests are green on Windows and in WSL, and no file under `core\` imports `claude-code`.
* [ ] **M15 Identity, people and commands.** `hooks/vendor/nacl.js`, `identity.ts`, `seal.ts`, `people.ts`, the store keys of 13.12, the `/volley` forms of 13.13, and the `online` row in `plugin.json`. No network yet: `online` set does nothing but make the key pair. **Done when** the tests are green, and in a session the user has set a nickname, read their code, added a friend's code and listed the friends.
* [ ] **M16 The lobby.** `lobby.ts` (13.6): the messages, presence, the pacing with the bucket, the back off, the day's count and the lease, the pairing rules, offers and answers sealed. Tested against a stand-in lobby in the kit. **Done when** the tests are green, and two sessions on this machine with config folders of their own find each other on a private topic (`WOBBLY_VOLLEY_LOBBY`) and each names the other in its log.
* [ ] **M17 The meeting in the hooks module.** `net.ts` (the pick of the net helper, its lines, the control file, the start in WSL) and `match.ts` (13.10): connecting, joining, the steps, the flags, the ends, saving and resume. Kit tests with a stand-in net helper. **Done when** the tests are green, and two sessions on this machine (config folders of their own, a private topic, one side scripted through `WOBBLY_VOLLEY_NET_SCRIPT`) play through the real `net.ps1` to a turn end that saves on both sides, and their next meeting resumes the standing.
* [ ] **M18 The court in online play.** 13.11 in full: the props and the report, the mirror, the narrower match, the score row with the ping, the hints. **Done when** the tests are green and the user has played a whole match against a person on another machine, with the manual online checks of section 8 passed.
* [ ] **M19 `net.py` for Linux and macOS.** The Python net helper (13.9), the pick of `python3` on macOS, the start on both systems, `uname` joining the pick as 6.12 foresaw. Until M2b has passed the key helpers of Linux and macOS, `net.py` is checked with `--script` only. **Done when** `tools/netpair.ts` passes `net.py` with `net.py` and `net.py` against `net.ps1` (in WSL against Windows), and the kit tests of the pick are green.
* [ ] **M20 Rounds across systems.** Windows against Linux (CachyOS, a second machine) and Windows against macOS (the friend), each once between two homes: a whole match, a turn end and the resume, the pinned hashes green in that system's kit, the macOS firewall when it is on, no helper left behind. Needs M2b's rounds for Linux and macOS. **Done when** each pairing has its pass or fail in section 10. A system that fails has no online play, and the README says so.
* [ ] **M21 Release 2.0.0.** README: online play, what goes where (13.14), the net helper per system, what P5 found on firewalls, the networks that cannot connect (13.7), ntfy.sh and its limits. Version 2.0.0 in `plugin.json` and `VERSION`, a final validate. **Done when** validate passes and the repo is pushed. Publishing is the user's step.

---

## 10. Prototype results

Fill in during M1, M2 and M2b. Replace each "open" with the finding and the date.

P4 result files carry the system in their name: `prototypes\results\p4-key-helper-<system>.json`, with `windows`, `wsl`, `linux` or `macos`.

P1 findings come from `prototypes\results\p1-band.json` (the run after the last load, 2026-10-06, Windows Terminal, fullscreen layout, window 115 to 119 columns by 70 rows).

| Question | Finding |
|---|---|
| Real `bodyColumns` and `maxRows` | 2026-10-06, P1: `bodyColumns` is always the viewport's columns less 5 (109 at 114, 114 at 119). `maxRows` is 29 with the window at 70 rows, 27 or 28 for a moment as a turn starts. A width change asks the band again at every step of the drag; a height change alone asks it too (`maxRows` 0 with the window 5 rows high). |
| Ticks per second of `surface.every(16)`, shortest and longest gap | 2026-10-06, P1: median 58 a second, shortest gap about 16 ms, longest gap per second median 22 ms, 95th percentile 45 ms, worst 112 ms (343 windows of one second; the same during a turn). In some stretches the clock runs at a steady 31 a second with gaps of 32 to 33 ms; both stretches in the log fit the person being away from the terminal window, and the rate returned to 58 right after. P2 checks the cause by switching windows. |
| `Date.now()` in a surface module | 2026-10-06, P1: works and advances, as does `performance.now()`; the two agree within 1 ms per second. `Date.now()` also works in the hooks module, within 4 ms per second of `$.clock.now()`. |
| Hover moves without focus | 2026-10-06, P1: yes. `move`, `enter` and `leave` arrive before any click and after the keyboard went back to the prompt. No `fine` position on Windows Terminal. |
| Does a `down` take the keyboard, do letters stay out of the prompt | 2026-10-06, P1: yes. After a click every key reaches `onKey` and no `prompt.edit` fires. Key names: letters as typed, `left`, `right`, `up`, `down`, `space`. A held key repeats after 506 ms, then every 32 ms. Fast typing can bring two letters in one event (`"aw"`). |
| First Esc: focus only, or turn interrupted | 2026-10-06, P1: the first Esc only returns the keyboard (the next letters raise `prompt.edit`). The second Esc interrupted the running turn (`turn.complete` reason `aborted`), confirmed by the person. Neither press reaches the `Client`, and no event tells the plugin that the keyboard left (no `ui.focus` in the whole run). |
| Keyboard back at the prompt when the `Client` is removed | 2026-10-06, P1: yes, letters typed while the band was hidden raised `prompt.edit`. When the band came back a new instance mounted, and the keyboard stayed at the prompt until the next click. |
| Effect of `[-]` on the `Client` | 2026-10-06, P1: the `Client` unmounts (no ticks while collapsed) and a fresh instance mounts on expanding. The band hook is not asked for either. |
| Dialog while the `Client` holds the focus | 2026-10-06, P1: for `$.ui.ask` and for the model's AskUserQuestion alike, the `Client` unmounts while the dialog is up (no ticks, band hook not asked), the dialog gets the keys, and a fresh instance mounts when it closes. The plugin's `tool.call` hook sees the model's AskUserQuestion but not its own `$.ui.ask`. |
| Extra: post to `{ props }` round trip, as the `Client` sees it | 2026-10-06, P1: median 18.6 ms, 95th percentile typically 22 ms, worst 83 ms. The second leg of P4's "key to `Client`". |
| Extra: remounts | 2026-10-06, P1: every remount is a new instance with empty state, but the surface module's own variables survive it (a module counter reached 5 within one load). |
| Extra: `isWorking` | 2026-10-06, P1: the band is asked again about 0.1 s after `turn.start` and after `turn.complete`. A slash command also makes `isWorking` true for about 0.1 s. |
| Extra: renders | 2026-10-06, P1: about two renders per tick when a `setState` and a props reply both arrive each tick; up to 331 in a second of resizing. |
| P2: draws per second, longest gap, CPU, verdict | 2026-10-06, P2 (`prototypes\results\p2-client-court.json`; court 110 x 24 plus a stats row, tick 16 ms): **pass, architecture A.** Counted are the module's draws, not the terminal's paint; the paint is the user's verdict. Draws: median 58 a second, idle and in turns; 58 to 60 in every second of the streaming turn, longest gap there 26 ms. Longest gap per second over the whole run: median 24 ms idle and 28 ms in turns, 95th percentile 49 and 131 ms, worst 175 ms. One draw takes the module about 0.5 ms; the tree stayed at 6,787 characters and 61 nodes. With the terminal window in the background the rate falls to a steady 30 and returns at once. A 33 ms tick gives 27 to 28 draws. CPU of the claude process over 10 s: 17% of one core idle with the court, 4.4% idle without it, 22.9% in the streaming turn; later samples during turns 53.3%, and 31% and 32% (these two taken by the building session with the same script at 30 draws a second, so not in the file), and 78.3% right after the session was forked to the background. User's verdict: no flicker, no tearing, pointer immediate, 30 a second looks the same as 60 (keep 60). The user ruled the CPU line passed: the streaming turn stayed at 22.9% and the court's own share is about 13 points. |
| P3 (only if needed): blits per second, pointer arrangement | Not built: P2 passed. |
| P4 on Windows: spawn to first heartbeat | 2026-10-06, P4 (`prototypes\results\p4-key-helper-windows.json`, five starts in three sessions): 517 to 953 ms, median 645 ms. The first start in a session took 645 to 953 ms, later ones 517 and 552 ms. Split: the process starts 3 to 195 ms after the call (slow only at a session's first call), PowerShell reaches the script after 179 to 332 ms, `Add-Type` compiles in 304 to 402 ms, the walk to the window takes 28 to 82 ms, and the first line reaches the hooks module 1 to 6 ms later. The 11 s start of section 4 did not recur. The bare run used 1.2% of one core. |
| P4 on Windows: key to hooks module, median and 95th percentile | 2026-10-06, P4: median 0 ms, 95th percentile 2 ms, worst 16 ms (515 key changes; 107 of them during a streaming turn: 0, 1 and 4 ms). |
| P4 on Windows: key to `Client`, median and 95th percentile | 2026-10-06, P4: **pass** (the line: 50 and 100 ms). Median 11 ms, 95th percentile 24 ms, worst 122 ms, one change over 50 ms (392 changes that reached a `Client`). During a streaming turn: median 12 ms, 95th percentile 27 ms, worst 36 ms (106). 123 changes reached no `Client`: 113 in the first session after it was continued in the daemon, when no `Client` was mounted there any more (section 11), and 10 replaced by a later mask within the same frame. |
| P4 on Windows: two keys, release, foreground gate, no process left, Defender | 2026-10-06, P4: **pass.** Two and three keys at once came through (Left with Up, Left with Right, Right with Up, all three), and every release as a change of its own. Three stretches with another window in front (4.0, 4.6 and 9.5 s): mask 0 and not one line until the terminal came back; no key bit ever without the foreground bit. No helper left behind: `/p4 off` ended the loop after 249 ms and `/p4 procs` found none; a restart ended the old helper after 275 ms; a reload killed it (`/p4 procs` in the new load found none); quitting Claude killed it (exit code 1); afterwards no `keys.ps1` process ran. Defender: no detection and no detection event that day. In a session run by the daemon the helper wrote `E nowindow` and exited. |
| P4 on WSL (M2b) | 2026-10-06, bare run only: `helper/keys.ps1` started from a bash in Ubuntu-24.04 through `powershell.exe` wrote its first heartbeat 548 ms after the start, its walk went `wsl.exe` < `wsl.exe` < ... < `WindowsTerminal.exe`, and it saw the terminal in front. The probe loads in the native Linux `claude` 2.1.291 there and picks `wsl`. 2026-10-12, probe (`prototypes/results/p4-key-helper-wsl.json`, one load in the native `claude` 2.1.296, two starts): **pass** on what was measured, and the user's call to ship (section 11). Spawn to first heartbeat 574 ms (on Windows' clock 530 and 604 ms from process to ready); the walk went `wsl.exe` < `wsl.exe` < `powershell.exe` < `WindowsTerminal.exe`. Key to hooks module: at six first presses the helper's `K` line came within 1 ms of the terminal's own key event (the helper's stamps are on Windows' clock and cannot be set against the WSL one, section 11). Hooks module to `Client`: median 12 ms, 95th percentile 25 ms, worst 32 ms (56 changes, 1 overtaken), so key to `Client` lies well inside 50 and 100 ms. Two keys at once came through (A with W, D with W, A with D). No helper left behind after a `session.end`, after `/p4 off` and after quitting Claude (a process check afterwards found only the helpers of Windows sessions). Not done in this round: the streaming turn, `/p4 restart`, the reload, another window in front, and 57 key changes instead of about 200. |
| P4 on Linux, CachyOS (M2b) | open |
| P4 on macOS (M2b) | open |
| P5: STUN and the NAT's mapping | open |
| P5: Windows Defender Firewall | open |
| P5: the control file, write to act (Windows, WSL) | open |
| P5: the key helper as the net helper's child | open |
| P5: punching (one network, IPv6, IPv4 between homes, hotspot) | open |
| P5: lockstep (steps per second, stalls, loss, identical step lines) | open |
| P5: cost and cleanup | open |
| P6: publish to poll between two sessions | open |
| P6: a `fetch` that hangs | open |
| P6: prompts or refusals | open |
| P6: TweetNaCl in the hooks worker | open |
| Online across systems (M20): Windows and Linux, Windows and macOS | open |

---

## 11. Change log

Add a line for every deviation from this plan: date, milestone, what changed, why.

* 2026-10-06: plan written.
* 2026-10-06, M0: the repo starts with `git init -b main` (git alone gives `master` here). Later milestones commit straight to `main`, the user's choice: one person, no reviewer for a branch.
* 2026-10-06, M0: `.claude\workflow.md` added (the user's choice), so the backlog skills find the rules without rereading the whole plan. `.gitignore` also names `.claude/settings.local.json`, which a session in this folder may write.
* 2026-10-06, M0: a root `tsconfig.json` joins the file list (6.2 had none). The engine writes it at the first load, and it is committed as written.
* 2026-10-06, M0: `/volley` answers with a `VERSION` constant exported by `register.tsx`, because `$.plugin` carries only `name` and `root` and tests have no fs. It must stay equal to `version` in `plugin.json`; M11 raises both.
* 2026-10-06, M0: `delaySeconds` carries `min: 0` and `max: 60`, so `/config` cannot hold a negative or huge delay. 6.9 named no limits.
* 2026-10-06, M0: `plugin.json` names the author without an email, since the repo may go public.
* 2026-10-06, M0: `dev.ps1` reads its arguments itself instead of through a `param` block, because a block would bind a bare prompt (`.\dev.ps1 "fix it"`) to `-Only` by position. Checked under PowerShell 5.1 and 7.6.
* 2026-10-06, M0: until M4 (bare toggle) and M8 (`on`, `off`, `reset`, `stats`), every form of `/volley` answers the version. Its description and argument hint are already the final ones.
* 2026-10-06, M0 finding: the plugin-authoring skill's SKILL.md says a `claude -p` load lays no types. On 2.1.291 it does (5.1, row 35), which lays them without starting a session. Reproduce: run the headless line of `.claude\workflow.md` from another folder, then list `.claude-plugin\types\`.
* 2026-10-06, M1: P2's CPU line is "under 50% of one core" (section 7 said "clearly below one core"), the user's choice.
* 2026-10-06, M1: P1 answers more than section 7 asked, each cheap and feeding a later milestone: key names and auto repeat (M6's 150 ms rule), whether anything marks the keyboard leaving the `Client` (armed logic), resizes of the height alone (3.2 sizing), the post to props round trip (P4's second leg), and when `isWorking` reaches the band.
* 2026-10-06, M1: the prototypes are named `volley-p1` and `volley-p2`, so their `$.state` and `$.store` never touch the mod's. Their result files in `prototypes\results\` are committed as evidence, and the `tsconfig.json` the engine writes into each prototype folder is committed as written (as in M0).
* 2026-10-06, M1: P1 needed three fixes while running, so its first run's log is not the evidence (the run after the last load is). The lines it writes every second pushed the person's steps out of a shared 3,000 entry log after 25 minutes; they now keep a list of their own. Props did not name the instance they were for, so a remounted `Client` took the previous instance's acknowledgement and dropped its first events. Hooks that ran while `session.start` read the old file logged into an object the file then replaced.
* 2026-10-06, M1 finding, consequences for later milestones: `[-]`, a hidden band and every dialog remount the `Client` with empty state, so the running rally is lost each time. That matches the void rally rule of 3.2. The surface module's own variables survive a remount and could carry a rally (section 12, exact resume). After a remount the keyboard stays at the prompt until the next click, which fits "a click resumes" (D4, D6). No event marks the keyboard leaving the `Client`: the hooks module learns it from the next `prompt.edit`, the helper from Esc (6.8 holds). The second Esc interrupts the turn, so the "Esc once" hint of section 7 is needed. One `onKey` event may carry several letters.
* 2026-10-06, M1 finding for M4: the 6.7 encoding of a real scene costs 0.04 ms per frame in Node and about 50 nodes and 6,000 serialized characters. A pathological frame in which every cell differs comes to about 236,000 characters at 110 columns, above the `Client` bound of 100,000 (the instance would unmount). The court's palette cannot get near it, but M4's encoder needs a size guard. Reproduce: encode a checkerboard of the six palette colors at 110 x 24.
* 2026-10-06, M1 finding: the root `.gitignore` pattern `.claude-plugin/types/` matches only at the root, but the engine lays its own `.gitignore` (`*`) inside every `types` folder it writes, so prototype types stay out of git.
* 2026-10-06, M1: **architecture A is chosen.** P2 passed: the `Client` court drew 58 to 60 times in every second of a streaming turn (longest gap 26 ms), the user saw no flicker or tearing and found the pointer immediate, and the claude process used 22.9% of one core in that turn (17% idle with the court, 4.4% without). Two later samples lay above the 50% line (53.3% at the start of a turn full of tool calls, 78.3% right after the session was forked to the background); the user ruled the line passed, since the court's own share is about 13 points. P3 is not built. The frame tick stays at 16 ms: a 33 ms tick (27 to 28 draws) looked the same to the user, who prefers 60 as long as nothing speaks against it.
* 2026-10-06, M1 finding for M7: the engine can move a session to the background (5.1 row 50). Such a session loaded the prototype, drew its court in a pty nobody sees and kept ticking at 58 a second. The mod must not open the court there, and above all must not start the key helper there. How to tell such a session apart is open (5.2). Until it is settled, D4 covers the worst case: the court opens only inside a running turn and waits for a click. Reproduce: Get-CimInstance Win32_Process for `claude.exe` lines holding `--bg-pty-host`.
* 2026-10-06, M1 finding: two sessions that load the same prototype rewrite one result file in turns, each with its own view. `p2-client-court.json` as committed is the view of the session the user worked in (the one holding the `/p2` commands). The mod's own store has the same last write wins shape (3.2) and background sessions make it more likely.
* 2026-10-06, M1 finding: with the terminal window in the background the frame clock halves to 30 a second. The simulation steps by elapsed time with up to 5 steps per tick (6.8), so play speed is unaffected.
* 2026-10-06, M1 finding: run the headless line of `.claude\workflow.md` from PowerShell. Git Bash rewrites `"/p1"` into a Windows path (`C:/Program Files/Git/p1`), so the run starts a real model turn instead of the command. Reproduce: `claude -p "/p1" --plugin-dir <prototype>` from Git Bash.
* 2026-10-06, before M2: **D3 is changed by the user's wish: held keys also on WSL, Linux and macOS.** One helper script per system behind one line format (6.12), each shipped only after it was measured on its system, and the pointer wherever no helper runs. Tap keys move from "left out" to a trial at the end of M6. New milestone M2b measures P4 on the other systems and may wait on another machine or person while M3 goes on. Touched: sections 1, 2, 3, 4, 5, 6.1, 6.2, 6.9, 6.12, 7, 8, 9, 10 and 12, and `.claude\workflow.md`.
* 2026-10-06, M2: the Windows helper does its work in one C# class compiled by `Add-Type` (6.12 says so now). One process snapshot replaces a WMI lookup per parent (0.4 s each, section 4): the walk took 28 to 82 ms. No PowerShell runs per poll, so the helper uses 1.2% of one core.
* 2026-10-06, M2: the helper compares the process that owns the window in front with the terminal's process instead of comparing window handles. Windows Terminal runs all its windows in one process, so another window or tab of it counts as in front. The 150 ms rule of 6.8 guards that case.
* 2026-10-06, M2: the helper writes one `start` line to stderr (startup times, chain of parents). The line format on stdout is unchanged, and readers ignore other lines (6.12).
* 2026-10-06, M2: the helper lives at `helper\keys.ps1` in the mod's folder and the probe starts it from there, so M6 ships the file that was measured. The probe's line reader (`prototypes\p4-key-helper\hooks\helper.ts`) has no `claude-code` import and can move into `hooks\keys.ts`.
* 2026-10-06, M2: the probe writes its result file per module load. A load writes only once a `/p4` command started something, and then only its own entry. That is the lesson from P2's file, which a session left open had overwritten with an hour of idle reports.
* 2026-10-06, M2: `/p4 restart` ran once instead of three times. The startup numbers come from five starts in three sessions instead.
* 2026-10-06, M2 finding for M6 and M7: a session can be continued in a daemon session while the person goes on working in it (5.1 row 56). The first probe session was continued in this way at 17:30:27 and the person went on in the new one. The new session's helper found no window above it and wrote `E nowindow`, so held keys cannot work in such a session; since M5 the band says so in place of the court (D3). Reproduce: the old session's transcript ends with a `continued-in` entry; Get-CimInstance Win32_Process shows the new session's `claude.exe` with `--fork-session` under one with `--bg-pty-host`.
* 2026-10-06, M2 finding for M6: the old session's helper ran on for 95 s with no `Client` mounted and reported 113 key changes typed into the other session. The band state does not show that a `Client` is gone (the same holds for `[-]` and a dialog, 5.1 row 45), but the posts do: they come every frame (30 to 60 a second) while a `Client` is mounted. M6 can stop the helper when the posts stop for about a second and start it again with the next post. Reproduce: in the result file, the first load's key rows with `clientAt` null from 17:30:26 on.
* 2026-10-06, M2 finding for M6: the 150 ms rule of 6.8 has room. While the `Client` holds the keyboard, its `onKey` press arrives within 3 ms before to 9 ms after the helper's key change (178 presses). One `onKey` event may carry several letters (`"wq"`, `"poa"`), and the rule must count each of them, or it finds no press. Keys typed into the prompt reach the helper with no `onKey` at all (19 key downs in the run). Reproduce: match each key down in the result file's `keys` with the `clientKeys` of the same load.
* 2026-10-06, M2 finding: touching a file in the plugin folder reloads the module (5.1 row 54). The probe session's own `touch` reloaded it 12 s later, when its turn ended.
* 2026-10-06, M2b: `dev.sh` joins the file list (6.2), so a session on Linux or macOS starts the mod or a prototype the way `dev.ps1` does on Windows. The user wanted the project written straight into the Linux home; Windows mounts that partition read only on purpose (section 4), so the project goes there through the repo instead, and section 7 holds the steps for each system.
* 2026-10-06, M2b finding: in WSL Ubuntu-24.04 a native Linux `claude` 2.1.291 sits in `~/.local/bin`, which is not on the `PATH`, so `claude` there starts the Windows build through the npm shim under `/mnt/c`. The WSL round has to call `~/.local/bin/claude`. Reproduce: `command -v claude` in a login shell of the distribution.
* 2026-10-06, M2b: the Linux helper reads evdev key state with `EVIOCGKEY` instead of reading key events: polling the state works like `GetAsyncKeyState` and needs no event queue. The X11 backend asks which window is in front every 20 ms rather than every pass, to keep the round trips to the X server down. Both untested on a real desktop until the CachyOS round; in WSL each failure path gave its `E` line (`noevdev`, `nowindow` under WSLg, `nodisplay`).
* 2026-10-06, M3: `Input.run` is a number from -1 to 1, clamped by `step` (6.5 said `-1 | 0 | 1`). The AI's speed factors of 6.6 (0.75, 0.9) need fractions, and the AI stays an `InputSource` under the human's limits. Keys still give whole values.
* 2026-10-06, M3: `PointerSource` steers proportionally within the last step's reach, so the blob lands on the column exactly (6.5 said "toward the column until within 1 px"). It is the motion P2 used, which the user found immediate.
* 2026-10-06, M3: the core keeps its own `Match` beside the contract's `VolleyMatch` (6.11), with a type check that holds them equal. The types file says a contract may hold no import, and the core may not import the contract. `number`, undocumented before, is the match's running number.
* 2026-10-06, M3: phase timers count steps, not milliseconds (6.4), since the core reads no clock. The 10 s cut after a turn end is 600 steps of play.
* 2026-10-06, M3: M3 wrote all of `game.ts` (the phases and every transition, now spelled out in 6.4) and all of `input.ts` (`KeysSource`, `PointerSource`), because the core tests of section 8 need `turnDone` and `resize`. M5 and M6 now wire them into the `Client`; their lines say so.
* 2026-10-06, M3: two gameplay details 6.4 left open were settled by the user (3.2): a click after a pause runs the countdown and then resumes the frozen rally, and the countdown runs only after a click, not between points.
* 2026-10-06, M3 finding: at 60 steps a second a held jump peaks at 23.15 px (48 steps in the air) and a one step tap at 15.74 px (36 steps), below the continuous 24.05 and 16.06 that 6.3 quoted; 6.3 now gives both. Reproduce: `tests/sim.test.ts`, the jump tests.
* 2026-10-06, M3 finding for M4 and M10: a straight up hit rises 22.5, 41.3 and 60.0 px at widths 60, 110 and 160 (`hitSpeed(w)² / 2 BALL_GRAVITY`), against a view 48 px high, so the arrow for a ball above the view will be common on wide courts. Tuning belongs to M10.
* 2026-10-06, M3 finding: the 6.3 constants allow a serve over the net at every width. A scan in Node (your blob at the serve, offsets of -8 to 8 px in steps of 0.25, jump held 1 to 40 steps, standing or running either way) sent 344, 204 and 132 of 1,005 tries over the net at widths 60, 110 and 160. The only rallies that never ended were a blob right under the ball juggling it on its head for ever; the touch rule ends those (`tests/sim.test.ts`, the juggling test).
* 2026-10-06, M3 finding: no tunnelling. The fastest ball moves about 2.9 px a step (hit from the top of a jump at width 160), less than every contact distance (5.4 and 6.4 px for the blob circles, 4 px for the net); 60,000 steps of random play never left the ball inside a blob or touching the net.
* 2026-10-06, M3 finding: a synchronous endless loop in a test hangs `claude plugin test` and its per file process, past the 5000 ms limit (5.1 row 58). It happened while checking the tests against a broken wall bounce. Every loop in the core tests now has a limit. Reproduce: a test holding `while (true) {}`.
* 2026-10-06, M3 finding: the core tests were checked by breaking the core on purpose in a scratch copy (held gravity, touch rule, touch gap, net and blob push out, net reflection, wall bounce, cut timing, serve after a point, win by two, the winner's serve, resize, pause, turn end, countdown, randomness, reset, pointer, keys, a drifting `Match`). Each break failed at least one test or tsc. The first round found two gaps, a net push out and the contract check missing an optional field; both are closed.
* 2026-10-06, M3 finding: 10,000 game steps of random play take about 30 ms in the kit, so the 200 AI rallies of M9 fit the 5000 ms test limit.
* 2026-10-06, M3 finding for M7: `CourtProps` carries no `manual` flag, so a court opened by `/volley` during a turn would get the next `doneSeq`, finish its rally and pause, although 3.2 says such a court stays. M7 has to hold `doneSeq` back for a manual court, or pass the flag.
* 2026-10-06, M4: **the arrow for a ball above the view moved from M10 to M4**, drawn as pixels by `draw` (6.7). A probe measured how long the ball is wholly above the view: 14 to 46% of rally time on a 24 row court at 110 columns, 41 to 71% at 160, 30 to 80% on a 16 row court. Without the arrow the demo would hide the ball about a third of the time. Pixels rather than a `▲` glyph, so no font fallback can widen the row. Reproduce: step two `ChaseSource`s and count the rally steps with `floor(ball.y) - BALL_R` at or above `2 * rows - groundPx(rows)`.
* 2026-10-06, M4: the blob is drawn as its collision circles (6.7), a 7 by 9 pear. P2's 9 by 9 ellipse was wider than the shape the ball bounces off. The ball uses `r² + r` for a round edge.
* 2026-10-06, M4: the ground thins from 4 px to 2 on a 16 row court. The hovering serve's top pixel row is world row 29, and 4 px of ground leave only 28 px of air at 16 rows (6.7).
* 2026-10-06, after M4, the user's choice: **the game pauses when the terminal window loses the focus and when the keyboard leaves the court**, built in M5 (3.2, 6.8). The pause on `prompt.edit` moves from M7 to M5 with it. The focus signal is the frame clock's background rate (P1, P2); a pause when the pointer leaves the court was offered and not chosen.
* 2026-10-06, M4: below 60 columns the band shows one line, "Wobbly Volley needs a wider window" (3.2 named only the height case). A court clipped at the right would hide Claude's side.
* 2026-10-06, M4, from the user's check: a window made too short and then tall again restarted the demo. The band hook drew the one line in place of the `Client`, and the court came back as a new instance with a new game (5.1 row 45). Now the band keeps the `Client` one row high, the court draws the line itself and holds the game, and play goes on where it stopped (3.2, 6.8, 6.9; `tests/band.test.ts`, the test of a band without room). A collapse with `[-]` and a dialog still remount the court, as the engine does; from M5 the standing returns through the props and only the rally is served again (3.2).
* 2026-10-06, M4: the time base is `performance.now()` instead of `Date.now()` (6.8): monotonic, so a step of the system clock cannot freeze or skip play. P1 measured both equal.
* 2026-10-06, M4: `hooks/protocol.ts` joins the file list (6.2), holding `CourtProps` for both modules without a `claude-code` import, as the prototypes did. M4 passes the part it uses (6.10).
* 2026-10-06, M4: the score and hint rows are rows of their own, so the frame's overlays are for text on the court (6.7 listed the score among them).
* 2026-10-06, M4: `ui.fault` (6.9) came with the first real `Client`: it logs to the debug log and hides the court, which stays away until `/volley` shows it again. Its row in 6.9 says so.
* 2026-10-06, M4: `/volley` alone toggles the court (and sets `manual`, 3.2); with a word it still answers the version until M8.
* 2026-10-06, M4 finding: a stand-in with a fixed aim makes a poor demo. Every rally came out the same (median, 95th percentile and longest equal over 30 min), at several offsets one side won every point, and aiming at the predicted landing point ran rallies of up to 7.5 min, at two settings never ending in 30 min. A fresh seeded aim, 3 ± 2.5 px behind the ball, fixed it: over 6 seeds and 4 court sizes of 30 min each the longest rally was 15.5 to 50 s, each side won 43 to 57% of points, 7.6 to 11.5 points fell a minute, every serve was taken within 0.3 s, and at most 9 of about 300 points ended on the touch rule. `tests/ai.test.ts` holds the line at 60 s. Reproduce: set `AIM_SPREAD` to 0 in `core/ai.ts` and run that test.
* 2026-10-06, M4 finding: a real frame encodes to at most 27 coloured runs and 70 runs in all; paint and encode take 0.02 to 0.04 ms a frame in Node, and the court's tree measures about 6,000 characters in the kit (`tests/band.test.ts` holds it under 20,000).
* 2026-10-06, M4 finding: the new tests were checked by breaking the code on purpose in a scratch copy (23 breaks across `draw`, `encode`, `ai`, `court.tsx` and `register.tsx`). Three stood the first round: the net at odd widths (now tested at 61 and 111 columns), the demo starting the next match by itself (now a kit test plays a whole match), and the overlay's check of the right edge, which changes nothing, since cells past the width are never read. Four more breaks of the hold after the user's check: three caught; the fourth, moving the tick's time stamp behind the hold, changes nothing under the tick clock and at most 5 steps (83 ms) under real time.
* 2026-10-06, M5: **the AI plans its shot by playing it.** 6.6 named placement but not how. With a first AI against itself, which stood a fixed 2.5 px behind the landing point, 76 to 84% of points went against the side that touched last, 28 to 32% on the touch rule; a fixed offset of 3.5 px left its own serve hovering for ever when the error pushed it out of reach. An analytic shot model did no better, since a jump meets a slanting ball higher and further back than the plan assumed (the AI stood 2.6 px off and hit straight up). Now it weighs stands 0 to 6 px behind the ball and plays each out with the sim's own steps, its jump included (6.6). Without an aiming error 82 to 96% of its touches cross the net and rallies against itself run for minutes, so the plan sees the real shot. Reproduce: `tests/ai.test.ts`, the test without an aiming error.
* 2026-10-06, M5: `sim.ts` exports `flyBall` (one step of a free ball: gravity, walls, net), `moveBlob` and `collideBlob`, and `step` uses the first two pieces itself, so the AI's plan and play share one physics.
* 2026-10-06, M5 finding for M9: with medium's error of ±3 px drawn evenly, 61 to 74% of its touches cross the net, rallies against itself last a median 7 to 14 s, and it wins 99 to 100% of points against a player who only serves. A triangular error with the same bound made it far stronger in a run before the planner's last speed up (median rallies 12 to 24 s against 7 to 14, the longest 168 s), so medium keeps the even error of 6.6. Its longest rally against itself reached 156 s on a 160 column court over 360 points, above the 60 s line of section 8: M9 has to bring that down while tuning the levels. The middle of the stands that work beats the first one that works: 66 to 69% of touches cross over 1,000 a width, against about 61%.
* 2026-10-06, M5: `ChaseSource` is gone with the demo; `tests/encode.test.ts` plays the medium AI on both sides instead.
* 2026-10-06, M5: the report carries `lastMatch` instead of `matchesDelta` (6.10). With the match number it names the match that ended, so the hooks module counts it once whichever court instance or module load sends it, with no baseline per instance, and the record gets the points of finished matches as well. A reset clears it, so an abandoned match is not counted.
* 2026-10-06, M5: the report carries no `armed` (6.10): the hooks module has no use for it, and since the change to WASD (below) the court has no such flag either.
* 2026-10-06, M5: the pause command's `seq` is the larger of `seq + 1` and `Date.now()` (6.10), so a reload cannot send it back, and the court takes the one it mounts with as seen. `prompt.edit` raises it at every edit without reading `$.state`, since that hook is in the path of every typed key.
* 2026-10-06, M5: the focus rule (6.8) comes from P1's seconds: background seconds tick 28 to 31 times with most gaps at 32 to 33 ms, but carry now and then one gap of 9.5 to 27 ms, so a rule that wants every gap slow would miss them; foreground seconds tick about 58 times with single stalls of up to 316 ms. 12 of the last 16 gaps between 26 and 40 ms means gone (about 0.4 s), at most 4 means back. P2's per second reports hold no gap minimums and add nothing here. The user's check in a busy turn is the measurement section 6.8 asked for. Reproduce: group `windows` of `prototypes\results\p1-band.json` by `minGap` of 28 ms or more.
* 2026-10-06, M5: a test clock `away` (32.5 ms a tick, the background rate) joins `tick`, so a kit test shows the court pausing by itself and a click resuming it for good (6.8, 6.10).
* 2026-10-06, M5: the phase messages are plain text in the terminal's own colour, two rows above the net's top, where no hovering serve reaches on any court height: "Click to play", the countdown digit, who scored, the match result, "Paused, click to resume". M10 makes the countdown and the win screen grand. The score row shows the level and the session's matches won and lost; the record moves to `$.store` in M8.
* 2026-10-06, M5 finding: the new tests were checked by breaking the code on purpose in a scratch copy (24 breaks across `court.tsx`, `register.tsx`, `protocol.ts`, `focus.ts`, `ai.ts` and `draw.ts`). The first round left four standing: a stuck mouse button (the jump test looked at a single moment, when the jumping blob happened to be down; now two), a slow band widened to 50 ms (the focus test now holds steady 20 and 45 ms clocks), the AI taking the first stand that works (now the test of 1,000 touches), and `armed` cleared by the pause (nothing reads it before M6, so it moved there). A fifth turned out to be a dead line, the button released while the court has no room, which the click that resumes makes moot; it is gone.
* 2026-10-06, M5, from the user's check: **the left arrow sends the session to the background.** Pressed while playing, ← opened agent view ("Your conversation moved to the background"). It is Claude Code's shortcut for ← on an empty prompt, which `/config leftArrowOpensAgents=false` turns off (5.1 row 71). It explains the session of M2 that went on in the daemon (5.1 row 56): each ← forked the session into one the daemon runs, with the mod loaded, and such sessions stay until they are stopped in agent view. The first build had left the court's `onKey` out with `armed`, and the shortcut came first blamed on that; the listener is back (as P1 measured), and ← behaved the same with it. The mods docs say a mod cannot bind Tab or the arrows and that a game steers with `w`, `a`, `s`, `d`. **For M6, against D3:** held arrows would also work Claude Code's own keys (the shortcut, and moving between controls while the band has the keyboard). The proposal is A and D to run and W or Space to jump, without the arrows; D3 is closed, so the user decides.
* 2026-10-06, M5: the session of the user's check ran Claude Code 2.1.292, and `claude` is 2.1.292 now (section 0, step 3). Between the 2.1.291 types and the 2.1.292 ones the text on the `Client` and its surface, the band and its props, `ui.message`, `prompt.edit`, `ui.fault` and `$.state` is unchanged, and validate, test and tsc pass on 2.1.292. The other rows of section 5 were not checked again. Reproduce: diff the skill's `types/claude-code.d.ts` of 2.1.291 with `.claude-plugin/types/claude-code/index.d.ts`.

* 2026-10-06, M5, the user's choice: **WASD is the only movement, and the mouse only clicks** (D3 changed, answering the question of the entry before). The mouse no longer steers or jumps; it starts, resumes and opens the next match. The helpers watch A, D, W and Esc (the arrows and Space are gone from all three scripts; the Windows one ran bare afterwards and wrote its heartbeats). Taps, D3's trial, are the fallback wherever no helper runs, and the `controls` setting is `auto` or `taps`. M6's key work moved into M5, whose check is now played with WASD. Touched: sections 1, 2, 3, 6.2, 6.5, 6.8, 6.9, 6.10, 6.12, 7, 8 and 9, the helper scripts and `plugin.json`.
* 2026-10-06, M5: **no armed flag.** 6.8 planned one, so that held keys move the blob only while the game believes it holds the keyboard. Every case that would clear it pauses the game, and only a click resumes, which hands the court the keyboard: a running rally always has it, and the flag changed nothing (two deliberate breaks of it went unseen). The court pauses directly on Esc going down, on the terminal leaving the front, on a key without its press within 150 ms, and on `prompt.edit`. It reacts to changes of the mask only: the props a click meets may be a frame old and still say the window is not in front (a test pins it).
* 2026-10-06, M5: the helper starts with the court's posts and stops when they stop (6.12), as the M2 finding proposed, rather than with the band state; that also covers `[-]` and dialogs, which unmount the court without a state change. A helper that ends by itself is not started again in that load, so a session the daemon runs (`E nowindow`) does not start one every frame. `keys` in the props has no `seq` (6.10): the court finds key changes by comparing masks.
* 2026-10-06, M5: `hooks/keys.ts` holds the pure parts (the line reader from P4, the key state, which helper a system starts); the spawn and its watch live in `register.tsx`, since validate refuses `$` passed to a function not declared in the hooks module (5.1 row 49).
* 2026-10-06, M5: taps follow D3's trial: A or D starts a run, the other one or S stops it, W holds the jump for a whole rise (27 steps), and a held W's repeats hold it on. Taps start afresh when the helper stops being trusted, so a press made while held keys steered leaves no run behind. Named keys of `onKey` (Space, End, the arrows) tap nothing; read as letters, "space" would tap A and S.
* 2026-10-06, M5 finding: the key code was checked by breaking it on purpose (27 breaks). The first round left four standing: two of the armed flag (it is gone, above), taps pressed while the helper runs (harmless thanks to the reset, which a test now pins), and named keys read as letters (now tested).

* 2026-10-06, M5, the user's check and verdict: **taps are dropped.** The user played a full match to 11 with held WASD, and the pauses (Esc, typing into the prompt, another window, a busy turn, resizing) worked. Taps, tried through the setting, were unplayable. Where no key helper runs there is no game: the band draws one line in place of the court that says why (no helper for this system yet; the helper's `E` word in plain words; it stopped; it could not start), the user's choice over the mouse as a fallback there. `TapSource`, its jump constant and the `controls` setting are gone; this machine's `settings.json` still holds `controls: taps`, which the engine ignores (5.1 row 73).
* 2026-10-06, M5: no helper left behind: changing the setting reloaded the module, and the helper it had ended with the reload (no `keys.ps1` process remained), as P4 found for a reload; P4 also found it ending with the session.
* 2026-10-06, M5: the court moves your blob by `KeysSource` alone. With taps gone, the choice between the helper's keys and standing still was the zero mask again, which the hooks module already guarantees for a helper it does not trust (`KeyFeed`, pinned by `tests/keys.test.ts`); the court's own guard went unseen by a deliberate break and is gone, and the protocol states the rule.
* 2026-10-06, M5: the kit tests of the court share `tests/kit.ts` (the engine beneath, a Windows session with the stand-in helper, readers of the drawing, `hold` and `serve`), and the band tests play with held keys through it.
* 2026-10-06, M5 finding: the third round of deliberate breaks (24, the key code without taps and the line in place of the court) left one standing, the doubled zero mask above.
* 2026-10-07, after M5, finding: a P2 prototype session from M1 still ran in the daemon hours later (`--resume ... --reply-on-resume --plugin-dir ...\prototypes\p2-client-court`) and rewrote `prototypes\results\p2-client-court.json` (the M1 finding of two sessions writing one file). The committed file is the evidence; the change is left out of commits and goes back with `git checkout` once that session is stopped in agent view. Reproduce: Get-CimInstance Win32_Process for `claude.exe` lines holding `p2-client-court`.
* 2026-10-07, before M7: that session was gone (no `claude.exe` held `p2-client-court`, none ran with `--bg-pty-host`, no `keys.ps1` ran), so `p2-client-court.json` went back with `git checkout`. `leftArrowOpensAgents` was `false` in `~/.claude.json` by then.
* 2026-10-07, M7: **dialogs ride on the engine.** 6.9 planned a `dialog` flag with hooks on `classic.PermissionRequest` and `tool.call`, written before P1 found that the engine unmounts the court under a dialog and mounts a fresh one when it closes (5.1 row 45). That already does what D6 asks: the rally is void, the posts stop and the helper with them, and the court comes back waiting for a click as soon as the dialog closes, sooner than the plan's "when the tool settles", so the accepted risk of section 7 is gone. `dialog` left `VolleyBand`. P1 measured AskUserQuestion and `$.ui.ask`; the permission prompt passed the user's check of M7 (5.1 row 45). Had it left the court on screen, the hooks of 6.9 would have come back (about 1.5 h).
* 2026-10-07, M7: the M3 finding on `/volley` courts is settled by holding `doneSeq` back: `turn.complete` raises it only while a court that opened by itself is shown, so the props need no `manual` flag.
* 2026-10-07, M7: the report carries `closed`, the highest `doneSeq` whose rally is over, instead of `closing: boolean` (6.10). A boolean from one turn end would close the court at the next one: a prompt typed ahead starts a turn while the rally runs out, the court ends its rally and reports closing, the next turn ends, and that stale report arrives before the court took the new `doneSeq`.
* 2026-10-07, M7: `working` left `CourtProps`: the marker follows from the cut, and nothing read it.
* 2026-10-07, M7: at a turn end the hooks module counts the court as there while it posted within the last second, the helper's own rule (6.12). One that does not post (collapsed with `[-]`, behind a dialog, the line in place of the court) closes at once. 6.9 had looked at the last report's phase, which says nothing about a court that is gone.
* 2026-10-07, M7: the delay timers are never cancelled; each checks its own turn when it fires (6.9). The first build cancelled them as well, and the deliberate breaks showed each guard covering for the other, so one went. Likewise a pending close is guarded only by `turn.start` cancelling it, which the close in `ui.message` and the backstop both rely on.
* 2026-10-07, M7: the defaults of 3.2 for the turn end (marker, only a rally plays out, `enabled` off closes at the reload) were set by the designer. `hooks/lifecycle.ts` holds the pure parts (settings, `afterLoad`), as `keys.ts` does for the helper (6.2).
* 2026-10-07, M7 finding: probes in a scratchpad copy found 5.1 rows 74 to 78 (turn events in the kit, options and one load per test, a timer's state write, one hook per event, where `console.log` goes). Reproduce: copy the mod, call a probe `register` from the copy's `register.tsx`, run `claude plugin test --file <abs test> <abs copy>`.
* 2026-10-07, M7 finding: in the kit a stand-in helper that says nothing for 2 s is no longer trusted, and its zero mask drops the foreground bit, which the court reads as the window leaving (6.8): a test that moves only the mock clock 12 s pauses play, and one whose court stops posting meanwhile loses its helper too. `tests/lifecycle.test.ts` (`live`) keeps the heartbeat and the frames going. The suite now takes about 32 s (21 s before `live`, 6 s before M7).
* 2026-10-07, M7 finding: the new code was checked by breaking it on purpose in a scratch copy, 32 breaks in round 1 and 32 in round 2. Round 1 left nine standing: three missing tests (a short turn followed by the next, a new turn while the mock clock passes the backstop, `/volley` during the wait), now written, and two pairs of guards covering for each other, now one each (above). Four stand by design: `appear` ignoring `muted` (nothing sets it before M8, whose line takes the test), the court's starting `done` and `closed` (a fresh court waits for its first click, where a turn end changes nothing, and its first post comes after a tick that sets `closed`), and the reload re-arming the delay (the kit cannot stage a reload, 5.1 row 75, so the turn's own timer opens the court anyway; `afterLoad` has its pure test, the wiring the user's check).
* 2026-10-07, M7, the user's check: in a fresh `.\dev.ps1` session (started 11:15) the court opened by itself during a long turn, and every manual check of the plan passed: appearing about 5 s in and not in a short turn, the turn end with the marker and the close, the close before a first click, Esc, the permission prompt and AskUserQuestion (5.1 row 45), a `/volley` court staying after the turn, `delaySeconds` and `enabled` in `/config` with a reload during a turn. Afterwards no `keys.ps1` ran. The user asked whether a court should leave when the run finishes; it does when it opened by itself, and a `/volley` court staying (3.2) was left as it is.

* 2026-10-07, M8 finding: **`/clear` empties `$.state` and raises no `session.start`** (5.1 row 79). The module goes on as it was, so a load of the saved standing that sat only in `session.start`, as 6.9 had it, would miss every `/clear`: the court would open at match 1 and its first point would overwrite the saved standing. The standing is now taken in wherever the state has none (`standing` in `register.tsx`): `session.start`, every `/volley`, the delay's timer and each report. Reproduce: a probe plugin with a state value and a `/probe` command, fed `/probe bump`, `/clear`, `/probe state` as stream JSON (`claude -p --input-format stream-json --output-format stream-json --verbose --plugin-dir <probe> --no-session-persistence --setting-sources project`, with `CLAUDE_CONFIG_DIR` set to a scratch folder so nothing lands in `~/.claude`; a plugin command runs no model turn and needs no login).
* 2026-10-07, M8 finding: the other probes of that kind gave 5.1 rows 80 to 84 (the 1.5 s of `session.end`, the store's file and its name, fresh reads across sessions, no double load, a get after a set). Two sessions on one store were driven by a small Node script that keeps one stream JSON session open while a second `claude -p` writes.
* 2026-10-07, M8: **a reset reaches a shown court by the match number, not by a command** (6.8, 6.10). 6.10 planned `cmd.kind: 'reset'`, but a command shares its one slot with the pause that `prompt.edit` raises at every typed key, so typing right after `/volley reset` could replace the reset before the court saw it, and the court would then play an old match whose reports the hooks module ignores. The number cannot be lost that way: a `match` in the props with a higher number than the court's replaces the court's match, and the hooks module ignores reports below its own number. The core's `reset` takes the match it is handed (6.4).
* 2026-10-07, M8: `session.end` saves only what a failed write left pending, not "the standing one last time" (6.9). The store is read afresh at every call (5.1 row 82), so a blind save at the end of an idle session would put its older standing over a newer one another session saved since. A store write that throws would fail the hook (5.1 row 85), so every save catches, and what failed is tried again with the next save.
* 2026-10-07, M8: the record is counted against the store's (another session may have raised it), the score row takes the store's record when the court opens, and `/volley stats` reads it from the store. With the session's own record still pending, that one counts.
* 2026-10-07, M8: the plan's `readSaved` wrapper fell away: `protocol.ts` exports `readMatch` and `readRecord`, which read the store's values as they read a report. `tally` and `same` moved from `register.tsx` to `hooks/standing.ts`, with the words and answers of `/volley`.
* 2026-10-07, M8: the kit tests answer the store themselves (`store` in `tests/kit.ts`), since a test can neither read `mock.store` nor watch its writes (5.1 row 85); its `fail` switch stands for a full disk.
* 2026-10-07, M8, accepted: a `/volley reset` in the same frame as a match end the hooks module has not taken yet leaves that match uncounted (about 16 ms).
* 2026-10-07, M8 finding: the new code was checked by breaking it on purpose in a scratchpad copy, 51 breaks in round 1 (each alone, the whole suite on it, four copies at a time) and 10 in round 2. Round 1 left eleven standing. Five were code that changed nothing, now gone: `standing` loading and writing the record (the court's opening and every reader take the record from the store, so `standing` keeps to the match), its early return on both values, `manual: false` in `/volley off` (a hidden band's `manual` is never read), and the guard around the opening in `/volley on`. Six were missing tests, now written: a pending write never cleared, the pending record counting before the store's, every court drawing a new seed, a court that opens by itself after `/clear` (only with a saved match number 1, since a later number is taken up by the reset rule anyway), `session.end` waiting for a report being taken, and a store that cannot be read. Round 2 caught all ten after one more test (a court opened by `/volley on` shows the store's record). Reproduce: `breaks.mjs` of the session's scratchpad, a list of `[id, file, from, to]` applied to fresh copies.
* 2026-10-07, M8 finding: under four suites at once, the M7 tests of a silent court at 10.9 s and 11 s failed now and then beside unrelated breaks. Alone they take about 3.7 s of the default 5 s (the stand-in helper wakes every 10 ms through 11 s of mock time); they now carry `timeoutMs: 30000` as their neighbours do.
* 2026-10-07, M8: the suite has 141 tests (115 before M8) and takes about 33 s. A headless `/volley stats` and an unknown word answered as planned, and the exit wrote no store file (nothing was pending).
* 2026-10-07, M8, the user's check: in a `.\dev.ps1` session all six checks passed: points played showed in `/volley stats`; a reload through `/config`, `/clear` and a restart each kept the standing on the court and in `stats`; `/volley off` kept the court away in a long turn, `/volley on` showed it, and once hidden the next long turn opened it by itself; `/volley reset` showed 0 : 0 at once and kept the record. Afterwards the store file held match 3 at 0 : 0 and one match lost 5 : 11, and a headless `/volley stats` read the same.
* 2026-10-07, M8: **the mod loads in every session** (D12, the user agreed during planning). The user's `~\.claude\settings.json` got `"env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\projects\\ClaudeyVolley" }`, and the leftover `pluginConfigs."wobbly-volley@inline"` entry (`delaySeconds: 1` from the M7 check, the dropped `controls: taps`, `difficulty: medium`) was removed, as the user chose, so the court opens after the default 5 s again. Nothing else in the file changed. A headless `/volley stats` from another folder with no `--plugin-dir` answered with the saved standing, and with `--plugin-dir` as well, once (5.1 row 83). Saves in the project folder now reload the mod in every open session, and `.\dev.ps1 -Only <prototype>` would load the mod beside the prototype.
* 2026-10-07, M8 finding for M11: an installed plugin is keyed by its marketplace, not `inline` (another installed plugin's store file is named `<name>_<marketplace>-….json`), so the standing saved while the mod loads from its folder will not carry over to a marketplace install, and neither will its `/config` values. Not checked further; M11 decides whether the README says so.
* 2026-10-07, after M8, the user's report: sometimes the court closed at the turn end with the ball in play, with no marker or right after it. The user keeps D5 (only the rally in play runs out, not the whole set). **Cause: a turn that saves a file in the plugin's folder reloads the module as it ends (5.1 row 27)**, which since M8 is every turn that works on this project, in every session. Two things ended the rally there. `afterLoad` closed a court that opened by itself once its turn had ended (M7 took a reload for a rare event; a test even asked for it), and with the reload before `turn.complete` the fresh load had heard no post yet and took the court for gone. And the reload ends the helper (5.1 row 53): until the next one is trusted the mask is 0, which the court read as the terminal leaving the front, so it paused, and a pause during the cut ends the rally. A third gap sat beside them: `KeyFeed` trusted a helper's first `H`, which comes before its first `K`, with mask 0, and after a silence it dropped the last `K`, which the helper does not repeat. Fixed: `afterLoad` gives `finish` for an ended turn, `finish` in `register.tsx` serves both paths and gives a court a fresh load has not heard from one second to post, the court compares only trusted masks and holds a rally still while the helper is not trusted, and `KeyFeed` is trusted from the first `K` and keeps the last one through a silence. Ruled out on the way: the user's Stop hook, which plays a sound through PowerShell, took no focus (four starts from Node, hidden and not, with the foreground window polled every millisecond: no change). 144 tests; of eight deliberate breaks seven failed tests, and the eighth (no wait for a court a fresh load has not heard from) stands, since the kit cannot stage a fresh load (5.1 row 75). Open: whether the court's `Client` keeps its instance across a reload. If it does not, a fresh court takes the turn end as seen and closes at once, and the rally would have to travel through `$.state` (section 12, exact resume). The user's check tells.
* 2026-10-09: the fix of the entry before was committed on its own (144 tests) before M9 began. Its open check stays open; every long turn of M9 ended in a reload with a court shown.
* 2026-10-09, M9: the types now come from Claude Code **2.1.295**. What M9 relies on reads the same (5.1 rows 18 and 75: `register(on, options)` gets the `userConfig` values with defaults filled in, and `test(name, { options })` sets them), and the suite passed on it before M9. New in the doc comment: a stored value outside a picker's `options` counts as unset, so its default applies (row 18).
* 2026-10-09, M9, the user's choice: **medium about even with the user.** The store held the user's record against medium (error 3 px): 0 matches won, 5 lost, points 28 : 57, so the user won 33% of points. Medium's aim error went from 3 to 4 px; easy and hard kept the starting values of 6.6. A human proxy (next entry) wins 54% of points against the new medium, 78% against easy and 21.5% against hard.
* 2026-10-09, M9 finding: **a human proxy calibrated to the user's record.** No test can play like the user, so the levels were set against a stand-in: an `AiSource` with 250 ms reaction (15 steps), full speed, jump chance 0.7, medium's placement and an aim error of 4 px ("aim"); a second one with an error of 3 px whose landing guess is off by up to 30 px per second of flight left ("guess") gave the same picture. Both won 35 to 39% of points against the old medium, as the user did. Against the levels of the prototype: easy 76 to 78%, medium with error 4 50 to 51%, hard 18 to 21%, hard with medium's placement 10 to 12%. Model numbers; the user's check is the test. Reproduce: in a scratch file under Node, an `AiSource` with `{ reaction: 15, aimError: 4, speed: 1, jumpChance: 0.7, placement: 'over' }` against each level on 60, 110 and 160 columns, three seeds, 60 points each and both sides.
* 2026-10-09, M9 finding: **placement does not make an AI receiver fail more.** Medium failed 10.7% of the balls that came to its side against its own shots and 10.3% against hard's "away" shots; wider stands for hard (2 px in front to 9 behind) or letting it choose whether to jump changed nothing for the receiver, and neither did the proxy. Every hit has the same speed, so a receiver that predicts the flight has time to reach any ball. "Away" costs hard some reliability (its own faults 4.4% against 3.0% with medium's placement; 70% of points against medium instead of 82%) and was kept: 6.6 decided it, its shots are visibly aimed (on 110 and 160 columns they came down 15.2 and 21.5 px from where the receiver stood, medium's 11.6 and 15.2), and it leaves hard demanding rather than hopeless (the proxy: 18 to 21% against 10 to 12%).
* 2026-10-09, M9, deviation from the M5 finding for M9 (bring medium against itself under 60 s): **the 60 s line binds the pairings with easy.** A long rally is a tail, not a loop: medium (error 3) against itself on 160 columns, 2,000 rallies, had 383 over 30 s, 74 over 60, 16 over 90, 3 over 120 and 2 over 150, longest 171 s, a steady factor of about 5 per 30 s. A rally ends at the first fault, so between two sides that rarely fail its longest grows with the number of rallies; holding medium against itself under 60 s at any count would need it to fail about one ball in five, weaker than the user chose. With error 4 the same run had 120, 8, 1, 0, longest 97 s. Pairings with easy stay short (longest 28 and 38 s in 1,080 points). The tests hold medium against itself under 90 s (37 s on its seeds) and hard against medium under 3 minutes (51 s on its seeds, 77 s in 1,080 points).
* 2026-10-09, M9: how the levels are built. `meet` returns where each shot is once it is past the net and lower than its top (M5's stop), and hard aims by that x, a few pixels short of where the ball comes down; `shots` and `plan` are exported for the placement tests. Every new ball draws three values for every level (the error, the mind to jump, the random stand), so medium's draws changed with M9 too. The court builds its `AiSource` with the level of its props and swaps `level` when a later props value differs (6.8). The kit plays the core bit for bit as Node does (5.1 row 60), at about 3.4 times Node's time; the three pairings of 200 rallies take 0.6, 0.4 and 1.6 s in the kit, the suite about 35 s. On the tests' seeds: hard beats easy 189 to 12, medium beats easy 137 to 64, hard beats medium 159 to 42; the error of 3 px sends 68.4% over (66 to 69% in M5), medium's own 4 px 58.2%.
* 2026-10-09, M9 finding: the new tests were checked by breaking the code on purpose in scratch copies, one break at a time (12 breaks). Caught: easy or hard with medium's placement, hard taking the stand nearest the other blob, the random stand's range turned around, the random stand also for its own serve, `readSettings` ignoring `difficulty`, `courtProps` without the level. Two left standing in the first round got answers: easy drawing its stand at every plan instead of once a ball (its blob set off again two to five times a ball) now fails a test of its own; `meet` following a shot on to 11 px, as first built, changed nothing measurable against M5's stop (hard beat easy 93.4% against 94.6% and medium 78.3% against 80.6% over 1,080 points, medium against itself the same to the point), so that condition is gone. Two stand by design: the court building its AI with medium is set right by the swap in the same first render, and a court without the swap keeps its level until it remounts, which the kit cannot stage under a mounted court (5.1 row 75); both together fail the kit test of the score row, and the swap after a `/config` change is the user's check.
* 2026-10-12, the user's wish: **the mod loads in WSL too, with one standing for both sides** (section 4). The native `claude` 2.1.296 in Ubuntu-24.04 validates the mod and passes its 152 tests. Finding: the engine writes a plugin's store through a temp file and a rename, so a store file that is a symlink turns into a plain file at the first write, and the link is lost without a word. Linking the whole store folder survives it: a write from WSL landed in the Windows folder and the link stayed. Reproduce: a throwaway mod that calls `$.store.set` on `session.start`, run twice with `~/.local/bin/claude -p --plugin-dir <it> /<its command>`, its store file made a symlink between the runs. The `/volley` mute lives in `$.state`, so it stays per session. WSL still has no game until its P4 round passes (M2b); the probe's step text now names A, D and W instead of the arrows and Space (D3).
* 2026-10-12, M2b: **WSL ships.** The user ran the probe in an Ubuntu-24.04 tab, judged it working and asked for the port before every step of the round was done (section 10 lists what was left out); the latency and cleanup lines passed on what was measured. `keys.ts` got `pickSystem` (Windows by `OS`, then WSL by `WSL_DISTRO_NAME`) and `helperScript`; `helperArgv` now takes the system and the script's path, and `lookUp` asks `wslpath -w` for that path in WSL (6.12). The validator wants a literal name in `$.env.get`, so a wrapper that took the name as a parameter failed validation; `lookUp` spells out `OS` and `WSL_DISTRO_NAME`. The kit's `engine` takes `distro` and answers `process.run` as `wslpath`; new are two kit tests (the WSL start, with a held key moving the blob, and a `wslpath` that fails) and the unit tests of the pick. 155 tests, green on Windows and with the native build in WSL.
* 2026-10-12, M2b finding: **in WSL the wall clock is not the Windows one.** The helper's stamps (`GetSystemTimePreciseAsFileTime`) against the hooks module's `Date.now()` moved from -206 to +225 ms within 22 s, about 2% of the time passing, and stepped back by about half a second between the two starts (the second start read 45 ms from spawn to first heartbeat on the WSL clock, 604 ms on Windows'). So in WSL no delay can be measured across the two clocks; the WSL figures of section 10 use the terminal's own key events (the `Client`'s `onKey`) as the reference. The mod compares nothing across them: the court's frames run on `performance.now()`, and the hooks module only checks a 2 s heartbeat gap and a 1 s post gap, which steps of the size seen here cannot trip (a step back only makes a gap look shorter).
* 2026-10-12, M2b finding: the WSL port was checked by breaking it on purpose in scratchpad copies, 13 breaks, each alone with the whole suite on it. Ten failed tests at once: the pick asking for WSL before Windows, an empty `WSL_DISTRO_NAME` counting as WSL, a pick that never says WSL, `helperArgv` giving WSL no helper, the Linux path handed to `powershell.exe`, the line end of the answer kept, a failed `wslpath` read as "none for this system yet", the variable not read, the look up at every post instead of once, and a failed `wslpath` that starts the helper all the same. Three stood and got tests. **Windows asking `wslpath` too** stood because the kit's stand-in answered on every system; it would have cost Windows its game, where no `wslpath` exists. The stand-in now answers only in a WSL distribution and fails elsewhere, and the break fails the 53 kit tests of a Windows court. `windowsPath` ignoring the exit code, and taking an empty answer for a path: each guard alone covered the stand-in's one failure (exit 1 with nothing written), so one test now fails `wslpath` with a path written and a second lets it end well with none. 156 tests.
* 2026-10-12, finding for later rounds of deliberate breaks: six suites at once on this machine (20 threads) time single tests out at the kit's 5 s, the first test of a file and the long AI runs, in the unbroken copy too (4 of 160). Two at once ran clean through that round, but afterwards the long AI test (2 to 3 s alone) ran past 5 s at two as well. A timeout is no verdict: a break counts as caught only by a failed assertion, and a suite that only timed out is run again alone. Reproduce: copy `.claude-plugin`, `core`, `hooks`, `helper`, `tests`, `types` and `tsconfig.json` into six scratchpad folders and run `claude plugin test <folder>` on all at the same time.
* 2026-10-12, ahead of M10, the user's choice: **the blobs' new look stays, and section 1 changes with it.** Section 1 left squash and stretch out of version 1; the blob's wobble is now in, and what stays out is the ball's squash and a stretch in a jump (sections 1 and 12). The look was built that day with no entry here, and the user confirmed afterwards that it stays. What it is: the blob is painted from art in `draw.ts` instead of its collision circles, round jelly `BLOB_W` wide with a shine and a shade of its own colour, four new palette entries (3.2, 6.7); `Blob` got `wobble`, a count that `moveBlob` runs for a blob that walks or takes off and that only the drawing reads, which picks one of three frames (6.3, 6.7); the net is drawn over the blobs, so a blob squashed wide against it goes behind it. Play is untouched: the collision circles, the speeds and the AI are as before, the state stays plain JSON, and the same seed and inputs still give the same state. A blob with no count counts as at rest: a game from before the wobble would have such blobs if a court kept it across the reload that brought this code (whether a court does is the open check of 2026-10-07). The kit test of held keys waits half a second after its walk, so the jump heights are measured on a blob at rest. Eyes that follow the ball stay M10's.
* 2026-10-12 finding: the look was checked by breaking it on purpose in scratchpad copies, 18 breaks, each alone with the whole suite on it. Fourteen failed tests at once: no wobble starting, one never ending, any creep or walking in the air setting one, a blob without a count not at rest, no squash, a squash that rises to the end, the frames in the wrong order, the wide frame off centre, the net drawn before the blobs, Claude's blob facing away from the net or one column off, shine and shade swapped, and the blob upside down. Four stood and got tests. A take-off that sets no wobble: the test's take-off also walked, and now it starts from a stand. A serve that keeps the wobble under way, and a wobble only at full speed, which would leave easy and medium walking stiff: a new test walks both blobs at the slowest level's pace and then serves. The shines swapped between the sides: a new test holds each blob's shine to a lighter and its shade to a darker tone of its own colour, with the same channel strongest. 163 tests.

* 2026-10-12, M10: **two parts.** Part one, the look, needs nobody. Part two is one play session with the user: the constants first, then M9's verdict on easy and hard, then both ticks. The verdict waits for the tuning because a 10% change of one constant moves hard by up to 12 points for the human stand-in (two entries on), so a verdict given before would not hold.
* 2026-10-12, M10, the user's choices (a question with pictures of each): the eye of two white pixels whose pupil takes the ball's side, over a 2 by 2 eye whose pupil also looks up and down (in play it moved about 93 times a minute a blob against 34, and it took much of the squashed head); big digits for the countdown and the final score with the winner hopping and the loser flat, over the same without motion and over text as before; the tuning sheet in the repo (`tools/tune.ts`, 6.2) rather than a scratch file each session.
* 2026-10-12, M10: **the countdown is big text, no longer a line of text** (6.7), and the kit reads it back by matching the court's cells against the font (`big` in `tests/kit.ts`). A prototype in a scratchpad copy of the core, rendered to pictures, settled the layout: a 3 by 5 font at 2 by 2 world pixels standing on world row 18 fills whole cells on every court, and the smallest court (60 by 16) holds it with the headline on its top row and "108 : 110" within its width. A hop of 8 px came within a pixel of the digits on a 16 row court, so the hop is 6 px.
* 2026-10-12, M10 finding: **the tuning sheet** (`tools/tune.ts`, about 10 s) on the constants as they are: a tap jump 15.74 px, a held one 23.15 px; a hit straight up rises 22.5, 41.3 and 60 px at 60, 110 and 160 columns; medium against itself has a median rally of 5.4, 5.1 and 8.5 s, and the ball is wholly above a 24 row view 0.5%, 22.6% and 41.9% of rally time; the stand-in of M9 wins 79.3% of points against easy, 51.9% against medium and 19.5% against hard; hard beats easy in 95.4%, medium beats easy in 75.5%, hard beats medium in 81.7%, as M9 found. With each of `RUN_TIME`, `JUMP_SPEED`, `GRAVITY_HELD`, `GRAVITY`, `BALL_GRAVITY`, `HIT_RANGE`, `SERVE_Y` and `NET_H` moved by 10% either way: `HIT_RANGE` is the lever for the ball leaving the view (at 0.675: 10.7% and 34.9% at 110 and 160 columns; `BALL_GRAVITY` barely moves it, since the hit speed grows with it); the stand-in wins 46.8 to 55.6% against medium and 78.2 to 85.6% against easy in all 16 runs; hard moves most, 18.2 to 31.6%, weakest at `SERVE_Y` 23 (31.6%, where hard beats medium in only 70.4%), `GRAVITY_HELD` 222 (29.8%) and `JUMP_SPEED` 120 (25.4%); every pairing stays above its test line. Reproduce: `npx -y tsx tools/tune.ts NAME=value`.
* 2026-10-12, M10 finding: **the tests' reads of the message line broke when a constant of the layout moved.** The whole suite on a copy with one constant moved by 10% (17 runs one after another, no timeouts): `GRAVITY`, `GRAVITY_HELD`, `HIT_RANGE`, `BALL_GRAVITY` 170, `RUN_TIME` 1.17 and `JUMP_SPEED` 120 failed nothing; `RUN_TIME` 1.43 and `JUMP_SPEED` 98 failed one test ("medium wins nearly every point against a player who only serves"), `BALL_GRAVITY` 140 two (the placement tests on one ball); `SERVE_Y` 23 failed 15 and 29 six, `NET_H` 15 five and 19 thirteen. Most of the big numbers came from band, helper and lifecycle tests that read the whole message line with `.trim()`: with the hovering serve or the net's top in that terminal row, its half blocks came along (`"▀███▀   3"`). The kit's `message` leaves them out now. On the code of M10's first part the same two copies fail 7 tests (`SERVE_Y` 23) and 5 (`NET_H` 19): those that pin the numbers, and the win screen test, which finds no cell row left above the big score for the headline on a 16 row court (with `SERVE_Y` 23 that court gets 4 px of ground instead of 2, with `NET_H` 19 the score stands two rows higher). A part two move of either constant needs the smallest court's win screen looked at. Reproduce: copy the mod to a scratch folder, change one line of `core/constants.ts`, run `claude plugin test` on the copy.
* 2026-10-12, M10 finding: the pupil in play (medium against itself, 10 minutes a width) moves about 34 times a minute a blob; about 5 of those a minute go back within 3 steps, when the ball passes over the eye. A drawing without state cannot damp that, and it reads as the eyes darting; the user's check tells whether it bothers.
* 2026-10-12, M10: the hints of the idle court (79 characters) and of play (65) were cut on a 60 column court. All hints are rewritten to fit (3.2), and a test holds them and the marker of D5 to 60. `hint` and `DONE` are exported from `court.tsx` for that test, which validate and the kit accept from a surface module.
* 2026-10-12, M10: the encode test held every frame of real play under 60 coloured runs (M4). Big text needs more: a countdown frame about 48, a win screen of "108 : 110" on 160 columns 83 runs and about 10,800 characters, far within the guard's 900 runs and the `Client`'s 100,000 characters. Frames with big text have a line of their own at 120, and a test holds the widest win screen to it.
* 2026-10-12, M10 finding: the first part was checked by breaking it on purpose in scratchpad copies, 22 breaks, each alone with the whole suite on it, two copies at a time; no break stood and none timed out. Caught: the pupil fixed toward the net, its side swapped, the eye found by its right pixel, the eye a row up, `BIG_Y` odd (half cells), the digit upside down, the digit a column off the net, the colon off the net, the score colours swapped, the headline on the digits, the headline in the sky colour, the big cells a row off, the digit drawn over what plays, the countdown still written as text, the win screen writing `blob.y`, a hop with no landing, the loser not flat, a hop up to the digits, a hint over 60 characters, and in the kit the decoder taking any run of columns, `picture` keeping the digit and `message` keeping the half blocks (the message row lies inside the digit's rows during the countdown). 170 tests, about 36 s. Reproduce: `breaks.mjs` of the session's scratchpad, a list of breaks as `[from, to]` edits applied to fresh copies.
* 2026-10-12, M10, the user's verdict on sight: **the big digits were too much.** The countdown and the win screen show their message line as before ("3", "You win 11 : 7") and it pulses: in each beat of 0.5 s bold for a third, plain for a third, dim for a third (3.2, 6.7). The pulse uses the terminal's bold and dim attributes on its own text colour, which read on a dark and a light theme, where a ramp of greys of the mod's own would vanish on a light one. The eyes, the hopping winner and the flat loser stay. Gone with the big text: the font, its layout and its tests, the kit's `big` and `headline` readers and the masked digit box in `picture`, the encode test's second line for big text, and the limit of the entry before last (no headline row above the big score on a 16 row court). New: `Weight` on an overlay and a run, `pulse` and its tests, the court drawing a weight as `bold` or `dimColor`, the kit's `weight`. On this code a move of `SERVE_Y` to 23 fails 6 tests and of `NET_H` to 19 four, all of them tests that pin those numbers. 171 tests. Checked by 12 more deliberate breaks, each failing a test: no pulse at all, the pulse fading in instead of out, the countdown's beat counted backwards, a still win screen, every message pulsing, the win line without the score, `encodeRuns` dropping the weight or merging across it, the court ignoring bold or dim or drawing a weighted plain run as a bare string, and the kit reading every run as plain. Reproduce: `breaks2.mjs` with `list2.mjs` of the session's scratchpad.
* 2026-10-12, M9 and M10, the user's checks: easy and hard work well, a level changed in `/config` under an open court shows on the score row, and the feel is good with the constants as they are. No constant moved, so the tuning round of M10's plan fell away and M9's verdict stands. The check of 2026-10-07 (a court's `Client` across a reload) stays open for want of a reload with a court shown; it does not block M11.
* 2026-10-12, M11, the user's choice: **the AI plays under a name for each level**, Pudding at easy, Jelly at medium, Gummy at hard (3.2), picked from three sets (citrus, jelly, volleyball's three touches). Until then the opponent was called Claude. The mod is a fan project, so its character got names of its own, and "Claude" on the court now means Claude Code alone. As built: each `AiLevel` has a `player` (`core/ai.ts`); `View` gained `rival`, which `draw` hands to `message` for the point and the win screen (6.7); the court's score row and `statsLine` take the name of the level of `/config`, and the `/config` row's description names the three. The side stays `claude` in the code, in the `$.state` contract and in the store, so nothing saved changes. The marker of D5 keeps "Claude is done": it means Claude Code.
* 2026-10-12, M11 finding: **a test helper read the old name and would have passed on nothing.** `untilPoint` in `tests/kit.ts` advanced while the score row began with "You 0 : 0 Claude". Under the new name it stops at once and reports 0 s, which its callers' "under 60 s" accept. It now waits on "You 0 : 0 " alone, whatever the AI is called.
* 2026-10-12, M11: version 1.0.0 in `plugin.json` and in `VERSION`. The manifest gained `displayName` ("Wobbly Volley", D11), `homepage`, `repository`, `keywords` and the author's `url`, the fields the docs' checklist for a release names (5.1 row 88); validate passes with them, plain and with `--strict`, and reads `marketplace.json` in the same run (5.1 row 87). The license came the same day (below).
* 2026-10-12, M11: section 1 still listed a fourth setting, the control scheme, which went with D3's change in M5. Corrected there; the README lists the three rows of `/config`.
* 2026-10-12, M11: **what the README says, where the plan left it open.** The M8 finding of 2026-10-07 is settled with one line under Development: a mod loaded from a folder and the installed one keep their standings and settings apart. It says that the mod is a fan project, not made, endorsed or supported by Anthropic. Per system it says what held keys need and whether that was tested (6.12): Windows and WSL tested, Linux and macOS written, not tested and not started by the mod, so no game there. It names the fullscreen layout as a need, since the game starts with a click (5.1 row 26).
* 2026-10-12, M11 finding: **the install, checked without touching the user's config.** With `CLAUDE_CONFIG_DIR` set to an empty scratch folder and `CLAUDE_CODE_PLUGIN_DIRS` cleared: `claude plugin marketplace add C:/projects/ClaudeyVolley` added the marketplace `wobbly-volley`; `claude plugin install wobbly-volley@wobbly-volley` installed it at the user scope ("3 userConfig options not yet set"); `claude plugin list` showed version 1.0.0, enabled, read from the folder (a folder marketplace is not copied, 5.1 row 87). From another folder, headless: `/volley version` answered "Wobbly Volley 1.0.0: /volley shows or hides the court; /volley on, off, reset or stats" and `/volley stats` "match 1 stands at You 0 : 0 Jelly. All time: 0 won, 0 lost, points 0 : 0", a standing of its own, as the M8 finding expected.
* 2026-10-12, M11 finding: **the install from GitHub, after the push**, in a second empty `CLAUDE_CONFIG_DIR`: `claude plugin marketplace add kopylow/wobbly-volley` cloned the repo and validated the marketplace file, `claude plugin install wobbly-volley@wobbly-volley` installed version 1.0.0, and the copy lies in `<config folder>\plugins\cache\wobbly-volley\wobbly-volley\1.0.0\`. Headless, the copy answered `/volley version` and `/volley stats` as the folder install did. `helper\keys.ps1` started from that cache folder with the mod's own arguments wrote its heartbeat and `K 16`, ready 1,328 ms after its process started (920 ms of that before the script ran, its first start from a new place), and no helper was left afterwards. The repo is private, so the clone went through this machine's git login: until the repo is public the install line works only for accounts with access. Not checked: the line typed at a prompt with its questions (5.1 row 30), and play from an installed copy.
* 2026-10-12, M11 finding: **the Windows helper starts from a folder in the WSL home**, where an install made inside WSL puts the mod. M2b measured WSL only from `/mnt/c`. `helper/keys.ps1` copied to `~/volley-unc-test/helper/` in Ubuntu-24.04: `wslpath -w` gave `\\wsl.localhost\Ubuntu-24.04\home\<user>\volley-unc-test\helper\keys.ps1`, and `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File` on that path wrote its heartbeat and `K 16` 681 ms after the process started (by the helper's own stamps), with the walk `wsl.exe` < `wsl.exe` < `pwsh.exe` < `cmd.exe` < `claude.exe` < `powershell.exe` < `WindowsTerminal.exe`. Only the start was checked, not play from there; the README says so. Reproduce: `unc.sh` of the session's scratchpad, run through `wsl.exe -d Ubuntu-24.04 -- bash <path under /mnt/c>` from PowerShell (Git Bash rewrites the path).
* 2026-10-12, M11, the new code checked by 7 deliberate breaks in scratchpad copies, four at a time, each failing the tests meant for it: easy under the medium name, the point and the win naming a fixed AI, the court drawing a fixed name, the score row a fixed name, `stats` reading the medium name, and the stats line a fixed name. Two copies also failed "ai: with an aiming error of 3 px" at 5.1 s, a timeout with four copies running, so no verdict (workflow). The court test at hard was widened for this: before, nothing at a level other than medium read a message from the court. 173 tests, about 35 s. Reproduce: `breaks.mjs` of the session's scratchpad.
* 2026-10-12, M11 and after, the user's choices for the public repo. **The mod is renamed from Claudey Volley to Wobbly Volley** (D11), picked from names that echo Blobby Volley: "Blob Volley" sits between Blobby Volley and an old game called "Volley Blob", "Bloppy Volley" sounds like a copy of Blobby Volley's name, and no game called "Wobbly Volley" turned up. The reason for leaving the old name: the docs on Claude Code say its names may not be part of a third party's product name, and in 2026 small community tools for Claude Code were asked to rename. The command stays `/volley`, the AI's side stays `claude` in the code, and the folder on the build machine stays `C:\projects\ClaudeyVolley`, which the settings of D12 and of WSL load from. The renamed mod keeps the user's standing: its store file and `/config` values were carried over to the new name. Finding: the hash in the store file's name changes with the mod's name, not only its source (5.1 row 81): the folder load is `claudey-volley_inline-1765b23ab702.json` before and `wobbly-volley_inline-f8cd336459db.json` after, and a copy under the old hash was not read. The way that worked: let the renamed mod write once (a headless `/volley reset`), then copy the old file over the one it made; `/volley stats` then read match 17 and the record of 2 won, 19 lost. The `pluginConfigs` key in `settings.json` moved from `claudey-volley@inline` to `wobbly-volley@inline`. **The license is MIT** (`LICENSE`, `license` in `plugin.json`). The user's wish was free use and readable source, with changes coming back to the repo. No standard license can demand the last part: open source lets anyone share a changed version, a text that forbade it would be a custom one outside open source, and nobody could enforce it for changes made at home. GPL 3.0 would keep shared changes open, which for a mod of plain TypeScript changes little. So the wish stands as an ask: the README's "Contributing" section says changes are welcome as pull requests. The code takes any license: it has no dependency, nothing from Blobby Volley but proportions (6.3), and none of the engine's types in the repo (`.gitignore`). **This file was cleaned for release**: section 4 keeps what the design relies on, and details of the user's machines and accounts are gone from it and from the entries that repeated them.
* 2026-10-12, before the release, finding: **the docs on mods and on publishing, read for the release** (5.1 row 88). The mods API is documented in public and mods are on by default, so section 5 describes a public API; "early access" in the types means the surface may still move between releases. What follows here: the README names 2.1.287 as the oldest build and gives the shell form of the install line beside the one for the prompt; every later release raises `version` in `plugin.json` and `VERSION` together, because installed users get a new copy only when the version changes (`.claude/workflow.md`); and the mod's `name` is fixed from the first public install on. Should a rename ever be wanted, it touches the repo and the install line, `name` in `plugin.json` and `marketplace.json` (with a `renames` entry there for existing installs), the `plugin` key of the four `$.state` references and of `types/index.d.ts`, the texts of `/volley` and the band's lines, `WOBBLY_VOLLEY_CLOCK`, and the store file and the `/config` values, which are keyed by the mod's name (5.1 row 81), so a standing would need carrying over.
* 2026-10-12, the release, the user's choice: **the public history starts with one release commit.** The commits of the build, M0 to M11, are not in the public repo; this log is their record, which is why it names no commit. The release lives in a new repo, `kopylow/wobbly-volley`: after a forced push GitHub still served the old commits by hash, so the old repo stays private with the user, as does a bundle of the old history.
* 2026-10-12, the release: **the repo is public**, the user's go. Checked right after: the marketplace file reads without a login, and `claude plugin install wobbly-volley --marketplace kopylow/wobbly-volley` installed and answered `/volley stats` in an empty `CLAUDE_CONFIG_DIR` with git's global and system config switched off (`GIT_CONFIG_GLOBAL` an empty file, `GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`), so with no stored login, as a stranger would. Publishing through the repo's own marketplace needs nothing more (5.1 row 88). For finding it, the user's choice: a GitHub release `v1.0.0` with short notes, and the repo's topics `claude-code`, `claude-code-plugin`, `mod`, `game`, `volleyball` and `terminal-game`. No `claude plugin tag` tag (`wobbly-volley--v1.0.0`): it matters only to plugins that declare a version range on this one.
* 2026-10-12, after the release, the user's decisions: **online play for version 2** (D14 to D22), designed in section 13 with milestones M12 to M21. The user asked for peer to peer play with as little server as possible, ideally none; chose a friend system with personal codes, friends matched first, and automatic matchmaking over a free public meeting point; kept online play bound to the waiting time, with the AI until a person is found; asked that a match a turn end interrupts be saved on both sides and resumed when the same two meet again, with statistics per ID; asked for every system and any pairing of them; and asked for a nickname for everyone. Three recommendations of the designer were accepted with the go to write this plan: online play off by default (D20), a pause limit of 15 s (D21), and Python as the second helper language, for Linux and macOS (D22). What the design session found on the way:
  * **The engine declares no public key cryptography** (5.1 row 89): `crypto.subtle` has `digest` alone. The mod brings TweetNaCl-js (public domain) for the key pair and for sealing lobby messages; a box proves its sender, so no signatures are needed (13.5).
  * **ntfy.sh's limits shape the lobby** (13.6): 60 requests and one more every 5 s per address, 250 messages a day, messages up to 4,096 bytes, topics public. Hence a poll every 6 s, a bucket of the mod's own, a cap of 200 messages a day per machine, one searching session per machine, and addresses only inside sealed boxes. `$.http.fetch` cannot stream (5.1 row 90), so the mod polls.
  * **The net helper runs the key helper as its child** (13.9). That refines D22 as first worded, where Python would have read the keys on macOS too: the key helpers stay as they are, play against the AI on macOS needs no Python, and their promise to open no connection holds.
  * **The mod talks to the net helper through a file** (13.9): the helper's stdin closes at its start (5.1 row 19), and from WSL the Windows side's `127.0.0.1` is out of reach in WSL's default network mode.
  * **The hooks module owns a meeting** (13.3), unlike the AI match: a dialog or `[-]` unmounts the `Client` (5.1 row 45), and a meeting has to go on through a short pause.
  * **macOS's `/usr/bin/python3` is a stub** that raises the dialog to install the command line tools, so the mod asks `xcode-select -p` first (13.9).
  * Touched: the status, sections 0, 1, 2, 3, 5, 6.1, 6.12, 7, 8, 9, 10 and 12, the new section 13, and `.claude\workflow.md`. No code changed.

---

## 12. Ideas for later

Recorded, not designed.

* **Sound.** Two routes on Windows: one PowerShell call per event (about 0.25 seconds late, fine for a whistle or a fanfare, too late for ball hits), or a second channel into the helper (a watched file or a local HTTP port, since its stdin closes at start).
* **Desktop Code tab.** The band and `Client` exist there, `Raster` does not. Architecture A should carry over. How half block text looks in the desktop page is untested.
* **Docked side pane** for terminals of 144 columns and more.
* **Adaptive AI** that moves a notch after each match.
* **More finish:** ball trail, squash and stretch beyond the blob's wobble (the ball, a stretch in a jump), a burst when a point is scored, blob colors in `/config`.
* **Key releases from the terminal.** Terminals that report key releases (kitty keyboard protocol) would make the helpers unnecessary, if a later build passes releases to `onKey`.
* **Exact resume** of a rally after the court was closed, by keeping the rally in the report.
* **Faster return after a dialog**, if a later build offers an event for a dialog closing.
* **Classic Blobby rules** as an option: only the server scores, to 15.
* **Background agents** counting as waiting time too.
* **Multiplayer.** Designed as online play for version 2 in section 13. Left for later there:
  * A relay for pairs that cannot connect directly (both behind carrier grade or symmetric NAT), for instance a Cloudflare Worker on its free tier. It would be a service of our own after all, which D15 avoids.
  * Rollback on top of the lockstep stream (13.15).
  * The net helper streaming the lobby instead of the mod polling it (13.15).
  * A second meeting point beside ntfy.sh, for when that one is down or changes its limits.
  * Online play from a court opened with `/volley` (3.2).

---

## 13. Online play (version 2)

Designed on 2026-10-12 from the user's decisions D14 to D22 (3.1) and the designer's defaults for online play (3.2). For milestones M12 to M21 this section is binding the way sections 3 and 6 are for version 1. With `online` off nothing here runs: no request leaves the mod, and the key helper starts as in version 1.

### 13.1 Goal and scope

**Goal.** Play a person instead of the AI when someone else is waiting on Claude at the same time, with no server of our own, on every system, with every match carried over between meetings.

**In version 2**

* Automatic matchmaking in a public lobby on ntfy.sh, friends first (D14, D15).
* Personal friend codes, a friend list, a block list, and a nickname for every player (D14, D19).
* A direct UDP connection between the two players, found through public STUN servers and hole punching, with IPv6 and the local network tried as well (13.7).
* Lockstep play with a small input delay: only inputs travel, and the net helper is the clock (13.8).
* The AI until a person is found, and again after they leave (D16). The match is saved on both sides when one leaves and resumed when the two meet again (D17).
* A record per opponent and one against people, beside the AI's (D17).
* Windows, WSL, Linux and macOS, in any pairing (D18); on macOS with a real `python3` (D22).
* The `online` row in `/config`: off, friends or everyone, off by default (D20).
* New `/volley` forms for the code, the nickname, friends, blocking and opponents (13.13).

**Left out of version 2**

* A relay for pairs whose networks cannot be punched through. They play the AI (section 12 keeps the idea).
* Rollback (section 12).
* Rankings across players, chat, spectators, more than two players.
* Moderation beyond each player's own block list.
* Online play from a court opened with `/volley` (3.2).
* Online play in the desktop app, VS Code or on mobile (there is no court there).

### 13.2 A meeting, as the players see it

1. The court opens a few seconds into a turn, as in version 1. You click and play Jelly. With `online` set, the mod looks for a player meanwhile, and the hint row says so.
2. Mia is waiting too. The two mods pair up and connect, and the hint row says "Mia joins after this rally". Your rally against Jelly plays out (10 s at most), then the court counts down and you play Mia: you on the left in blue, Mia on the right in orange, her nickname and the ping on the score row. On Mia's court she is the one on the left.
3. Esc, a dialog, typing or another window in front pauses the match for both. Whoever paused resumes with a click. A pause of more than 15 s ends the meeting (D21).
4. Your turn ends. The rally under way plays out on both courts, the match is saved on both sides, and your court closes. Mia plays Jelly again, and her mod looks for the next player.
5. The next time you and Mia are both waiting, your mods pick each other before strangers (13.6), and the match goes on at the score it had.

A **meeting** is the time two players are connected; a match may take several meetings.

### 13.3 Overview

```
 drawing thread            hooks worker                               host system              the other player
┌────────────────┐ post   ┌───────────────────────────────┐ stdout  ┌───────────────────┐  UDP  ┌─────────────┐
│ court.tsx      │ ─────→ │ register.tsx                  │ ←────── │ helper/net.*      │ ←───→ │ its net     │
│  AI match (v1) │ report │  online/lobby.ts  (matching)  │ lines   │  STUN, punching,  │       │ helper      │
│  online match  │ ←───── │  online/match.ts  (the game)  │ ──────→ │  lockstep clock   │       └─────────────┘
│  drawn from    │ props  │  online/people.ts (the store) │ control │    │ child        │
│  the props     │        │  online/net.ts    (lines)     │ file    │    ▼              │
└────────────────┘        └───────────────┬───────────────┘         │  helper/keys.*    │
                                          │ $.http.fetch            └───────────────────┘
                                          ▼
                                  ntfy.sh topic: the lobby
```

* The **court** keeps the AI match as in version 1. During a meeting it draws the game its props carry, and it reports clicks and reasons to pause.
* The **hooks module** owns the online match and steps it on each step line of the net helper. A dialog, `[-]` or a remount takes the `Client` away (5.1 row 45), while the hooks module stays; the step lines reach it first (5.1 row 52); and it already writes the store, talks to the lobby and holds the control file. So the match lives there.
* The **net helper** is the only process with a network connection. It runs the key helper of its system as its own child and passes that helper's lines on, so the key helpers stay exactly as they are (6.12), and play against the AI goes on through the net helper's copy of the `K` lines.
* The **core** gains `core/online.ts` and stays free of any `claude-code` import (section 0).

### 13.4 Files

```
  core\
    online.ts               the online game around Game: seats, step input from masks, flags, the pause limit, the state hash
    draw.ts                 (changed) the view of a seat: mirrored, own colour, a match narrower than its band
  hooks\
    online\
      identity.ts           the key pair, the code, nicknames and their rule
      people.ts             friends, the block list, rivals and their standings in the store
      lobby.ts              the lobby: messages, presence, polling and pacing, pairing
      seal.ts               a lobby message sealed for one player (TweetNaCl's box)
      net.ts                the net helper: which one a system starts, its lines, the control file
      match.ts              a meeting: steps, flags, pauses, hashes, saving, resume
    vendor\
      nacl.js               TweetNaCl-js 1.0.3 (public domain), its export turned into an ES module export
    court.tsx, register.tsx, protocol.ts, standing.ts   (changed)
  helper\
    net.ps1                 Windows and WSL: STUN, punching, lockstep; runs keys.ps1 as its child
    net.py                  Linux and macOS: the same; runs keys.py or keys.js as its child
  tools\
    netpair.ts              two net helpers against each other on one machine with scripted keys; compares their step lines
  tests\
    online, identity, lobby, seal, people, net, match   one *.test.ts each, and kit tests of the court online
  prototypes\
    p5-net\ p6-lobby\
```

### 13.5 Identity, nicknames, friends

* **Key pair.** At the first start with `online` on, the mod makes an X25519 key pair with TweetNaCl (`nacl.box.keyPair`, its randomness from `crypto.getRandomValues`) and keeps it in `$.store` (`identity`, 13.12). The engine declares no key agreement, signing or encryption in `crypto.subtle`, only `digest` (5.1 row 89), so the mod brings its own: TweetNaCl-js, one file, audited, public domain. A box proves its sender (only the holder of a secret key seals from it), so no signatures are needed.
* **Code.** The first 60 bits of SHA-256 over the public key (`crypto.subtle.digest`), in Crockford's base32, shown in three groups of four: `4F2K-M9XD-7QAB`. It is the player's ID everywhere: in the lobby, in the store and in `/volley`. A typed code is read without dashes and spaces, in any case, with I and L read as 1 and O as 0. To pass for someone, one would need a key whose hash starts with the same 60 bits.
* **Nickname** (D19). Set with `/volley name <nickname>` and kept in the store (`nick`): 2 to 16 characters after NFC, from letters of the Latin, Greek and Cyrillic scripts, digits, the space, `.`, `_` and `-`, with no space at either end. Those scripts take one column per letter, so the score row can count on the width. Until one is set, the nickname is "Blob" and the first four characters of the code ("Blob 4F2K"). A nickname from the lobby is cleaned by the same rule: anything else is dropped and the rest cut at 16; with fewer than 2 characters left it shows as "Blob" and the first four of that player's code. So no control character or escape from a stranger reaches the court.
* **Friends.** `/volley friend <code> [label]` adds a friend, `/volley unfriend <code or label>` removes one. A label is the player's own name for that friend, cleaned by the nickname rule. The court shows a friend by their label when there is one, else by their nickname. Friendship is one sided: adding a code changes one's own matching only.
* **Block list.** `/volley block` blocks the current or last opponent and ends a meeting under way at once, the rally void. `/volley block <code>` blocks any code, `/volley unblock <code>` lifts it. A blocked code is never offered a match, and its offers are ignored.

### 13.6 The lobby

**The service** (docs.ntfy.sh, read on 2026-10-12: the pages on publishing, subscribing, configuration and the terms). ntfy.sh is a public publish and subscribe service over plain HTTPS, run by ntfy LLC, open source, free within limits. What the design relies on:

* `POST https://ntfy.sh/<topic>` publishes the body as one message. A body over 4,096 bytes becomes an attachment, so every lobby message stays far below that.
* `GET https://ntfy.sh/<topic>/json?poll=1&since=<x>` returns the cached messages as JSON lines and closes. `x` is a message id (only newer ones), a duration such as `6m`, a Unix time, or `all`. Each message has `id`, `time`, `event` and, for the event `message`, the body as `message`.
* Messages stay cached for 12 hours by default. Topics are public: anyone who knows the name reads and writes.
* Limits per visitor, that is per IPv4 address or IPv6 /64: a bucket of 60 requests that refills by one every 5 s, and on ntfy.sh 250 messages a day. Past a limit the answer is 429, and repeated excess may bring a temporary ban of the address. The terms forbid getting around the rate limits and loads out of proportion.
* No streaming for the mod: `$.http.fetch` resolves once the body is read (5.1 row 90) and a subscription never ends, so the mod polls.

**Topic.** `wobbly-volley-lobby-1`, its last number the protocol version, so mods of different protocols never meet. `WOBBLY_VOLLEY_LOBBY` (a whole URL) points prototypes and manual checks at a private topic; while it is set, a court opened with `/volley` enters the lobby too, so two sessions can meet without turns.

**Messages.** The body is one JSON object, `{ v: 1, k, from, ... }`, read field by field as a report is (6.10) and dropped on any doubt.

| `k` | Sent | Fields | Readable by all |
|---|---|---|---|
| `hello` | on entering the lobby, then every 5 minutes while in it | `from`, `pk`, `nick`, `ver` (the mod's version), `mode` (`friends` or `everyone`) | all of them |
| `bye` | on leaving the lobby for good (the court closes, `online` goes off) | `from` | all of them |
| `offer` | to propose a match | `from`, `to`, `pk`, `nonce`, `box` | `from`, `to`, `pk` |
| `answer` | to accept an offer; no answer means no | `from`, `to`, `nonce`, `box` | `from`, `to` |

The `box` of an offer or an answer holds `{ ts, nick, w, cand, saved, kn }`: the time, the nickname, the court's width, the address candidates (13.7), the standing saved against the other player (13.10), and a random nonce for the match key (13.8). It is sealed with `nacl.box` for the receiver from the sender's secret key, so only the receiver opens it and only the sender's key made it. `from` must be the code of `pk`. Addresses therefore never stand in the public topic. A box older than 60 s, or with a nonce seen before, is dropped. Anyone can post a `hello` in someone else's name, but nobody else can seal their box, so the court shows the nickname from the box; the one in a `hello` only serves `/volley friends`.

**Presence.** A player counts as in the lobby from their `hello` until their `bye`, or for 6 minutes after their last `hello`. The first poll on entering asks `since=6m`, later ones `since=<last id>`.

**Who enters.** A session enters the lobby when all of these hold: `online` is `friends` or `everyone`; the court opened by itself in a turn (not through `/volley`, 3.2); it has had its first click; the key helper is trusted (`keys.ok`, 6.12); the net helper has reported its candidates; and no other session on this machine holds the lobby (the lease below). It leaves with a `bye` when the court closes or `online` goes off. While paused or in a meeting it stays listed and does not answer offers.

**Pacing.**

* A poll every 6 s, and every 2 s for the 20 s after sending an offer or an answer. The mod keeps a bucket of its own like ntfy's (60, one more every 5 s), counts every request against it, and sends nothing while it is empty.
* A 429 stops all lobby traffic for the time its `Retry-After` names, else for 60 s, doubled at each 429 in a row up to 15 minutes. Any other failure waits 30 s. A request that has not resolved after 10 s is given up (P6 finds out what a hanging `fetch` does).
* At most 200 messages per UTC day and machine, counted in the store (`lobbyDay`), so one machine never uses up ntfy's 250 alone; others behind the same address share the rest.
* **Lease.** One session per machine searches. `lobbyLease` in the store names the session and a time; the holder renews it every 10 s, and it is free after 30 s without renewal. A session without the lease plays the AI only. Otherwise several sessions behind one address would drain the bucket together.

**Pairing.** Rules every mod follows alike:

* Candidates are the players present whose `ver` equals one's own, who are not oneself, not blocked, and allowed by both modes: in `friends` mode a player offers to and accepts only codes on their own friend list.
* Order: friends first, then players with whom one has an unfinished match, then everyone else; within each group the longest waiting (by their first `hello`) first. A candidate who let an offer run out is skipped for 2 minutes, a pair whose connection failed for 10 minutes.
* A player has at most one open offer. It runs out after 15 s without an answer.
* A player with no open offer and no meeting accepts the first acceptable offer they read, by answering it.
* A player with an open offer answers no other offer, with one exception: two players who offered to each other. Then the offer from the lower code stands, and the player with the higher code answers it.
* An answer leads straight to connecting (13.7). A pair that has not connected within 10 s goes back to the lobby.
* Accepted gap: an offer from a friend that comes while one's own offer to a stranger is open goes unanswered.

**Cost.** About four messages a match: an offer, an answer, and a share of the `hello` and the `bye`. With 200 a day a machine has room for about 50 matches and some ten hours in the lobby.

### 13.7 Connecting

**Candidates.** The net helper opens one UDP socket for IPv4 and one for IPv6, on ports the system picks, and reports its candidates:

* `host4`: its local IPv4 addresses (for players on the same network),
* `host6`: its global IPv6 addresses (no NAT there; a stateful firewall lets in the answer to an outgoing packet),
* `stun4`: its public IPv4 address and port, asked with a STUN binding request (RFC 5389: 20 bytes out, the address from the answer's `XOR-MAPPED-ADDRESS`) of `stun.l.google.com:19302` and `stun.cloudflare.com:3478`. When the two answers name different ports, the NAT maps per destination and punching will most likely fail; the helper says so (`A nat varies`).

While no meeting runs it asks again every 20 s, which also keeps the mapping open, and reports a change.

**Punching.** Once both sides have each other's candidates and the match key (13.8), both send probes to every candidate of the other every 50 ms for up to 10 s, and answer every probe that carries the session ID and a valid MAC. The first pair of addresses that has carried a probe and its answer both ways wins; when several do within the same 100 ms, IPv6 and the local network go before `stun4`. The helper then reports `C up <rtt> <delay>`, or after 10 s without a winner `C failed`.

**Expected.** Two players on one network connect through `host4`. Two homes with IPv6 connect through `host6` in most cases. Two homes on IPv4 connect when at least one NAT keeps one mapping per source port (most home routers). Both behind carrier grade or symmetric NAT (mobile hotspots, some cable and fibre lines on IPv4 only): no connection, and both play the AI. P5 measures which of these hold.

### 13.8 Lockstep: the net helper is the clock

The simulation is deterministic (6.3), so the two sides exchange inputs only, and each runs the same game.

* **Match key.** SHA-256 over the shared key of the two key pairs (`nacl.box.before`), the offer's `kn` and the answer's `kn`. Its first 4 bytes are the session ID; the rest keys an HMAC-SHA256 over every UDP packet, cut to 8 bytes. Both helper languages have HMAC-SHA256 in their standard library. A packet whose MAC fails is dropped unread.
* **Packets.** `WV`, the version, the kind, the session ID, the body, the MAC. Kinds: `probe` and `probe answer` (punching and the round trip), `inputs`, `bye`. An `inputs` packet carries the highest step the sender holds from the other side, then a run of its own inputs (the first step, then up to 32 inputs of one byte), and now and then a state hash (a step and 4 bytes). About 40 bytes, 60 a second each way: about 2.4 kB/s.
* **Input byte.** Bits 0 to 2 are A, D and W, as in the key mask (6.10). Bits 4 to 7 are the flags the mod asked for: 16 pause, 32 resume, 64 done (the turn ended), 128 leave.
* **Clock.** Once told to start, the helper ticks 60 times a second on a monotonic clock. At its tick `t` it takes the newest key mask of its child, adds the pending flags, and makes that its input for step `t + D`. Every tick it sends the inputs the other side has not acknowledged, at most 32, so a lost packet costs nothing as long as a later one arrives.
* **Release.** As soon as both inputs of the next step are known, in order, it writes `S <step> <you> <claude>`: the two input bytes in the order of the sim's sides (13.10). Neither side ever steps on a guessed input.
* **Delay `D`.** Picked by the helper of the `you` seat from the round trip measured while punching: `ceil((rtt / 2 + 20 ms) / 16.7 ms)`, at least 2 and at most 8 (33 to 133 ms). It travels in that helper's first `inputs` packet and is fixed for the meeting.
* **Stall.** A missing input holds the release, so both games stand still until it comes. Two clocks that drift apart wait on each other this way, so no clock sync is needed, and a side that starts later is waited for.
* **Lost.** No valid packet for 3 s: `C lost`, and the helper stops sending inputs.

### 13.9 The net helper (`helper/net.*`, `hooks/online/net.ts`)

| System | Script | Started through | Its child |
|---|---|---|---|
| Windows | `helper/net.ps1` | `powershell.exe` with the arguments of 6.12 | `keys.ps1` |
| WSL | `helper/net.ps1` | `powershell.exe`, the path from `wslpath -w` as in 6.12 | `keys.ps1` |
| Linux | `helper/net.py` | `python3` | `keys.py` |
| macOS | `helper/net.py` | the first real `python3` found (below) | `keys.js` through `osascript` |

* **Two implementations, one contract** (D22). The lines out, the control file in, the packets and the timings of 13.7 and 13.8 are the contract, as the line format is for the key helpers (6.12). `tools/netpair.ts` holds both to it (section 8).
* **The keys as its child.** The net helper starts the key helper of its system and reads its lines, and passes every `K`, `H` and `E` line on unchanged, so the court plays the AI through it exactly as through the key helper. The key helpers do not change and still open no connection. A key helper's walk up its parents passes the net helper and should still find the terminal (6.12); P5 checks that on Windows, the rounds of M20 elsewhere. The net helper ends its child when it ends; when it is killed, the child's own check of its parent ends it within one to four heartbeats.
* **macOS's `python3`.** `/usr/bin/python3` is a stub that raises the dialog to install the Xcode command line tools when they are missing, so the mod never runs it unchecked. It takes `/usr/bin/python3` only when `xcode-select -p` exits with 0, else the first of `/opt/homebrew/bin/python3`, `/usr/local/bin/python3` and `/Library/Frameworks/Python.framework/Versions/Current/bin/python3` that exists. With none, online play is off on that Mac, the hint row and `/volley` say why, and play against the AI goes on through `keys.js` alone.
* **When it runs.** With `online` on, the net helper takes the key helper's place and follows its rule (6.12): the court's posts start it, and it stops within about 1.5 s after they stop. During a meeting it stays until the meeting has ended, so a dialog does not cut the connection. Where no net helper can run (macOS without Python, a system whose net helper has not passed its round), the key helper runs as in version 1 and the mod stays out of the lobby.
* **Lines out** (stdout; readers ignore any other line, as in 6.12):
  * `K`, `H`, `E` from the child, unchanged.
  * `P <path>` once at the start: the control file.
  * `A <kind> <address> <port>`: a candidate (13.7), and `A nat <same|varies>`.
  * `C up <rtt> <delay>`, `C failed`, `C lost`.
  * `S <step> <you> <claude>`: one step (13.8).
  * `X <step> <hash>`: the other side's state hash.
  * `T <rtt> <lost>`: once a second while connected, the round trip and the packets lost in that second.
  * `N <word>` once, when the network cannot work (`noudp`, `nostun`). The helper then goes on as a key helper.
* **Control file in.** The mod's way to the helper while it runs, since its stdin closes after the start (5.1 row 19). The helper makes a file of its own in the system's temp folder (on Linux and macOS inside a folder only its user may read) and names it in its `P` line. The mod writes the whole file with `$.fs.write` (5.1 row 91): a number that only rises, one command per line, then `end`. The helper looks at the file every 20 ms, takes it only with its `end` line, and does the commands numbered above the last it did. Commands: `peer <session> <key> <seat> <candidates...>`, `start`, `flag <pause|resume|done|leave>`, `hash <step> <hash>`, `stop` (end the meeting and go on as a key helper). In WSL the mod writes through `wslpath -u` of the path. A file rather than a local port: from WSL the Windows side's `127.0.0.1` is out of reach in WSL's default network mode, and a port is open to every process on the machine, while the file is the user's alone. P5 measures the delay from writing to acting.
* **Test modes.** `-Script <file>` (`--script` for `net.py`) takes the key masks from a file instead of a child, and `-Drop <percent>` drops that share of the outgoing packets. With `WOBBLY_VOLLEY_NET_SCRIPT` set, the mod starts its helper with `-Script`, for a manual match against a scripted player.
* **What it does on the network.** STUN requests to the two servers, and UDP to and from the one player it was paired with. Nothing else. It stores nothing but its control file, which it deletes when it ends.

### 13.10 The online match (`core/online.ts`, `hooks/online/match.ts`)

* **Seats.** The player whose code sorts first takes the sim's `you` side, the other its `claude` side. Each mod knows its own seat, and the court mirrors the view of the `claude` seat (13.11). The names in the code stay: `Side` is the core's word for a side of the court.
* **Start.** The two boxes carry each side's court width and saved standing. The width is the smaller of the two, clamped as in 6.4, and fixed for the meeting. When both saved the same standing (each seen from its own side), the match goes on from it; when they differ, the one further on counts: the higher `number`, then the more points played; with none saved, a new match starts at 0:0. In a new match the `you` seat serves first in odd numbered matches and the `claude` seat in even ones. The meeting starts with the countdown at step 0.
* **Steps.** `stepOnline(online, you, claude)` turns the two input bytes into `Input`s (`run` = D minus A, `jump` = W, 6.5), applies the flags, then runs `tick` (6.4). It is pure and in the core, so both sides run the same function on the same bytes.
* **Pauses** (D21). Each seat has its own paused flag: `pause` sets it, `resume` clears it. The game runs only while neither is set (it dispatches `pause` when the first is set and `start` when the last clears, 6.4), so the countdown runs and play goes on where it stopped. After 900 paused steps in a row (15 s) the meeting ends as a leave. After the win screen the next match counts down by itself; nobody needs to click.
* **The mod's flags.** `pause`, for each reason of version 1 (6.8): Esc, the terminal leaving the front, a key without its press, the window losing the focus, `prompt.edit`. And for two reasons of its own: the court has not posted for 300 ms during a meeting (a dialog, `[-]`, a hidden band), and the court has no room for the match's width. `resume`, from a click on the court while this seat is paused. `done`, at the turn end of a court that opened by itself (6.9). `leave`, from `/volley block`, from `/volley off`, and when `online` goes off.
* **Turn end** (D5, D17). A `done` from a seat dispatches `turnDone` on both sides at the same step: the rally under way gets its cut of 600 steps (6.4), and at `rallyOver` the meeting ends. That player's court closes as in version 1. The other player goes back to the AI and the lobby.
* **Ends.** A meeting ends at `rallyOver` after a `done`, at the pause limit, at a `leave` (the rally void), at `C lost`, and at a hash mismatch (the rally void, logged with `$.ui.log(..., { to: 'debug' })`). In every case the mod writes `stop` and saves. A court still in play returns to its AI match with a countdown, since the keyboard is still the court's; a paused court returns to it paused and waits for its click; the court of a turn end closes.
* **Saving** (D17). After every point and at the end, the standing against this rival goes to the store (`rivals`, 13.12), from the player's own side. At a match end the result counts into the rival's record and into the record against people. Both sides save the same standings, since they run the same steps. The one gap: when the connection breaks, one side may have taken a few steps more, with a point among them. At the next meeting the start rule above takes the standing that is further on.
* **Hashes.** Every 60 steps each side hashes its game (`stateHash` in the core: FNV-1a over every number of the state as a 64 bit float, in a fixed order) and writes it as `hash`; the helper hands the other side's back as `X`. A mismatch ends the meeting.
* **Joining.** After `C up` the court holds its AI match once the AI rally under way is over, 10 s at most (D5's cut; a rally still running then is void). Then the mod writes `start`. The helper that starts first waits for the other (13.8), and the hint row says who waits for whom (13.11). When no step line has come 15 s after `start`, the mod gives the meeting up, and the pair is skipped for 2 minutes.

### 13.11 The court in online play (`hooks/court.tsx`, `core/draw.ts`)

* **Props** gain `online`: `null`, or `{ phase: 'joining' | 'playing', seat, rival (the name to show), ping, game (the online game, plain JSON as 6.3 keeps it), hint }`. While it is set, the court draws `online.game` instead of its own game and steps nothing. Its AI game waits where it stopped and goes on after the meeting.
* **The report** gains two counters that only rise: `clicks`, and `pauses` (a pause the court found: Esc, the front, the 150 ms rule, the focus, no room). The hooks module turns a rise into a `resume` or a `pause` flag.
* **Mirror.** `draw` gains `view.seat`. The blob of that seat is drawn in the human's colours (blue), the other in the AI's (orange), and for the `claude` seat the whole picture is mirrored, so each player sees themself on the left. Since a blob's art already faces the net, the mirrored picture looks right on both courts.
* **A narrower match.** The match's width may be smaller than the band. The court draws it centred and leaves the columns beside it blank. A band narrower than the match shows the line of 3.2 and sends `pause`.
* **Score row.** "You 3 : 5 Mia", then the ping ("34 ms"), then the record against Mia, within 60 columns.
* **Hints**, as examples (M18 fixes the words, each within 60 columns): "A and D run, W jumps. Looking for a player meanwhile." "Found Mia; connecting." "Mia joins after this rally." "Waiting for Mia's rally to end." "Mia paused; the match waits 15 s at most." "Mia left; the match is saved." "Could not connect to Mia; Jelly plays on."

### 13.12 Persistence

New keys in `$.store`, each one of its own, so sessions that write different ones do not overwrite each other (5.1 row 82):

| Key | Value |
|---|---|
| `identity` | `{ v: 1, pk, sk }`, in base64 |
| `nick` | the nickname, or none yet |
| `friends` | `{ [code]: { label, added } }` |
| `blocked` | `{ [code]: time }` |
| `rivals` | `{ [code]: { nick, pk, last, match: { v: 1, you, them, server: 'you' or 'them', number }, record: VolleyRecord } }`, from the player's own side; friends are always kept, of the others the 100 met last |
| `humans` | the record against people (`VolleyRecord`), beside `record`, which stays the record against the AI |
| `lobbyDay`, `lobbyLease` | the day's message count and the lease (13.6) |

The secret key lies in the store file like everything else there; whoever copies that file plays under the code. On the build machine Windows and WSL share the store (section 4), so both play under one code.

### 13.13 Commands and settings

* `online` in `/config`: a picker of `off`, `friends` and `everyone`, `off` by default (D20). `friends`: matched with friends only. `everyone`: friends first, then anyone. A change reloads the module (5.1 row 18), which ends a meeting under way as a lost connection does.
* `/volley code`: the code and the nickname, and the line a friend types to add them.
* `/volley name <nickname>`: sets the nickname, or says the rule.
* `/volley friend <code> [label]`, `/volley unfriend <code or label>`, and `/volley friends`, which lists each friend with label and nickname, the standing, when last met, and "in the lobby" when the last poll saw them.
* `/volley block`, `/volley block <code>`, `/volley unblock <code>`.
* `/volley opponents`: the last ten opponents with the standing and the record.
* `/volley stats`: as before, plus the record against people and the standing against the current or last opponent.
* `/volley reset` stays the AI match's. Standings against people are never reset by one side alone.

Every form answers in a short line or a few, as in version 1, with the court shown or hidden.

### 13.14 Privacy, trust and abuse

* What goes where (for the README). ntfy.sh sees the player's address and their lobby messages: the nickname, the public key, the mod's version, the mode, and the times one plays. The boxes it cannot open. The STUN servers see the address. The opponent sees the address. Nothing else leaves the machine, and with `online` off nothing at all.
* The net helper is a process of its own that starts only with `online` on. The key helpers keep the promise of 6.12.
* Everything from the lobby and the network is untrusted: lobby messages are read field by field and bounded in size, boxes must open, packets must carry the MAC, nicknames are cleaned (13.5), and input bytes are masked to their bits.
* A changed mod can still play by script or leave when it is losing. Records are each player's own and there is no ranking, so nothing is won by it. Anyone can write junk into the public topic or flood it: readers drop the junk, and a flood stops matchmaking, not the game.
* Blocking is per player and local. There is no report button, and nobody to report to.

### 13.15 Ways not taken

* **Other meeting points.** Nostr relays (WebSockets and secp256k1 signatures, neither within the mod's reach), public MQTT brokers (TCP or WebSockets), BitTorrent trackers and the DHT (binary protocols over UDP or WebSockets), Firebase or Supabase (accounts and keys of our own). ntfy.sh speaks plain HTTPS, which the mod reaches with `$.http.fetch` alone, in one implementation for every system.
* **The net helper streaming the lobby** instead of the mod polling: faster, but HTTPS in two languages (and Python's certificate store on macOS) for a gain of seconds, while the player has the AI meanwhile.
* **Rollback.** Smoother at a high ping, but it needs a second state, resimulation and a ball that visibly jumps when a guess was wrong. Lockstep comes first, and rollback can sit on the same input stream later.
* **The court owning the online match.** A dialog and `[-]` unmount it (5.1 row 45), and the steps reach the hooks module first.
* **A local port as the control channel.** Out of reach from WSL by default, and open to every process on the machine.
* **One compiled helper for every system.** One implementation instead of two, but binaries nobody can read, one per system and processor, and the README's promise of readable helpers gone.
* **Python on Windows too.** Windows ships no Python; PowerShell 5.1 is always there (section 4).
* **Python reading the keys on macOS** (the route the user accepted for D22, as first worded): the net helper running `keys.js` as its child does the same with less, and play against the AI on macOS then needs no Python.
