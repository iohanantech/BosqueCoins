import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";

export interface CasaRankingItem {
  casaId: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  saldoAtual: number;
  saldoAcumulado: number;
}

/** Ranking da Copa das Casas do Bosque (secao 4.1) - com destaque visual de pódio e cores oficiais. */
export function RankingCasas({ dados }: { dados: CasaRankingItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🏆 Copa das Casas do Bosque</CardTitle>
      </CardHeader>

      <ul className="space-y-2">
        {dados.map((c, idx) => (
          <li
            key={c.casaId}
            className="flex items-center justify-between rounded-xl2 px-3 py-2.5"
            style={{
              background: `linear-gradient(90deg, ${c.corPrimaria}1A 0%, transparent 60%)`,
              borderLeft: `4px solid ${c.corPrimaria}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏅"}</span>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c.corPrimaria }} />
                <p className="text-sm font-medium">{c.nome}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-sm font-semibold">
                <CoinIcon className="h-3.5 w-3.5" />
                {c.saldoAtual}
              </p>
              <p className="text-[11px] text-neutral-400">acumulado {c.saldoAcumulado}</p>
            </div>
          </li>
        ))}
        {dados.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">Nenhuma Casa cadastrada.</p>}
      </ul>
    </Card>
  );
}
