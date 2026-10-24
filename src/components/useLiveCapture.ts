"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Live audio capture for the meeting. Each chunk is a standalone MediaRecorder file that ends on a
// natural pause (≈1.4 s of silence after speech) instead of a fixed timer, so sentences with short
// pauses stay together. Silent chunks are skipped; the final chunk is always kept on stop.

const VOICE = 0.015; // RMS above this counts as speech
const END_SILENCE_MS = 1400; // silence after speech that closes a chunk
const PAUSE_HINT_MS = 450; // silence after speech shown as "pausa detectada"
const MAX_CHUNK_MS = 25000; // hard limit for one chunk
const IDLE_RESET_MS = 30000; // restart silent chunks so they don't grow

export type CaptureSource = "mic" | "tab";
export type CaptureState = "idle" | "starting" | "listening" | "error";
export type VoiceState = "waiting" | "speaking" | "pause";

export function useLiveCapture(onChunk: (blob: Blob) => Promise<void>) {
  const [state, setState] = useState<CaptureState>("idle");
  const [voice, setVoice] = useState<VoiceState>("waiting");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(false);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunkStart = useRef(0);
  const hadSpeech = useRef(false);
  const lastVoice = useRef(0);
  const cb = useRef(onChunk);
  cb.current = onChunk;

  const recordChunk = useCallback(() => {
    if (!active.current || !stream.current) return;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(new MediaStream(stream.current.getAudioTracks()), mime ? { mimeType: mime } : undefined);
    const parts: Blob[] = [];
    const spoke = { v: false };
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
      if ((spoke.v || !active.current) && blob.size > 2000) void cb.current(blob); // never drop the last chunk
      if (active.current) recordChunk();
    };
    recorder.current = rec;
    chunkStart.current = performance.now();
    hadSpeech.current = false;
    (rec as MediaRecorder & { _spoke?: typeof spoke })._spoke = spoke;
    rec.start();
  }, []);

  const cut = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") {
      const spoke = (rec as MediaRecorder & { _spoke?: { v: boolean } })._spoke;
      if (spoke) spoke.v = hadSpeech.current;
      rec.stop();
    }
  }, []);

  const stop = useCallback(() => {
    active.current = false;
    const s = stream.current;
    stream.current = null;
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") {
      rec.addEventListener("stop", () => s?.getTracks().forEach((t) => t.stop()), { once: true });
      cut();
    } else s?.getTracks().forEach((t) => t.stop());
    if (raf.current) cancelAnimationFrame(raf.current);
    ctx.current?.close().catch(() => {});
    ctx.current = null;
    setLevel(0);
    setVoice("waiting");
    setState("idle");
  }, [cut]);

  const start = useCallback(
    async (source: CaptureSource) => {
      setError(null);
      setState("starting");
      try {
        const s =
          source === "tab"
            ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (s.getAudioTracks().length === 0) {
          s.getTracks().forEach((t) => t.stop());
          throw new Error("no-audio");
        }
        s.getVideoTracks().forEach((t) => t.stop());
        stream.current = s;
        const ac = new AudioContext();
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        ac.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(an);
        ctx.current = ac;
        const buf = new Float32Array(an.fftSize);
        let lastUi: VoiceState = "waiting";
        const tick = () => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > VOICE) {
            hadSpeech.current = true;
            lastVoice.current = now;
          }
          const silentFor = now - lastVoice.current;
          const len = now - chunkStart.current;
          const ui: VoiceState = rms > VOICE ? "speaking" : hadSpeech.current && silentFor > PAUSE_HINT_MS ? "pause" : hadSpeech.current ? "speaking" : "waiting";
          if (ui !== lastUi) setVoice((lastUi = ui));
          setLevel(Math.min(1, rms * 8));
          if (active.current && recorder.current?.state === "recording") {
            if ((hadSpeech.current && silentFor > END_SILENCE_MS && len > 1200) || len > MAX_CHUNK_MS) cut();
            else if (!hadSpeech.current && len > IDLE_RESET_MS) cut();
          }
          raf.current = requestAnimationFrame(tick);
        };
        s.getAudioTracks()[0].addEventListener("ended", stop);
        active.current = true;
        setState("listening");
        recordChunk();
        tick();
      } catch (e) {
        setState("error");
        setError(
          (e as Error)?.message === "no-audio"
            ? "A fonte escolhida não tem áudio. Ao compartilhar a aba, marque “Compartilhar áudio da aba”."
            : "Não foi possível acessar o áudio. Verifique a permissão do microfone no navegador.",
        );
      }
    },
    [recordChunk, stop],
  );

  useEffect(() => stop, [stop]);

  return { state, voice, level, error, start, stop };
}
