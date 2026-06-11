import Link from "next/link";
import {
  UserPlus, MessageCircle, Settings, ClipboardList, BookOpen,
  Bell, Calendar, ChevronRight, Users,
} from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

const LINKS = [
  { href: "/admissions",     icon: UserPlus,      labelKey: "admissions",     descKey: "admissionsDesc" },
  { href: "/exams",          icon: ClipboardList, labelKey: "exams",          descKey: "examsDesc" },
  { href: "/timetable",      icon: Calendar,      labelKey: "timetable",      descKey: "timetableDesc" },
  { href: "/homework",       icon: BookOpen,      labelKey: "homework",       descKey: "homeworkDesc" },
  { href: "/notices",        icon: Bell,          labelKey: "notices",        descKey: "noticesDesc" },
  { href: "/communications", icon: MessageCircle, labelKey: "communications", descKey: "communicationsDesc" },
  { href: "/settings",       icon: Settings,      labelKey: "settings",       descKey: "settingsDesc" },
] as const;

// Teacher: their daily academic tools only — no admissions/messaging admin.
// Students + Exams + Timetable + Notices + Settings (Fees & Homework live in their bottom nav).
const TEACHER_LINKS = [
  { href: "/students",  icon: Users,         labelKey: "students",  descKey: null },
  { href: "/exams",     icon: ClipboardList, labelKey: "exams",     descKey: "examsDesc" },
  { href: "/timetable", icon: Calendar,      labelKey: "timetable", descKey: "timetableDesc" },
  { href: "/notices",   icon: Bell,          labelKey: "notices",   descKey: "noticesDesc" },
  { href: "/settings",  icon: Settings,      labelKey: "settings",  descKey: "settingsDesc" },
] as const;

export default async function MorePage() {
  const { membership } = await requireInstitution();
  const messages = getMessages(await getLocale());
  const links = membership.role === "TEACHER" ? TEACHER_LINKS : LINKS;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">{messages.more.title}</h1>
      <div className="space-y-2">
        {links.map(({ href, icon: Icon, labelKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border rounded-xl p-4 hover:bg-muted/50 transition-colors min-h-[60px]"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{messages.nav[labelKey]}</p>
              {descKey && <p className="text-xs text-muted-foreground">{messages.more[descKey]}</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
