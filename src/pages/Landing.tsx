import React from 'react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { HeroSection } from '../components/landing/HeroSection';
import { TrustBar } from '../components/landing/TrustBar';
import { ProblemsSolutionsSection } from '../components/landing/ProblemsSolutionsSection';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { MarketplacePreviewSection } from '../components/landing/MarketplacePreviewSection';
import { PricingSection } from '../components/landing/PricingSection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { FaqSection } from '../components/landing/FaqSection';
import { FinalCtaBand } from '../components/landing/FinalCtaBand';
import { StickyMobileCta } from '../components/landing/StickyMobileCta';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface flex flex-col selection:bg-primary selection:text-ink">
      {/* 1. Sticky Navigation Header */}
      <PublicHeader />

      <main className="flex-1">
        {/* Section 1: Hero with Dark Ink Glow & Dashboard Mockup */}
        <HeroSection />

        {/* Section 2: Trust Bar with Counters & Badges */}
        <TrustBar />

        {/* Section 3: Problems vs Solutions (3 Pain Points) */}
        <ProblemsSolutionsSection />

        {/* Section 4: Features Grid (8 Cards) */}
        <FeaturesGrid />

        {/* Section 5: How It Works (3 Steps) */}
        <HowItWorksSection />

        {/* Section 6: Marketplace Preview (Scrollable Machinery Cards) */}
        <MarketplacePreviewSection />

        {/* Section 7: Pricing (Single Transparent Plan + RIB / Wafacash) */}
        <PricingSection />

        {/* Section 8: Testimonials (3 Moroccan Contractors) */}
        <TestimonialsSection />

        {/* Section 9: FAQ Accordion (7 Questions) */}
        <FaqSection />

        {/* Section 10: Final Full-Width CTA Band */}
        <FinalCtaBand />
      </main>

      {/* Primary Footer with Links, Cities, Categories, WhatsApp, and Language Switcher */}
      <Footer />

      {/* Mobile Sticky Bottom CTA (Appears on Scroll Past Hero) */}
      <StickyMobileCta />
    </div>
  );
};

export default Landing;
