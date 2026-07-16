# Repository Publication and Data-Separation Policy

## Purpose

The OLV Operations Platform source repository may be public. Repository visibility does not determine whether member information is private: privacy depends on keeping real operational data, credentials, and restricted records outside the source repository and protecting them in the production system.

This policy applies to source code, documentation, demonstrations, screenshots, sample imports, issue reports, and commit history.

## Permitted in the public repository

- Application source code and technical documentation
- Product and workflow documentation approved for publication
- Fictional demonstration people, schedules, and contact details
- Public chapel information already approved for public distribution
- Empty data templates and examples containing no real personal information
- Configuration examples that contain placeholders rather than working credentials

## Prohibited in the public repository

- Real member, volunteer, family, clergy, or donor records unless the exact information is intentionally public and approved for this use
- Information about minors or guardians
- APR records, screening requirements assigned to individuals, screening results, or related correspondence
- Private appointments, pastoral notes, sacramental intake details, or family contact information
- Volunteer rosters, availability, absences, qualifications, attendance, or assignment history derived from production
- Mailing lists, Telegram identifiers, phone numbers, private email addresses, or notification logs
- Production databases, exports, backups, uploads, logs, or private calendar feeds
- Passwords, API keys, bot tokens, session secrets, private keys, certificates, or other credentials
- Screenshots or issue reports that expose any prohibited information

## Required separation

Production data must be stored only in the approved production database and related protected services. Secrets must be stored in an approved secret-management or deployment-configuration system. Neither belongs in Git, including in deleted files or earlier commits.

Development and demonstrations must use fictional or specifically approved test data. Connecting a local or deployed application to real data does not authorize copying that data into the repository.

## Publication checklist

Before the first public push, and before later additions containing documents, screenshots, imports, exports, or logs:

1. Confirm that all included data is fictional, intentionally public, or specifically approved for publication.
2. Check current files and commit history for credentials and prohibited information.
3. Confirm that local databases, environment files, tokens, uploads, exports, backups, and logs are excluded from Git.
4. Review design documents for personal names and sensitive internal operational details.
5. Replace real examples with fictional examples where publication is unnecessary.
6. Obtain chapel approval for any borderline content before publishing it.

## Production privacy

Making the source repository public does not make the production application or its data public. The production system must enforce authentication, role-based access, privacy-tiered calendar views, data minimization, audit logging, retention rules, and secure backups as defined in the approved product and architecture documentation.

If prohibited information is committed, stop publication or deployment, notify the designated technical and chapel custodians, remove the information from the repository and its history as appropriate, and rotate any exposed credentials. Deleting only the latest copy is not sufficient because Git retains history.
