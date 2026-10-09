import { NextResponse, type NextRequest } from "next/server";
import { routeAfterSubmit, type ApprovalStatus } from "@/lib/approval";
import { EVIDENCE_EXTS, checkEvidence, isVideoPath, looksLikeVideo } from "@/lib/evidence";
import { stripJpegMetadata } from "@/lib/jpeg";
import { getQuestRun } from "@/lib/questRuns";
import { verifyCompletedRun } from "@/lib/questVerification";
import { photoPath, secondsUntilUnlock } from "@/lib/quests";
import { earnRewardsForRun, supabaseRewardStore, type EarnedReward } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

// POST multipart/form-data { kind: "before" | "after", photo: image/jpeg | video/mp4 | video/webm }
// Uploads to evidence/<uid>/<run>/<kind>.<ext> (JPEG metadata stripped; clips
// as-is), then advances the run via RPC (which re-checks ownership, state and
// the 4-min rule). After a completion it runs the AI progress check on JPEGs
// (≤10 s, never fails the request — the quest is already completed by then).
// Clips skip the check and always wait for a giver. An ai_instant run with an
// AI pass is approved on the spot and earns its rewards (food + game loot,
// mock fulfillment); everything else stays pending until a giver approves.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Sign in first");

  const run = await getQuestRun(id);
  // Squadmates can read the run, but only its player uploads evidence.
  if (!run || run.user_id !== user.id) return err(404, "Quest not found");

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
  const type = checkEvidence(photo.type, photo.size);
  if (!type.ok) return err(type.status, type.error);

  // Cheap pre-checks so we don't upload a photo the RPC will reject anyway.
  if (kind === "before" && run.status !== "draft") {
    return err(409, "This quest already has a before photo");
  }
  if (kind === "after") {
    if (run.status !== "active" || !run.started_at) return err(409, "This quest isn't in progress");
    const wait = secondsUntilUnlock(Date.parse(run.started_at), Date.now());
    if (wait > 0) return err(425, `Keep going — ${wait}s until you can finish`);
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  let clean: Uint8Array;
  if (type.mime === "image/jpeg") {
    const stripped = stripJpegMetadata(bytes);
    if (!stripped) return err(415, "Photo must be a JPEG from the in-app camera");
    clean = stripped;
  } else {
    if (!looksLikeVideo(bytes, type.mime)) return err(415, "Clip must be an MP4 or WebM from the in-app camera");
    clean = bytes;
  }

  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(photoPath(user.id, run.id, kind, type.ext), clean, { contentType: type.mime, upsert: true });
  if (uploadError) return err(502, `Upload failed: ${uploadError.message}`);

  // A redo may switch photo ↔ clip; drop the old variant so the RPC can't pick it.
  if (kind === "after") {
    const stale = EVIDENCE_EXTS.filter((e) => e !== type.ext).map((e) => photoPath(user.id, run.id, kind, e));
    const { error: rmError } = await supabase.storage.from("evidence").remove(stale);
    if (rmError) console.warn("photo route: couldn't remove stale evidence:", rmError.message);
  }

  const { data, error } = await supabase
    .rpc(kind === "before" ? "record_before_photo" : "complete_quest", { p_run_id: run.id })
    .single<{ status: string; started_at: string | null; completed_at: string | null }>();
  if (error) {
    const status = error.code === "22023" ? 425 : error.code === "55000" ? 409 : 400;
    return err(status, error.message);
  }

  // The vision check compares two JPEGs. With a clip on either side it's
  // skipped: verification stays null and a giver reviews it.
  const check =
    kind === "after" && !type.video && !isVideoPath(run.before_path)
      ? await verifyCompletedRun(supabase, run, clean)
      : null;

  let approvalStatus: ApprovalStatus = "pending";
  let rewards: EarnedReward[] = [];
  if (kind === "after" && routeAfterSubmit(run.approval_mode, check?.verification ?? null) === "instant") {
    // The RPC re-checks the stored (service-role-written) verdict; if it wasn't
    // saved, the run just waits for a giver like any other.
    const { error: approveError } = await supabase.rpc("mark_run_ai_approved", { p_run_id: run.id });
    if (approveError) {
      console.warn("photo route: instant approval failed:", approveError.message);
    } else {
      approvalStatus = "approved";
      rewards = await earnRewardsForRun(supabaseRewardStore(supabase), run);
    }
  }

  return NextResponse.json({
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    verification: check?.verification ?? null,
    verificationReason: check?.reason ?? null,
    approvalStatus: kind === "after" ? approvalStatus : null,
    rewards,
  });
}
