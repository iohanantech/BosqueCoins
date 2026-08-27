"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ATENÇÃO — conteúdo formativo, não travado por decisão unilateral de código:
 * este texto representa a voz institucional do colégio (é confessional
 * cristão) e fala diretamente com o aluno. Antes de publicar em produção,
 * a coordenação pedagógica/religiosa do colégio deve revisar e aprovar o
 * texto final desta seção — tom, ênfase teológica e adequação à idade
 * escolar. As referências bíblicas abaixo são paráfrases da ideia central
 * de cada trecho, não citações literais, e as tradições cristãs variam na
 * ênfase que dão a cada uma — ajuste livremente.
 */

const OPCOES = [
  { titulo: "Casa", texto: "O que você investe aqui vira ponto pra sempre no placar da sua Casa. Não tem volta — é um presente pra galera." },
  { titulo: "Turma", texto: "Igual à Casa, mas pra sua sala. Também não tem volta: é você escolhendo o time antes de si mesmo." },
  { titulo: "CDB", texto: "Rende mais que a poupança, um pouquinho todo dia. Em troca, o dinheiro fica preso um tempo: o resgate só libera depois de 30 dias aplicado (uma vez por mês)." },
  { titulo: "Poupança", texto: "Rende um pouco menos que o CDB, mas é o mais livre de todos: você resgata a qualquer hora, sem esperar." },
  { titulo: "Fundo Imobiliário", texto: "Rende parecido com \"aluguel\" dos seus BosqueCoins. O resgate libera depois de 7 dias aplicado (uma vez por semana)." },
  { titulo: "Tesouro Direto", texto: "Um investimento mais \"seguro\", rendendo de forma constante. O resgate libera a cada 15 dias." },
  { titulo: "Dízimo (Igreja)", texto: "Uma doação pra igreja. Não tem volta — é um presente, não um investimento no sentido de esperar algo de volta." },
  { titulo: "Lar do Idoso", texto: "Uma doação pro lar dos idosos. Também não tem volta: é ajudar quem precisa, sem esperar nada em troca." },
];

const VIRTUDES = [
  {
    titulo: "Responsabilidade",
    texto: "O que você recebe não é só seu pra gastar sem pensar — é algo confiado a você. Cuidar bem disso é uma forma de ser fiel com o pouco antes de receber o muito.",
    referencia: "Mateus 25 (parábola dos talentos)",
  },
  {
    titulo: "Sabedoria",
    texto: "Parar pra pensar antes de decidir vale mais do que agir no impulso. Comparar as opções, entender pra onde o dinheiro vai — isso é planejar com cuidado.",
    referencia: "Provérbios 21:5",
  },
  {
    titulo: "Diligência e paciência",
    texto: "Os juros só aparecem pra quem espera. Cada investimento tem um tempo mínimo antes de poder resgatar (a poupança nenhum, o CDB um mês) — de propósito: resultado bom vem de persistir, não de atalho, como a formiga que junta aos poucos e chega lá.",
    referencia: "Provérbios 6:6-8; 13:11",
  },
  {
    titulo: "Contentamento",
    texto: "O número no saldo não é a fonte da sua alegria nem da sua segurança. Buscar acumular por acumular é uma armadilha — o objetivo aqui é aprender, não ficar obcecado.",
    referencia: "1 Timóteo 6:6-10",
  },
  {
    titulo: "Generosidade",
    texto: "Investir na Casa ou na turma, mesmo sem volta, é um jeito prático de colocar o bem do grupo à frente do seu próprio ganho. Doar pro Dízimo ou pro Lar do Idoso vai um passo além: é dar sem esperar nada de volta, nem pro grupo nem pra você — de coração.",
    referencia: "2 Coríntios 9:7; Provérbios 11:24-25",
  },
  {
    titulo: "Honestidade",
    texto: "É um jogo, mas os princípios valem de verdade: jogar limpo importa tanto quanto o resultado final.",
    referencia: "Provérbios 11:1",
  },
];

export function InstrucoesInvestimento() {
  const [aberto, setAberto] = useState(false);

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setAberto((a) => !a)}>
        <div>
          <p className="text-sm font-semibold">Como investir bem</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {aberto ? "Ver menos" : "Ver mais — o que cada opção faz, e algumas virtudes pra levar pra vida"}
          </p>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-neutral-400 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">As opções</p>
            <ul className="space-y-2">
              {OPCOES.map((o) => (
                <li key={o.titulo} className="rounded-xl2 bg-neutral-50 p-2.5 text-xs dark:bg-graphite">
                  <span className="font-semibold text-gold-dark">{o.titulo}: </span>
                  <span className="text-neutral-600 dark:text-neutral-300">{o.texto}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Virtudes pra praticar com o dinheiro</p>
            <ul className="space-y-2">
              {VIRTUDES.map((v) => (
                <li key={v.titulo} className="rounded-xl2 border border-gold/20 bg-gold/5 p-2.5 text-xs">
                  <span className="font-semibold text-gold-dark">{v.titulo}: </span>
                  <span className="text-neutral-600 dark:text-neutral-300">{v.texto}</span>
                  <span className="mt-1 block text-[11px] italic text-neutral-400">{v.referencia}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
