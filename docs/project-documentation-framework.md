# OLV Operations Platform — Project Documentation Framework

## Purpose

Documentation is a first-class project deliverable and the authoritative description of the product. Implementation must follow approved documentation. Existing components may influence architecture, but may not alter business requirements without an explicit product decision.

The Product Owner is interviewed one workflow at a time. Each workflow is challenged for ambiguity, actors, permissions, business rules, alternate paths, exceptions, privacy, and edge cases. A workflow is not considered approved until the Product Owner reviews its complete draft.

## Documentation structure

1. Vision — statement, goals, success metrics, scope, and exclusions
2. Functional Specification — actors, workflows, rules, permissions, notifications, acceptance criteria, and edge cases
3. Domain Model — authentic liturgical terminology, cases, events, ministries, roles, qualifications, resources, and chapel rules
4. User Experience — personas, journeys, screen flows, navigation, accessibility, and progressive disclosure
5. Technical Architecture — architecture, data, APIs, integrations, authentication, deployment, and recorded technology decisions
6. Non-Functional Requirements — performance, reliability, security, privacy, audit logging, backup, recovery, and scalability
7. Modules — dashboard, scheduling, calendar, communications, sacristy, APR, inventory, and reporting
8. Testing — test cases, acceptance tests, regression tests, and bug tracking
9. Documentation — user guide, administrator guide, installation guide, release notes, and FAQ
10. Project Management — roadmap, milestones, risks, decisions, open questions, and change log

## Required workflow sections

Every workflow must contain:

- Purpose
- Actors
- Trigger
- Preconditions
- Main Success Scenario
- Alternate Flows
- Exception Handling
- Permissions
- Notifications
- Business Rules
- Acceptance Criteria
- Open Questions
- Potential Existing Capabilities to Reuse

## Requirements lifecycle and technical review

The project uses one requirements lifecycle:

**Draft Workflow → Technical Steward Review → Open Questions and Technical Constraints → Product Owner Resolution → Stakeholder or Priest Review when needed → Approved Workflow → Implementation**

Technical review is part of requirements development, not a competing specification process. The authoritative product behavior remains in the workflow specifications and related functional documents.

### Separate approval and review status

A workflow's product-approval status and technical-review status are tracked separately. Opening or reopening technical review does not silently withdraw an existing product approval. An already approved workflow follows this path:

**Approved Workflow → Technical Review Companion → Requirements Change Proposal if needed → Product Owner and applicable stakeholder approval → Coordinated Documentation Update → Revised Approved Workflow**

### Authority boundaries

- **Product Owner** owns functional requirements, business rules, acceptance criteria, priorities, and approval of requirements changes.
- **Technical Steward** may question or challenge any assumption or requirement; identify technical constraints, risks, and existing capabilities; and recommend alternative functional or technical solutions.
- **Workflow Steward or subject-matter expert** validates real-world practice, terminology, exceptions, and ministry-specific behavior.
- **Stakeholder Review Group or Father** reviews changes that exceed delegated product authority, alter chapel policy, affect liturgical judgment, or require broader confirmation.
- **AI assistants** may analyze documents, find inconsistencies, and draft review items or proposed revisions. They may not treat their recommendation as approval or modify approved requirements automatically.

The underlying operational need is preserved unless the Product Owner and applicable stakeholders determine that the chapel's need has changed. A functional requirement may be revised when review identifies a better way to meet that need. Technical solutions remain subject to technical evaluation and later architecture decisions.

### Protected authoritative documents

Technical review does not directly edit an approved workflow, business rule, or acceptance criterion. Review comments are recorded in the workflow's technical-review companion under `docs/reviews/workflows/`.

If review recommends an actual requirements change:

1. Record a Requirements Change Proposal using the project template.
2. Identify the operational need being preserved, the exact proposed change, alternatives, dependencies, and affected documents.
3. Record the Product Owner response and any required stakeholder or priest decision.
4. Do not modify authoritative requirements while the proposal is pending.
5. After approval, update every affected workflow, rationale record, architecture section, permission, notification rule, business rule, acceptance criterion, open question, and future test consistently.
6. Preserve the technical review and change proposal as decision history.

