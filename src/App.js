import React, { useEffect, useState } from "react";
import { currencies, convertAmount, fetchRate } from "./rates";
import "./App.css";
export default function App() {
  const [amount, setAmount] = useState("100");
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState("EUR");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    if (base === quote) {
      setData({ rate: 1, date: null });
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    fetchRate(base, quote)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [base, quote, attempt]);
  const result = data ? convertAmount(amount, data.rate) : null;
  const invalid = convertAmount(amount, 1) === null;
  const format = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quote,
      maximumFractionDigits: 2,
    }).format(value);
  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="./">
          <span className="brand-symbol">C</span> Currency
          <span className="brand-period">.</span>
        </a>
        <span className="top-note">
          A little clarity for your next conversion.
        </span>
        <a
          className="source-link"
          href="https://github.com/lucasrigonatto/Currency"
        >
          View source ↗
        </a>
      </header>
      <section className="intro">
        <span className="eyebrow">LESS GUESSWORK. MORE CLARITY.</span>
        <h1>
          Different currencies.
          <br />
          <em>One simple answer.</em>
        </h1>
        <p>
          Check a daily exchange rate, swap your currencies, and see what your
          amount becomes.
        </p>
      </section>
      <section className="converter" aria-label="Currency converter">
        <div className="panel-heading">
          <h2>Make the conversion</h2>
          <span className="provider-pill">
            <i /> Daily reference rates
          </span>
        </div>
        <label className="amount-label">
          Amount
          <input
            aria-label="Amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="currency-pair">
          <label>
            From
            <select
              aria-label="From currency"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            >
              {currencies.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="swap"
            aria-label="Swap currencies"
            onClick={() => {
              setBase(quote);
              setQuote(base);
            }}
          >
            ⇄
          </button>
          <label>
            To
            <select
              aria-label="To currency"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            >
              {currencies.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {invalid && (
          <p className="error" role="alert">
            Enter a valid amount of zero or more.
          </p>
        )}
        {loading && (
          <p className="loading" role="status">
            Getting the latest reference rate…
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="retry" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </button>
          </div>
        )}
        {data && !loading && !error && (
          <div className="result">
            <span>YOU GET</span>
            <output aria-label="Converted amount">
              {result === null ? "—" : format(result)}
            </output>
            <p>
              1 {base} ={" "}
              {data.rate.toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
              {quote}
            </p>
            {data.rate > 0 && base !== quote && (
              <p>
                1 {quote} ={" "}
                {(1 / data.rate).toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })}{" "}
                {base}
              </p>
            )}
            <small>
              {data.date
                ? "Reference date: " + data.date
                : "Same currency · no conversion needed"}
            </small>
          </div>
        )}
      </section>
      <section className="notes">
        <div>
          <span>01</span>
          <h3>Choose your pair</h3>
          <p>
            Twelve commonly used currencies, including the US dollar, euro,
            and Brazilian real.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>Keep the context</h3>
          <p>
            Daily reference data from Frankfurter. Your bank or card provider
            may apply a different rate and fees.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Make it yours</h3>
          <p>
            Change the amount instantly or swap currencies to look at the
            conversion the other way around.
          </p>
        </div>
      </section>
      <footer>
        Built for a clearer picture.
        <a href="https://frankfurter.dev/">Rate data: Frankfurter ↗</a>
      </footer>
    </main>
  );
}
