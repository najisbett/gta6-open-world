# SALT & NEON - Port Halcyon

An original open-world crime game that runs in a desktop browser from static files (three.js, ES modules, no network, no audio files).
Play as Juno Reyes, fresh off the ferry in a sun-soaked coastal city: walk and drive through a grid city with traffic, pedestrians and
signals, steal cars, shoot it out, shake the Port Halcyon PD, and work a six-mission story for Dessa Okoye.

Run it: `node serve.ts` then open http://localhost:8080 (any static server over `game/` works).
Hand-in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

Controls: WASD move/drive, mouse look, Shift sprint, Space jump/handbrake, E enter/exit/use, LMB fire, RMB aim, 1-4/Q/wheel weapons,
Enter dialogue, P/Esc pause, M music. Arrow keys orbit the camera when the mouse is not captured.

`?shot=cover|chase|hud|mission` renders a deterministic scene (fixed seed, hour and scripted controls) used for the screenshots.
Source map: `game/src/` - one job per file (city layout/render, sky, vehicles, traffic, pedestrians, combat, police, missions, shops, HUD, audio...).
