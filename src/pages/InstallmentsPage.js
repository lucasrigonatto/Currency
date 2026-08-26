import { useFinance } from '../context/FinanceContext';
import { remainingSchedule } from '../domain/installments';
import { brlCents, formatDate } from '../lib/format';

export default function InstallmentsPage() {
  const { installmentGroups, transactions } = useFinance();
  const posted = transactions.filter((t) => t.status === 'posted');

  return (
    <>
      <p className="page-lead">
        Cada compra parcelada vira um grupo. Só a parcela do mês conta como despesa daquele mês; o restante aparece como compromisso futuro.
      </p>
      {!installmentGroups.length && <p className="muted">Nenhum parcelamento detectado ainda.</p>}
      {installmentGroups.map((group) => {
        const schedule = remainingSchedule(group, posted);
        return (
          <section className="panel" key={group.id}>
            <h3>{group.merchant}</h3>
            <div className="metrics">
              <div className="metric"><span className="metric__label">Total</span><strong className="metric__value">{brlCents(group.totalAmountCents)}</strong></div>
              <div className="metric"><span className="metric__label">Parcela</span><strong className="metric__value">{brlCents(group.installmentAmountCents)}</strong><span className="metric__hint">{group.totalInstallments}x</span></div>
              <div className="metric"><span className="metric__label">Pago</span><strong className="metric__value">{schedule.paidCount}/{group.totalInstallments}</strong><span className="metric__hint">{brlCents(schedule.paidCents)}</span></div>
              <div className="metric"><span className="metric__label">Restante</span><strong className="metric__value">{brlCents(schedule.remainingCents)}</strong><span className="metric__hint">{schedule.remainingCount} parcelas</span></div>
              <div className="metric"><span className="metric__label">Próxima</span><strong className="metric__value">{schedule.next ? formatDate(schedule.next.date) : '—'}</strong></div>
              <div className="metric"><span className="metric__label">Última</span><strong className="metric__value">{schedule.last ? formatDate(schedule.last.date) : '—'}</strong></div>
            </div>
          </section>
        );
      })}
    </>
  );
}
