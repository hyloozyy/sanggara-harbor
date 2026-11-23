// Deterministic screenshot scenes (?shot=cover|combat|drive|menu|test): seeds the world, stages a
// moment of play with the real systems (missions, police, traffic, combat), simulates it with a
// fixed time step, renders, and flags window.__shotReady for the capture script.
import { rng } from '../core/rng.js';
import { MISSIONS } from '../missions/mission-scripts.js';
import { Combatant } from '../combat/combatant-ai.js';

const DT = 1 / 30;

function simulate(session, seconds, perStep = () => {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    perStep(i * DT);
    session.update(DT);
    session.input.endFrame();
  }
}

function startMissionAt(session, id, stageIndex) {
  const m = MISSIONS.find((x) => x.id === id);
  for (const x of MISSIONS) { if (x === m) break; session.missions.completed.add(x.id); }
  session.missions.start(m);
  while (session.missions.active && session.missions.active.stageIndex < stageIndex) session.missions.nextStage();
  session.dialogue.clear();
}

function finish(session, gfx) {
  session.hud.update(DT, session.hudState());
  session.minimap.draw(DT, session.minimapState());
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      gfx.render(12.5);
      if (++n < 2) requestAnimationFrame(tick);
      else { window.__shotReady = true; resolve(); }
    };
    requestAnimationFrame(tick);
  });
}

const SCENES = {
  // Everything at once: a 3-star chase with the helicopter, mission panel, traffic and people.
  async cover(session, gfx) {
    const s = session;
    s.player.arsenal.give('pistol', 60); s.player.arsenal.give('smg', 120);
    s.progression.money = 18450000; s.progression.xp = 2650;
    s.crew.unlock('dimas'); s.crew.unlock('lastri');
    s.start({});
    startMissionAt(s, 'kontainer-27', 3);
    const v = s.missions.active.vehicle;
    // Put the evidence pickup on Jalan Pantai Senja heading west into the sunset.
    v.pos.set(-30, 0, 317.4); v.heading = -Math.PI / 2; v.vel.set(-24, 0, 0);
    s.player.tryEnterExit(s);
    s.wanted.setLevel(3, 'Pencurian di pelabuhan');
    for (let i = 0; i < 3; i++) {
      const u = s.police.spawnCar('car', v.pos.x, v.pos.z, null);
      if (u) { u.vehicle.pos.set(-30 + 16 + i * 11, 0, 317.4 + (i % 2 ? 3.4 : -1.5)); u.vehicle.heading = -Math.PI / 2; u.vehicle.vel.set(-25, 0, 0); }
    }
    s.traffic.populate(-60, 300, 22);
    s.peds.populate(-60, 300, 34);
    s.radio.index = 3; s.radio.on = true;
    s.cameraRig.yaw = -Math.PI / 2 + 0.38; s.cameraRig.pitch = 0.17; s.cameraRig.idleMouse = 0;
    simulate(s, 2.6, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0;
    });
    s.input.simulateHold('KeyW', false);
    s.police.heli.pos.set(v.pos.x - 14, 34, v.pos.z - 16);
    s.police.heli.update(0.01, { x: v.pos.x, z: v.pos.z }, s.wanted.lastKnown, true);
    s.dialogue.say('dimas', 'Polisi di mana-mana! Lewat pantai, Rak!');
    s.dialogue.update(0.01);
    await finish(s, gfx);
  },

  async test(session, gfx) {
    session.start({});
    session.missions.start(session.missions.nextMission);
    simulate(session, 1.0);
    await finish(session, gfx);
  },
};

export async function stageScreenshot(name, ctx) {
  rng.reseed(Number(ctx.params.get('seed') || 7));
  ctx.session.input.enabled = true;
  const scene = SCENES[name] || SCENES.test;
  void Combatant;
  await scene(ctx.session, ctx.gfx, ctx);
}
