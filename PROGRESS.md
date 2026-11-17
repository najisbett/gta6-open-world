# Salt & Neon - progress log

| Iteration | Change | Measured effect |
|---|---|---|
| A1 | City grid, roads, buildings, palms, sky, vehicles, traffic, pedestrians, camera, HUD, minimap | boots in headless Chrome, cover/hud shots render (see screenshots/) |
| A2 | Lighting intensities scaled for physical units; car glass inset | cover brighter; roof no longer black |
| B1 | combat.js (hitscan from crosshair, melee, explosions), police.js (cruisers, road routing, dismount), gunmen.js, wanted.js heat + line-of-sight loss | probe: crime heat 6 -> 3 stars, 4 cruisers spawned; 1 shot hit a pedestrian (hp 30 -> 2) and raised heat to 1.7 |
| B2 | chase shot scripted (3 cruisers behind player, copSpeed override), traffic speed cap lifted for police | chase.jpg 111 KB shows 3 stars, minimap police blips |
