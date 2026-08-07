import {
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  HandRaisedIcon,
  HomeIcon,
  ListBulletIcon,
  LifebuoyIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  UserCircleIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline"

const action = (id, label, icon) => ({ id, label, icon })

const profileSection = {
  id: "profile",
  label: "My Profile",
  icon: UserCircleIcon,
  description: "Manage personal details and account-wide preferences.",
  actions: [action("profile-details", "Profile", UserCircleIcon)],
}

const supportSection = {
  id: "support",
  label: "Support",
  icon: LifebuoyIcon,
  description: "Contact the chapel support team and attach screenshots or supporting files.",
  actions: [action("contact-support", "Contact Support", LifebuoyIcon)],
}

const ministrySections = [
  {
    id: "overview",
    label: "Overview",
    icon: HomeIcon,
    description:
      "A clear view of upcoming work, coverage, and ministry activity.",
    actions: [
      action("summary", "Summary", Squares2X2Icon),
      action("activity", "Activity", ListBulletIcon),
      action("alerts", "Alerts", BellAlertIcon),
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: CalendarDaysIcon,
    description: "Review assignments and ministry coverage by date and time.",
    actions: [
      action("month", "Month", CalendarIcon),
      action("week", "Week", TableCellsIcon),
      action("today", "Today", ListBulletIcon),
      action("custom", "Custom", AdjustmentsHorizontalIcon),
    ],
  },
  {
    id: "events",
    label: "Events",
    icon: CalendarIcon,
    description: "Create and manage every event belonging to this ministry.",
    actions: [
      action("add-event", "Add Event", PlusIcon),
      action("modify", "Modify", PencilSquareIcon),
      action("cancel", "Cancel", NoSymbolIcon),
    ],
  },
  {
    id: "members",
    label: "Members",
    icon: UserGroupIcon,
    description:
      "Manage members, access roles, and the level-to-capability hierarchy.",
    actions: [
      action("add-member", "Add Member", PlusIcon),
      action("levels", "Levels & Capabilities", AdjustmentsHorizontalIcon),
      action("member-access", "Member Access", UsersIcon),
      action("roster", "Roster", ListBulletIcon),
    ],
  },
  {
    id: "responsibilities",
    label: "Responsibilities",
    icon: ClipboardDocumentCheckIcon,
    description: "Define positions and monitor coverage for upcoming events.",
    actions: [
      action("add-responsibility", "Add", PlusIcon),
      action("assign", "Assign", UserGroupIcon),
      action("coverage", "Coverage", CheckCircleIcon),
    ],
  },
  {
    id: "volunteers",
    label: "Volunteers",
    icon: HandRaisedIcon,
    description:
      "Review one-time volunteers without adding them to the roster.",
    actions: [
      action("invite", "Invite", PlusIcon),
      action("signups", "Signups", ListBulletIcon),
      action("approvals", "Approvals", CheckCircleIcon),
    ],
  },
  {
    id: "templates",
    label: "Templates",
    icon: DocumentDuplicateIcon,
    description: "Build reusable responsibility sets for repeatable events.",
    actions: [
      action("new-template", "New", PlusIcon),
      action("duplicate", "Duplicate", DocumentDuplicateIcon),
      action("archive", "Archive", ArchiveBoxIcon),
    ],
  },
  {
    id: "availability",
    label: "Availability",
    icon: ClockIcon,
    description: "Capture preferences, recurring availability, and absences.",
    actions: [
      action("my-availability", "Mine", UserCircleIcon),
      action("team-availability", "Team", UsersIcon),
      action("conflicts", "Conflicts", BellAlertIcon),
    ],
  },
  {
    id: "messages",
    label: "Messages",
    icon: ChatBubbleLeftRightIcon,
    description: "Keep ministry announcements and conversations together.",
    actions: [
      action("new-message", "New", PlusIcon),
      action("inbox", "Inbox", ChatBubbleLeftRightIcon),
      action("announcements", "Notices", BellAlertIcon),
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: ChartBarIcon,
    description: "Understand participation, coverage, and recent workload.",
    actions: [
      action("participation", "Service", ChartBarIcon),
      action("coverage-report", "Coverage", EyeIcon),
      action("export", "Export", ArrowDownTrayIcon),
    ],
  },
  {
    id: "settings",
    label: "Ministry Settings",
    shortLabel: "Settings",
    icon: Cog6ToothIcon,
    description: "Control ministry details, permissions, and notifications.",
    actions: [
      action("general", "General", Cog6ToothIcon),
      action("permissions", "Access", UsersIcon),
      action("notifications", "Alerts", BellAlertIcon),
    ],
  },
]

const memberSections = [
  {
    id: "schedule",
    label: "Calendar",
    icon: CalendarDaysIcon,
    description:
      "See every published event. Events assigned to your selected profiles are outlined in orange.",
    actions: [
      action("month", "Month", CalendarIcon),
      action("week", "Week", TableCellsIcon),
      action("today", "Today", ListBulletIcon),
    ],
  },
  {
    id: "events",
    label: "Events",
    icon: CalendarIcon,
    description: "View this ministry's events and the events assigned to you.",
    actions: [
      action("all-events", "All Events", CalendarIcon),
      action("my-events", "My Events", CheckCircleIcon),
    ],
  },
  {
    id: "availability",
    label: "Availability",
    icon: ClockIcon,
    description: "Block dates when this profile cannot be scheduled.",
    actions: [
      action("my-availability", "Availability", ClockIcon),
    ],
  },
]

export { memberSections, ministrySections, profileSection, supportSection }
