# Working conversations

This folder holds the transcripts of the working sessions, so the thinking
behind the code travels with the code.

## What is in here

| File | What it is |
|---|---|
| `<date>-<title>-<id>.md` | a readable transcript: what was asked, what was decided, what was built |

The Markdown files are the ones to read. They are plain text, they diff
cleanly, and they open in any editor on any machine.

## Regenerating them

```bash
npm run export:conversations
```

The script reads the OpenCode database (`~/.local/share/opencode/opencode.db`)
and rewrites this folder. It works on macOS, Linux and Windows — Node's
built-in `node:sqlite` reads the database, so nothing has to be installed.

Add `--json` to also write the lossless session records in OpenCode's own
export format, which can be re-imported on another machine with:

```bash
opencode session import docs/conversations/<file>.json
```

Those JSON files are large and are **not** committed (see `.gitignore`) —
run the export with `--json` when you actually need to move a session between
machines.

---

## Only this project

This repository is public, so it must not carry anything about the other
projects that live on the same machine. The exporter enforces two rules:

1. **Only this project's sessions are exported.** A session is included only
   if it was held inside this project's working directory. Sessions from
   anywhere else are skipped and never written.
2. **Other projects are removed.** Any paragraph or tool call that mentions
   one is dropped from the transcript, and any path that points at one is
   rewritten to a neutral placeholder.

### Where the rules live

The list of what counts as "another project" is deliberately **not** in this
repository — naming them here would defeat the purpose. It lives in a local,
git-ignored file:

```
tools/conversation-filter.local.json
```

Copy `tools/conversation-filter.local.example.json` to create it. It holds:

| Key | Meaning |
|---|---|
| `includeDirs` | extra directories whose sessions belong to this project's story |
| `drop` | plain strings; any block containing one is removed entirely |
| `redact` | plain path rewrites, applied to whatever survives |

Without the file the exporter still works — it exports only the sessions from
this project's own directory and rewrites nothing.

The export fails loudly if any private marker survives into the output, so a
mistake here cannot silently publish something it should not.

---

## Moving to another machine

Two separate things travel with this repository:

1. **The code** — clone the repository.
2. **The conversation** — run `npm run export:conversations` on the machine
   that has the sessions, commit the Markdown, and pull on the other one.

If you want to move the sessions themselves rather than just the transcript,
export them with `--json` and use `opencode session import` on the new
machine.

## A note on privacy

These transcripts are ordinary development conversations: they may contain
paths, snippets and the occasional half-finished thought. They are part of
the repository, so they are public with it. The exporter removes the other
projects' material, but **check a transcript before committing it** if a
session ever covers something sensitive — the filter only knows about the
projects you have listed in it.
