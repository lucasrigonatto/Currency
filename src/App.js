import analysis from './data/analysis.json';
import {
  CategoryPie,
  MerchantBars,
  CategoryBars,
  DailyLine,
  CumulativeLine,
  CategoryCountBars,
  WeekdayBars,
  RecurringPie,
} from './components/Charts';
import { brl, pct, formatDate, scoreColor } from './utils/format';
import './App.css';

const SCORE_LABELS = {
  organizacao: 'Organização financeira',
  diversificacao: 'Diversificação dos gastos',
  controle: 'Controle financeiro',
  consumo_consciente: 'Consumo consciente',
  saude_financeira: 'Saúde financeira',
};

const RECOMMENDATIONS = [
  {
    priority: 1,
    title: 'Automatizar pagamento da fatura no vencimento',
    difficulty: 'Baixo',
    monthly: analysis.summary.late_fees_total / 3,
    annual: analysis.summary.late_fees_total * 4,
    short: 'Elimina encargos no próximo ciclo.',
    long: 'Reconstrói histórico de crédito e libera margem para investimento.',
    why: 'As 3 faturas analisadas cobraram multa, juros e IOF. É o desperdício de maior certeza — zero benefício em troca.',
  },
  {
    priority: 2,
    title: 'Auditar Cursor AI (plano e frequência de cobrança)',
    difficulty: 'Baixo',
    monthly: 851.33,
    annual: 10215.96,
    short: 'Evita surpresa de quase R$ 1.000 em um único mês.',
    long: 'Alinha ferramenta de trabalho ao ROI real e reduz volatilidade da fatura.',
    why: 'Houve salto de R$ 111,75 para R$ 963,08. Pode ser anual/upgrade; se for mensal no patamar alto, é o maior risco de caixa.',
  },
  {
    priority: 3,
    title: 'Planejar refeições e limitar delivery/restaurantes',
    difficulty: 'Médio',
    monthly: 186.34,
    annual: 2236.09,
    short: 'Reduz gastos de conveniência sem eliminar vida social.',
    long: 'Cria hábito de consumo intencional e melhora previsibilidade orçamentária.',
    why: 'Restaurantes + delivery + cafés somam parte relevante da fatura e respondem bem a metas semanais (ex.: 2 saídas sociais).',
  },
  {
    priority: 4,
    title: 'Definir teto semanal de Uber',
    difficulty: 'Médio',
    monthly: 41.65,
    annual: 499.81,
    short: 'Corta corridas curtas por impulso.',
    long: 'Libera recursos de transporte para combustível planejado ou reserva.',
    why: '18 corridas líquidas no período, várias abaixo de R$ 25 — padrão clássico de conveniência acumulada.',
  },
  {
    priority: 5,
    title: 'Revisar cobranças Apple.com/Bill',
    difficulty: 'Baixo',
    monthly: 20,
    annual: 240,
    short: 'Remove assinatura invisível de baixo valor.',
    long: 'Evita “vazamento” mensal de microassinaturas esquecidas.',
    why: 'Há pelo menos R$ 69,90 + R$ 5,90 recorrentes. O menor valor raramente é lembrado e quase nunca é essencial.',
  },
  {
    priority: 6,
    title: 'Congelar novos parcelamentos acima de 3x',
    difficulty: 'Médio',
    monthly: analysis.installments_latest.reduce((a, p) => a + p.installment_value, 0),
    annual: analysis.installments_latest.reduce((a, p) => a + p.remaining_value, 0),
    short: 'Contém a fatura futura já comprometida.',
    long: 'Recupera flexibilidade de caixa nos próximos 7–12 meses.',
    why: 'Tina Europa (12x), Puro Charme (7x e 10x) elevam o piso fixo da fatura mesmo sem novas compras. O valor anual indica o residual estimado ainda a pagar.',
  },
];

function Section({ id, eyebrow, title, children }) {
  return (
    <section className="section" id={id}>
      <header className="section__head">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      {hint && <span className="metric__hint">{hint}</span>}
    </div>
  );
}

