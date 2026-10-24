import { NextResponse } from "next/server";
import { TransitionError } from "@/core/state";
import type { Session } from "@/core/types";
import { handle, initialSession, view, type Action } from "@/server/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stateless API: the demo session lives in the browser (localStorage) and is sent with each action.
export async function GET() {
  return NextResponse.json(view(initialSession()));
}

function isSession(x: unknown): x is Session {
  const s = x as Session;
  return !!s && typeof s === "object" && typeof s.sections === "object" && Array.isArray(s.trace) && !!s.meeting;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: Action; session?: unknown };
    const action = body.action ?? ({ type: "view" } as Action);
    const current = isSession(body.session) ? body.session : undefined;
    const session = await handle(action, current);
    return NextResponse.json(view(session));
  } catch (err) {
    const status = err instanceof TransitionError ? 409 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "erro" }, { status });
  }
}
