import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata("/activity");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
