import Link from "next/link";
import {
  UserPlus, MessageCircle, Settings, ClipboardList, BookOpen,
  Bell, Calendar, ChevronRight,
} from "lucide-react";

const LINKS = [
  { href: "/admissions",     icon: UserPlus,      label: "Admissions",     desc: "Leads pipeline" },
  { href: "/exams",          icon: ClipboardList, label: "Exams",          desc: "Marks & results" },
  { href: "/timetable",      icon: Calendar,      label: "Timetable",      desc: "Class schedule" },
  { href: "/homework",       icon: BookOpen,      label: "Homework",       desc: "Assignments" },
  { href: "/notices",        icon: Bell,          label: "Notices",        desc: "Notice board" },
  { href: "/communications", icon: MessageCircle, label: "Communications", desc: "Templates & messages" },
  { href: "/settings",       icon: Settings,      label: "Settings",       desc: "Team & institution" },
];

export default function MorePage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">More</h1>
      <div className="space-y-2">
        {LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border rounded-xl p-4 hover:bg-muted/50 transition-colors min-h-[60px]"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
