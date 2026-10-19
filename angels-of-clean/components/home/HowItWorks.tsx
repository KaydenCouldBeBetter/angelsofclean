import Section from "@/components/home/Section";

// Matches the residential flow and the "quote after booking" decision (B28):
// no price is shown while booking; the office confirms it afterwards.
const STEPS = [
  {
    title: "Tell us about your home",
    body: "Choose a cleaning, how often you'd like it, and enter your address and the size of your home.",
  },
  {
    title: "Pick a day and time",
    body: "Choose a morning or afternoon window that suits you, then add your contact details.",
  },
  {
    title: "We confirm your booking",
    body: "The office reviews your booking and confirms the details and price with you.",
  },
];

export default function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      title="How it works"
      intro="Running a business? Send a commercial quote request instead and we'll follow up."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-zinc-900">{step.title}</h3>
              <p className="text-base text-zinc-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
