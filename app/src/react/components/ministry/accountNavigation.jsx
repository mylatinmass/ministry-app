import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  HomeIcon,
  LifebuoyIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline"

const accountSections = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
    description: "Your assignments, calendar, and ministries.",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDaysIcon,
    description: "See public events and events visible to this profile.",
  },
  {
    id: "events",
    label: "Events",
    icon: CheckCircleIcon,
    description: "Review your assigned events or create a new event.",
  },
  {
    id: "availability",
    label: "Availability",
    icon: ClockIcon,
    description: "Set specific dates, date ranges, and automatic scheduling rules.",
  },
  {
    id: "messages",
    label: "Messages",
    icon: ChatBubbleLeftRightIcon,
    description: "Read messages sent to this profile.",
  },
  {
    id: "ministries",
    label: "Ministries",
    icon: Squares2X2Icon,
    description: "Open the ministry workspaces available to this profile.",
  },
  {
    id: "members",
    label: "Members",
    icon: UserGroupIcon,
    description: "View and manage members in the ministries you administer.",
    managerOnly: true,
  },
  {
    id: "chapel-settings",
    label: "Chapel Settings",
    icon: Cog6ToothIcon,
    description: "Manage chapel information, defaults, and local observances.",
    globalAdminOnly: true,
  },
  {
    id: "profile",
    label: "My Profile",
    icon: UserCircleIcon,
    description: "Manage personal details and account-wide preferences.",
  },
  {
    id: "support",
    label: "Support",
    icon: LifebuoyIcon,
    description:
      "Contact the chapel support team and attach screenshots or supporting files.",
  },
]

const accountSectionUrl = (sectionId) =>
  sectionId === "home" ? "/" : `/?section=${sectionId}`

export { accountSections, accountSectionUrl }
