<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Experiment execution runs client-side via `src/lib/lab.ts` against a simulated ARC-style environment, writing to experiments/runs/steps tables; why: no Python/ARC SDK runtime on the edge, keep the agent contract swappable for real adapters later.
- Authenticated pages live under the `_authenticated` pathless layout with a client-side session guard; data is per-user via RLS on `user_id`.
