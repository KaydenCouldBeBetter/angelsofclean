import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Angels of Clean</CardTitle>
          <CardDescription>Select a booking flow to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/residential">
            <Button className="w-full h-14">Book Now — Residential</Button>
          </Link>
          <Link href="/commercial">
            <Button variant="outline" className="w-full h-14">Get a Quote — Commercial</Button>
          </Link>
        </CardContent>
      </Card>
      <footer className="flex gap-4 text-xs text-zinc-600">
        <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-900">Privacy Policy</Link>
        <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-900">Terms of Service</Link>
      </footer>
    </div>
  );
}
