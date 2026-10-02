import { useEffect } from "react";
import { useRouter } from "next/router";

// The old "Full Portion" page is now "Paper Builders" (it covers Full Portion, Topical and AI checking).
export default function FullPortionRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/paper-builders");
  }, [router]);
  return null;
}
