# Chapel Scheduler functional alpha

This is a database-backed local prototype. It is intentionally separate from the disposable stakeholder POC in `poc/`.

It demonstrates real server-enforced roles, public/private response differences, a SQLite database, rolling weekly assignment review, one-tap batch confirmation, qualified substitute requests, a staffing dashboard, a message outbox, manual service creation, public-source refresh, and an administrative audit trail.

All volunteer names are fictional. Do not add real minors, APR information, private appointments, credentials, or production rosters.

## Run

From the project root:

```sh
python3 alpha/server.py --reset
```

Open `http://127.0.0.1:8081`.

The importer reads the public Davie schedule embedded at `fsspx.today/chapel/fl-davie/` and the public JSON feed used by `1962ordo.today/calendar/`. These are treated as fragile sources: the alpha retains cached data and reports failures. Production use requires permission/terms review, monitoring, validation, and a manual correction path.

## Suggested five-minute demonstration

1. Start as **Public visitor** and point out that the server sends no assignments or volunteer names.
2. Switch to **Michael R. · Sacristan**, open **My schedule**, and confirm the new assignments together.
3. Request David R. as a substitute and explain that Michael remains assigned until David accepts.
4. Switch to **Ministry leader** and show the red/yellow/green dashboard and queued private message.
5. Add a service and show its open sacristan position.
6. Switch to **Main administrator**, refresh the public sources, and show the audit trail.

## Telegram alpha acceptance checklist

The Telegram volunteer experience is ready to freeze when all five workflows pass a clean end-to-end test:

1. View confirmed assignments and new assignments awaiting review.
2. Confirm all new assignments together or confirm them individually.
3. Report a one-time conflict or a vacation date range, with interpreted dates repeated before saving.
4. Request, track, and cancel a qualified substitute request while the original volunteer remains responsible until acceptance.
5. View and claim open volunteer positions without mixing them into the personal-schedule messages.

After acceptance, changes to these interactions require a demonstrated usability, safety, or correctness problem. New administrative features should reuse the same underlying actions without casually redesigning the volunteer flow.

## Deliberate boundaries

- Demo-role switching replaces real authentication.
- Substitute messages remain queued demonstrations. A configured Telegram alpha bot sends real private test messages through its own chat.
- The Telegram token is stored only in `alpha/data/telegram_bot_token`, excluded from Git, and deleted by the disconnect control.
- The source refresh is read-only and only adds new services.
- Scheduling automation, APR, minors, Telegram authorization, email delivery, and production deployment are not yet implemented.
