import type { Metadata } from "next";
import { MobileFrame } from "../../components/common/MobileFrame";

export const metadata: Metadata = {
  title: "Kenalan dengan Nera",
  description: "Atur fokus finansialmu dan susun rencana awal bersama Nera.",
};

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MobileFrame hideBottomNav>{children}</MobileFrame>;
}
