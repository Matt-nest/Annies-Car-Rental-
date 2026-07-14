#!/usr/bin/env node
import { access, chmod, copyFile, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { KNOWLEDGE_GUIDES } from '../src/data/knowledgeHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, '..');
const ffmpegPath = ffmpegInstaller.path;

const HIGGSFIELD_VOICE = {
  id: 'dc382508-c8bd-443c-8cb2-46e57b8d2e6f',
  name: 'Sterling',
  type: 'preset',
  variant: 'elevenlabs',
};

const HIGH_RISK_NARRATION = {
  'customer-verification-approval-gate': 'The confirmation link is the customer verification gate. Review the booking, submit license, address, date of birth, terms, signature, and insurance, then stop at Awaiting Approval. Payment stays locked until an admin approves.',
  'customer-payment-after-approval': 'After approval, the confirmation link shows receipt review and unlocks payment. Verify amount, vehicle, dates, deposit, and booking code before paying.',
  'admin-approval-payment-unlock': 'Admin approval unlocks payment. Open the booking record, verify identity, agreement, insurance, vehicle, dates, pricing, risk, and deposit, then approve and notify the customer with the secure payment link.',
  'payments-deposits-refunds': 'Payments is a high-risk queue. Read exposure tiles, confirm customer, booking, amount, and reason, then open the booking before any charge, refund, release, or deposit action. Stop if statuses disagree.',
  'insurance-review': 'Insurance is a pickup gate. Check pending binds and failures, then verify driver, vehicle, dates, tier, premium, and status. Do not approve handoff if coverage is expired, mismatched, or unresolved.',
  'calendar-checkins': 'Check-Ins turns the schedule into work lanes. Read pickup, return, overdue, and settlement counts, then open the exact rental. Stop if payment, agreement, license, inspection, or damage is unresolved.',
  'system-health': 'System Health explains workflow failures. Check backend health, environment, notifications, payments, automation, and webhooks before asking a customer to retry. Escalate repeated failures with booking code and timestamp.',
};

const STITCHED_DEMOS = [
  {
    id: 'customer-demo',
    order: [
      'customer-booking-flow',
      'customer-verification-approval-gate',
      'customer-payment-after-approval',
    ],
    narration: [
      'The customer demo is split from the admin demo. First the renter browses vehicles, opens the detail page, chooses dates, pickup or delivery, add-ons, contact details, reviews the request, and submits it. That first form creates a pending booking code, not a paid rental.',
      'Next the confirmation link becomes the verification gate. The customer reviews the rental summary, scans or enters driver license and address details, accepts terms, completes acknowledgements, signs, chooses insurance, reviews the package, and submits it for approval.',
      'After admin approval, the same confirmation link changes again. It shows the approved receipt and unlocks payment. The customer reviews rental, insurance, deposit, vehicle, dates, and booking code before paying through the secure payment form.',
    ].join(' '),
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
    narration: [
      'The admin demo starts where the customer stops. Operators use Bookings to find pending approval work, then open Booking Detail before deciding. The approval decision verifies customer, vehicle, dates, agreement, license, insurance, pricing, risk, and deposit.',
      'Approval unlocks payment and notifies the customer. Until payment completes, the booking stays approved unpaid with a payment link and reminder action. Once paid, Booking Detail becomes the source of truth for documents, pickup prep, handoff, return, invoice, and timeline.',
      'Support queues help operators find risk. Fleet protects inventory, Check-Ins runs pickup and return work, Payments controls money actions, Insurance handles coverage gates, Messaging sends traceable follow-up, Revenue supports business decisions, and System Health explains integration failures.',
    ].join(' '),
  },
];

const STITCHED_DEMO_IDS = new Set(STITCHED_DEMOS.map((demo) => demo.id));

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function argList(name) {
  const raw = argValue(name, '');
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0;
}

function timestamp(seconds, decimal = '.') {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}${decimal}${String(millis).padStart(3, '0')}`;
}

async function readManifest(guideDir) {
  const manifestPath = path.join(guideDir, 'manifest.json');
  if (!(await exists(manifestPath))) return null;
  return readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
}

function scriptLines(manifest) {
  const script = Array.isArray(manifest?.script) ? manifest.script : [];
  return script
    .map((step) => step.caption || step.narration)
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index);
}

function captionLines(guide, manifest = null) {
  const manifestLines = scriptLines(manifest);
  if (manifestLines.length) return manifestLines;
  const demoCaptions = (guide.demo || []).map((frame) => frame.caption).filter(Boolean);
  if (demoCaptions.length) return demoCaptions;
  return [guide.beforeStart, ...guide.steps.slice(0, 3), guide.doneWhen].filter(Boolean);
}

function narrationText(guide, manifest = null, duration = null) {
  const stitchedDemo = STITCHED_DEMOS.find((demo) => demo.id === guide.id);
  if (stitchedDemo) return stitchedDemo.narration;
  if (HIGH_RISK_NARRATION[guide.id]) {
    return HIGH_RISK_NARRATION[guide.id];
  }
  const manifestNarration = timelineNarrationText(manifest, duration);
  if (manifestNarration) return manifestNarration;
  const demoNarration = (guide.demo || []).map((frame) => frame.narration).filter(Boolean);
  const lines = demoNarration.length ? demoNarration : [guide.summary, ...guide.steps.slice(0, 3), guide.doneWhen];
  return lines.filter(Boolean).join(' ');
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function timelineNarrationText(manifest, duration = null) {
  const steps = Array.isArray(manifest?.script) ? manifest.script : [];
  if (!steps.length) return '';
  const videoSeconds = duration || Math.max(...steps.map((step) => step.endMs || 0), 0) / 1000 || 20;
  const maxWords = Math.max(18, Math.floor(videoSeconds * 1.25));
  const selected = [];
  let usedWords = 0;

  for (const step of steps) {
    const line = step.narration || step.caption;
    if (!line || /Start on the exact operational screen/i.test(line)) continue;
    const words = wordCount(line);
    if (selected.length && usedWords + words > maxWords) continue;
    selected.push(line);
    usedWords += words;
  }

  if (!selected.length) return scriptLines(manifest).slice(0, 3).join(' ');
  return selected.join(' ');
}

async function probeDuration(file) {
  const result = spawnSync(ffmpegPath, ['-i', file], { encoding: 'utf8' });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = combined.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function buildTimedCaptions(lines, duration) {
  const usableDuration = Math.max(duration || lines.length * 4, lines.length * 2.5);
  const segment = usableDuration / lines.length;
  return lines.map((text, index) => ({
    text,
    start: index * segment,
    end: index === lines.length - 1 ? usableDuration : (index + 1) * segment,
  }));
}

async function writeCaptions(outDir, guide, duration, manifest = null) {
  const timed = buildTimedCaptions(captionLines(guide, manifest), duration);
  const vtt = [
    'WEBVTT',
    '',
    ...timed.flatMap((caption) => [
      `${timestamp(caption.start)} --> ${timestamp(caption.end)}`,
      caption.text,
      '',
    ]),
  ].join('\n');
  const srt = timed.map((caption, index) => [
    String(index + 1),
    `${timestamp(caption.start, ',')} --> ${timestamp(caption.end, ',')}`,
    caption.text,
    '',
  ].join('\n')).join('\n');

  const vttPath = path.join(outDir, `${guide.id}.vtt`);
  const srtPath = path.join(outDir, `${guide.id}.srt`);
  await writeFile(vttPath, vtt, 'utf8');
  await writeFile(srtPath, srt, 'utf8');
  return { vttPath, srtPath };
}

function audioFitFilter(audioDuration, videoDuration, label) {
  if (!audioDuration || !videoDuration || audioDuration <= videoDuration) return null;
  const ratio = audioDuration / videoDuration;
  if (ratio > 1.15) {
    throw new Error(`${label} voiceover is too long for the recording (${audioDuration.toFixed(1)}s audio vs ${videoDuration.toFixed(1)}s video). Shorten narration or recapture the walkthrough.`);
  }
  return `atempo=${ratio.toFixed(3)}`;
}

async function writeHiggsfieldVoiceover(guideDir, guide, manifest = null, duration = null) {
  const voiceoverPath = path.join(guideDir, 'voiceover.mp3');
  const metaPath = path.join(guideDir, 'voiceover-meta.json');
  const narration = narrationText(guide, manifest, duration);
  if (await exists(voiceoverPath)) {
    const meta = await readFile(metaPath, 'utf8').then(JSON.parse).catch(() => null);
    if (meta?.narration === narration) {
      const now = new Date();
      await utimes(voiceoverPath, now, now).catch(() => {});
      await utimes(metaPath, now, now).catch(() => {});
      return voiceoverPath;
    }
    await rm(voiceoverPath, { force: true });
    await rm(metaPath, { force: true });
  }
  if (!(await commandExists('higgsfield'))) {
    throw new Error('Higgsfield CLI not found. Run: npm install -g @higgsfield/cli && higgsfield auth login');
  }

  const result = spawnSync(
    'higgsfield',
    [
      'generate',
      'create',
      'text2speech_v2',
      '--prompt',
      narration,
      '--variant',
      HIGGSFIELD_VOICE.variant,
      '--voice-id',
      HIGGSFIELD_VOICE.id,
      '--voice-type',
      HIGGSFIELD_VOICE.type,
      '--wait',
      '--wait-timeout',
      '10m',
      '--json',
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Higgsfield voiceover generation failed.');
  }

  const jobs = JSON.parse(result.stdout);
  const url = jobs?.[0]?.result_url;
  if (!url) throw new Error('Higgsfield did not return a voiceover result_url.');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download Higgsfield voiceover: ${response.status}`);
  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(voiceoverPath, audio);
  await writeFile(
    path.join(guideDir, 'voiceover-meta.json'),
    JSON.stringify(
      {
        engine: 'higgsfield',
        model: 'text2speech_v2',
        variant: HIGGSFIELD_VOICE.variant,
        voiceName: HIGGSFIELD_VOICE.name,
        voiceId: HIGGSFIELD_VOICE.id,
        voiceType: HIGGSFIELD_VOICE.type,
        narration,
        jobId: jobs?.[0]?.id,
        resultUrl: url,
      },
      null,
      2,
    ),
    'utf8',
  );
  return voiceoverPath;
}

