"use client";

import { usePathname } from "next/navigation";
import DesktopNavbar from "@/components/booking/DesktopNavbar";
import DesktopStepper from "@/components/booking/DesktopStepper";
import BookingSummary from "@/components/booking/BookingSummary";

const RESIDENTIAL_STEPS = [
  { label: "Service" },
  { label: "Address" },
  { label: "Property" },
  { label: "Date & Time" },
  { label: "Contact" },
  { label: "Review" },
];

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
    <>
      {/* Mobile layout */}
      <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto lg:hidden">
        {children}
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col min-h-screen bg-white">
        <DesktopNavbar />

        {showStepper && (
          <DesktopStepper steps={RESIDENTIAL_STEPS} currentStep={currentStep} />
        )}

        <div className="flex-1 bg-[#f7f9f8]">
          <div
            className={`mx-auto px-10 py-10 ${
              showSidebar ? "max-w-[1200px] flex gap-10" : "max-w-[960px]"
            }`}
          >
            <div className={showSidebar ? "flex-1 min-w-0" : ""}>
              {children}
            </div>

            {showSidebar && <BookingSummary />}
          </div>
        </div>
      </div>
    </>
  );
}
