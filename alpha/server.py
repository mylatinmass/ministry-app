#!/usr/bin/env python3
"""Chapel Scheduler functional alpha: standard-library web server + SQLite."""

import json
import re
import sqlite3
import sys
import threading
import time
import urllib.request
import urllib.parse
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA = ROOT / "data"
DB = DATA / "chapel_scheduler.db"
TOKEN_FILE = DATA / "telegram_bot_token"
FSSPX_URL = "https://fsspx.today/chapel/fl-davie/"
ORDO_URL = "https://1962ordo.today/get-liturgical-days/"


def connection():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def initialize(reset=False):
    DATA.mkdir(exist_ok=True)
    if reset and DB.exists():
        DB.unlink()
    db = connection()
    db.executescript("""
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
      qualified INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY, service_date TEXT NOT NULL, service_time TEXT NOT NULL,
      title TEXT NOT NULL, liturgical_day TEXT, public INTEGER NOT NULL DEFAULT 1,
      cancelled INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      source_url TEXT, UNIQUE(service_date, service_time, title)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY, service_id INTEGER NOT NULL REFERENCES services(id),
      person_id INTEGER REFERENCES people(id), ministry TEXT NOT NULL,
      status TEXT NOT NULL, UNIQUE(service_id, ministry)
    );
    CREATE TABLE IF NOT EXISTS substitute_requests (
      id INTEGER PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      requested_person_id INTEGER NOT NULL REFERENCES people(id), status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS absences (
      id INTEGER PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES people(id),
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY, channel TEXT NOT NULL, recipient TEXT NOT NULL,
      subject TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
      detail TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY, source TEXT NOT NULL, status TEXT NOT NULL,
      detail TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_links (
      id INTEGER PRIMARY KEY, person_id INTEGER NOT NULL UNIQUE REFERENCES people(id),
      telegram_user_id TEXT NOT NULL UNIQUE, chat_id TEXT NOT NULL,
      username TEXT, linked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_keyboard_messages (
      chat_id TEXT NOT NULL, message_id INTEGER NOT NULL,
      PRIMARY KEY(chat_id, message_id)
    );
    """)
    if not db.execute("SELECT 1 FROM people LIMIT 1").fetchone():
        db.executemany("INSERT INTO people(name, role, qualified) VALUES(?,?,?)", [
            ("Michael R.", "volunteer", 1), ("David R.", "volunteer", 1),
            ("Thomas B.", "volunteer", 1), ("Peter C.", "volunteer", 0),
            ("Ministry Leader", "leader", 1), ("Main Administrator", "admin", 1),
        ])
        seed_services(db)
    # Confessions and Rosary are informational calendar entries, never standalone staffing duties.
    db.execute("""DELETE FROM assignments WHERE service_id IN (
        SELECT id FROM services WHERE title LIKE '%Confession%' OR title LIKE '%Rosary%'
    )""")
    db.commit()
    db.close()


def seed_services(db):
    rows = [
      ("2026-07-17", "5:30 pm", "Confessions | Rosary", "Feria", 0),
      ("2026-07-17", "6:30 pm", "Low Mass", "Feria", 1),
      ("2026-07-18", "8:00 am", "Confessions | Rosary", "St. Camillus de Lellis", 0),
      ("2026-07-18", "9:00 am", "Low Mass", "St. Camillus de Lellis", 1),
      ("2026-07-19", "6:30 am", "Confessions | Rosary", "VIII Sunday after Pentecost", 0),
      ("2026-07-19", "7:00 am", "Low Mass", "VIII Sunday after Pentecost", 1),
      ("2026-07-19", "8:30 am", "Confessions | Rosary", "VIII Sunday after Pentecost", 0),
      ("2026-07-19", "9:00 am", "Low Mass", "VIII Sunday after Pentecost", 1),
      ("2026-07-19", "10:30 am", "Confessions | Rosary", "VIII Sunday after Pentecost", 0),
      ("2026-07-19", "11:00 am", "Sung Mass", "VIII Sunday after Pentecost", 1),
      ("2026-07-19", "4:30 pm", "Confessions | Rosary", "VIII Sunday after Pentecost", 0),
      ("2026-07-19", "5:00 pm", "Low Mass", "VIII Sunday after Pentecost", 1),
      ("2026-07-20", "7:15 am", "Low Mass", "St. Jerome Emiliani", 1),
      ("2026-07-24", "5:30 pm", "Confessions | Rosary", "Feria", 0),
      ("2026-07-24", "6:30 pm", "Low Mass", "Feria", 1),
      ("2026-07-25", "8:00 am", "Confessions | Rosary", "St. James the Greater", 0),
      ("2026-07-25", "9:00 am", "Low Mass", "St. James the Greater", 1),
      ("2026-07-26", "7:00 am", "Low Mass", "IX Sunday after Pentecost", 1),
      ("2026-07-26", "9:00 am", "Low Mass", "IX Sunday after Pentecost", 1),
      ("2026-07-26", "11:00 am", "Sung Mass", "IX Sunday after Pentecost", 1),
      ("2026-07-26", "5:00 pm", "Low Mass", "IX Sunday after Pentecost", 1),
      ("2026-07-27", "7:15 am", "Low Mass", "Feria", 1),
    ]
    for date, time, title, liturgy, staff in rows:
        cur = db.execute("INSERT OR IGNORE INTO services(service_date,service_time,title,liturgical_day,source,source_url) VALUES(?,?,?,?,?,?)",
                         (date, time, title, liturgy, "cached FSSPX + Ordo", FSSPX_URL))
        sid = cur.lastrowid
        if staff and sid:
            db.execute("INSERT INTO assignments(service_id,person_id,ministry,status) VALUES(?,?,?,?)",
                       (sid, None, "Sacristan", "open"))
    # Published assignments are accepted automatically; volunteers act only on exceptions.
    assignments = db.execute("""SELECT a.id,s.service_date FROM assignments a JOIN services s ON s.id=a.service_id
        WHERE s.service_date IN ('2026-07-17','2026-07-18') ORDER BY s.service_date""").fetchall()
    for assign in assignments:
        status = "confirmed" if assign["service_date"] == "2026-07-17" else "pending"
        db.execute("UPDATE assignments SET person_id=1,status=? WHERE id=?", (status, assign["id"]))
    assign = db.execute("SELECT a.id FROM assignments a JOIN services s ON s.id=a.service_id WHERE s.service_date='2026-07-19' AND s.service_time='7:00 am'").fetchone()
    if assign:
        db.execute("UPDATE assignments SET person_id=2,status='confirmed' WHERE id=?", (assign[0],))


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def friendly_date(value):
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return "%s, %s %d" % (parsed.strftime("%A"), parsed.strftime("%B"), parsed.day)


