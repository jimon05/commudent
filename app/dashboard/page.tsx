import type { Metadata } from "next";
import HomePage from "@/app/page";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Dashboard"
};

export default function DashboardPage() {
  return (
    <AuthGate>
      <HomePage />
    </AuthGate>
  );
}
