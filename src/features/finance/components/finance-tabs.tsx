import { Tabs } from "@/components/app/bits";

export type FinanceTab = "projets" | "contrats" | "imports" | "tresorerie" | "analyses";

/** Onglets communs aux pages Finance (/finance, /finance/tresorerie, /finance/analyses). */
export function FinanceTabs({ active }: { active: FinanceTab }) {
  return (
    <Tabs
      active={active}
      items={[
        { key: "projets", label: "Projets", href: "/finance" },
        { key: "tresorerie", label: "Trésorerie", href: "/finance/tresorerie" },
        { key: "analyses", label: "Analyses", href: "/finance/analyses" },
        { key: "contrats", label: "Contrats récurrents", href: "/finance?onglet=contrats" },
        { key: "imports", label: "Imports", href: "/finance?onglet=imports" },
      ]}
    />
  );
}
