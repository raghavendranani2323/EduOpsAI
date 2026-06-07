import { PushToggle } from "@/components/notifications/push-toggle";

export default function NotificationsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Notifications</h1>
      <p className="text-sm text-muted-foreground">
        Get push alerts for absent students, fee dues, and notices — directly on your phone or laptop.
      </p>
      <PushToggle />
      <div className="border rounded-xl p-4 space-y-1 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">How it works</p>
        <p>Push notifications use the browser&apos;s standard Web Push API. EduOps sends alerts only for events you care about — they never include sensitive student data in the preview.</p>
      </div>
    </div>
  );
}
