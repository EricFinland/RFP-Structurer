"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-slate-500 transition hover:text-slate-800"
    >
      Sign out
    </button>
  );
}
