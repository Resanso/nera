import { MobileFrame } from "../../components/common/MobileFrame";
import { OnboardingGate } from "../../components/onboarding/OnboardingGate";
import { WalletSync } from "../../components/common/WalletSync";

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OnboardingGate>
      <WalletSync />
      <MobileFrame showFullscreenControl>{children}</MobileFrame>
    </OnboardingGate>
  );
}
