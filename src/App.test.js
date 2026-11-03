import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { convertAmount } from "./rates";
const reply = (rate = 0.9) => ({
  ok: true,
  json: async () => ({ rate, date: "2026-11-03", base: "USD", quote: "EUR" }),
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(reply());
});
afterEach(() => {
  jest.restoreAllMocks();
});
test("converts an amount using the returned rate and shows the reference date", async () => {
  render(<App />);
  expect(await screen.findByLabelText("Converted amount")).toHaveTextContent(
    "€90.00",
  );
  fireEvent.change(screen.getByLabelText("Amount"), {
    target: { value: "250" },
  });
  expect(screen.getByLabelText("Converted amount")).toHaveTextContent(
    "€225.00",
  );
  expect(screen.getByText(/Reference date: 2026-11-03/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("rejects negative amounts and accepts zero", async () => {
  render(<App />);
  await screen.findByLabelText("Converted amount");
  fireEvent.change(screen.getByLabelText("Amount"), {
    target: { value: "-1" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("valid amount");
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
  expect(screen.getByLabelText("Converted amount")).toHaveTextContent("€0.00");
  expect(convertAmount("", 1)).toBeNull();
  expect(convertAmount("abc", 1)).toBeNull();
  expect(convertAmount("10", Infinity)).toBeNull();
});
test("swaps currencies and requests the reversed pair", async () => {
  render(<App />);
  await screen.findByLabelText("Converted amount");
  fireEvent.click(screen.getByRole("button", { name: "Swap currencies" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenLastCalledWith(
      "https://api.frankfurter.dev/v2/rate/EUR/USD",
    ),
  );
  await screen.findByLabelText("Converted amount");
  expect(screen.getByLabelText("From currency")).toHaveValue("EUR");
});
test("same-currency conversion uses one without another network request", async () => {
  render(<App />);
  await screen.findByLabelText("Converted amount");
  fireEvent.change(screen.getByLabelText("To currency"), {
    target: { value: "USD" },
  });
  expect(
    await screen.findByText("Same currency · no conversion needed"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Converted amount")).toHaveTextContent(
    "$100.00",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("shows a provider error and recovers on retry", async () => {
  fetch.mockResolvedValueOnce({ ok: false });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByLabelText("Converted amount")).toHaveTextContent(
    "€90.00",
  );
});
