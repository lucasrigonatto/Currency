import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./components/Charts', () => ({
  CategoryPie: () => <div data-testid="chart-pie" />,
  HorizontalBars: () => <div data-testid="chart-bars" />,
}));

test('renders the finance shell and empty dashboard', async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText('Finanças')).toBeInTheDocument());
  expect(screen.getByText(/Comece importando uma fatura/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Importar CSV, XLSX ou PDF/i })).toBeInTheDocument();
});
