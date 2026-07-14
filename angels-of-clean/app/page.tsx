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
          <Link href="/residential">
            <Button className="w-full h-14">Book Now — Residential</Button>
          </Link>
          <Link href="/commercial">
            <Button variant="outline" className="w-full h-14">Get a Quote — Commercial</Button>
          </Link>
          <div className="border-t border-zinc-100 pt-3">
            <Link href="/admin">
              <Button variant="ghost" className="w-full h-10 text-zinc-400 text-xs">Admin Dashboard →</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