def compact_date(value):
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return "%s %s %d" % (parsed.strftime("%a"), parsed.strftime("%b"), parsed.day)


def audit(db, actor, action, detail):
    db.execute("INSERT INTO audit_log(actor,action,detail,created_at) VALUES(?,?,?,?)", (actor, action, detail, now()))


def actor_for(role):
    return {"volunteer": "Michael R.", "leader": "Ministry Leader", "admin": "Main Administrator"}.get(role, "Public visitor")


def import_public_sources(db):
    results = []
    ordo = {}
    try:
        with urllib.request.urlopen(ORDO_URL, timeout=12) as response:
            payload = json.load(response)
        ordo = {d["date"]: d for d in payload.get("liturgicalDays", []) if d.get("date", "").startswith("2026")}
        results.append(("1962 Ordo Today", "success", "%d calendar days read" % len(ordo)))
    except Exception as exc:
        results.append(("1962 Ordo Today", "cached", "Live refresh failed; cached titles retained: %s" % type(exc).__name__))
    try:
        req = urllib.request.Request(FSSPX_URL, headers={"User-Agent": "ChapelSchedulerAlpha/0.1"})
        with urllib.request.urlopen(req, timeout=12) as response:
            html = response.read().decode("utf-8", "replace")
        match = re.search(r"var jsonDataPage = (\{.*?\});\s*</script>", html, re.S)
        if not match:
            raise ValueError("embedded schedule not found")
        page = json.loads(match.group(1))
        count = 0
        for day in page.get("massDays", []):
            date = day.get("dayYMD")
            if not date or not date.startswith("2026-"):
                continue
            lit = ordo.get(date.replace("-", ""), {}).get("name") or day.get("liturgicalDayName")
            for item in day.get("masses", []):
                if item.get("skip"):
                    continue
                title = re.sub(r"\s+", " ", item.get("description", "")).strip()
                time = re.sub(r"\s+", " ", item.get("time", "")).strip()
                if not title or not time:
                    continue
                db.execute("INSERT OR IGNORE INTO services(service_date,service_time,title,liturgical_day,source,source_url) VALUES(?,?,?,?,?,?)",
                           (date, time, title, lit, "FSSPX Today + 1962 Ordo Today", FSSPX_URL))
                service = db.execute("SELECT id FROM services WHERE service_date=? AND service_time=? AND title=?", (date,time,title)).fetchone()
                if service and "Mass" in title:
                    db.execute("INSERT OR IGNORE INTO assignments(service_id,person_id,ministry,status) VALUES(?,?,?,?)",
                               (service["id"], None, "Sacristan", "open"))
                count += 1
        results.append(("FSSPX Today — Davie", "success", "%d service entries read" % count))
    except Exception as exc:
        results.append(("FSSPX Today — Davie", "cached", "Live refresh failed; cached services retained: %s" % type(exc).__name__))
    for source, status, detail in results:
        db.execute("INSERT INTO import_runs(source,status,detail,created_at) VALUES(?,?,?,?)", (source, status, detail, now()))
    audit(db, "Main Administrator", "refreshed imports", "; ".join(r[1] for r in results))
    return results


