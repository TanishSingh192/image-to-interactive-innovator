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
- Genesis simulation and offline experiments run client-side through `src/lib/genesis`, persisting snapshots and measured records to Genesis tables; why: the prototype uses a browser symbolic engine, not a Python or remote model runtime.
- Authenticated pages live under the `_authenticated` pathless layout with a client-side session guard; data is per-user via RLS on `user_id`.
- Repository documentation lives in the root README and focused guides under `docs`, with actual captures under `docs/images`; why: GitHub renders diagrams and screenshots alongside source without a separate documentation service.
- GitHub collaboration uses issue forms and a pull request template under `.github`, with no implied CI service; why: contributions need reproducible evidence and explicit research-impact review without inventing automated checks.
