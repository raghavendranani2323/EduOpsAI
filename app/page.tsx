import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { Landing } from "@/components/landing";

export default async function RootPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return <Landing />;
}
