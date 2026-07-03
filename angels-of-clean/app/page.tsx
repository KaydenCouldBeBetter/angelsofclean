import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Angels of Clean</CardTitle>
          <CardDescription>Select a booking flow to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full h-14">
            <Link href="/residential">Book Now — Residential</Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-14">
            <Link href="/commercial">Get a Quote — Commercial</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
