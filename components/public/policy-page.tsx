import Link from "next/link";

export function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">← EduOps home</Link>
      <h1 className="mt-6 font-display text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <article className="mt-8 space-y-6 text-sm leading-7 text-foreground">{children}</article>
    </main>
  );
}