function App() {
  const { summary, period, categories, merchants, weekday, daily, subscriptions, installments_latest, stats, impulse_candidates, savings, scores, opportunities, transactions } = analysis;
  const spendTx = transactions.filter((t) => !t.meta);
  const avgScore =
    Object.values(scores).reduce((acc, s) => acc + s.score, 0) / Object.values(scores).length;

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden="true" />

      <header className="hero">
        <p className="brand">Auditoria Nubank</p>
        <h1>Diagnóstico completo dos seus gastos</h1>
        <p className="hero__lead">
          Análise consolidada de <strong>3 faturas</strong> ({formatDate(period.start)} a {formatDate(period.end)}):
          padrões de consumo, desperdícios, assinaturas, parcelamentos e plano de economia.
        </p>
        <div className="hero__cta">
          <a href="#resumo" className="btn btn--primary">Ver resumo executivo</a>
          <a href="#relatorio" className="btn btn--ghost">Ir ao relatório final</a>
        </div>
        <p className="hero__note">
          Metodologia: excluídos pagamentos recebidos, saldo pendente e depósito de confiança (para não duplicar gasto).
          Estornos de Uber foram liquidados no líquido da categoria.
        </p>
      </header>

      <nav className="toc" aria-label="Seções do relatório">
        {[
          ['resumo', 'Resumo'],
          ['classificacao', 'Classificação'],
          ['rankings', 'Rankings'],
          ['comportamento', 'Comportamento'],
          ['assinaturas', 'Assinaturas'],
          ['parcelamentos', 'Parcelamentos'],
          ['estatisticas', 'Estatísticas'],
          ['graficos', 'Gráficos'],
          ['insights', 'Insights'],
          ['economia', 'Plano'],
          ['score', 'Score'],
          ['recomendacoes', 'Recomendações'],
          ['relatorio', 'Relatório'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>{label}</a>
        ))}
      </nav>

      <Section id="resumo" eyebrow="01" title="Resumo geral">
        <div className="metrics">
          <Metric label="Gasto líquido total" value={brl(summary.total_net_spend)} hint="3 faturas · sem meta/saldo" />
          <Metric label="Compras (qtde.)" value={summary.purchase_count} hint={`Estornos: ${brl(summary.refunds_total)}`} />
          <Metric label="Ticket médio" value={brl(summary.avg_ticket)} hint={`Mediana ${brl(summary.median_ticket)}`} />
          <Metric label="Maior compra" value={brl(summary.max_purchase.amount)} hint={summary.max_purchase.title} />
          <Metric label="Menor compra*" value={brl(summary.min_purchase.amount)} hint={`${summary.min_purchase.title} · *excl. taxas`} />
          <Metric label="Estabelecimentos" value={summary.establishments} />
          <Metric label="Média / dia" value={brl(summary.avg_per_day)} hint={`${period.days} dias`} />
          <Metric label="Média / semana" value={brl(summary.avg_per_week)} />
          <Metric label="Média / categoria" value={brl(summary.avg_per_category)} />
          <Metric label="Média mensal" value={brl(summary.avg_monthly)} />
          <Metric label="Encargos por atraso" value={brl(summary.late_fees_total)} hint="Multa + juros + IOF" />
          <Metric label="Alimentação consolidada" value={brl(summary.food_total)} hint="Mercado + rest. + delivery + cafés" />
        </div>

        <div className="panel">
          <h3>Por fatura (novos lançamentos)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Gasto líquido</th>
                  <th>Compras</th>
                  <th>Qtde.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.bill_totals).map(([bill, b]) => (
                  <tr key={bill}>
                    <td>{formatDate(bill)}</td>
                    <td><strong>{brl(b.net)}</strong></td>
                    <td>{brl(b.purchases)}</td>
                    <td>{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section id="classificacao" eyebrow="02" title="Classificação automática de todas as compras">
        <p className="prose">
          Cada lançamento foi categorizado por estabelecimento. Itens desconhecidos receberam a categoria mais
          provável (estimativa). A tabela abaixo lista <strong>todas</strong> as transações de gasto (e estornos),
          sem omitir compras.
        </p>
        <div className="table-wrap table-wrap--tall">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Estabelecimento</th>
                <th>Categoria</th>
                <th>Canal</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {spendTx
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t, i) => (
                  <tr key={`${t.date}-${t.title}-${i}`} className={t.amount < 0 ? 'is-credit' : ''}>
                    <td>{formatDate(t.date)}</td>
                    <td>{t.title}</td>
                    <td>{t.merchant}</td>
                    <td><span className="tag">{t.category}</span></td>
                    <td>{t.channel}</td>
                    <td><strong>{brl(t.amount)}</strong></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="rankings" eyebrow="03" title="Ranking dos maiores gastos">
        <div className="grid-2">
          <div className="panel">
            <h3>Top estabelecimentos</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Estabelecimento</th>
                    <th>Total</th>
                    <th>Compras</th>
                    <th>Ticket médio</th>
                    <th>% fatura</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((m, i) => (
                    <tr key={m.merchant}>
                      <td>{i + 1}</td>
                      <td>{m.merchant}</td>
                      <td><strong>{brl(m.total)}</strong></td>
                      <td>{m.count}</td>
                      <td>{brl(m.avg)}</td>
                      <td>{pct(m.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h3>Top categorias</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Valor</th>
                    <th>%</th>
                    <th>Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td><strong>{brl(c.total)}</strong></td>
                      <td>{pct(c.pct)}</td>
                      <td>{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <h3>Top dias da semana</h3>
          <div className="weekday-list">
            {weekday
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((d) => (
                <div key={d.day} className="weekday-item">
                  <span>{d.day}</span>
                  <strong>{brl(d.total)}</strong>
                  <small>{d.count} compras</small>
                </div>
              ))}
          </div>
        </div>
      </Section>

      <Section id="comportamento" eyebrow="04" title="Análise comportamental">
        <div className="insight-grid">
          <article className="insight">
            <h3>Atrasos sistemáticos</h3>
            <p>
              Em <strong>100%</strong> das faturas houve multa, juros e IOF ({brl(summary.late_fees_total)} no total).
              Motivo: o cartão está sendo usado como extensão de caixa sem disciplina de vencimento — o custo é
              puro desperdício.
            </p>
          </article>
          <article className="insight">
            <h3>Conveniência (Uber + delivery)</h3>
            <p>
              Uber líquido {brl(categories.find((c) => c.category === 'Uber')?.total || 0)} e delivery {brl(categories.find((c) => c.category === 'Delivery')?.total || 0)}.
              Padrão de pequenas decisões repetidas que somam silenciosamente.
            </p>
          </article>
          <article className="insight">
            <h3>Alimentação fora vs mercado</h3>
            <p>
              Restaurantes ({brl(categories.find((c) => c.category === 'Restaurantes')?.total || 0)}) quase empatam com mercado ({brl(categories.find((c) => c.category === 'Mercado')?.total || 0)}). Quando comida pronta rivaliza
              com supermercado, há espaço claro para refeições planejadas sem perder qualidade social.
            </p>
          </article>
          <article className="insight">
            <h3>Gasto emocional pontual</h3>
            <p>
              Flosofia Flowershop ({brl(320)}) e Nip Napoli ({brl(446.35)}) são compras de alto ticket e baixa
              frequência — típicas de ocasião. Não são o vazamento estrutural, mas merecem orçamento consciente.
            </p>
          </article>
          <article className="insight">
            <h3>Volatilidade em tecnologia</h3>
            <p>
              Cursor AI saiu de ~R$ 112 para ~R$ 963. Isso distorce a média e o desvio-padrão ({brl(summary.stdev)}).
              Sem teto para ferramentas digitais, a fatura fica imprevisível.
            </p>
          </article>
          <article className="insight">
            <h3>Parcelamentos alongando o compromisso</h3>
            <p>
              Novas compras em 7x, 10x e 12x elevam o “piso” das próximas faturas. Motivo de atenção: o prazer é
              imediato; o pagamento permanece até 1 ano.
            </p>
          </article>
          <article className="insight">
            <h3>Finais de semana</h3>
            <p>
              Fins de semana concentraram {brl(stats.weekend_total)} ({pct(stats.weekend_pct)} das compras).
              Não é dominância extrema, mas reforça lazer/alimentação social no sábado/domingo.
            </p>
          </article>
          <article className="insight">
            <h3>Estornos / duplicidade aparente</h3>
            <p>
              Houve estornos de Uber (ex.: −R$ 19,10; −R$ 38,88; −R$ 21,86). Não são compras duplicadas reais —
              são correções. O líquido de Uber já considera esses créditos.
            </p>
          </article>
        </div>

        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <h3>Candidatos a impulso / conveniência (amostra)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Compra</th>
                  <th>Valor</th>
                  <th>Leitura</th>
                </tr>
              </thead>
              <tbody>
                {impulse_candidates.slice(0, 18).map((t, i) => (
                  <tr key={i}>
                    <td>{formatDate(t.date)}</td>
                    <td>{t.title}</td>
                    <td>{brl(t.amount)}</td>
                    <td>{t.reasons.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section id="assinaturas" eyebrow="05" title="Assinaturas encontradas">
        <div className="cards-3">
          {subscriptions.map((s) => (
            <article className="sub-card" key={s.name}>
              <h3>{s.name}</h3>
              <p className="sub-card__notes">{s.notes}</p>
              <dl>
                <div><dt>No período</dt><dd>{brl(s.total_period)}</dd></div>
                <div><dt>Estimativa mensal</dt><dd><strong>{brl(s.monthly_estimate)}</strong></dd></div>
                <div><dt>Estimativa anual</dt><dd>{brl(s.annual_estimate)}</dd></div>
                <div><dt>Economia possível / mês</dt><dd>{brl(s.possible_savings_monthly)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="prose muted">
          Estimativas: valores anuais projetam a recorrência observada. No Cursor, o valor alto pode ser cobrança
          anual — valide no extrato/e-mail antes de assumir R$ 963 todo mês.
        </p>
      </Section>

      <Section id="parcelamentos" eyebrow="06" title="Parcelamentos">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Parcela</th>
                <th>Atual</th>
                <th>Total</th>
                <th>Faltam</th>
                <th>Valor restante</th>
                <th>Compra estimada</th>
              </tr>
            </thead>
            <tbody>
              {installments_latest.map((p) => (
                <tr key={`${p.store}-${p.total_parcels}-${p.installment_value}`}>
                  <td>{p.store}</td>
                  <td><strong>{brl(p.installment_value)}</strong></td>
                  <td>{p.current}</td>
                  <td>{p.total_parcels}</td>
                  <td>{p.remaining_parcels}</td>
                  <td>{brl(p.remaining_value)}</td>
                  <td>{brl(p.total_purchase_estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="prose">
          Compromisso residual estimado (somatório do que ainda falta nas últimas posições observadas):{' '}
          <strong>{brl(installments_latest.reduce((a, p) => a + p.remaining_value, 0))}</strong>.
          Fujioka e Mercado Livre antigos já finalizaram ou estão no fim; Tina Europa / Puro Charme puxam o futuro.
        </p>
      </Section>

      <Section id="estatisticas" eyebrow="07" title="Estatísticas">
        <div className="metrics">
          <Metric label="Ticket médio" value={brl(summary.avg_ticket)} />
          <Metric label="Mediana" value={brl(summary.median_ticket)} />
          <Metric label="Moda" value={brl(summary.mode_ticket)} hint="Valor mais frequente (parcela Fujioka)" />
          <Metric label="Desvio padrão" value={brl(summary.stdev)} />
          <Metric label="Online" value={pct(stats.online_pct)} hint={brl(stats.online_total)} />
          <Metric label="Presencial" value={pct(stats.presencial_pct)} hint={brl(stats.presencial_total)} />
          <Metric label="Recorrente" value={pct(stats.recurring_pct)} hint={brl(stats.recurring_total)} />
          <Metric label="Eventual" value={pct(stats.eventual_pct)} hint={brl(stats.eventual_total)} />
        </div>
        <div className="grid-2" style={{ marginTop: '1rem' }}>
          <div className="panel">
            <h3>% por categoria</h3>
            <ul className="pct-list">
              {categories.map((c) => (
                <li key={c.category}>
                  <span>{c.category}</span>
                  <span>{pct(c.pct)} · {brl(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>% por estabelecimento (top 10)</h3>
            <ul className="pct-list">
              {merchants.slice(0, 10).map((m) => (
                <li key={m.merchant}>
                  <span>{m.merchant}</span>
                  <span>{pct(m.pct)} · {brl(m.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="graficos" eyebrow="08" title="Gráficos">
        <div className="charts">
          <div className="panel"><h3>Pizza — categorias</h3><CategoryPie data={categories} /></div>
          <div className="panel"><h3>Barras — maiores estabelecimentos</h3><MerchantBars data={merchants} /></div>
          <div className="panel"><h3>Barras — gastos por categoria</h3><CategoryBars data={categories} /></div>
          <div className="panel"><h3>Linha — gastos por dia</h3><DailyLine data={daily} /></div>
          <div className="panel"><h3>Linha — evolução acumulada no período</h3><CumulativeLine data={daily} /></div>
          <div className="panel"><h3>Barras — quantidade de compras por categoria</h3><CategoryCountBars data={categories} /></div>
          <div className="panel"><h3>Barras — gastos por dia da semana</h3><WeekdayBars data={weekday} /></div>
          <div className="panel">
            <h3>Pizza — recorrentes vs ocasionais</h3>
            <RecurringPie recurring={stats.recurring_total} eventual={stats.eventual_total} />
          </div>
        </div>
      </Section>

      <Section id="insights" eyebrow="09" title="Insights inteligentes">
        <div className="insight-grid">
          <article className="insight">
            <h3>Onde economizar mais</h3>
            <p>
              1) Cursor (se o valor alto se repetir), 2) alimentação fora, 3) encargos de atraso.
              Juntos dominam o upside de economia com menor perda de qualidade de vida estrutural.
            </p>
          </article>
          <article className="insight">
            <h3>Gastos que parecem desnecessários</h3>
            <p>
              Multa/juros/IOF ({brl(summary.late_fees_total)}) e microassinatura Apple de R$ 5,90 — custo sem utilidade
              adicional perceptível.
            </p>
          </article>
          <article className="insight">
            <h3>Gastos que agregam valor</h3>
            <p>
              Espaçolaser e cabelo (saúde/cuidados), Google One (backup), combustível e mercado — mantêm rotina e
              patrimônio pessoal/produtivo.
            </p>
          </article>
          <article className="insight">
            <h3>Compras que deveriam ser planejadas</h3>
            <p>
              Tina Europa 12x, Puro Charme 7x/10x, Imperium Joi e Decathlon — candidatos a lista de espera de 7–14 dias
              antes do checkout.
            </p>
          </article>
          <article className="insight">
            <h3>Impulso emocional</h3>
            <p>
              Floricultura e jantares de ticket alto (Nip Napoli, Outback, Carne de Sol) concentram emoção/socialização.
              Melhor com envelope mensal de lazer do que proibição total.
            </p>
          </article>
          <article className="insight">
            <h3>Conveniência &amp; invisíveis</h3>
            <p>
              Uber curto, Tutto Pane, Subway e iFood são “taxas de cansaço”. Assinaturas Apple/Google são gastos
              invisíveis até auditar a fatura linha a linha.
            </p>
          </article>
        </div>

        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <h3>Top 5 oportunidades de economia (impacto anual estimado)</h3>
          <ol className="opp-list">
            {opportunities.map((o) => (
              <li key={o.title}>
                <div>
                  <strong>{o.title}</strong>
                  <p>{o.detail}</p>
                </div>
                <div className="opp-list__money">
                  <span>{brl(o.monthly)}/mês</span>
                  <strong>{brl(o.annual)}/ano</strong>
                  <em>{o.impact}</em>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="economia" eyebrow="10" title="Plano de economia — 3 cenários">
        <div className="cards-3">
          {[
            ['Conservador', savings.conservative, 'Pouca mudança de hábito'],
            ['Moderado', savings.moderate, 'Ajustes razoáveis e sustentáveis'],
            ['Agressivo', savings.aggressive, 'Máxima economia possível'],
          ].map(([name, sc, lead]) => (
            <article className="scenario" key={name}>
              <p className="eyebrow">{lead}</p>
              <h3>{name}</h3>
              <p className="scenario__save">Economia mensal <strong>{brl(sc.monthly)}</strong></p>
              <p className="scenario__save">Economia anual <strong>{brl(sc.annual)}</strong></p>
              <ul>
                {sc.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section id="score" eyebrow="11" title="Score financeiro">
        <p className="prose">
          Nota média ponderada simples: <strong>{avgScore.toFixed(1)} / 10</strong>. Escala interpretativa da consultoria
          com base apenas no comportamento observado nestas faturas (sem renda declarada).
        </p>
        <div className="scores">
          {Object.entries(scores).map(([key, s]) => (
            <article key={key} className="score-card">
              <div className="score-card__top">
                <h3>{SCORE_LABELS[key]}</h3>
                <span className="score-pill" style={{ color: scoreColor(s.score), borderColor: scoreColor(s.score) }}>
                  {s.score.toFixed(1)}
                </span>
              </div>
              <div className="score-bar">
                <i style={{ width: `${s.score * 10}%`, background: scoreColor(s.score) }} />
              </div>
              <p>{s.reason}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="recomendacoes" eyebrow="12" title="Recomendações personalizadas (priorizadas)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Recomendação</th>
                <th>Dificuldade</th>
                <th>Economia/mês</th>
                <th>Economia/ano</th>
                <th>Curto prazo</th>
                <th>Longo prazo</th>
              </tr>
            </thead>
            <tbody>
              {RECOMMENDATIONS.map((r) => (
                <tr key={r.priority}>
                  <td>{r.priority}</td>
                  <td>
                    <strong>{r.title}</strong>
                    <div className="muted small">{r.why}</div>
                  </td>
                  <td>{r.difficulty}</td>
                  <td>{brl(r.monthly)}</td>
                  <td><strong>{brl(r.annual)}</strong></td>
                  <td>{r.short}</td>
                  <td>{r.long}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="relatorio" eyebrow="13" title="Relatório final — consultoria">
        <article className="report">
          <h3>Resumo executivo</h3>
          <p>
            No período de {formatDate(period.start)} a {formatDate(period.end)}, o cartão registrou
            {' '}<strong>{brl(summary.total_net_spend)}</strong> em gastos líquidos novos, distribuídos em
            {' '}<strong>{summary.purchase_count}</strong> compras e <strong>{summary.establishments}</strong> estabelecimentos.
            A média diária ficou em <strong>{brl(summary.avg_per_day)}</strong> e a mensal aproximada em
            {' '}<strong>{brl(summary.avg_monthly)}</strong>. O perfil combina utilidade (mercado, combustível, ferramentas)
            com vazamentos claros: encargos por atraso, alimentação fora recorrente e volatilidade em assinatura de software.
          </p>

          <h3>Principais descobertas</h3>
          <ul>
            <li>Assinaturas lideram o ranking de categorias ({pct(categories[0].pct)} da fatura líquida).</li>
            <li>Alimentação consolidada (mercado + fora) soma {brl(summary.food_total)} — rivalizando com tech.</li>
            <li>Encargos por atraso em 3/3 faturas: {brl(summary.late_fees_total)} sem retorno.</li>
            <li>Novos parcelamentos longos criam piso fixo futuro de centenas de reais/mês.</li>
            <li>Online representa {pct(stats.online_pct)} do gasto — alto poder de compra com um toque.</li>
          </ul>

          <h3>Pontos positivos</h3>
          <ul>
            <li>Presença de gastos de cuidado pessoal/saúde (Espaçolaser, cabelo) — investimento em bem-estar.</li>
            <li>Mercado e combustível mostram base de consumo “real”, não só lazer.</li>
            <li>Há estornos corretivos de Uber, indicando algum acompanhamento das cobranças.</li>
            <li>Ferramentas digitais (Cursor, Google One, Hostinger) podem ter ROI profissional se calibradas.</li>
          </ul>

          <h3>Pontos de atenção</h3>
          <ul>
            <li>Rotina de atraso = taxa implícita altíssima sobre o próprio consumo.</li>
            <li>Ticket médio ({brl(summary.avg_ticket)}) bem acima da mediana ({brl(summary.median_ticket)}) — cauda de compras caras.</li>
            <li>Restaurantes quase no mesmo patamar de supermercado.</li>
            <li>Compromisso residual de parcelas ainda relevante após o período analisado.</li>
          </ul>

          <h3>Oportunidades de economia</h3>
          <p>
            Cenário conservador: <strong>{brl(savings.conservative.monthly)}/mês</strong> ({brl(savings.conservative.annual)}/ano).
            Moderado: <strong>{brl(savings.moderate.monthly)}/mês</strong>. Agressivo: <strong>{brl(savings.aggressive.monthly)}/mês</strong>.
            A alavanca mais segura é zerar atrasos; a de maior upside é validar o plano Cursor; a mais sustentável
            para qualidade de vida é redesenhar alimentação fora com teto semanal.
          </p>

          <h3>Recomendações</h3>
          <p>
            Priorize ações de dificuldade baixa e impacto certo (débito automático da fatura + auditoria de assinaturas).
            Em seguida, imponha tetos semanais para Uber e food. Por fim, pause novos parcelamentos &gt; 3x até o
            residual atual cair abaixo de um limite que você definir (sugestão: &lt; 15% da fatura média).
          </p>

          <h3>Conclusão</h3>
          <p>
            Sua fatura não revela “falência de hábitos”, e sim <em>falta de sistemas</em>: pagamento em dia,
            tetos por categoria e revisão mensal de assinaturas. Com o cenário moderado, é realista recuperar
            cerca de <strong>{brl(savings.moderate.annual)}</strong> ao ano sem abrir mão de lazer — apenas trocando
            decisões automáticas por decisões intencionais. Score médio atual: <strong>{avgScore.toFixed(1)}/10</strong>,
            com caminho claro para 7+ em 2–3 ciclos de fatura se os atrasos forem eliminados e a volatilidade tech controlada.
          </p>
        </article>
      </Section>

      <footer className="footer">
        <p>Auditoria financeira pessoal · dados Nubank · gerado automaticamente a partir das faturas CSV.</p>
      </footer>
    </div>
  );
}

export default App;
