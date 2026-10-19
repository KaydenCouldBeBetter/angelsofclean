import HomeHeader from "@/components/home/HomeHeader";
import Hero from "@/components/home/Hero";
import Services from "@/components/home/Services";
import ServiceArea from "@/components/home/ServiceArea";
import HowItWorks from "@/components/home/HowItWorks";
import Reviews from "@/components/home/Reviews";
import TrustFacts from "@/components/home/TrustFacts";
import TeamPhotos from "@/components/home/TeamPhotos";
import HomeFooter from "@/components/home/HomeFooter";

// Homepage built from the HeroSplit frame (Figma 120:3). Reviews, trust facts and
// team photos come from lib/homepage-content.ts and show a "Placeholder" label
// until the owner replaces them (backlog B27).
export default function Home() {
  return (
    <>
      <HomeHeader />
      <main>
        <Hero />
        <Services />
        <ServiceArea />
        <HowItWorks />
        <Reviews />
        <TrustFacts />
        <TeamPhotos />
      </main>
      <HomeFooter />
    </>
  );
}
