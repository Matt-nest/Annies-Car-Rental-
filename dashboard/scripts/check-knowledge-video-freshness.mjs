#!/usr/bin/env node
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_GUIDES } from '../src/data/knowledgeHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, '..');

const HIGH_RISK_GUIDES = new Set([
  'customer-verification-approval-gate',
  'customer-payment-after-approval',
  'admin-approval-payment-unlock',
  'payments-deposits-refunds',
  'insurance-review',
  'calendar-checkins',
  'system-health',
]);

const STITCHED_DEMOS = [
  {
    id: 'customer-demo',
    order: [
      'customer-booking-flow',
      'customer-verification-approval-gate',
      'customer-payment-after-approval',
    ],
  },
  {
    id: 'admin-demo',
    order: [
      'admin-approval-payment-unlock',
      'booking-queue',
      'booking-lifecycle',
      'fleet-availability',
      'calendar-checkins',
      'payments-deposits-refunds',
      'insurance-review',
      'customers-portal-long-term',
      'messaging-notifications',
      'revenue-reporting',
      'system-health',
    ],
  },
];

const STITCHED_DEMO_IDS = new Set(STITCHED_DEMOS.map((demo) => demo.id));
const STRICT_CAPTURE_FRESHNESS = process.argv.includes('--strict-captures')
  || process.env.KNOWLEDGE_VIDEO_STRICT_CAPTURES === '1';

const SOURCE_FILES = [
  'src/data/knowledgeHub.js',
  'src/pages/KnowledgeHubPage.jsx',
  'src/components/knowledge/GuidedDemoPlayer.jsx',
  'scripts/capture-knowledge-real-ui.mjs',
  'scripts/render-real-knowledge-videos.mjs',
  'package.json',
];

const VOICEOVER_SOURCE_FILES = [
  'src/data/knowledgeHub.js',
  'scripts/render-real-knowledge-videos.mjs',
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function mtime(file) {
  return (await stat(file)).mtimeMs;
}

async function newestMtime(files) {
  const times = await Promise.all(files.map((file) => mtime(file)));
  return Math.max(...times);
}

async function findRecording(guideDir) {
  const manifestPath = path.join(guideDir, 'manifest.json');
  const fallback = path.join(guideDir, 'recording.webm');
  if (await exists(manifestPath)) {
    const manifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
    if (manifest?.recording && await exists(manifest.recording)) return manifest.recording;
  }
  return (await exists(fallback)) ? fallback : null;
}

async function requireFile(file, failures, label) {
  if (!(await exists(file))) {
    failures.push(`${label} missing: ${path.relative(dashboardRoot, file)}`);
    return false;
  }
  return true;
}

async function requireFresh(file, newestSource, failures, label) {
  if (!(await requireFile(file, failures, label))) return;
  const fileTime = await mtime(file);
  if (fileTime < newestSource) {
    failures.push(`${label} is stale: ${path.relative(dashboardRoot, file)}`);
  }
}

async function main() {
  const capturesRoot = path.join(dashboardRoot, 'demo-output/real-ui');
  const outputRoot = path.join(dashboardRoot, 'public/knowledge-videos');
  const sourceFiles = SOURCE_FILES.map((file) => path.join(dashboardRoot, file));
  const voiceoverSourceFiles = VOICEOVER_SOURCE_FILES.map((file) => path.join(dashboardRoot, file));
  const failures = [];

  for (const file of sourceFiles) {
    await requireFile(file, failures, 'knowledge source');
  }
  if (failures.length) throw new Error(failures.join('\n'));

  const sourceMtime = await newestMtime(sourceFiles);
  const voiceoverSourceMtime = await newestMtime(voiceoverSourceFiles);

  for (const guide of KNOWLEDGE_GUIDES.filter((item) => !STITCHED_DEMO_IDS.has(item.id))) {
    const mp4 = path.join(outputRoot, `${guide.id}.mp4`);
    const vtt = path.join(outputRoot, `${guide.id}.vtt`);
    const captions = path.join(outputRoot, `${guide.id}.captions.vtt`);

    if (!STRICT_CAPTURE_FRESHNESS) {
      await requireFile(mp4, failures, `${guide.id} MP4`);
      await requireFile(vtt, failures, `${guide.id} VTT`);
      await requireFile(captions, failures, `${guide.id} caption copy`);
      continue;
    }

    const guideDir = path.join(capturesRoot, guide.id);
    const recording = await findRecording(guideDir);
    if (!recording) {
      failures.push(`recording missing: ${path.relative(dashboardRoot, path.join(guideDir, 'recording.webm'))}`);
      continue;
    }

    const guideSourceMtime = Math.max(sourceMtime, await mtime(recording));

    await requireFresh(mp4, guideSourceMtime, failures, `${guide.id} MP4`);
    await requireFresh(vtt, guideSourceMtime, failures, `${guide.id} VTT`);
    await requireFresh(captions, guideSourceMtime, failures, `${guide.id} caption copy`);

    if (HIGH_RISK_GUIDES.has(guide.id)) {
      const voiceover = path.join(guideDir, 'voiceover.mp3');
      const voiceoverMeta = path.join(guideDir, 'voiceover-meta.json');
      await requireFresh(voiceover, voiceoverSourceMtime, failures, `${guide.id} voiceover`);
      await requireFresh(voiceoverMeta, voiceoverSourceMtime, failures, `${guide.id} voiceover metadata`);
      if (await exists(mp4) && await exists(voiceover) && (await mtime(mp4)) < (await mtime(voiceover))) {
        failures.push(`${guide.id} MP4 is older than its voiceover.`);
      }
    }
  }

  for (const stitchedDemo of STITCHED_DEMOS) {
    const mp4 = path.join(outputRoot, `${stitchedDemo.id}.mp4`);
    const vtt = path.join(outputRoot, `${stitchedDemo.id}.vtt`);

    if (!STRICT_CAPTURE_FRESHNESS) {
      await requireFile(mp4, failures, `${stitchedDemo.id} MP4`);
      await requireFile(vtt, failures, `${stitchedDemo.id} captions`);
      continue;
    }

    const constituentMp4s = stitchedDemo.order.map((id) => path.join(outputRoot, `${id}.mp4`));
    const existingGuideMp4s = [];
    for (const file of constituentMp4s) {
      if (await exists(file)) existingGuideMp4s.push(file);
    }
    const stitchedSourceMtime = existingGuideMp4s.length
      ? Math.max(sourceMtime, await newestMtime(existingGuideMp4s))
      : sourceMtime;
    await requireFresh(mp4, stitchedSourceMtime, failures, `${stitchedDemo.id} MP4`);
    await requireFresh(vtt, stitchedSourceMtime, failures, `${stitchedDemo.id} captions`);
  }

  if (failures.length) {
    throw new Error(`Knowledge videos are stale or incomplete:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  }

  if (STRICT_CAPTURE_FRESHNESS) {
    console.log('Knowledge videos are fresh.');
  } else {
    console.log('Knowledge video public assets are present. Run with --strict-captures to validate local capture freshness.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
