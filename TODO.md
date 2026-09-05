# Westie in the Park — feature ideas

Keep the park playful, procedural, offline, and comfortable at dog-eye height. Implement one feature at a time and verify it in the browser before expanding it.

## Wet-dog chaos — first implementation

- [x] Track wetness after spending time in the pond.
- [x] Shake automatically after leaving the water and slowing down.
- [x] Animate chest, head, ears, and tail over the existing walk pose.
- [x] Spray procedural droplets without shaking the camera; reduce the effect in comfort mode.
- [x] Leave alternating wet pawprints on gravel, fading over 12 seconds, with a bounded pool.
- [ ] Tune the effect against different locally loaded Ludo models.
- [ ] Add subtle damp-fur shading while preserving the white coat and model-replacement disposal rules.
- [ ] Consider a dedicated shake sound and a manual shake action.

## Free-orbit controls — implemented

- [x] Independent camera and character heading as a fourth camera mode.
- [x] Mouse/right-side touch orbit; A/D/left stick turn Ludo.
- [ ] Consider an optional camera-relative movement scheme later.

## An owner on a bench

- Return the ball to the owner for another throw.
- Earn a treat or head scratch; keep first-person interaction readable.
- Consider a catch-at-apex reward.

## Digging spots

- Follow scent to buried toys and sticks.
- Sometimes uncover something useless, with a playful reaction.
- Use local soil deformation or pooled dirt particles, with bounded persistence.

## Other dogs

- Meet a shy spaniel or an enthusiastic lab.
- Exchange sniffs and play chase, with distinct temperaments and safe obstacle avoidance.
- Establish a procedural model approach before adding dependencies or external assets.

## Oversized stick

- Carry a comically large stick.
- Let it catch on the gazebo entrance; make the collision understandable and recoverable.

## Evening mode

- Gradual sunset, dusk, lantern glow, crickets, and fireflies.
- Coordinate sky, light, fog, and sound; avoid expensive per-lantern shadow maps.

## Westie business

- Investigate the hydrant with tremendous seriousness.
- Add an optional sniff/mark interaction and a small animation or reward.

## Photo mode

- Freeze a leap, hide the HUD, and orbit the camera.
- Export an image and restore camera, pause, and input state correctly on exit.

## Further realism polish

- Improve shallow-water coloration and reflections; consider ducks or a footbridge.
- Improve wildlife navigation around water and furniture.
- Add more natural idle/run clips if compatible rigged clips become available.
- Refresh README screenshots after the visual design settles.
- Profile desktop and mobile before increasing detail budgets further.
