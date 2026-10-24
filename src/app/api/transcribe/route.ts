import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side speech-to-text for the meeting copilot. Audio is not stored.
const MODELS = [process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe", "whisper-1"];

// Vocabulary hint for the speech model only. It is NEVER shown or analyzed: if the model echoes it
// (a known behavior on silence/short audio), the output is discarded.
const HIDDEN_VOCAB = "ART, Anotação de Responsabilidade Técnica, DETRAN, laudo, alvará, reforma sem ampliação, antecedência, portador, motorista.";
const VOCAB_WORDS = new Set(fold(HIDDEN_VOCAB).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
const ECHO_MARKERS = ["termos usados", "reuniao de implantacao", "anotacao de responsabilidade tecnica", "entre a aprova e a prefeitura"];

function fold(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** True when the "transcript" is mostly the hidden vocabulary/prompt instead of speech. */
function echoesPrompt(text: string): boolean {
  const f = fold(text);
  if (ECHO_MARKERS.some((m) => f.includes(m))) return true;
  const words = f.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return true;
  const inVocab = words.filter((w) => VOCAB_WORDS.has(w)).length;
  const commas = (text.match(/,/g) || []).length;
  return inVocab / words.length > 0.6 || (commas >= 3 && inVocab >= 3);
}

/** Drops noise hallucinations (e.g. non-Latin text or one-word fragments from silence/beeps). */
function plausible(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return "";
  const latin = letters.replace(/[^\p{Script=Latin}]/gu, "").length / letters.length;
  if (latin < 0.9) return "";
  if (text.split(/\s+/).filter(Boolean).length < 2) return "";
  if (echoesPrompt(text)) return "";
  return text;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Transcrição indisponível: IA não configurada." }, { status: 503 });
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000) return NextResponse.json({ text: "" });
  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const buf = Buffer.from(await audio.arrayBuffer());
  for (const model of MODELS) {
    try {
      const file = await toFile(buf, `trecho.${ext}`, { type });
      const out = await client.audio.transcriptions.create({
        file,
        model,
        language: "pt",
        prompt: HIDDEN_VOCAB,
      });
      return NextResponse.json({ text: plausible((out.text ?? "").trim()), model });
    } catch {
      // try the next model
    }
  }
  return NextResponse.json({ error: "Não foi possível transcrever este trecho." }, { status: 502 });
}
