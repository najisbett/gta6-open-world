# Salt & Neon - progress log

| Iteration | Change | Measured effect |
|---|---|---|
| A1 | City grid, roads, buildings, palms, sky, vehicles, traffic, pedestrians, camera, HUD, minimap | boots in headless Chrome, cover/hud shots render (see screenshots/) |
| A2 | Lighting intensities scaled for physical units; car glass inset | cover brighter; roof no longer black |
| B1 | combat.js (hitscan from crosshair, melee, explosions), police.js (cruisers, road routing, dismount), gunmen.js, wanted.js heat + line-of-sight loss | probe: crime heat 6 -> 3 stars, 4 cruisers spawned; 1 shot hit a pedestrian (hp 30 -> 2) and raised heat to 1.7 |
| B2 | chase shot scripted (3 cruisers behind player, copSpeed override), traffic speed cap lifted for police | chase.jpg 111 KB shows 3 stars, minimap police blips |
| C1 | missions.js + missionData.js (6-mission chain, dialogue, steal/drive/goto/kill/collect/lose/talk), save.js, shops.js, pickups.js, activities.js (race), menus.js, audio.js (WebAudio synth), gameFlow.js | scripted play-through: all six missions reach done=true; menu/pause/shop/save-load/respawn probe passes |
| C2 | shots: cover (traffic + crowd), chase, hud, mission with camera overrides; HUD dialogue no longer overlaps place label | 4 JPEGs 111-135 KB, distinct md5; cover shrunk to 768x480 keeps HUD readable |
