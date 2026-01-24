import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-success/25 via-primary/10 to-transparent blur-3xl animate-blob-slower" />
        <div className="absolute -bottom-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-primary/20 via-success/10 to-transparent blur-3xl animate-blob-slowest" />
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22] bg-[radial-gradient(closest-side_at_50%_50%,hsl(var(--primary)/0.14),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.08] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_70%)]" />
      </div>
      <div className="relative z-10">
        <Header />
        <HeroSection />
      </div>
    </div>
  );
};
export default Index;