Questions resolved without changing an approved requirement do not require a Requirements Change Proposal.

### Non-duplication rules

- Workflow specifications define **what** the product must do.
- The requirements-rationale document explains **why** significant requirements exist.
- Technical-review companions record questions, constraints, alternatives, and recommendations about a particular workflow.
- Requirements Change Proposals authorize proposed changes before authoritative documents are edited.
- Technical architecture records accepted implementation direction after review.

Review records reference workflow sections and rationale IDs instead of copying their full contents. The workflow's **Potential Existing Capabilities to Reuse** section identifies candidates; the technical-review companion records the Technical Steward's evaluation of those candidates.

## Modeling principles

### Human-Centered Ministry Principle

The OLV Operations Platform exists to support the ministries of the chapel, not to replace them. The platform should automate repetitive administrative work, improve communication, and reduce errors, while preserving meaningful opportunities for parishioners to contribute their time, talents, and judgment. Whenever possible, the system should assist people in carrying out ministry rather than eliminate their participation.

- Model real chapel operations rather than screens.
- Keep operational cases, liturgical events, business rules, UX, and technical implementation distinct.
- Prefer authentic liturgical terminology. Research uncertain terminology before modeling it.
- Optimize for a modular chapel-operations platform, not only the first scheduling release.
- Define desired behavior before evaluating existing connectors or components.
- Keep complex rules behind simple, role-specific steps using progressive disclosure.
- Preserve privacy through data minimization and role-specific views.

## Cross-Functional Workflow Stewardship and SME Review

Major chapel operations may span several linked workstreams. A Confirmation, patronal feast, procession, or fundraising gala may involve liturgical planning, schola or music, hospitality, food, facilities, venue reservations, communications, fundraising, setup, cleanup, and volunteer staffing. These workstreams belong to one coordinated operational case but retain their own actors, permissions, rules, tasks, and acceptance criteria.

The Product Owner and Ceremony Coordinator define the overall case and its integration points. Each functional area must be reviewed through its designated stewardship. A cross-functional workflow is not considered complete merely because its liturgical or scheduling portion is complete; unreviewed areas must be labeled as SME input required, not filled in by assumption.

Every pending ministry or workstream must identify the applicable stewardship roles:

- **Workflow Steward** — explains current practice, pain points, terminology, exceptions, and desired outcomes; refines the workflow; and approves it within the authority delegated for that functional area.
- **Technical Steward** — identifies existing components, connectors, constraints, security considerations, and implementation options after the desired workflow is defined.
- **Product Owner** — confirms platform fit, accepts cross-functional integration, and resolves conflicts between functional areas.
- **Stakeholder Review Group** — reviews major or disputed decisions when broader confirmation is appropriate.

One person may hold more than one stewardship role. The role describes responsibility for the workflow and does not require or imply a formal ministry title. Public documentation identifies roles rather than personal names. Current personal assignments and the scope of delegated authority are maintained in an access-controlled project register outside the public repository.

Steward or SME feedback may amend an approved workflow through the controlled change process. The change must identify the affected workflow, decision, effective date, permissions, notifications, acceptance criteria, and any related documents or tests.

Existing capabilities may accelerate a functional area such as Schola scheduling, but reuse does not replace SME validation or change the required workflow merely to fit an existing tool.

## Controlled hybrid maintenance process

After each approved workflow:

- Save the workflow specification.
- Record decisions, rules, open questions, and affected-document updates.
- Create or update its technical-review companion when technical review begins.
- Keep unapproved recommendations outside the authoritative workflow.

After each logical workflow group:

- Reconcile the Functional Specification and Domain Model.
- Update permissions, notifications, UX guidance, tests, and architectural implications.
- Check for contradictions, omissions, and duplication.
- Produce a documentation-consistency report.

See `docs/reviews/README.md` for the practical review, GitHub, and change-control procedure.
