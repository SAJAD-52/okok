import React, { useState } from 'react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { HeroSection, PillarKey } from '../components/landing/HeroSection';
import { PillarShowcaseSections } from '../components/landing/PillarShowcaseSections';
import { StickyMobileCta } from '../components/landing/StickyMobileCta';

export const Landing: React.FC = () => {
  const [activePillar, setActivePillar] = useState<PillarKey | null>(null);

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-x-hidden selection:bg-primary selection:text-ink">
      <PublicHeader />

      <main className="flex-1">
        <HeroSection
          activePillar={activePillar}
          onSelectPillar={setActivePillar}
        />

        <PillarShowcaseSections activePillar={activePillar} />
      </main>

      <Footer />

      <StickyMobileCta />
    </div>
  );
};

export default Landing;