class TelegramConnector:
    """Minimal long-polling Telegram adapter for the local alpha."""
    def __init__(self):
        self.thread = None
        self.stop_event = threading.Event()
        self.status = "not connected"
        self.bot_username = None
        self.offset = 0
        self.keyboard_messages = {}

    def token(self):
        try:
            return TOKEN_FILE.read_text().strip()
        except OSError:
            return None

    def call(self, method, payload=None, token=None):
        token = token or self.token()
        if not token:
            raise ValueError("Telegram token is not configured")
        data = urllib.parse.urlencode(payload or {}).encode()
        request = urllib.request.Request("https://api.telegram.org/bot%s/%s" % (token, method), data=data)
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
        if not result.get("ok"):
            raise ValueError(result.get("description", "Telegram rejected the request"))
        return result.get("result")

    def configure(self, token):
        token = token.strip()
        if not re.fullmatch(r"\d{6,}:[A-Za-z0-9_-]{20,}", token):
            raise ValueError("That does not look like a complete BotFather token.")
        profile = self.call("getMe", token=token)
        TOKEN_FILE.write_text(token)
        TOKEN_FILE.chmod(0o600)
        self.bot_username = profile.get("username")
        self.status = "connected"
        self.start()
        return profile

    def start(self):
        if not self.token() or (self.thread and self.thread.is_alive()):
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self.run, name="telegram-alpha", daemon=True)
        self.thread.start()

    def disconnect(self):
        self.stop_event.set()
        if TOKEN_FILE.exists():
            TOKEN_FILE.unlink()
        self.status, self.bot_username = "not connected", None

    def send(self, chat_id, text, keyboard=None):
        payload = {"chat_id": chat_id, "text": text}
        if keyboard:
            payload["reply_markup"] = json.dumps({"inline_keyboard": keyboard})
        result = self.call("sendMessage", payload)
        if keyboard and result and result.get("message_id"):
            self.keyboard_messages.setdefault(str(chat_id), []).append(result["message_id"])
            with connection() as db:
                db.execute("INSERT OR IGNORE INTO telegram_keyboard_messages(chat_id,message_id) VALUES(?,?)",
                           (str(chat_id), result["message_id"]))
                db.commit()
        return result

    def clear_keyboards(self, chat_id):
        key = str(chat_id)
        with connection() as db:
            stored = [row[0] for row in db.execute("SELECT message_id FROM telegram_keyboard_messages WHERE chat_id=?", (key,))]
            db.execute("DELETE FROM telegram_keyboard_messages WHERE chat_id=?", (key,))
            db.commit()
        message_ids = list(dict.fromkeys(self.keyboard_messages.pop(key, []) + stored))
        for message_id in message_ids:
            try:
                self.call("editMessageReplyMarkup", {
                    "chat_id": chat_id, "message_id": message_id,
                    "reply_markup": json.dumps({"inline_keyboard": []}),
                })
            except Exception:
                pass

    def home_keyboard(self):
        return [[{"text": "Show my schedule", "callback_data": "schedule"}]]

    def assignment_keyboard(self):
        return [[{"text": "Refresh my schedule", "callback_data": "schedule"}]]

    def assignment_rows(self, statuses):
        placeholders = ",".join("?" for _ in statuses)
        with connection() as db:
            return db.execute("""SELECT a.id,a.status,s.service_date,s.service_time,s.title FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.person_id=1 AND a.status IN (%s)
                AND s.cancelled=0 AND s.service_date>=? ORDER BY s.service_date,a.id""" % placeholders,
                tuple(statuses) + (date.today().isoformat(),)).fetchall()

    def assignment_list(self, rows):
        return "\n".join("• %s at %s — %s" % (
            friendly_date(row["service_date"]), row["service_time"], row["title"]) for row in rows)

    def pending_keyboard(self, rows):
        buttons = [[{"text": "✓ Confirm all new assignments", "callback_data": "confirm_all"}]]
        for row in rows:
            buttons.append([{"text": "✓ Confirm · %s · %s" % (
                compact_date(row["service_date"]), row["service_time"]), "callback_data": "confirm:%s" % row["id"]}])
        return buttons

    def substitute_keyboard(self, rows):
        return [[{"text": "I can't serve · %s · %s" % (
            compact_date(row["service_date"]), row["service_time"]), "callback_data": "unavailable:%s" % row["id"]}]
            for row in rows]

    def find_substitute_keyboard(self, rows):
        return [[{"text": "Find substitute · %s · %s" % (
            compact_date(row["service_date"]), row["service_time"]), "callback_data": "substitute:%s" % row["id"]}]
            for row in rows]

    def cancel_substitute_keyboard(self, rows):
        buttons = [[{"text": "Cancel request · %s · %s" % (
            compact_date(row["service_date"]), row["service_time"]), "callback_data": "cancel_sub:%s" % row["id"]}]
            for row in rows]
        if len(rows) > 1:
            buttons.insert(0, [{"text": "Cancel all substitute requests", "callback_data": "cancel_sub_all"}])
        return buttons

    def send_schedule_bundle(self, chat_id):
        self.clear_keyboards(chat_id)
        confirmed = self.assignment_rows(("confirmed",))
        pending = self.assignment_rows(("pending",))
        requested = self.assignment_rows(("substitute requested",))
        self.send(chat_id, "CONFIRMED ASSIGNMENTS\n" + (self.assignment_list(confirmed) if confirmed else "None."))
        if pending:
            self.send(chat_id, "NEW ASSIGNMENTS — PLEASE REVIEW\n" + self.assignment_list(pending), self.pending_keyboard(pending))
        else:
            self.send(chat_id, "NEW ASSIGNMENTS\nYou have no new assignments awaiting confirmation.")
        if confirmed:
            self.send(chat_id, "NEED TO CHANGE A CONFIRMED ASSIGNMENT?\nUse a button below, or type what you need—for example, \"I can't serve July 17\" or \"I'm away July 17-20.\" The bot will ask you to confirm before changing the schedule.\n\nYou remain assigned until a qualified substitute accepts.", self.substitute_keyboard(confirmed))
        if requested:
            self.send(chat_id, "SUBSTITUTE REQUESTS IN PROGRESS\n" + self.assignment_list(requested) +
                      "\n\nTo change these, message: Cancel my substitute request.")

    def assignment_buttons(self):
        with connection() as db:
            rows = db.execute("""SELECT a.id,a.status,s.service_date,s.service_time FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status IN ('pending','confirmed') AND s.cancelled=0 AND s.service_date>=?
                ORDER BY s.service_date,a.id LIMIT 8""", (date.today().isoformat(),)).fetchall()
        buttons = []
        if any(row["status"] == "pending" for row in rows):
            buttons.extend([
                [{"text": "✓ Confirm all new assignments", "callback_data": "confirm_all"}],
                [{"text": "Review assignments individually", "callback_data": "review"}],
            ])
        for row in rows:
            if row["status"] != "confirmed":
                continue
            label, action = "I can't serve", "unavailable:%s" % row["id"]
            buttons.append([{"text": "%s · %s · %s" % (label, compact_date(row["service_date"]), row["service_time"]),
                             "callback_data": action}])
        return buttons

    def review_buttons(self):
        with connection() as db:
            rows = db.execute("""SELECT a.id,s.service_date,s.service_time FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status='pending' AND s.cancelled=0 AND s.service_date>=?
                ORDER BY s.service_date,a.id""", (date.today().isoformat(),)).fetchall()
        buttons = []
        for row in rows:
            when = "%s · %s" % (compact_date(row["service_date"]), row["service_time"])
            buttons.append([{"text": "✓ Confirm · %s" % when, "callback_data": "confirm:%s" % row["id"]}])
            buttons.append([{"text": "I can't serve · %s" % when, "callback_data": "unavailable:%s" % row["id"]}])
        buttons.append([{"text": "Back to my schedule", "callback_data": "schedule"}])
        return buttons

    def confirm_all(self):
        with connection() as db:
            count = db.execute("""SELECT COUNT(*) FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status='pending' AND s.cancelled=0 AND s.service_date>=?""",
                (date.today().isoformat(),)).fetchone()[0]
            db.execute("""UPDATE assignments SET status='confirmed' WHERE id IN (
                SELECT a.id FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status='pending' AND s.cancelled=0 AND s.service_date>=?)""",
                (date.today().isoformat(),))
            audit(db, "Michael R. via Telegram", "confirmed weekly assignment review", "%s new assignments confirmed together" % count)
            db.commit()
        return "All %s new assignments are confirmed. If something changes, use I can't serve from your schedule." % count

    def unavailable_reason(self, assignment_id):
        with connection() as db:
            row = db.execute("""SELECT a.status,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.id=? AND a.person_id=1 AND s.cancelled=0""", (assignment_id,)).fetchone()
        if not row or row["status"] not in ("pending", "confirmed"):
            return "That assignment is not available for this action.", self.home_keyboard()
        text = "You indicated that you cannot serve for %s on %s at %s. Is this a one-time conflict, or should your regular availability change?" % (
            row["title"], friendly_date(row["service_date"]), row["service_time"])
        return text, [
            [{"text": "One-time conflict", "callback_data": "conflict:%s:once" % assignment_id}],
            [{"text": "Update my regular availability", "callback_data": "conflict:%s:update" % assignment_id}],
            [{"text": "Cancel", "callback_data": "schedule"}],
        ]

    def record_conflict(self, assignment_id, kind):
        with connection() as db:
            row = db.execute("SELECT id FROM assignments WHERE id=? AND person_id=1 AND status IN ('pending','confirmed')", (assignment_id,)).fetchone()
            if row:
                audit(db, "Michael R. via Telegram", "reported scheduling conflict",
                      "One-time conflict" if kind == "once" else "Regular availability update requested")
                db.commit()
        prefix = "One-time conflict recorded. " if kind == "once" else "Availability update requested. In production, the bot would guide you through the affected preferences. "
        text, keyboard = self.substitute_choices(assignment_id)
        return prefix + text, keyboard

    def substitute_choices(self, assignment_id):
        with connection() as db:
            assignment = db.execute("""SELECT a.id,a.status,s.service_date,s.service_time,s.title FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.id=? AND a.person_id=1 AND s.cancelled=0""",
                (assignment_id,)).fetchone()
            people = db.execute("SELECT id,name FROM people WHERE role='volunteer' AND qualified=1 AND active=1 AND id<>1 ORDER BY name").fetchall()
        if not assignment or assignment["status"] not in ("pending", "confirmed"):
            return "That assignment is not available for a substitute request.", self.home_keyboard()
        text = "Choose a qualified sacristan to ask about %s on %s at %s. You remain assigned until someone accepts." % (
            assignment["title"], friendly_date(assignment["service_date"]), assignment["service_time"])
        keyboard = [[{"text": "Ask %s" % person["name"],
                      "callback_data": "suboffer:%s:%s" % (assignment_id, person["id"])}] for person in people]
        keyboard.append([{"text": "Cancel", "callback_data": "schedule"}])
        return text, keyboard

    def request_substitute(self, assignment_id, person_id):
        with connection() as db:
            assignment = db.execute("""SELECT a.id,a.status,s.service_date,s.service_time,s.title FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.id=? AND a.person_id=1 AND s.cancelled=0""",
                (assignment_id,)).fetchone()
            person = db.execute("SELECT id,name FROM people WHERE id=? AND role='volunteer' AND qualified=1 AND active=1", (person_id,)).fetchone()
            if not assignment or assignment["status"] not in ("pending", "confirmed") or not person:
                return "That substitute request is no longer available."
            db.execute("INSERT INTO substitute_requests(assignment_id,requested_person_id,status,created_at) VALUES(?,?,?,?)",
                       (assignment_id, person_id, "offered", now()))
            db.execute("UPDATE assignments SET status='substitute requested' WHERE id=?", (assignment_id,))
            db.execute("INSERT INTO outbox(channel,recipient,subject,status,created_at) VALUES(?,?,?,?,?)",
                       ("Telegram + email", person["name"], "Qualified substitute request", "queued demo", now()))
            audit(db, "Michael R. via Telegram", "requested substitute",
                  "Offer queued to %s; original volunteer remains assigned" % person["name"])
            db.commit()
        return "Request sent privately to %s for %s on %s at %s. You remain assigned until he accepts." % (
            person["name"], assignment["title"], friendly_date(assignment["service_date"]), assignment["service_time"])

    def schedule_text(self, person_id=1):
        with connection() as db:
            rows = db.execute("""SELECT s.service_date,s.service_time,s.title,a.status FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.person_id=? AND s.cancelled=0 ORDER BY s.service_date,a.id""", (person_id,)).fetchall()
        if not rows:
            return "You have no assignments in the alpha schedule."
        return "Your sacristan assignments:\n" + "\n".join("• %s at %s — %s (%s)" % (friendly_date(r["service_date"]),r["service_time"],r["title"],r["status"]) for r in rows)

    def natural_schedule_message(self, text):
        lowered = text.lower().replace("–", "-").replace("—", "-")
        if "cancel" in lowered and ("sub" in lowered or "substitute" in lowered):
            rows = self.assignment_rows(("substitute requested",))
            if not rows:
                return "You have no active substitute requests to cancel.", self.home_keyboard()
            prompt = "I understood that you want to cancel a substitute request and remain assigned. Choose the request to cancel:"
            return prompt, self.cancel_substitute_keyboard(rows)
        months = {name.lower(): number for number, name in enumerate([
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"], 1)}
        date_match = re.search(r"\b(" + "|".join(months) + r")\s+(\d{1,2})(?:\s*(?:-|to|through)\s*(?:(?:" + "|".join(months) + r")\s+)?(\d{1,2}))?\b", lowered)
        if not date_match:
            return None
        month, first_day = months[date_match.group(1)], int(date_match.group(2))
        last_day = int(date_match.group(3) or first_day)
        try:
            start = date(date.today().year, month, first_day)
            end = date(date.today().year, month, last_day)
        except ValueError:
            return "I could not interpret that date. Try, for example: I am unavailable July 17-20.", self.home_keyboard()
        if end < start:
            return "The ending date appears to be before the starting date. Please enter the dates again.", self.home_keyboard()
        is_range = last_day != first_day or any(word in lowered for word in ("vacation", "away", "unavailable from"))
        if is_range:
            text = "I understood that you will be unavailable from %s through %s. Is that correct?" % (
                friendly_date(start.isoformat()), friendly_date(end.isoformat()))
            keyboard = [[{"text": "Yes, record these dates", "callback_data": "absence:%s:%s" % (start.isoformat(), end.isoformat())}],
                        [{"text": "Cancel", "callback_data": "schedule"}]]
            return text, keyboard
        if "can't serve" in lowered or "cannot serve" in lowered or "cant serve" in lowered:
            rows = self.assignment_rows(("pending", "confirmed"))
            matches = [row for row in rows if row["service_date"] == start.isoformat()]
            if not matches:
                return "I found no assignment for you on %s. No change was made." % friendly_date(start.isoformat()), self.home_keyboard()
            if len(matches) == 1:
                return self.unavailable_reason(matches[0]["id"])
            return "I found more than one assignment that day. Which one can you not serve?", self.substitute_keyboard(matches)
        return None

    def cancel_substitute_request(self, assignment_id=None):
        with connection() as db:
            if assignment_id is None:
                rows = db.execute("""SELECT a.id,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                    WHERE a.person_id=1 AND a.status='substitute requested' ORDER BY s.service_date,a.id""").fetchall()
            else:
                rows = db.execute("""SELECT a.id,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                    WHERE a.id=? AND a.person_id=1 AND a.status='substitute requested'""", (assignment_id,)).fetchall()
            if not rows:
                return "That substitute request is no longer active."
            ids = [row["id"] for row in rows]
            placeholders = ",".join("?" for _ in ids)
            db.execute("UPDATE assignments SET status='confirmed' WHERE id IN (%s)" % placeholders, ids)
            db.execute("UPDATE substitute_requests SET status='cancelled' WHERE status='offered' AND assignment_id IN (%s)" % placeholders, ids)
            db.execute("UPDATE outbox SET status='cancelled demo' WHERE status='queued demo' AND subject='Qualified substitute request'")
            audit(db, "Michael R. via Telegram", "cancelled substitute request",
                  "%s assignments restored to confirmed" % len(rows))
            db.commit()
        return "%s substitute request%s cancelled. You remain confirmed for:\n%s" % (
            len(rows), "" if len(rows) == 1 else "s", self.assignment_list(rows))

    def record_absence(self, start_date, end_date):
        with connection() as db:
            db.execute("INSERT INTO absences(person_id,start_date,end_date,source,created_at) VALUES(?,?,?,?,?)",
                       (1, start_date, end_date, "Telegram plain-language entry", now()))
            rows = db.execute("""SELECT a.id,a.status,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status IN ('pending','confirmed') AND s.service_date BETWEEN ? AND ?
                ORDER BY s.service_date,a.id""", (start_date, end_date)).fetchall()
            audit(db, "Michael R. via Telegram", "recorded absence", "%s through %s; %s affected assignments" % (start_date, end_date, len(rows)))
            db.commit()
        text = "Your absence from %s through %s has been recorded." % (friendly_date(start_date), friendly_date(end_date))
        if rows:
            text += "\n\nThese assignments need substitutes:\n" + self.assignment_list(rows)
            return text, self.find_substitute_keyboard(rows)
        return text + " You have no assignments during that period.", self.home_keyboard()

    def open_text(self):
        with connection() as db:
            count = db.execute("""SELECT COUNT(*) FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.status='open' AND s.cancelled=0 AND s.service_date>=?
                """, (date.today().isoformat(),)).fetchone()[0]
        if not count:
            return "There are no open sacristan positions."
        return "Open positions — tap a service below to volunteer:"

    def volunteer_buttons(self):
        with connection() as db:
            rows = db.execute("""SELECT a.id,s.service_date,s.service_time,s.title FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.status='open' AND s.cancelled=0 AND s.service_date>=?
                ORDER BY s.service_date,a.id LIMIT 6""", (date.today().isoformat(),)).fetchall()
        buttons = [[{"text": "VOLUNTEER · %s · %s · %s" % (friendly_date(r["service_date"]), r["service_time"], r["title"]),
                     "callback_data": "volunteer:%s" % r["id"]}] for r in rows]
        return buttons

    def open_keyboard(self):
        return self.volunteer_buttons()

    def volunteer(self, assignment_id):
        with connection() as db:
            qualified = db.execute("SELECT qualified FROM people WHERE id=1 AND active=1").fetchone()
            row = db.execute("""SELECT a.status,s.service_date,s.service_time,s.title FROM assignments a
                JOIN services s ON s.id=a.service_id WHERE a.id=? AND s.cancelled=0""", (assignment_id,)).fetchone()
            if not qualified or not qualified["qualified"]:
                return "Your profile is not currently eligible for this assignment. Contact the ministry leader."
            if not row or row["status"] != "open":
                return "That position is no longer open. Select Open positions to refresh the list."
            db.execute("UPDATE assignments SET person_id=1,status='confirmed' WHERE id=? AND status='open'", (assignment_id,))
            audit(db, "Michael R. via Telegram", "volunteered for open assignment",
                  "%s %s %s; confirmed by the volunteer action" % (row["service_date"],row["service_time"],row["title"]))
            db.commit()
        return "Accepted. You are confirmed as sacristan for %s on %s at %s." % (row["title"],friendly_date(row["service_date"]),row["service_time"])

    def confirm_next(self):
        with connection() as db:
            row = db.execute("""SELECT a.id,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.person_id=1 AND a.status='pending' AND s.cancelled=0 ORDER BY s.service_date,a.id LIMIT 1""").fetchone()
            if not row:
                return "You have no assignments awaiting confirmation."
            db.execute("UPDATE assignments SET status='confirmed' WHERE id=?", (row["id"],))
            audit(db, "Michael R. via Telegram", "confirmed assignment", "%s %s %s" % (row["service_date"],row["service_time"],row["title"]))
            db.commit()
        return "Confirmed: %s on %s at %s." % (row["title"],friendly_date(row["service_date"]),row["service_time"])

    def confirm_assignment(self, assignment_id):
        with connection() as db:
            row = db.execute("""SELECT a.id,a.status,s.service_date,s.service_time,s.title FROM assignments a JOIN services s ON s.id=a.service_id
                WHERE a.id=? AND a.person_id=1 AND s.cancelled=0""", (assignment_id,)).fetchone()
            if not row:
                return "That assignment is not available on your schedule."
            if row["status"] != "pending":
                return "That assignment is already %s." % row["status"]
            db.execute("UPDATE assignments SET status='confirmed' WHERE id=?", (assignment_id,))
            audit(db, "Michael R. via Telegram", "confirmed assignment",
                  "%s %s %s" % (row["service_date"],row["service_time"],row["title"]))
            db.commit()
        return "Confirmed: %s on %s at %s." % (row["title"],friendly_date(row["service_date"]),row["service_time"])

    def link_alpha_user(self, message):
        user, chat = message.get("from", {}), message.get("chat", {})
        with connection() as db:
            db.execute("""INSERT INTO telegram_links(person_id,telegram_user_id,chat_id,username,linked_at) VALUES(?,?,?,?,?)
                ON CONFLICT(person_id) DO UPDATE SET telegram_user_id=excluded.telegram_user_id,chat_id=excluded.chat_id,
                username=excluded.username,linked_at=excluded.linked_at""",
                (1,str(user.get("id")),str(chat.get("id")),user.get("username"),now()))
            audit(db, "Michael R. via Telegram", "linked Telegram alpha account", "Private bot chat linked; no phone number stored")
            db.commit()

    def handle(self, update):
        message, callback = update.get("message"), update.get("callback_query")
        if message:
            text, chat = message.get("text", ""), message.get("chat", {})
            chat_id, chat_type = chat.get("id"), chat.get("type")
            if chat_type != "private":
                self.send(chat_id, "Chapel Scheduler group mode is not enabled in this alpha. For privacy, open the bot directly to view assignments or take scheduling actions.")
                return
            if text.startswith("/start"):
                self.link_alpha_user(message)
                self.send(chat_id, "Welcome to the Chapel Scheduler alpha. You are linked to the fictional Michael R. sacristan profile. Nothing here affects a real chapel schedule.")
                self.send_schedule_bundle(chat_id)
            elif text.startswith("/schedule"):
                self.send_schedule_bundle(chat_id)
            elif text.startswith("/open"):
                self.clear_keyboards(chat_id)
                self.send(chat_id, self.open_text(), self.open_keyboard())
            else:
                natural = self.natural_schedule_message(text)
                if natural:
                    self.clear_keyboards(chat_id)
                    self.send(chat_id, natural[0], natural[1])
                else:
                    self.send(chat_id, "I did not understand that yet. Try: I can't serve July 17, or I am on vacation July 17-20. You can also send /schedule or /open.", self.home_keyboard())
        elif callback:
            callback_chat = callback.get("message", {}).get("chat", {})
            chat_id, action = callback_chat.get("id"), callback.get("data")
            if callback_chat.get("type") != "private":
                try:
                    self.call("answerCallbackQuery", {"callback_query_id": callback.get("id"), "text": "Open the private bot chat for scheduling actions."})
                except Exception:
                    pass
                return
            try:
                self.call("answerCallbackQuery", {"callback_query_id": callback.get("id"), "text": "Processing…"})
            except Exception:
                pass
            self.clear_keyboards(chat_id)
            if action == "schedule":
                self.send_schedule_bundle(chat_id)
                return
            elif action == "open":
                text, keyboard = self.open_text(), self.open_keyboard()
            elif action == "confirm":
                text, keyboard = self.confirm_next(), self.home_keyboard()
            elif action == "confirm_all":
                self.send(chat_id, self.confirm_all())
                self.send_schedule_bundle(chat_id)
                return
            elif action == "review":
                text, keyboard = "Review each new assignment. Confirm the ones you can serve and flag only the exceptions.", self.review_buttons()
            elif action and action.startswith("confirm:"):
                self.send(chat_id, self.confirm_assignment(int(action.split(":", 1)[1])))
                self.send_schedule_bundle(chat_id)
                return
            elif action and action.startswith("absence:"):
                _, start_date, end_date = action.split(":")
                text, keyboard = self.record_absence(start_date, end_date)
            elif action == "cancel_sub_all":
                self.send(chat_id, self.cancel_substitute_request())
                self.send_schedule_bundle(chat_id)
                return
            elif action and action.startswith("cancel_sub:"):
                self.send(chat_id, self.cancel_substitute_request(int(action.split(":", 1)[1])))
                self.send_schedule_bundle(chat_id)
                return
            elif action and action.startswith("unavailable:"):
                text, keyboard = self.unavailable_reason(int(action.split(":", 1)[1]))
            elif action and action.startswith("conflict:"):
                _, assignment_id, kind = action.split(":")
                text, keyboard = self.record_conflict(int(assignment_id), kind)
            elif action and action.startswith("substitute:"):
                text, keyboard = self.substitute_choices(int(action.split(":", 1)[1]))
            elif action and action.startswith("suboffer:"):
                _, assignment_id, person_id = action.split(":")
                text, keyboard = self.request_substitute(int(assignment_id), int(person_id)), self.assignment_keyboard()
            elif action and action.startswith("volunteer:"):
                self.send(chat_id, self.volunteer(int(action.split(":", 1)[1])) + "\n\nSend /open to see the remaining volunteer opportunities.")
                return
            else:
                text, keyboard = "Unknown action.", self.home_keyboard()
            self.send(chat_id, text, keyboard)

    def run(self):
        self.status = "connected"
        while not self.stop_event.is_set() and self.token():
            try:
                updates = self.call("getUpdates", {"offset": self.offset, "timeout": 20, "allowed_updates": json.dumps(["message","callback_query"])})
                for update in updates:
                    self.offset = max(self.offset, update["update_id"] + 1)
                    self.handle(update)
                self.status = "connected"
            except Exception as exc:
                self.status = "connection error: %s" % type(exc).__name__
                time.sleep(3)


telegram = TelegramConnector()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def json_response(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def role(self):
        return self.headers.get("X-Demo-Role", "public")

    def require(self, *roles):
        if self.role() not in roles:
            self.json_response({"error": "This action is not permitted for the selected role."}, 403)
            return False
        return True

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/state":
            return super().do_GET()
        role = parse_qs(parsed.query).get("role", [self.role()])[0]
        with connection() as db:
            services = [dict(r) for r in db.execute("SELECT * FROM services WHERE public=1 AND service_date LIKE '2026-07-%' ORDER BY service_date, id")]
            if role != "public":
                assignments = [dict(r) for r in db.execute("""SELECT a.*,p.name person_name,s.service_date,s.service_time,s.title
                    FROM assignments a JOIN services s ON s.id=a.service_id LEFT JOIN people p ON p.id=a.person_id
                    WHERE s.service_date LIKE '2026-07-%' ORDER BY s.service_date,a.id""")]
            else:
                assignments = []
            people = [dict(r) for r in db.execute("SELECT id,name,qualified FROM people WHERE role='volunteer' AND active=1")] if role in ("volunteer","leader","admin") else []
            outbox = [dict(r) for r in db.execute("SELECT * FROM outbox ORDER BY id DESC LIMIT 10")] if role in ("leader","admin") else []
            audits = [dict(r) for r in db.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 10")] if role == "admin" else []
            imports = [dict(r) for r in db.execute("SELECT * FROM import_runs ORDER BY id DESC LIMIT 4")]
            telegram_links = db.execute("SELECT COUNT(*) FROM telegram_links").fetchone()[0]
        self.json_response({"role": role, "services": services, "assignments": assignments, "people": people,
                            "outbox": outbox, "audit": audits, "imports": imports,
                            "telegram": {"configured": bool(telegram.token()), "status": telegram.status,
                                         "bot_username": telegram.bot_username, "linked_testers": telegram_links} if role == "admin" else {}})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self.body()
            with connection() as db:
                if path == "/api/reset":
                    if not self.require("admin"): return
                    db.close(); initialize(True); return self.json_response({"ok": True})
                if path == "/api/imports/refresh":
                    if not self.require("admin"): return
                    results = import_public_sources(db); db.commit()
                    return self.json_response({"ok": True, "results": results})
                if path == "/api/telegram/config":
                    if not self.require("admin"): return
                    profile = telegram.configure(data.get("token", ""))
                    audit(db, actor_for(self.role()), "connected Telegram test bot", "@%s" % profile.get("username"))
                    db.commit()
                    return self.json_response({"ok": True, "username": profile.get("username")})
                if path == "/api/telegram/disconnect":
                    if not self.require("admin"): return
                    telegram.disconnect()
                    audit(db, actor_for(self.role()), "disconnected Telegram test bot", "Local token deleted")
                    db.commit()
                    return self.json_response({"ok": True})
                if path == "/api/assignments/confirm-all":
                    if not self.require("volunteer"): return
                    count = db.execute("SELECT COUNT(*) FROM assignments WHERE person_id=1 AND status='pending'").fetchone()[0]
                    db.execute("UPDATE assignments SET status='confirmed' WHERE person_id=1 AND status='pending'")
                    audit(db, actor_for(self.role()), "confirmed weekly assignment review", "%s assignments confirmed together" % count)
                    db.commit(); return self.json_response({"ok": True, "count": count})
                m = re.fullmatch(r"/api/assignments/(\d+)/confirm", path)
                if m:
                    if not self.require("volunteer"): return
                    aid = int(m.group(1))
                    row = db.execute("SELECT a.*,s.title,s.service_date FROM assignments a JOIN services s ON s.id=a.service_id WHERE a.id=?", (aid,)).fetchone()
                    if not row or row["person_id"] != 1: return self.json_response({"error": "That assignment does not belong to Michael."}, 403)
                    db.execute("UPDATE assignments SET status='confirmed' WHERE id=?", (aid,))
                    audit(db, actor_for(self.role()), "confirmed assignment", "%s on %s" % (row["title"], row["service_date"]))
                    db.commit(); return self.json_response({"ok": True})
                m = re.fullmatch(r"/api/assignments/(\d+)/substitute", path)
                if m:
                    if not self.require("volunteer"): return
                    aid, candidate = int(m.group(1)), int(data.get("candidate_id", 0))
                    assignment = db.execute("SELECT * FROM assignments WHERE id=? AND person_id=1", (aid,)).fetchone()
                    person = db.execute("SELECT * FROM people WHERE id=? AND role='volunteer' AND qualified=1", (candidate,)).fetchone()
                    if not assignment or not person: return self.json_response({"error": "Choose a qualified substitute."}, 400)
                    db.execute("INSERT INTO substitute_requests(assignment_id,requested_person_id,status,created_at) VALUES(?,?,?,?)", (aid,candidate,"offered",now()))
                    db.execute("UPDATE assignments SET status='substitute requested' WHERE id=?", (aid,))
                    db.execute("INSERT INTO outbox(channel,recipient,subject,status,created_at) VALUES(?,?,?,?,?)", ("Telegram + email",person["name"],"Qualified substitute request","queued demo",now()))
                    audit(db, actor_for(self.role()), "requested substitute", "Offer queued to %s; original volunteer remains assigned" % person["name"])
                    db.commit(); return self.json_response({"ok": True})
                if path == "/api/services":
                    if not self.require("leader", "admin"): return
                    cur = db.execute("INSERT INTO services(service_date,service_time,title,liturgical_day,source,source_url) VALUES(?,?,?,?,?,?)",
                                     (data["date"],data["time"],data["title"],data.get("liturgical_day","Manual entry"),"manual",None))
                    if data.get("needs_sacristan", True):
                        db.execute("INSERT INTO assignments(service_id,person_id,ministry,status) VALUES(?,?,?,?)", (cur.lastrowid,None,"Sacristan","open"))
                    audit(db, actor_for(self.role()), "created service", "%s %s %s" % (data["date"],data["time"],data["title"]))
                    db.commit(); return self.json_response({"ok": True}, 201)
        except (KeyError, ValueError, sqlite3.IntegrityError) as exc:
            return self.json_response({"error": str(exc)}, 400)
        self.json_response({"error": "Not found"}, 404)

    def log_message(self, fmt, *args):
        if "/api/" in getattr(self, "requestline", ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    initialize("--reset" in sys.argv)
    telegram.start()
    port = 8081
    print("Chapel Scheduler alpha: http://127.0.0.1:%d" % port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
