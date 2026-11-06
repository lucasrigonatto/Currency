export const currencies = [
  ["USD", "US dollar"],
  ["EUR", "Euro"],
  ["BRL", "Brazilian real"],
  ["GBP", "British pound"],
  ["CAD", "Canadian dollar"],
  ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"],
  ["CHF", "Swiss franc"],
  ["CNY", "Chinese yuan"],
  ["INR", "Indian rupee"],
  ["MXN", "Mexican peso"],
  ["ARS", "Argentine peso"],
];
export async function fetchRate(base, quote) {
  const response = await fetch(
    "https://api.frankfurter.dev/v2/rate/" + base + "/" + quote,
  );
  if (!response.ok)
    throw new Error("Rates are unavailable right now. Please try again.");
  const data = await response.json();
  if (!Number.isFinite(data.rate) || data.rate <= 0 || !data.date)
    throw new Error("The provider returned an invalid rate.");
  return data;
}
export async function fetchRates(base) {
  const quotes = currencies
    .map(([code]) => code)
    .filter((code) => code !== base)
    .join(",");
  const response = await fetch(
    "https://api.frankfurter.dev/v2/rates?base=" + base + "&quotes=" + quotes,
  );
  if (!response.ok)
    throw new Error("Rates are unavailable right now. Please try again.");
  const data = await response.json();
  if (
    !Array.isArray(data) ||
    !data.length ||
    data.some(
      (row) =>
        !Number.isFinite(row.rate) || row.rate <= 0 || !row.quote || !row.date,
    )
  )
    throw new Error("The provider returned invalid rates.");
  return data;
}
export function convertAmount(amount, rate) {
  if (amount === "" || !Number.isFinite(Number(amount)) || Number(amount) < 0)
    return null;
  const converted = Number(amount) * rate;
  return Number.isFinite(converted) ? converted : null;
}
