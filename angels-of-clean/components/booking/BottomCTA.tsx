import { Button } from "@/components/ui/button";

interface BottomCTAProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function BottomCTA({ label, onClick, disabled = false }: BottomCTAProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100">
      <Button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-14 text-base font-semibold"
      >
        {label}
      </Button>
    </div>
  );
}
