import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0f1419]">
      <div
        className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"
        style={{ animationDuration: "2s" }}
      ></div>
      <Loader />
    </div>
  );
}
