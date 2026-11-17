# Salt & Neon - progress log

| Iteration | Change | Measured effect |
|---|---|---|
| A1 | City grid, roads, buildings, palms, sky, vehicles, traffic, pedestrians, camera, HUD, minimap | boots in headless Chrome, cover/hud shots render (see screenshots/) |
| A2 | Lighting intensities scaled for physical units; car glass inset | cover brighter; roof no longer black |
| B1 | combat.js (hitscan from crosshair, melee, explosions), police.js (cruisers, road routing, dismount), gunmen.js, wanted.js heat + line-of-sight loss | probe: crime heat 6 -> 3 stars, 4 cruisers spawned; 1 shot hit a pedestrian (hp 30 -> 2) and raised heat to 1.7 |
| B2 | chase shot scripted (3 cruisers behind player, copSpeed override), traffic speed cap lifted for police | chase.jpg 111 KB shows 3 stars, minimap police blips |
| C1 | missions.js + missionData.js (6-mission chain, dialogue, steal/drive/goto/kill/collect/lose/talk), save.js, shops.js, pickups.js, activities.js (race), menus.js, audio.js (WebAudio synth), gameFlow.js | scripted play-through: all six missions reach done=true; menu/pause/shop/save-load/respawn probe passes |
| C2 | shots: cover (traffic + crowd), chase, hud, mission with camera overrides; HUD dialogue no longer overlaps place label | 4 JPEGs 111-135 KB, distinct md5; cover shrunk to 768x480 keeps HUD readable |
| D1 | police.js: `boxIn` (predictive intercept, 4 box-in slots), last-known position seeded on a new crime and extrapolated by 2 s of player velocity (fixes cruisers routing to node 0,0 when unseen) | probe, wanted 3, player coasting: first cruiser within 15 m at 4.9 s, closest 2 m, 416 boxed frames, slots 0-3 all used, player HP 100 -> -2 by 25 s; on foot: 4 officers dismounted, HP 100 -> -5 in 40 s |
| D2 | streetDecor.js: crosswalks, stop lines, awnings, neon signboards, 2 blade signs, parked cars with colliders, benches/bins/hydrants/mailboxes/bus stops, rooftop clutter; warmer, lower sun and less fill light | draw calls cover/chase/hud/mission 89/131/100/108 -> 114/145/126/143; triangles ~410k -> ~600-627k; JS render ms about the same (software GL, not GPU time) |
