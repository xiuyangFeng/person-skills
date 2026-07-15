---
name: beijing-1plus3-math-physics
description: Create Beijing Grade 8 "1+3" interview-style mathematics or physics practice questions and optional paired Word handouts. Use when the user asks for Beijing junior-high 1+3 math/physics question design, escalating oral-interview practice, life-situation physics questions, teacher solutions, student-only question sheets, or paired Word versions.
---

# Beijing 1+3 Math & Physics Interview Training

Create questions that test oral reasoning, not answer recall. Target Beijing Grade 8 "1+3" interview practice only; do not use this skill for ordinary homework, senior-high problems, or other subjects.

## Source-first workflow

1. Inspect the current directory with `rg --files`.
2. Read every relevant PDF and Word file before drafting. Extract text and visually inspect when layout or diagrams matter.
3. Treat source files as style and topic references, not verified official facts or answer keys. Independently check every mathematical derivation and physical explanation.
4. If no useful source file exists, follow the baseline patterns in [references/interview-patterns.md](references/interview-patterns.md) and the user's prompt.

## Drafting questions

First identify the requested subject, topic, number of questions, difficulty, and whether Word output was explicitly requested. Ask one concise clarification only when a missing choice would materially alter the result.

### Mathematics

- Use Grade 8 mathematics as the vehicle: triangles, geometry, functions, algebra, integer conditions, classification, and planning/logic.
- Prefer short prompts with one hidden relationship, restriction, or useful transformation. Avoid routine plug-in calculations.
- Make difficulty genuinely escalate: direct relation -> combined conditions -> classification or proof -> reverse inference / non-obvious transformation.
- For each teacher-facing question, include: problem, prerequisite knowledge, key insight, complete step-by-step derivation, verification, and a short oral-answer structure.

### Physics

- Start from a familiar phenomenon, device, experiment, or engineering decision.
- Require the explanation chain: **phenomenon -> relevant quantity changes -> physical principle -> conclusion**.
- Use a follow-up that changes one variable, challenges a common misconception, asks for an error source, or requests a design improvement when appropriate.
- For pressure topics, distinguish solid pressure, liquid pressure, atmospheric pressure, and fluid-flow pressure. Never collapse pressure, force, and area into the same concept.

## Word-output branch

Create Word files only when the user explicitly asks for Word output.

1. Invoke the document-creation skill and use its render-and-inspect workflow.
2. Produce exactly two `.docx` files:
   - **Student version:** problems only, with optional answer space.
   - **Teacher version:** the same problems in the same order and numbering, plus prerequisite knowledge, key insight, complete solution/explanation, verification or error analysis, and oral-answer reminder.
3. Renumber both files from 1 upward after every insertion, deletion, or merge. Verify the titles and question text match one-to-one.
4. Save final files under `output/doc/` unless the user specifies another location. Use distinct filenames for materially revised versions to avoid stale Word previews.
5. Render and inspect every page before delivery. Deliver only final user-facing files.

## Quality gate

- Check all arithmetic, inequalities, geometry correspondence, units, and causality independently.
- Do not claim a question is an official historical question unless the user supplies authoritative proof.
- Do not label a source answer "standard" merely because it appears in a reference file.
- Keep student-facing wording concise; reserve pedagogy and full reasoning for the teacher version.