async function findRecording(guideDir) {
  const manifestPath = path.join(guideDir, 'manifest.json');
  const fallback = path.join(guideDir, 'recording.webm');
  if (!(await exists(manifestPath))) return (await exists(fallback)) ? fallback : null;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.recording && await exists(manifest.recording)) return manifest.recording;
  return (await exists(fallback)) ? fallback : null;
}

async function renderGuide(guide, capturesRoot, outDir, withVoiceover) {
  const guideDir = path.join(capturesRoot, guide.id);
  const manifest = await readManifest(guideDir);
  const recording = await findRecording(guideDir);
  if (!recording) {
    console.warn(`Skipping ${guide.id}: no real UI recording found in ${guideDir}`);
    return false;
  }

  await mkdir(outDir, { recursive: true });
  await chmod(ffmpegPath, 0o755).catch(() => {});

  const duration = await probeDuration(recording);
  const { vttPath, srtPath } = await writeCaptions(outDir, guide, duration, manifest);
  const outputPath = path.join(outDir, `${guide.id}.mp4`);
  const audioPath = withVoiceover ? await writeHiggsfieldVoiceover(guideDir, guide, manifest, duration) : null;
  const subtitleFilter = `subtitles=${srtPath}`;
  const videoFilter = `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,${subtitleFilter}`;

  const args = ['-y', '-i', recording];
  if (audioPath) args.push('-i', audioPath);
  args.push('-vf', videoFilter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p');
  if (audioPath) {
    const audioDuration = await probeDuration(audioPath);
    const audioFilter = audioFitFilter(audioDuration, duration, guide.id);
    args.push('-map', '0:v:0', '-map', '1:a:0');
    if (audioFilter) args.push('-filter:a', audioFilter);
    args.push('-c:a', 'aac', '-b:a', '160k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);

  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed while rendering ${guide.id}`);

  await copyFile(vttPath, path.join(outDir, `${guide.id}.captions.vtt`)).catch(() => {});
  console.log(`Real knowledge MP4 written to ${outputPath}`);
  return true;
}

async function writeStitchedDemoCaptions(outDir, stitchedDemo, orderedGuides) {
  let cursor = 0;
  const timed = [];

  for (const guide of orderedGuides) {
    const videoPath = path.join(outDir, `${guide.id}.mp4`);
    const duration = (await probeDuration(videoPath)) || 2.5;
    timed.push({
      text: `${guide.title}: ${guide.outcome}`,
      start: cursor,
      end: cursor + duration,
    });
    cursor += duration;
  }

  const vtt = [
    'WEBVTT',
    '',
    ...timed.flatMap((caption) => [
      `${timestamp(caption.start)} --> ${timestamp(caption.end)}`,
      caption.text,
      '',
    ]),
  ].join('\n');
  await writeFile(path.join(outDir, `${stitchedDemo.id}.vtt`), vtt, 'utf8');
}

async function renderStitchedDemo(stitchedDemo, capturesRoot, outDir, withVoiceover) {
  const orderedGuides = stitchedDemo.order
    .map((id) => KNOWLEDGE_GUIDES.find((guide) => guide.id === id))
    .filter(Boolean);
  const missing = [];

  for (const guide of orderedGuides) {
    const videoPath = path.join(outDir, `${guide.id}.mp4`);
    if (!(await exists(videoPath))) missing.push(guide.id);
  }

  if (missing.length) {
    throw new Error(`Cannot render ${stitchedDemo.id}. Missing per-guide MP4s: ${missing.join(', ')}`);
  }

  await mkdir(outDir, { recursive: true });
  const concatPath = path.join(outDir, `${stitchedDemo.id}.concat.txt`);
  const tempPath = path.join(outDir, `${stitchedDemo.id}.real.tmp.mp4`);
  const outputPath = path.join(outDir, `${stitchedDemo.id}.mp4`);
  await writeFile(
    concatPath,
    orderedGuides.map((guide) => `file '${path.join(outDir, `${guide.id}.mp4`).replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8',
  );

  const concatResult = spawnSync(
    ffmpegPath,
    ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', tempPath],
    { stdio: 'inherit' },
  );
  if (concatResult.status !== 0) throw new Error(`ffmpeg failed while stitching ${stitchedDemo.id}.`);

  const stitchedGuide = KNOWLEDGE_GUIDES.find((guide) => guide.id === stitchedDemo.id) || {
    id: stitchedDemo.id,
    summary: stitchedDemo.narration,
  };
  const stitchedCaptureDir = path.join(capturesRoot, stitchedDemo.id);
  await mkdir(stitchedCaptureDir, { recursive: true });
  const videoDuration = await probeDuration(tempPath);
  const audioPath = withVoiceover ? await writeHiggsfieldVoiceover(stitchedCaptureDir, stitchedGuide, null, videoDuration) : null;

  if (audioPath) {
    const audioDuration = await probeDuration(audioPath);
    const audioFilter = audioFitFilter(audioDuration, videoDuration, stitchedDemo.id);
    const muxArgs = [
      '-y',
      '-i',
      tempPath,
      '-i',
      audioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
    ];
    if (audioFilter) muxArgs.push('-filter:a', audioFilter);
    muxArgs.push(
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      outputPath,
    );
    const audioResult = spawnSync(
      ffmpegPath,
      muxArgs,
      { stdio: 'inherit' },
    );
    if (audioResult.status !== 0) throw new Error(`ffmpeg failed while adding ${stitchedDemo.id} voiceover.`);
  } else {
    await copyFile(tempPath, outputPath);
  }

  await writeStitchedDemoCaptions(outDir, stitchedDemo, orderedGuides);
  await rm(tempPath, { force: true });
  await rm(concatPath, { force: true });
  console.log(`${stitchedDemo.id} real UI knowledge demo written to ${outputPath}`);
}

async function main() {
  const capturesRoot = path.resolve(dashboardRoot, argValue('--captures', 'demo-output/real-ui'));
  const outDir = path.resolve(dashboardRoot, argValue('--out', 'public/knowledge-videos'));
  const all = hasFlag('--all');
  const full = hasFlag('--full');
  const explicitGuide = process.argv.includes('--guide');
  const explicitGuides = process.argv.includes('--guides');
  const guideId = argValue('--guide', 'customer-booking-flow');
  const guideIds = argList('--guides');
  const withVoiceover = hasFlag('--voiceover');
  const voiceoverEngine = argValue('--voiceover-engine', 'higgsfield');
  const shouldRenderGuides = all || explicitGuide || explicitGuides || !full;
  const guides = shouldRenderGuides
    ? all
      ? KNOWLEDGE_GUIDES.filter((guide) => !STITCHED_DEMO_IDS.has(guide.id))
      : explicitGuides
        ? guideIds.map((id) => KNOWLEDGE_GUIDES.find((guide) => guide.id === id))
        : [KNOWLEDGE_GUIDES.find((guide) => guide.id === guideId)]
    : [];

  if (guides.some((guide) => !guide)) {
    const requested = explicitGuides ? guideIds.join(', ') : guideId;
    throw new Error(`Unknown guide "${requested}". Available: ${KNOWLEDGE_GUIDES.map((guide) => guide.id).join(', ')}`);
  }
  if (withVoiceover && voiceoverEngine !== 'higgsfield') {
    throw new Error('Real UI voiceover currently uses Higgsfield only. Use --voiceover-engine higgsfield.');
  }

  let rendered = 0;
  for (const guide of guides) {
    if (await renderGuide(guide, capturesRoot, outDir, withVoiceover)) rendered += 1;
  }

  if (full) {
    for (const stitchedDemo of STITCHED_DEMOS) {
      await renderStitchedDemo(stitchedDemo, capturesRoot, outDir, withVoiceover);
    }
  }

  console.log(`Rendered ${rendered} real UI knowledge video${rendered === 1 ? '' : 's'}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
