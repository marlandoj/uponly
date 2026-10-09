import { MAX_COMMENT_CHARS } from "@/lib/approval";
import type { RunComment } from "@/lib/reviewData";
import { submitComment } from "../actions";

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Squad chat on a run: oldest first, visible to the player and their squad. */
export default function Comments({
  runId,
  viewerId,
  comments,
}: {
  runId: string;
  viewerId: string;
  comments: RunComment[];
}) {
  return (
    <section className="card comments" id="comments">
      <h2>Squad chat</h2>
      {comments.length === 0 ? (
        <p className="muted">No comments yet. Drop a shout-out or a tip.</p>
      ) : (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className={c.author_id === viewerId ? "mine" : ""}>
              <p className="comment-meta">
                <strong>{c.author_id === viewerId ? "You" : (c.author?.display_name ?? "A squadmate")}</strong>
                <time dateTime={c.created_at}>{timeFmt.format(new Date(c.created_at))}</time>
              </p>
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form action={submitComment} className="comment-form">
        <input type="hidden" name="id" value={runId} />
        <label>
          <span className="sr-only">Comment</span>
          <textarea name="body" required maxLength={MAX_COMMENT_CHARS} placeholder="Say something to the squad…" />
        </label>
        <button type="submit" className="secondary">Post</button>
      </form>
    </section>
  );
}
