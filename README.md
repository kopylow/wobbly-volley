# Wobbly Volley

A mod for Claude Code: a small volleyball game in the style of Blobby Volley, played in the band above the prompt while Claude works. Waiting time becomes play time.

A few seconds into a long turn the court opens above the prompt, paused. One click, and you play a rally against the AI with A, D and W. When Claude is done, the rally plays out, the court closes, and the standing waits for the next turn.

Wobbly Volley is a fan project. It is not made, endorsed or supported by Anthropic.

## Install

Type this at the prompt of a Claude Code session in a terminal:

```
/plugin install wobbly-volley --marketplace kopylow/wobbly-volley
```

Answer `y` to add the marketplace, pick a scope (the user scope comes first, Enter takes it), and set the three options or keep their defaults. Claude Code then says "Installed wobbly-volley. Plugin is now active."

From your shell the same install is `claude plugin install wobbly-volley --marketplace kopylow/wobbly-volley` (Claude Code 2.1.292 or later).

## What it needs

* **Claude Code in a terminal, in its fullscreen layout.** That layout is the default, and it is the one that reports the clicks the game starts with. Under tmux, or with `CLAUDE_CODE_NO_FLICKER=0`, Claude Code draws on the main screen and reports no clicks.
* **Windows, or WSL on Windows.** The game reads held keys through a small helper script (see [The key helper](#the-key-helper)), and so far the helper is tested on these two only. On Linux and macOS the mod loads and says in one line that there is no game yet.
* **A window of at least 60 columns, and a tall one.** The band gets at most half of the terminal's rows. The court wants 26 of them and shrinks down to 18. With less room the band says which way the window is too small, and the game waits.
* **Claude Code 2.1.287 or later**, the first build that runs mods by default. The game was built and tested with 2.1.296. The mod API may still change between releases, so a later build can break it until the mod catches up.

## How to play

* The court opens by itself about 5 seconds into a turn, paused. Until you click, typing still goes to the prompt.
* A click starts a countdown of three beats, then the rally. From then on the keyboard is the game's.
* **A** and **D** run while held. **W** jumps, and a longer hold jumps higher. The mouse only clicks: start, resume, the next match.
* **Esc once** hands the keyboard back to the prompt and pauses the game. A click resumes it where it stopped. Careful: a second Esc is Claude Code's own and interrupts the running turn.
* The game also pauses when the terminal window loses the focus, and when you type into the prompt.
* A permission prompt or a question from Claude takes the court away at once. It comes back paused when the dialog is gone, and the rally is served again.
* When Claude is done, the hint row says so, the rally under way plays out (10 seconds at most), and the court closes. The standing is kept.
* `[-]` beside the band collapses it, and `/volley` hides the court.

## Rules

* Rally scoring: every rally gives a point. A match goes to 11 and is won with two clear.
* At most three touches per side.
* The ball hovers above the server until it is touched, so nobody is rushed. The winner of a rally serves next. You serve first in every match.
* A rally the court closes on is void and served again. So is a rally during which the window is resized.
* The match carries over between turns and sessions, and an all time record of matches and points is kept.

## Your opponents

You play the blue blob on the left. The AI plays the orange one on the right, under a name of its own at each level:

| Level | Name | How it plays |
|---|---|---|
| easy | Pudding | Slow to react, aims loosely, rarely jumps. |
| medium | Jelly | Sends most balls back over the net. |
| hard | Gummy | Quick, and places the ball away from you. |

The level is a row in `/config`. Changed during a match, the new opponent takes over the score.

## The command

| | |
|---|---|
| `/volley` | Shows or hides the court, at any time, also outside a turn. A court opened this way stays until you hide it. |
| `/volley off` | Hides the court and keeps it from opening by itself for the rest of the session. |
| `/volley on` | Undoes that and shows the court. |
| `/volley reset` | Starts the next match at 0 : 0. The record stays. |
| `/volley stats` | The standing and the all time record in one line. |

## Settings

In `/config`:

| Setting | Default | |
|---|---|---|
| Show the court during long turns | on | Switched off, the court opens only through `/volley`. |
| Delay before the court opens | 5 | Seconds into a turn, 0 to 60. |
| AI level | medium | easy, medium or hard. |

## The key helper

Know this part before you install: to let you play, the mod starts a process that reads key state.

**Why.** A Claude Code mod is told when a key is pressed and never when it is released, so by itself it cannot know that you still hold A. The helper asks the system for the real state of the keys and passes it to the game.

**What it does, on every system:**

* It looks at four keys only: A, D, W and Esc.
* It looks only while the terminal that runs Claude Code is the window in front. With another window in front it reports nothing.
* It stores nothing and opens no network connection. All it produces is lines like `K 16 1791817235044` (which of the four keys are down, whether the terminal is in front, and when) on its standard output, which only the mod reads.
* It runs only while the court is shown. It stops within about 1.5 seconds after the court hides, and it ends with the session.

The scripts are short and sit in `helper/`. Read them before you trust them. You can also list what the mod hooks and calls without running it: clone the repository and run `claude plugin validate .` in it. Its `calls:` line names `$.process.spawn`, which is the helper's start.

| System | Helper | What held keys need | Tested |
|---|---|---|---|
| Windows | `helper/keys.ps1` | Windows PowerShell 5.1, which Windows ships. The script compiles a few lines of C# and calls `GetAsyncKeyState` and `GetForegroundWindow`. | Yes, on Windows 11 with Windows Terminal. |
| WSL | The same `keys.ps1`, started from Linux through `powershell.exe`, because the keyboard of a WSL session belongs to Windows. | `powershell.exe` and `wslpath` reachable from the distribution, which is the default. | Yes, in Ubuntu 24.04 under Windows Terminal, with the mod in a folder under `/mnt/c`. From a folder in the Linux home, where an install puts it, only the helper's start was checked. |
| Linux | `helper/keys.py` | Python 3.7 or later. On X11 `libX11`, on Wayland your user in the `input` group. | No. Written, not tested, and the mod does not start it yet: no game on Linux for now. |
| macOS | `helper/keys.js`, run by `osascript` | Possibly the Input Monitoring permission for the terminal app. | No. Written, not tested, and the mod does not start it yet: no game on macOS for now. |

More to know:

* On Windows the helper is started with `-ExecutionPolicy Bypass`. That holds for this one process, changes no setting, and is there for machines whose policy forbids script files.
* A script that reads key state can look suspicious to an antivirus tool. Microsoft Defender raised nothing in testing. The first start on a machine can take several seconds while the scanner has its look. Later starts take about half a second.
* On Wayland, once Linux ships, reading keys needs the `input` group, and membership in that group lets every program of that user read all keys. The mod never asks for root and never changes a group. Without the group the helper says so and exits.
* Where no helper can work (Linux and macOS for now, a session over SSH) there is no game, and the band says why in one line, for example "Wobbly Volley needs its key helper to read held keys, and there is none for this system yet."
* There is no mode without the helper. If you would rather not run a process that reads key state, do not install the mod.

## Where it does not run

* The desktop app, VS Code and the web. The mod draws nothing there: version 1 is for the terminal.
* There is no sound.

## Development

```
git clone https://github.com/kopylow/wobbly-volley.git
cd wobbly-volley
claude --plugin-dir .
```

`dev.ps1` and `dev.sh` do the same from any folder. The checks are `claude plugin validate .` and `claude plugin test .`. `PLAN.md` is the build plan, with every decision, measurement and finding.

A mod loaded from a folder and the installed one keep their standings and settings apart, so the score does not move over when you switch from one to the other.

## Contributing

Changes are welcome as pull requests to this repository. If you fix or improve something, please send it back here, so everyone who plays gets it.

## License

MIT, see [LICENSE](LICENSE).
