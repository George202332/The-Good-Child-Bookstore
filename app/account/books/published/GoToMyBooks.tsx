"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sends the author on to My Books after a short pause (the button on the page does it straight away). */
export function GoToMyBooks({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/account/books"), seconds * 1000);
    return () => clearTimeout(t);
  }, [router, seconds]);
  return null;
}
