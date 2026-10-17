---
name: junior-dev-workflow-en
description: Use for coding tasks that need simple file organization, readable code, Thai comments, real verification, logical Git commits, and a Thai checkpoint for the next AI session.
---

# Junior Developer Coding Workflow

Use this for writing or changing project code. Follow the user's task-specific directions and the project's own instructions first.

## Before editing

- Read the project instructions, file structure, Git status, and any existing checkpoint.
- Plan small, meaningful units of work that can be verified and committed separately. Avoid unnecessary files or abstraction layers.

## Write code

- Use English file and folder names. Give functions and variables descriptive names.
- Split files by responsibility when it improves clarity. Favor straightforward code that fits the project's conventions.
- Write comments in Thai to explain intent, non-obvious steps, or cautions. Do not repeat what the code already makes clear.
- Keep unrelated refactoring out of the task.

## Verify and record progress

- Run checks suited to the change, such as tests, build, lint, or a real user-flow check. Inspect the results and fix failures.
- Create or update `AI_CHECKPOINT.md` in Thai at the project root. If the project already has a checkpoint file, continue using that file instead.
- Record completed and verified work, the verification commands and results, remaining work or limitations, and the next steps so another AI can resume.
- If a check cannot be run, say so plainly. Do not mark unverified work as verified or complete.

## Commit

- Make separate commits for meaningful units after verifying each unit. Use the appropriate Conventional Commits type and a Thai description after `:`, such as `feat: เพิ่มหน้าค้นหา`, `fix: แก้การคำนวณยอดรวม`, or `refactor: แยกฟังก์ชันตรวจข้อมูล`.
- Include checkpoint updates in the relevant commit. Do not stage pre-existing changes from others or unrelated files.
- If there is no Git repository, initialize one only when this is clearly a new standalone project under your control. Otherwise explain why a commit could not be made.

## Handoff

Briefly report what changed, the checks and their actual results, the commits, and any remaining work or limitations.
