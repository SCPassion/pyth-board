import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata("/revenue");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
