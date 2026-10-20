"use client";

import { usePathname } from "next/navigation";
import DesktopNavbar from "@/components/booking/DesktopNavbar";
import DesktopStepper from "@/components/booking/DesktopStepper";
import BookingSummary from "@/components/booking/BookingSummary";

const RESIDENTIAL_STEPS = ["Service", "Address", "Property", "Date & Time", "Contact", "Review"];

const PATH_TO_STEP: Record<string, number> = {
  "/residential": 1,
  "/residential/address": 2,
  "/residential/property": 3,
  "/residential/datetime": 4,
  "/residential/contact": 5,
  "/residential/review": 6,
};

const NO_SIDEBAR_PATHS = ["/residential/review", "/residential/confirmation", "/residential/error"];
const NO_STEPPER_PATHS = ["/residential/confirmation", "/residential/error"];

export default function ResidentialShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = PATH_TO_STEP[pathname] ?? 0;
  const showStepper = currentStep > 0 && !NO_STEPPER_PATHS.includes(pathname);
  const showSidebar = currentStep > 0 && !NO_SIDEBAR_PATHS.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Desktop chrome — hidden on mobile */}
      <div className="hidden lg:block">
        <DesktopNavbar />
        {showStepper && (
          <DesktopStepper steps={RESIDENTIAL_STEPS} currentStep={currentStep} />
        )}
      </div>

      {/* Content — each step renders once; CSS handles the two breakpoints.
          Mobile: max-w-sm centred column (no chrome).
          Desktop: full-width with optional sidebar, gray background. */}
      <div className="flex-1 lg:bg-[#f7f9f8]">
        <div
          className={`max-w-sm mx-auto lg:px-10 lg:py-10 ${
            showSidebar
              ? "lg:max-w-[1200px] lg:flex lg:gap-10"
              : "lg:max-w-[960px]"
          }`}
        >
          <div className={showSidebar ? "lg:flex-1 lg:min-w-0" : ""}>
            {children}
          </div>

          {showSidebar && <BookingSummary />}
        </div>
      </div>
    </div>
  );
}
