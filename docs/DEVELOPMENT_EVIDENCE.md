# Candidate evidence and lean verification

Use the declared Node runtime on the authoritative host. This helper is a small
stdlib-only input check, not a test runner, approval gate, deployment tool or
replacement for the candidate-verification policy in CONVENTIONS.md.

## Capture and verify

From the repository root, after required checks pass and before review:

~~~sh
mkdir -p .agents/instruction-archives/ACTIVITY
node tools/candidate-evidence.js capture \
  > .agents/instruction-archives/ACTIVITY/candidate.json
node tools/candidate-evidence.js verify \
  .agents/instruction-archives/ACTIVITY/candidate.json
~~~

Replace ACTIVITY with the selected work's evidence directory. Keep the manifest
outside Git or in an ignored directory; otherwise the manifest itself becomes a
new input. Capture includes all tracked and new **unignored** files, even an
unstaged new module/test, plus their working bytes, HEAD and actual Node version.
Deleted tracked paths are explicit nulls. Ignored live/config/cache data is not
read or hashed by default. The helper prints JSON; it never writes source files.

For a built frontend, add explicit regular files from the isolated output:

~~~sh
node tools/candidate-evidence.js capture \
  --artifact .agents/instruction-archives/ACTIVITY/dist/index.html \
  --artifact .agents/instruction-archives/ACTIVITY/dist/assets/EXACT-BUNDLE.js \
  > .agents/instruction-archives/ACTIVITY/candidate.json
~~~

List every relevant built asset, not only index.html; use the actual build output,
not guessed names. Verify reads those artifact paths from the retained manifest.
All paths must be inside the repository without symlinks or traversal; explicit
artifacts must exist. Git paths must be losslessly decodable UTF-8; unsupported
filename bytes fail explicitly rather than appearing deleted. Literal Unicode
replacement characters and leading BOM characters remain valid filenames. Keep
manifest/log files private when paths are sensitive.

Exit codes: **0** captured/matched; **1** differences (JSON lists changed source/
artifact paths and HEAD/Node drift); **2** malformed arguments/manifest or I/O.
A nonzero result is never approval. Preserve the old evidence and classify the
difference: code/test/config/runtime changes invalidate affected checks; a
documentation-only or accepted-commit HEAD change may retain checks after exact
input/diff inspection. Record that mapping instead of silently editing history.

## Reuse the existing owners

- Required regression and lint commands remain `npm test` and `npm run lint`.
  Candidate evidence tests are included in that shared entrypoint; targeted:
  `node --test tools/candidate-evidence.test.js`.
- Build in an ignored activity directory with Vite's explicit `--outDir`; run
  `test_slideshow.js` using `LUMINA_TEST_DIST` for that exact absolute directory.
  Set `LUMINA_TEST_ARTIFACTS` to a fresh ignored evidence directory for screenshots;
  the default is ignored `.agents/instruction-archives/browser`. Do not overwrite
  prior review captures. Do not replace the live index, open a GUI or install
  another browser to test.
- New modules need direct compiler coverage when the existing graph omits them.
  Distinguish new diagnostics from newly reachable existing/imported errors.
- Review coherent risk/acceptance boundaries, not each commit. Passing checks
  precede freezing; independent review adds adversarial/negative controls rather
  than repeating the same full suite. Preserve rejections and recheck repairs.
- Lifecycle acceptance must inspect durable artifacts and fail if the claimed
  path is disabled. Seed after earlier normalizers so the path is actually reached.

## Limits

The manifest is an observation under the project's one-writer discipline, not an
atomic snapshot or lock against concurrent edits. Lockfiles are covered, but
installed dependency trees, system binaries, service units, private inputs,
external providers and physical devices are not. Include their qualified evidence
separately when relevant. This helper cannot decide which tests a change needs,
whether an artifact set is complete, whether UX is appropriate or whether a
review/deployment is authorized. Never turn it into a permanent runtime ledger.
