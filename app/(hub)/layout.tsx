import { HubShell } from "@/components/shell/HubShell";

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HubShell>{children}</HubShell>;
}
