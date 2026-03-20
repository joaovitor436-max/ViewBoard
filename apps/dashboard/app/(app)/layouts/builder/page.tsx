"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redireciona para o novo editor de layouts
export default function LayoutBuilderRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/layouts/editor");
  }, [router]);
  return null;
}
