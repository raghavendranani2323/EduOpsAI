import { Download, FileSpreadsheet, Users, Wallet, CalendarCheck } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function ExportPage() {
  const { membership } = await requireInstitution();
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
    redirect("/dashboard");
  }
  const messages = getMessages(await getLocale());

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.exportPage.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {messages.exportPage.description}
        </p>
      </div>

      <div className="space-y-3">
        <ExportRow
          icon={Users}
          title={messages.exportPage.students}
          description={messages.exportPage.studentsDesc}
          href="/api/export/students"
          allowed={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <ExportRow
          icon={Wallet}
          title={messages.exportPage.feeInvoices}
          description={messages.exportPage.feeInvoicesDesc}
          href="/api/export/fees"
          extra={
            <details className="text-xs">
              <summary className="cursor-pointer text-primary font-medium">{messages.exportPage.filterByMonth}</summary>
              <p className="text-muted-foreground mt-2">{messages.exportPage.appendMonth}</p>
            </details>
          }
          allowed={["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)}
        />
        <ExportRow
          icon={CalendarCheck}
          title={messages.exportPage.attendance}
          description={messages.exportPage.attendanceDesc}
          href="/api/export/attendance"
          allowed={["OWNER", "ADMIN"].includes(membership.role)}
        />
      </div>

      <Card className="p-4 bg-[var(--surface-1)]">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>{messages.exportPage.privacy}</span>
        </p>
      </Card>
    </div>
  );
}

function ExportRow({ icon: Icon, title, description, href, allowed, extra }: { icon: React.ElementType; title: string; description: string; href: string; allowed: boolean; extra?: React.ReactNode }) {
  if (!allowed) return null;
  return (
    <Card className="overflow-hidden">
      <a href={href} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors active:scale-[0.99]" download>
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {extra && <div className="mt-1.5">{extra}</div>}
        </div>
        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      </a>
    </Card>
  );
}
