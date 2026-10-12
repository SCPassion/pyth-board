import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata("/pythenians");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
