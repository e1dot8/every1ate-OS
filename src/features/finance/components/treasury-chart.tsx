import { chartGeometry, chartSummary, type TreasuryForecast } from "@/features/finance/treasury-rules";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const m = (c: number) => formatMoney(c, { round: true });

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("inline-block size-3 rounded-sm", swatch)} />
      {children}
    </span>
  );
}

/**
 * Graphique des 13 semaines en HTML/CSS (aucune bibliothèque) : solde de fin de semaine
 * de part et d'autre de zéro, puis entrées et sorties côte à côte. Le graphique est une
 * image pour les lecteurs d'écran (résumé en `aria-label`) ; le détail est dans la liste.
 */
export function TreasuryChart({ forecast }: { forecast: TreasuryForecast }) {
  const geo = chartGeometry(forecast.weeks);
  const cols = { gridTemplateColumns: `repeat(${forecast.weeks.length}, minmax(0, 1fr))` };
  return (
    <figure className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={chartSummary(forecast, m, (d) => formatDay(d))}
        className="flex flex-col gap-1"
      >
        <p className="text-xs text-muted-foreground">
          {forecast.hasStartBalance ? "Solde en fin de semaine" : "Variation cumulée en fin de semaine"}
        </p>
        <div className="relative h-36 md:h-44">
          <div className="absolute inset-0 grid gap-0.5 md:gap-1" style={cols}>
            {forecast.weeks.map((w, i) => {
              const bar = geo.bars[i];
              return (
                <div
                  key={w.start.toISOString()}
                  className={cn("relative h-full rounded-sm", bar.negative && "bg-danger-soft")}
                >
                  <div
                    className={cn(
                      "absolute inset-x-[15%] min-h-px",
                      bar.negative ? "rounded-b-sm bg-danger" : "rounded-t-sm bg-ink",
                    )}
                    style={
                      bar.negative
                        ? { top: `${100 - geo.zeroPct}%`, height: `${bar.balancePct}%` }
                        : { bottom: `${geo.zeroPct}%`, height: `${bar.balancePct}%` }
                    }
                  />
                </div>
              );
            })}
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-ink/50"
            style={{ bottom: `${geo.zeroPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Entrées et sorties de la semaine</p>
        <div className="grid h-20 gap-0.5 md:h-24 md:gap-1" style={cols}>
          {forecast.weeks.map((w, i) => {
            const bar = geo.bars[i];
            return (
              <div
                key={w.start.toISOString()}
                className={cn(
                  "flex h-full items-end justify-center gap-px rounded-sm md:gap-0.5",
                  bar.negative && "bg-danger-soft",
                )}
              >
                <div className="w-[38%] rounded-t-sm bg-success" style={{ height: `${bar.inflowPct}%` }} />
                <div className="w-[38%] rounded-t-sm bg-ink/35" style={{ height: `${bar.outflowPct}%` }} />
              </div>
            );
          })}
        </div>
        <div className="grid gap-0.5 border-t pt-1 text-center md:gap-1" style={cols}>
          {forecast.weeks.map((w, i) => (
            <div
              key={w.start.toISOString()}
              className={cn(
                "flex min-w-0 flex-col leading-tight",
                geo.bars[i].negative && "font-bold text-danger",
              )}
            >
              <span className="text-[10px] whitespace-nowrap sm:text-[11px]">
                <span className="max-sm:hidden">S</span>+{i + 1}
              </span>
              <span className="text-[10px] whitespace-nowrap text-muted-foreground max-sm:hidden">
                {formatDay(w.start)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Legend swatch="bg-ink">Solde</Legend>
        <Legend swatch="bg-danger">Solde sous zéro (semaine surlignée, libellé en gras)</Legend>
        <Legend swatch="bg-success">Entrées</Legend>
        <Legend swatch="bg-ink/35">Sorties</Legend>
        <span>Axe : semaines à venir (S+1 = semaine en cours), dates de début sur ordinateur.</span>
      </figcaption>
    </figure>
  );
}
