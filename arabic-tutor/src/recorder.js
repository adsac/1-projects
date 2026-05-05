// Thin wrapper over MediaRecorder. Record + replay only — no scoring, no upload.

let stream = null;
let recorder = null;
let chunks = [];
let lastBlobUrl = null;

export async function startRecording() {
  if (recorder && recorder.state === 'recording') return;
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  chunks = [];
  const mime = pickMime();
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.start();
}

export function stopRecording() {
  return new Promise((resolve) => {
    if (!recorder) return resolve(null);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
      if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
      lastBlobUrl = URL.createObjectURL(blob);
      resolve({ blob, url: lastBlobUrl });
    };
    if (recorder.state !== 'inactive') recorder.stop();
    else recorder.onstop();
  });
}

export function isRecording() {
  return recorder && recorder.state === 'recording';
}

export async function teardown() {
  try {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  } catch {}
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }
  recorder = null;
  chunks = [];
}

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}
