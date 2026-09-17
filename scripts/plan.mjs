import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const EFFECTS = new Set([
  'keyword-reveal', 'card-focus', 'aligned-compare', 'before-after',
  'flow-trace', 'bottleneck', 'quantity-fill', 'timeline', 'relationship-map',
  'evidence-callout', 'screen-focus', 'context-cutaway', 'visual-metaphor',
  'reframe', 'recap-build', 'question-hold',
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const frame = value => Number.isSafeInteger(value) && value >= 0;
const overlap = (a, b) => a.startFrame < b.endFrame && b.startFrame < a.endFrame;
const validRange = value => object(value) && frame(value.startFrame) && frame(value.endFrame) && value.startFrame < value.endFrame;

export function validatePlan(plan) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  if (!object(plan)) return ['Plan must be an object'];
  check(plan.version === 1, 'version must be 1');
  for (const key of ['title', 'language', 'finalSegmentTitle']) check(text(plan[key]), `${key} is required`);
  const fpsOk = Number.isSafeInteger(plan.fps) && plan.fps > 0 && plan.fps <= 240;
  const durationOk = frame(plan.durationFrames) && plan.durationFrames > 0;
  check(fpsOk, 'fps must be a positive integer at most 240');
  check(durationOk, 'durationFrames must be a positive safe integer');
  const sources = Array.isArray(plan.sources) ? plan.sources : [];
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const breaks = Array.isArray(plan.breaks) ? plan.breaks : [];
  check(Array.isArray(plan.sources), 'sources must be an array');
  check(scenes.length > 0, 'scenes must be a non-empty array');
  check(Array.isArray(plan.breaks), 'breaks must be an array, empty is allowed');
  const sourceIds = new Set(), sceneIds = new Set(), holdIds = new Set(), breakIds = new Set();
  const holds = new Map(), narrations = [];
  const unique = (item, set, label) => {
    check(text(item.id) && !set.has(item.id), `${label}: id must be non-empty and unique`);
    if (text(item.id)) set.add(item.id);
  };
  for (const [i, source] of sources.entries()) {
    if (!object(source)) { errors.push(`source ${i}: must be an object`); continue; }
    unique(source, sourceIds, `source ${i}`);
    check(text(source.label), `source ${i}: label is required`);
    check(['reference', 'provided', 'illustrative'].includes(source.kind), `source ${i}: invalid kind`);
    if (source.url !== undefined) {
      try { check(['https:', 'http:'].includes(new URL(source.url).protocol), `source ${i}: URL must use http(s)`); }
      catch { errors.push(`source ${i}: invalid URL`); }
    }
  }
  let expectedStart = 0;
  for (const [i, scene] of scenes.entries()) {
    if (!object(scene)) { errors.push(`scene ${i}: must be an object`); continue; }
    const label = `scene ${scene.id ?? i}`;
    unique(scene, sceneIds, label);
    check(validRange(scene), `${label}: invalid frame range`);
    check(scene.startFrame === expectedStart, `${label}: scene ranges must be contiguous from zero`);
    expectedStart = scene.endFrame;
    check(text(scene.message), `${label}: message is required`);
    check(object(scene.effect) && EFFECTS.has(scene.effect.id) && text(scene.effect.reason), `${label}: known effect and reason are required`);
    check(Array.isArray(scene.evidenceIds) && scene.evidenceIds.every(id => sourceIds.has(id)), `${label}: evidenceIds must reference sources`);
    if (!validRange(scene.narration)) errors.push(`${label}: narration range is required`);
    else {
      check(scene.narration.startFrame >= scene.startFrame && scene.narration.endFrame <= scene.endFrame, `${label}: narration must be inside scene`);
      narrations.push(scene.narration);
    }
    check(text(scene.narration?.text), `${label}: standalone narration text is required`);
    check(Array.isArray(scene.holds), `${label}: holds must be an array`);
    let previousEnd = scene.startFrame;
    for (const [j, hold] of (Array.isArray(scene.holds) ? scene.holds : []).entries()) {
      if (!object(hold)) { errors.push(`${label} hold ${j}: must be an object`); continue; }
      unique(hold, holdIds, `${label} hold ${j}`);
      check(validRange(hold), `${label} hold ${j}: invalid frame range`);
      check(hold.startFrame >= scene.startFrame && hold.endFrame <= scene.endFrame, `${label} hold ${j}: must be inside scene`);
      check(hold.startFrame >= previousEnd, `${label}: holds must be ordered and non-overlapping`);
      previousEnd = hold.endFrame;
      check(text(hold.heading), `${label} hold ${j}: heading is required`);
      check(hold.audio === 'quiet', `${label} hold ${j}: audio must be quiet`);
      if (text(hold.id)) holds.set(hold.id, hold);
    }
  }
  check(expectedStart === plan.durationFrames, 'Final scene must end at durationFrames');
  for (const hold of holds.values()) {
    check(!narrations.some(n => overlap(n, hold)), `hold ${hold.id}: overlaps narration`);
  }
  let previousBreak = 0;
  for (const [i, item] of breaks.entries()) {
    if (!object(item)) { errors.push(`break ${i}: must be an object`); continue; }
    const label = `break ${item.id ?? i}`;
    unique(item, breakIds, label);
    check(frame(item.atFrame), `${label}: atFrame must be a non-negative integer`);
    check(item.atFrame > previousBreak && item.atFrame < plan.durationFrames, `${label}: must be an ordered interior point`);
    check(text(item.completedTitle), `${label}: completedTitle is required`);
    check(typeof item.presenterNotes === 'string', `${label}: presenterNotes must be a string`);
    const hold = holds.get(item.holdId);
    check(Boolean(hold), `${label}: unknown holdId`);
    if (fpsOk && frame(item.atFrame)) {
      check(Number.isSafeInteger(item.atFrame * 10) && item.atFrame * 10 % plan.fps === 0, `${label}: time must align to both a frame and 0.1 second; do not round silently`);
      check(item.atFrame - previousBreak >= Math.ceil(plan.fps * 0.5), `${label}: segment must be at least 0.5 second`);
      const margin = Math.ceil(plan.fps * 0.6);
      if (hold) check(item.atFrame - margin >= hold.startFrame && item.atFrame + margin < hold.endFrame, `${label}: needs a stable quiet hold covering +/- 0.6 second`);
    }
    previousBreak = item.atFrame;
  }
  if (fpsOk && durationOk) check(plan.durationFrames - previousBreak >= Math.ceil(plan.fps * 0.5), 'Final segment must be at least 0.5 second');
  return errors;
}

export function buildHandoff(plan) {
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(errors.join('\n'));
  const holds = new Map(plan.scenes.flatMap(s => s.holds.map(h => [h.id, h])));
  const seconds = value => value / plan.fps;
  let start = 0;
  const segments = [...plan.breaks.map(b => ({end: b.atFrame, title: b.completedTitle})),
    {end: plan.durationFrames, title: plan.finalSegmentTitle}].map((item, index) => {
    const segment = {index: index + 1, title: item.title, startSec: seconds(start), endSec: seconds(item.end)};
    start = item.end;
    return segment;
  });
  // Deliberately construct public objects from an allowlist. Never spread plan data.
  const publicData = {
    format: 'build-explainer-video/manual-handoff-v1',
    service: 'https://video--slide.web.app/',
    importSupported: false,
    title: plan.title,
    language: plan.language,
    fps: plan.fps,
    durationFrames: plan.durationFrames,
    durationSec: seconds(plan.durationFrames),
    segments,
    breaks: plan.breaks.map(b => ({id: b.id, atFrame: b.atFrame, atSec: seconds(b.atFrame), expectedScreen: holds.get(b.holdId).heading})),
  };
  const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const time = value => {
    const tenths = Math.round(value * 10);
    return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
  };
  const manual = [
    `# ${plan.title} — video-slide 수동 입력표`, '',
    `영상 길이: ${time(publicData.durationSec)} / ${plan.fps}fps. 최종 YouTube 영상의 길이와 버전을 확인하세요.`, '',
    '이 파일은 자동 가져오기 파일이 아닙니다. 서비스 UI에서 입력하고 리허설하세요.', '',
    '| 구간 | 제목 | 시작(초) | 끝(초) |', '|---|---|---:|---:|',
    ...segments.map(s => `| ${s.index} | ${cell(s.title)} | ${s.startSec} | ${s.endSec} |`), '',
    '| Break | 입력 시간(초) | 시간 표시 | 정지 화면 |', '|---|---:|---|---|',
    ...publicData.breaks.map(b => `| ${cell(b.id)} | ${b.atSec.toFixed(1)} | ${time(b.atSec)} | ${cell(b.expectedScreen)} |`), '',
    '마지막 영상 종료는 중간 Break로 추가하지 않습니다. 모든 정지점 전후 0.6초와 이어 재생을 확인하세요.', '',
  ].join('\n');
  const privateNotes = [
    '# 비공개 발표자 메모', '',
    '공개 저장소·공개 입력표·배포 영상 설명란에 포함하지 마세요.',
    '정확한 경계에서는 다음 구간이 활성화됩니다. 아래 구간의 메모 첫 부분에 넣고 실제 프롬프터를 확인하세요.', '',
    ...plan.breaks.flatMap((b, i) => [`## ${time(seconds(b.atFrame))} / 구간 ${i + 2} 시작 정지점`, '', b.presenterNotes, '']),
  ].join('\n');
  return {publicData, manual, privateNotes};
}

export function exportHandoff(plan, directory) {
  const handoff = buildHandoff(plan);
  const target = resolve(directory);
  mkdirSync(target, {recursive: false, mode: 0o700});
  const write = (name, data) => writeFileSync(resolve(target, name), data, {flag: 'wx', mode: 0o600});
  write('public-breaks.json', JSON.stringify(handoff.publicData, null, 2) + '\n');
  write('manual-breaks.md', handoff.manual);
  write('presenter-notes.private.md', handoff.privateNotes);
  return target;
}

function main(args) {
  const [command, filename, ...rest] = args;
  if (!['validate', 'export'].includes(command) || !filename ||
      (command === 'validate' && rest.length) ||
      (command === 'export' && (rest.length !== 2 || rest[0] !== '--out'))) {
    throw new Error('Usage: node scripts/plan.mjs validate plan.json | export plan.json --out NEW-DIRECTORY');
  }
  const plan = JSON.parse(readFileSync(filename, 'utf8'));
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(errors.join('\n'));
  if (command === 'export') console.log(`Exported manual handoff: ${exportHandoff(plan, rest[1])}`);
  else console.log(`Valid: ${plan.scenes.length} scenes, ${plan.breaks.length} breaks, ${plan.durationFrames / plan.fps}s`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
