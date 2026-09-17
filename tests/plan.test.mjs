import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, existsSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildHandoff, validatePlan, exportHandoff} from '../scripts/plan.mjs';

const example = () => JSON.parse(readFileSync(new URL('../assets/example.plan.json', import.meta.url), 'utf8'));
test('final frame schedule generates manual seconds and gap-free replay segments', () => {
  const plan = example();
  assert.deepEqual(validatePlan(plan), []);
  const {publicData, privateNotes} = buildHandoff(plan);
  assert.deepEqual(publicData.breaks.map(b => b.atSec), [29, 59]);
  assert.deepEqual(publicData.segments.map(s => [s.startSec, s.endSec]), [[0, 29], [29, 59], [59, 90]]);
  assert.equal(publicData.importSupported, false);
  assert.match(privateNotes, /구간 2 시작 정지점/);
  assert.match(privateNotes, /구간 3 시작 정지점/);
});
test('timing change regenerates every downstream break and total duration', () => {
  const plan = example();
  plan.durationFrames += 300;
  plan.scenes[0].endFrame += 300;
  plan.scenes[0].holds.forEach(h => { h.startFrame += 300; h.endFrame += 300; });
  for (const scene of plan.scenes.slice(1)) {
    scene.startFrame += 300; scene.endFrame += 300;
    scene.narration.startFrame += 300; scene.narration.endFrame += 300;
    scene.holds.forEach(h => { h.startFrame += 300; h.endFrame += 300; });
  }
  plan.breaks.forEach(b => b.atFrame += 300);
  const {publicData} = buildHandoff(plan);
  assert.deepEqual(publicData.breaks.map(b => b.atSec), [39, 69]);
  assert.equal(publicData.durationSec, 100);
});
test('public handoff excludes notes, source material and unknown private fields', () => {
  const plan = example();
  plan.breaks[0].presenterNotes = 'PRIVATE_SENTINEL';
  plan.privateNotes = 'PRIVATE_SENTINEL';
  plan.scenes[0].narration.text = 'PRIVATE_SENTINEL';
  plan.sources[0].label = 'PRIVATE_SENTINEL';
  const {publicData, manual, privateNotes} = buildHandoff(plan);
  assert.ok(!JSON.stringify(publicData).includes('PRIVATE_SENTINEL'));
  assert.ok(!manual.includes('PRIVATE_SENTINEL'));
  assert.ok(privateNotes.includes('PRIVATE_SENTINEL'));
});
test('rejects a break at a transition, inside speech, or off the tenth-second grid', () => {
  for (const atFrame of [900, 820, 871]) {
    const plan = example(); plan.breaks[0].atFrame = atFrame;
    assert.ok(validatePlan(plan).length, `should reject ${atFrame}`);
  }
  const plan = example(); plan.scenes[0].narration.endFrame = 850;
  assert.ok(validatePlan(plan).some(e => e.includes('overlaps narration')));
});
test('rejects gaps, duplicate identifiers, missing holds and past-end breaks', () => {
  const changes = [
    p => p.scenes[1].startFrame++,
    p => p.scenes[1].id = p.scenes[0].id,
    p => p.scenes[1].holds[0].id = p.scenes[0].holds[0].id,
    p => p.breaks[0].holdId = 'missing',
    p => p.breaks[1].atFrame = p.durationFrames,
    p => p.fps = 29.97,
    p => p.scenes[0].evidenceIds = ['missing'],
  ];
  for (const change of changes) { const plan = example(); change(plan); assert.ok(validatePlan(plan).length); }
});
test('malformed inputs return errors without crashing', () => {
  for (const input of [null, [], {}, {scenes:[null], breaks:[null], sources:[null]}, {scenes:[{holds:[null]}]}]) {
    assert.ok(validatePlan(input).length);
  }
});
test('video-only plan is allowed, but unknown effects and empty narration are rejected', () => {
  const plan = example(); plan.breaks = [];
  assert.deepEqual(validatePlan(plan), []);
  assert.equal(buildHandoff(plan).publicData.segments.length, 1);
  plan.scenes[0].effect.id = 'not-an-effect'; plan.scenes[1].narration.text = '';
  assert.ok(validatePlan(plan).length >= 2);
});
test('export produces separate files and never overwrites an existing directory', () => {
  const parent = mkdtempSync(join(tmpdir(), 'explainer-test-'));
  const out = join(parent, 'handoff');
  exportHandoff(example(), out);
  assert.ok(existsSync(join(out, 'public-breaks.json')));
  assert.ok(existsSync(join(out, 'manual-breaks.md')));
  assert.ok(existsSync(join(out, 'presenter-notes.private.md')));
  if (process.platform !== 'win32') assert.equal(statSync(join(out, 'presenter-notes.private.md')).mode & 0o777, 0o600);
  assert.throws(() => exportHandoff(example(), out), /EEXIST/);
  const invalid = example(); invalid.breaks[0].atFrame = 1;
  assert.throws(() => exportHandoff(invalid, join(parent, 'invalid')));
  assert.ok(!existsSync(join(parent, 'invalid')));
});
