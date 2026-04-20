"use client";

import { useRouter } from "next/navigation";

export default function CreateLectureButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/live")}
      className="bg-[#FF8C69] text-slate-950 font-bold py-4 px-10 rounded-full text-lg shadow-[0_0_20px_rgba(255,140,105,0.3)] hover:scale-105 hover:bg-[#ff9c7d] transition-all duration-200"
    >
      Start Live Session
    </button>
  );
}
