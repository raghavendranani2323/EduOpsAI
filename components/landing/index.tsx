import { LandingNav } from "./nav";
import { Hero } from "./hero";
import { TrustMarquee, Stats, Features, HowItWorks, Testimonials } from "./sections";
import { Pricing, Faq, CtaBand } from "./pricing";
import { LandingFooter } from "./footer";

export function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-clip">
      <LandingNav />
      <main id="main-content">
        <Hero />
        <TrustMarquee />
        <Stats />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <LandingFooter />
    </div>
  );
}
