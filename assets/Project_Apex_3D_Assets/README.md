# Project Apex — lightweight 3D assets

Curated for a Babylon.js browser racing prototype. The individual `.glb` files below are the recommended starting point; load and reuse repeated track pieces rather than duplicating geometry/materials.

## Vehicles (`vehicles/kenney-glb/`)

- `hatchback-sports.glb` — lightweight sports-hatch placeholder.
- `sedan-sports.glb` — second car option.
- `race.glb` — racing-style placeholder.
- `wheel-racing.glb`, `wheel-default.glb` — reusable wheel models.

These five files total approximately 0.6 MB. They are a compact stylized placeholder set, not photorealistic coupe models; they do not promise independently rigged steering pivots. For the final car, verify wheel mesh hierarchy and pivots in Blender before wiring steering/rotation.

Source pack: Kenney Car Kit, https://kenney.nl/assets/car-kit
License: CC0. The downloaded original pack is retained as `vehicles/kenney_car-kit.zip`; the license text is beside the curated GLBs.

## Track and scenery (`tracks/kenney-racing-glb/`)

- `track-straight.glb`, `track-corner.glb`, `track-finish.glb`, `track-bump.glb` — modular test-track pieces.
- `decoration-forest.glb` — reusable forest scenery.

These are compact GLBs (roughly 0.35 MB combined). Repository: https://github.com/KenneyNL/Starter-Kit-Racing. Its README states the included 3D models are CC0; the source project code is MIT. Both the README and MIT notice are included here. Treat the models as the advertised CC0 art and preserve the project notice if you copy code or code-derived content.

## Optional source archive

`tracks/modular-racetrack-collection.zip` contains about 178 KB of modular OBJ/MTL track pieces. It is *not* in the curated folders because the source page did not state a clear license. Review the creator's terms before using or redistributing it. It is not GLB and will need import/conversion before Babylon.js use.

All sizes are compressed file sizes. This folder does not imply that the models meet the PRD's 15k–35k triangle target; inspect triangle counts and pivots before selecting the production vehicle. For lowest runtime cost, instance repeat scenery, reuse materials, and consider mesh compression after testing.
