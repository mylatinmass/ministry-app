# Technical Review and Requirements Change Control

## Purpose

This directory provides a lightweight way for the Technical Steward to review OLV Operations Platform requirements independently without directly or inadvertently changing approved workflows, business rules, or acceptance criteria.

The process supplements the authoritative project documentation framework. It does not create a second specification.

## What belongs where

| Artifact | Purpose | Authority |
|---|---|---|
| Workflow specification | Defines required operational behavior and acceptance criteria | Product Owner and applicable stakeholders |
| Requirements rationale | Explains operational need, reasoning, assumptions, and alternatives | Product documentation maintained under Product Owner control |
| Technical-review companion | Records technical questions, constraints, challenges, alternatives, and recommendations | Technical Steward authors; Product Owner responds |
| Requirements Change Proposal | Requests an actual change to approved product behavior | No effect until approved |
| Technical architecture or decision record | Records accepted implementation direction | Technical process, subject to requirements and approval boundaries |

## Lifecycle

For a new workflow:

1. Product Owner develops the draft workflow.
2. Technical Steward reviews the draft and creates its technical-review companion.
3. Product Owner and Technical Steward resolve questions and constraints.
4. Product Owner decides whether a proposed revision is accepted, rejected, deferred, or requires stakeholder or priest review.
5. Applicable stakeholders review policy, operational, privacy, or liturgical questions.
6. Product Owner approves the completed workflow.
7. The approved workflow becomes eligible for implementation planning.

For an already approved workflow:

1. The approved workflow remains authoritative.
2. Technical Steward opens or updates its technical-review companion.
3. Questions may be resolved without changing the workflow.
4. An actual recommended change is recorded in a separate Requirements Change Proposal.
5. The approved workflow remains unchanged while the proposal is pending.
6. After approval, an authorized documentation change updates all affected documents together.

## Review record structure

Create one companion file per workflow in `docs/reviews/workflows/` using `docs/reviews/templates/workflow-technical-review-template.md`.

Use a stable filename matching the workflow, for example:

`generate-publish-ministry-schedule-technical-review.md`

Each review item receives an identifier such as `TR-001`. A review item records:

- the referenced workflow section and rationale ID;
- whether it concerns the operational need, functional requirement, or technical solution;
- the question, challenged assumption, constraint, risk, or opportunity;
- existing capability that may be reused;
- proposed alternative and tradeoffs;
- security, privacy, scalability, and maintainability implications;
- impact on other workflows;
- recommended change, if any;
- Product Owner response;
- stakeholder or priest review requirement; and
- final resolution.

Do not copy the entire requirement into the review record. Quote or summarize only enough to identify the item being reviewed.

## Review-item states

- **Open** — awaiting analysis or response.
- **Needs clarification** — operational or requirement intent is unclear.
- **Constraint confirmed** — a technical limitation or dependency is established.
- **Change recommended** — Technical Steward recommends revising product behavior.
- **Stakeholder review required** — Product Owner cannot resolve it alone.
- **Accepted for change proposal** — proceed to a Requirements Change Proposal.
- **Resolved without requirements change** — explanation or technical approach resolves the item.
- **Rejected** — recommendation was considered but not accepted; record the reason.
- **Deferred** — valid question intentionally postponed with a review point.

## Requirements Change Proposals

Use `docs/reviews/templates/requirements-change-proposal-template.md` only when review recommends changing an approved functional requirement, business rule, permission, notification rule, or acceptance criterion.

Assign an identifier such as `RCP-001`. The proposal must distinguish:

- the underlying operational need being preserved or intentionally changed;
- the currently approved functional requirement;
- the proposed revised functional requirement;
- any proposed technical solution;
- rationale and alternatives;
- affected workflows and documents;
- security, privacy, migration, scalability, and maintenance effects;
- Product Owner decision; and
- required stakeholder or priest decision.

Approval of a proposal authorizes a coordinated documentation update. It does not itself alter the authoritative workflow.

## GitHub participation

### Recommended access

The Technical Steward should have permission to create branches and pull requests. The `main` branch should require pull requests and should not allow routine direct pushes. Repository administrators should configure the protection rule; repository documentation alone cannot enforce it.

If practical, require Product Owner review for changes to:

- `docs/specification/workflows/`
- `docs/requirements-rationale-and-design-considerations.md`
- functional requirements, business rules, permissions, notifications, and acceptance criteria elsewhere in the repository

A future `CODEOWNERS` rule may help enforce this after the chapel confirms the GitHub account or team that represents Product Owner approval. Do not place personal assignments in public documentation merely to configure ownership.

### Technical review branch and pull request

1. Update the local repository before beginning.
2. Create a branch named `technical-review/<workflow-name>`.
3. Add or update only the workflow's companion review file and, when appropriate, a pending change proposal.
4. Do not edit the approved workflow in the technical-review pull request.
5. Open a draft pull request using the Technical Review template.
6. Discuss and resolve review items in the review document or pull-request comments.
7. Merge the review record after it accurately captures the questions, responses, and resolutions. Merging a review record does not approve a requirements change.

### Applying an approved change

1. Create a separate branch named `requirements-change/<proposal-id>-<short-name>`.
2. Reference the approved change proposal and technical-review items.
3. Update all affected authoritative documents consistently.
4. Include a documentation-consistency check in the pull-request description.
5. Require Product Owner approval and any recorded stakeholder or priest approval before merge.
6. Mark the review item and change proposal implemented in documentation after the coordinated update merges.

## Using Codex or another AI assistant

The Technical Steward may independently use an AI assistant to review the repository. A suitable instruction is:

> Review the specified workflow, its referenced rationale records, architecture, and related workflows as Technical Steward. Identify technical questions, challenged assumptions, constraints, reusable capabilities, alternative solutions, scalability and maintainability concerns, security and privacy implications, and cross-workflow effects. Record findings only in the workflow's technical-review companion. Do not modify approved workflows, business rules, or acceptance criteria. Clearly separate operational need, functional requirement, and technical solution. Flag uncertainty rather than inventing rationale.

An AI assistant may draft a Requirements Change Proposal, but it may not mark it approved, modify authoritative requirements automatically, or infer stakeholder consent.

## Privacy and repository safety

Technical reviews and pull-request discussions must follow `docs/repository-publication-policy.md`. Do not include real volunteer data, minors' information, APR records, private appointments, credentials, private messages, or production exports. Use roles rather than personal names in public documentation.

## Keeping the process light

- Use one companion file per workflow, not one file per question.
- Create a change proposal only for a recommended change to approved behavior.
- Resolve simple explanations directly in the review record.
- Use links and section references instead of copying requirements.
- Batch related documentation updates into one coordinated change.
- Do not require technical review to repeat stakeholder or SME validation already recorded elsewhere.
