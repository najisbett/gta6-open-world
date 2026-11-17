# SALT & NEON - Port Halcyon

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/najisbett/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/najisbett/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game that runs in a desktop browser from static files (three.js, ES modules, no network, no audio files).
Play as Juno Reyes, fresh off the ferry in a sun-soaked coastal city: walk and drive through a grid city with traffic, pedestrians and
signals, steal cars, shoot it out, shake the Port Halcyon PD, and work a six-mission story for Dessa Okoye.

Run it: `node serve.ts` then open http://localhost:8080 (any static server over `game/` works).
Serve locally: from the repo root run `node serve.ts` (serves `game/` on 127.0.0.1:8080; pass `--port 9000` to change the port), then open `http://localhost:8080/?shot=cover` for a fixed scene or the bare URL to play.
Hand-in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

Controls: WASD move/drive, mouse look, Shift sprint, Space jump/handbrake, E enter/exit/use, LMB fire, RMB aim, 1-4/Q/wheel weapons,
Enter dialogue, P/Esc pause, M music. Arrow keys orbit the camera when the mouse is not captured.

`?shot=cover|chase|hud|mission` renders a deterministic scene (fixed seed, hour and scripted controls) used for the screenshots.
The page sets `window.__shotReady` once the scene has rendered. The four scene names:
- `cover` - red car driving down a palm-lined avenue at sunset, no wanted level (`screenshots/1-cover.jpg`).
- `chase` - three-star police chase through an intersection (`screenshots/2-chase.jpg`).
- `hud` - on foot with the Hornet SMG, armor bar and crosshair (`screenshots/3-hud.jpg`).
- `mission` - "Welcome to Halcyon" mission banner with Dessa Okoye's dialogue box (`screenshots/4-mission.jpg`).
Capture them with `node tools/capture.mjs cover chase hud mission` (headless Chrome, writes JPEGs to `screenshots/`).
Source map: `game/src/` - one job per file (city layout/render, sky, vehicles, traffic, pedestrians, combat, police, missions, shops, HUD, audio...).
