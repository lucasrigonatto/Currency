import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Charts', () => ({
  CategoryPie: () => <div data-testid="chart-category-pie" />,
  MerchantBars: () => <div data-testid="chart-merchant-bars" />,
  CategoryBars: () => <div data-testid="chart-category-bars" />,
  DailyLine: () => <div data-testid="chart-daily-line" />,
  CumulativeLine: () => <div data-testid="chart-cumulative-line" />,
  CategoryCountBars: () => <div data-testid="chart-category-count" />,
  WeekdayBars: () => <div data-testid="chart-weekday" />,
  RecurringPie: () => <div data-testid="chart-recurring" />,
}));

test('renders audit brand and executive summary', () => {
  render(<App />);
  expect(screen.getByText(/Auditoria Nubank/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Resumo geral/i })).toBeInTheDocument();
  expect(screen.getByText(/Gasto líquido total/i)).toBeInTheDocument();
});
