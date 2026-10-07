import { NextResponse, type NextRequest } from "next/server";
import { stripJpegMetadata } from "@/lib/jpeg";
import { getQuestRun } from "@/lib/questRuns";
import { verifyCompletedRun } from "@/lib/questVerification";
import { photoPath, secondsUntilUnlock } from "@/lib/quests";
import { earnRewardsForRun, supabaseRewardStore } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

// Matches the `evidence` bucket's file_size_limit in 0001_init.sql.
const MAX_BYTES = 10 * 1024 * 1024;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

// POST multipart/form-data { kind: "before" | "after", photo: image/jpeg }
// Uploads to evidence/<uid>/<run>/<kind>.jpg with metadata stripped, then
// advances the run via RPC (which re-checks ownership, state and the 4-min rule).
// After a successful completion it runs the AI progress check (≤10 s, never
// fails the request — the quest is already completed by then). In parallel it
// records any food rewards the run earned and runs their (mock) fulfillment;
// that never fails the request either.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Sign in first");

  const run = await getQuestRun(id);
  if (!run) return err(404, "Quest not found");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, "Expected a photo upload");
  }
  const kind = form.get("kind");
  const photo = form.get("photo");
  if (kind !== "before" && kind !== "after") return err(400, "kind must be before or after");
  if (!(photo instanceof Blob) || photo.size === 0) return err(400, "Missing photo");
  if (photo.size > MAX_BYTES) return err(413, "Photo is too large");

  // Cheap pre-checks so we don't upload a photo the RPC will reject anyway.
  if (kind === "before" && run.status !== "draft") {
    return err(409, "This quest already has a before photo");
  }
  if (kind === "after") {
    if (run.status !== "active" || !run.started_at) return err(409, "This quest isn't in progress");
    const wait = secondsUntilUnlock(Date.parse(run.started_at), Date.now());
    if (wait > 0) return err(425, `Keep going — ${wait}s until you can finish`);
  }

  const clean = stripJpegMetadata(new Uint8Array(await photo.arrayBuffer()));
  if (!clean) return err(415, "Photo must be a JPEG from the in-app camera");

  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(photoPath(user.id, run.id, kind), clean, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return err(502, `Upload failed: ${uploadError.message}`);

  const { data, error } = await supabase
    .rpc(kind === "before" ? "record_before_photo" : "complete_quest", { p_run_id: run.id })
    .single<{ status: string; started_at: string | null; completed_at: string | null }>();
  if (error) {
    const status = error.code === "22023" ? 425 : error.code === "55000" ? 409 : 400;
    return err(status, error.message);
  }

  const [check, rewards] =
    kind === "after"
      ? await Promise.all([
          verifyCompletedRun(supabase, run, clean),
          earnRewardsForRun(supabaseRewardStore(supabase), run),
        ])
      : [null, []];

  return NextResponse.json({
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    verification: check?.verification ?? null,
    verificationReason: check?.reason ?? null,
    rewards,
  });
}
