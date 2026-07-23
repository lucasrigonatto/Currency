#!/usr/bin/env python3
"""Gera src/data/analysis.json a partir dos CSVs Nubank em public/data/raw ou uploads."""
from __future__ import annotations

import csv
import json
import re
import shutil
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = Path("/home/ubuntu/.cursor/projects/workspace/uploads")
RAW = ROOT / "public" / "data" / "raw"

FILES = [
    ("2026-06-14", "Nubank_2026-06-14_c5f3.csv", "Nubank_2026-06-14.csv"),
    ("2026-07-14", "Nubank_2026-07-14_e86d.csv", "Nubank_2026-07-14.csv"),
    ("2026-08-14", "Nubank_2026-08-14_ec83.csv", "Nubank_2026-08-14.csv"),
]

WEEKDAYS_PT = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
]

RULES = [
    (r"iof de|multa por fatura|juros por fatura|iof por fatura", "Contas"),
    (r"ifood|ifd\*", "Delivery"),
    (r"uber", "Uber"),
    (r"carrefour posto|posto ", "Combustível"),
    (r"drogasil|drogaria|panvel|raia", "Farmácia"),
    (r"espacolaser|duarte haircut", "Saúde"),
    (r"google one|hostinger|cursor ai|apple\.com", "Assinaturas"),
    (r"zpyreceitafederal|receita federal", "Contas"),
    (r"sg servicos", "Contas"),
    (r"supermercado|carnedesol|lmsdistribuicao|distribuidor louvada|mp \*carne", "Mercado"),
    (r"mercadolivre|mercado\*|amazon|fujioka|jim\.com|purochar|tinaeuropa|decathlon", "Compras Online"),
    (r"tutto pane|valori", "Cafés"),
    (
        r"nip napoli|buteco|cabanero|outback|subway|bar do kuka|espetinhos|obhargastronomia|caseratto",
        "Restaurantes",
    ),
    (r"flosofia|flowershop|meu bilhete|pecuaria", "Lazer"),
    (r"solution", "Outros"),
]


def parse_amount(s: str) -> float:
    s = s.strip().replace('"', "")
    neg = s.startswith("-")
    s = s.lstrip("-").strip().replace(".", "").replace(",", ".")
    v = float(s)
    return -v if neg else v


def classify(title: str) -> str:
    t = title.lower()
    for pat, cat in RULES:
        if re.search(pat, t):
            return cat
    return "Outros"


def merchant_key(title: str) -> str:
    t = re.sub(r"\s*-\s*Parcela\s+\d+/\d+", "", title, flags=re.I)
    t = re.sub(r'^IOF de\s+"([^"]+)"$', r"IOF — \1", t, flags=re.I)
    tl = t.lower()
    mapping = [
        ("uber", "Uber"),
        ("buteco", "Buteco do Allan"),
        ("google one", "Google One"),
        ("apple.com", "Apple.com/Bill"),
        ("cursor", "Cursor AI"),
        ("fujioka", "Fujioka"),
        ("purochar", "Puro Charme (Mercado Livre)"),
        ("mercadolivre", "Mercado Livre"),
        ("tinaeuropa", "Tina Europa"),
        ("tinaeur", "Tina Europa"),
        ("imperium", "Imperium Joi (Jim.com)"),
        ("amazon", "Amazon"),
        ("hostinger", "Hostinger"),
        ("tutto pane", "Tutto Pane (Valori)"),
        ("valori", "Tutto Pane (Valori)"),
        ("carrefour posto", "Carrefour Posto"),
        ("espacolaser", "Espaçolaser"),
        ("zpyreceita", "Zapay Receita Federal"),
        ("carnedesol", "Carne de Sol Doc"),
        ("caseratto", "Caseratto (iFood)"),
        ("ifood", "iFood"),
        ("sg servicos", "SG Serviços Inteligentes"),
        ("lmsdistribuicao", "LMS Distribuição"),
        ("meu bilhete", "Meu Bilhete - Pecuária"),
        ("flosofia", "Flosofia Flowershop"),
        ("nip napoli", "Nip Napoli"),
        ("duarte", "Duarte Haircut"),
        ("louvada", "Distribuidor Louvada G"),
        ("pro brazi", "Supermercado Pro Brazil"),
        ("obhar", "Obhar Gastronomia"),
        ("cabanero", "Cabanero Tex-Mex"),
        ("outback", "Outback Goiânia"),
        ("bar do kuka", "Bar do Kuka"),
        ("espetinhos", "Espetinhos e Assados"),
        ("drogasil", "Drogasil"),
        ("decathlon", "Decathlon"),
        ("subway", "Subway"),
        ("solution", "Solution"),
        ("multa por fatura", "Multa por fatura atrasada"),
        ("juros por fatura", "Juros por fatura atrasada"),
        ("iof por fatura", "IOF por fatura atrasada"),
    ]
    for key, name in mapping:
        if key in tl:
            return name
    return t.strip()


def is_meta(title: str) -> bool:
    tl = title.lower()
    return (
        "pagamento recebido" in tl
        or "valor pendente" in tl
        or "depósito de confiança" in tl
    )


def parse_installment(title: str):
    m = re.search(r"Parcela\s+(\d+)/(\d+)", title, re.I)
    return (int(m.group(1)), int(m.group(2))) if m else None


def channel(title: str, category: str, merchant: str) -> str:
    tl = title.lower()
    if any(
        k in tl
        for k in [
            "nupay",
            "ifood",
            "ifd*",
            "amazon",
            "mercado",
            "apple.com",
            "google",
            "cursor",
            "hostinger",
            "jim.com",
            "dl*",
        ]
    ):
        return "online"
    if category in ("Uber", "Delivery", "Assinaturas", "Compras Online"):
        return "online"
    online_merchants = {
        "Uber",
        "iFood",
        "Caseratto (iFood)",
        "Cursor AI",
        "Google One",
        "Apple.com/Bill",
        "Hostinger",
        "Amazon",
        "Mercado Livre",
        "Fujioka",
        "Imperium Joi (Jim.com)",
        "Puro Charme (Mercado Livre)",
        "Tina Europa",
    }
    if merchant in online_merchants:
        return "online"
    return "presencial"


def resolve_sources():
    sources = []
    RAW.mkdir(parents=True, exist_ok=True)
    for bill, upload_name, raw_name in FILES:
        upload = UPLOADS / upload_name
        dest = RAW / raw_name
        if upload.exists():
            shutil.copy(upload, dest)
        if not dest.exists():
            raise FileNotFoundError(f"Missing CSV for bill {bill}")
        sources.append((bill, dest))
    return sources


def main():
    sources = resolve_sources()
    rows = []
    for bill, path in sources:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                amt = parse_amount(row["amount"])
                title = row["title"].strip()
                meta = is_meta(title)
                rows.append(
                    {
                        "date": row["date"],
                        "title": title,
                        "amount": round(amt, 2),
                        "bill": bill,
                        "meta": meta,
                        "category": "Meta" if meta else classify(title),
                        "merchant": title if meta else merchant_key(title),
                        "installment": None if meta else parse_installment(title),
                    }
                )

    spending = [r for r in rows if not r["meta"]]
    purchases = [r for r in spending if r["amount"] > 0]
    refunds = [r for r in spending if r["amount"] < 0]

    merchant_net = defaultdict(float)
    merchant_count = defaultdict(int)
    merchant_cat = {}
    for r in spending:
        merchant_net[r["merchant"]] += r["amount"]
        if r["amount"] > 0:
            merchant_count[r["merchant"]] += 1
        merchant_cat[r["merchant"]] = r["category"]

    cat_net = defaultdict(float)
    cat_count = defaultdict(int)
    for r in spending:
        cat_net[r["category"]] += r["amount"]
        if r["amount"] > 0:
            cat_count[r["category"]] += 1

    total_net = sum(r["amount"] for r in spending)
    total_purchases = sum(r["amount"] for r in purchases)
    amounts = [r["amount"] for r in purchases]
    n_purchases = len(purchases)

    bill_totals = {}
    for bill, _ in sources:
        bill_sp = [r for r in spending if r["bill"] == bill]
        bill_totals[bill] = {
            "net": round(sum(r["amount"] for r in bill_sp), 2),
            "purchases": round(sum(r["amount"] for r in bill_sp if r["amount"] > 0), 2),
            "count": len([r for r in bill_sp if r["amount"] > 0]),
        }

    dates = sorted({r["date"] for r in purchases})
    d0 = datetime.strptime(dates[0], "%Y-%m-%d")
    d1 = datetime.strptime(dates[-1], "%Y-%m-%d")
    n_days = (d1 - d0).days + 1
    n_weeks = n_days / 7

    daily = defaultdict(float)
    for r in spending:
        daily[r["date"]] += r["amount"]

    weekday_spend = defaultdict(float)
    weekday_count = defaultdict(int)
    for r in purchases:
        wd = datetime.strptime(r["date"], "%Y-%m-%d").weekday()
        weekday_spend[WEEKDAYS_PT[wd]] += r["amount"]
        weekday_count[WEEKDAYS_PT[wd]] += 1

    cum = []
    running = 0.0
    for d in sorted(daily.keys()):
        running += daily[d]
        cum.append({"date": d, "daily": round(daily[d], 2), "cumulative": round(running, 2)})

    mean = statistics.mean(amounts)
    median = statistics.median(amounts)
    mode = Counter([round(a, 2) for a in amounts]).most_common(1)[0][0]
    stdev = statistics.stdev(amounts)

    goods = [
        r
        for r in purchases
        if not any(x in r["title"].lower() for x in ["iof", "multa", "juros"])
    ]
    min_p = min(goods, key=lambda x: x["amount"])
    max_p = max(purchases, key=lambda x: x["amount"])

    top_merchants = sorted(
        [
            {
                "merchant": m,
                "total": round(merchant_net[m], 2),
                "count": merchant_count[m],
                "avg": round(merchant_net[m] / merchant_count[m], 2)
                if merchant_count[m]
                else 0,
                "category": merchant_cat[m],
                "pct": round(100 * merchant_net[m] / total_net, 2),
            }
            for m in merchant_net
            if merchant_net[m] > 0
        ],
        key=lambda x: -x["total"],
    )[:20]

    top_cats = sorted(
        [
            {
                "category": c,
                "total": round(cat_net[c], 2),
                "count": cat_count[c],
                "pct": round(100 * cat_net[c] / total_net, 2),
                "avg": round(cat_net[c] / cat_count[c], 2) if cat_count[c] else 0,
            }
            for c in cat_net
            if abs(cat_net[c]) > 0.001
        ],
        key=lambda x: -x["total"],
    )

    subs = []
    for m, notes, monthly_override, save in [
        (
            "Google One",
            "Assinatura mensal estável de armazenamento em nuvem.",
            24.99,
            0,
        ),
        (
            "Apple.com/Bill",
            "Dois cobradores recorrentes (~R$ 69,90 + R$ 5,90). Em maio houve R$ 34,90. Estimativa mensal: R$ 75,80.",
            75.80,
            5.90,
        ),
        (
            "Cursor AI",
            "Salto de R$ 111,75 (maio) para R$ 963,08 (junho) + IOF. Pode ser upgrade/anual. Estimativa de risco usa o maior valor observado.",
            963.08,
            round((963.08 - 111.75), 2),
        ),
        (
            "Hostinger",
            "Hospedagem (1 cobrança no período). Verificar se o serviço ainda é necessário.",
            51.08,
            51.08,
        ),
    ]:
        if m == "Cursor AI":
            txs = [r for r in spending if "cursor" in r["title"].lower()]
        else:
            txs = [r for r in spending if r["merchant"] == m]
        if not txs:
            continue
        total = sum(r["amount"] for r in txs)
        months = len({r["bill"] for r in txs})
        iof = sum(r["amount"] for r in txs if "IOF" in r["title"])
        subs.append(
            {
                "name": m,
                "charges": [
                    {
                        "date": r["date"],
                        "title": r["title"],
                        "amount": r["amount"],
                        "bill": r["bill"],
                    }
                    for r in txs
                ],
                "total_period": round(total, 2),
                "months_with_charge": months,
                "monthly_estimate": monthly_override,
                "annual_estimate": round(monthly_override * 12, 2),
                "iof": round(iof, 2),
                "notes": notes,
                "possible_savings_monthly": save,
            }
        )

    installments = []
    for r in purchases:
        if not r["installment"]:
            continue
        cur, total_p = r["installment"]
        rem = total_p - cur
        installments.append(
            {
                "store": r["merchant"],
                "title": r["title"],
                "date": r["date"],
                "bill": r["bill"],
                "installment_value": r["amount"],
                "current": cur,
                "total_parcels": total_p,
                "remaining_parcels": rem,
                "remaining_value": round(rem * r["amount"], 2),
                "total_purchase_estimate": round(r["amount"] * total_p, 2),
                "category": r["category"],
            }
        )

    latest = {}
    for i in installments:
        key = (i["store"], i["total_parcels"], i["installment_value"])
        if key not in latest or i["date"] > latest[key]["date"]:
            latest[key] = i
    installments_latest = sorted(latest.values(), key=lambda x: -x["remaining_value"])

    sub_names = {"Google One", "Apple.com/Bill", "Cursor AI", "Hostinger"}
    merch_bills = defaultdict(set)
    merch_times = Counter()
    for r in purchases:
        merch_bills[r["merchant"]].add(r["bill"])
        merch_times[r["merchant"]] += 1

    recurring = set()
    for m, bills in merch_bills.items():
        if (
            len(bills) >= 2
            or merch_times[m] >= 3
            or m in sub_names
            or any(x["store"] == m for x in installments_latest)
        ):
            recurring.add(m)
    for m in [
        "Multa por fatura atrasada",
        "Juros por fatura atrasada",
        "IOF por fatura atrasada",
        "Uber",
        "Carrefour Posto",
        "Fujioka",
    ]:
        if m in merchant_net:
            recurring.add(m)

    recurring_total = sum(merchant_net[m] for m in recurring)
    eventual_total = total_net - recurring_total
    online_total = sum(
        r["amount"]
        for r in spending
        if channel(r["title"], r["category"], r["merchant"]) == "online"
    )
    presencial_total = total_net - online_total

    impulse = []
    for r in purchases:
        reasons = []
        if r["category"] in ("Delivery", "Cafés") and r["amount"] < 120:
            reasons.append("Conveniência alimentar")
        if r["category"] == "Restaurantes" and r["amount"] < 120:
            reasons.append("Refeição fora — candidata a substituição planejada")
        if "flosofia" in r["title"].lower():
            reasons.append("Gasto emocional/presente")
        if r["merchant"] == "Uber" and r["amount"] < 25:
            reasons.append("Corrida curta — possível modal alternativo")
        if "buteco" in r["title"].lower() or "bar do kuka" in r["title"].lower():
            reasons.append("Lazer noturno / social")
        if reasons:
            impulse.append(
                {
                    "date": r["date"],
                    "title": r["title"],
                    "amount": r["amount"],
                    "category": r["category"],
                    "merchant": r["merchant"],
                    "reasons": reasons,
                }
            )

    late_fees = sum(
        r["amount"]
        for r in spending
        if r["merchant"]
        in (
            "Multa por fatura atrasada",
            "Juros por fatura atrasada",
            "IOF por fatura atrasada",
        )
    )
    food_total = sum(cat_net[c] for c in ["Restaurantes", "Delivery", "Cafés", "Mercado"])
    transport_total = cat_net["Uber"] + cat_net["Combustível"]
    weekend = sum(
        r["amount"]
        for r in purchases
        if datetime.strptime(r["date"], "%Y-%m-%d").weekday() >= 5
    )
    weekday_amt = total_purchases - weekend
    months = 3
    avg_monthly = total_net / months
    cursor_high = 963.08
    cursor_low = 111.75
    cons_monthly = late_fees / months + (cat_net["Uber"] * 0.25) / months + 5.90
    mod_monthly = (
        late_fees / months
        + (cat_net["Restaurantes"] + cat_net["Delivery"] + cat_net["Cafés"]) * 0.35 / months
        + cat_net["Uber"] * 0.40 / months
        + max(0, cursor_high - cursor_low) / months
        + 20
    )
    agg_monthly = (
        late_fees / months
        + (cat_net["Restaurantes"] + cat_net["Delivery"] + cat_net["Cafés"]) * 0.55 / months
        + cat_net["Uber"] * 0.60 / months
        + cursor_high / months
        + 40
        + 50
    )

    all_txs = []
    for r in rows:
        all_txs.append(
            {
                "date": r["date"],
                "title": r["title"],
                "amount": r["amount"],
                "bill": r["bill"],
                "category": r["category"],
                "merchant": r["merchant"],
                "meta": r["meta"],
                "installment": list(r["installment"]) if r["installment"] else None,
                "channel": "meta"
                if r["meta"]
                else channel(r["title"], r["category"], r["merchant"]),
                "recurring": (not r["meta"]) and (r["merchant"] in recurring),
            }
        )

    opportunities = sorted(
        [
            {
                "title": "Eliminar atrasos de fatura",
                "monthly": round(late_fees / 3, 2),
                "annual": round(late_fees / 3 * 12, 2),
                "impact": "Crítico",
                "detail": "Multa+juros+IOF em 3/3 faturas = desperdício puro sem benefício.",
            },
            {
                "title": "Revisar plano Cursor AI",
                "monthly": round((cursor_high - cursor_low), 2),
                "annual": round((cursor_high - cursor_low) * 12, 2),
                "impact": "Alto",
                "detail": "Diferença entre cobranças observadas. Confirmar se o plano alto é necessário mensalmente (ou se foi cobrança anual).",
            },
            {
                "title": "Reduzir alimentação fora (rest./delivery/café) em 35%",
                "monthly": round(
                    (cat_net["Restaurantes"] + cat_net["Delivery"] + cat_net["Cafés"])
                    * 0.35
                    / 3,
                    2,
                ),
                "annual": round(
                    (cat_net["Restaurantes"] + cat_net["Delivery"] + cat_net["Cafés"])
                    * 0.35
                    / 3
                    * 12,
                    2,
                ),
                "impact": "Alto",
                "detail": "Alimentação fora é maleável com planejamento semanal de refeições.",
            },
            {
                "title": "Otimizar mobilidade (Uber −40%)",
                "monthly": round(cat_net["Uber"] * 0.40 / 3, 2),
                "annual": round(cat_net["Uber"] * 0.40 / 3 * 12, 2),
                "impact": "Médio",
                "detail": "Muitas corridas de curto valor; misturar caminhada, ônibus ou agrupar deslocamentos.",
            },
            {
                "title": "Auditar Apple.com/Bill",
                "monthly": 20.0,
                "annual": 240.0,
                "impact": "Médio",
                "detail": "Há pelo menos dois cobradores. Cancelar o de R$ 5,90 e revisar o de R$ 69,90.",
            },
        ],
        key=lambda x: -x["annual"],
    )

    report = {
        "period": {
            "start": dates[0],
            "end": dates[-1],
            "days": n_days,
            "weeks": round(n_weeks, 2),
            "bills": [b for b, _ in sources],
            "label": f"{dates[0]} a {dates[-1]} (3 faturas Nubank)",
        },
        "summary": {
            "total_net_spend": round(total_net, 2),
            "total_purchases_gross": round(total_purchases, 2),
            "refunds_total": round(sum(r["amount"] for r in refunds), 2),
            "purchase_count": n_purchases,
            "avg_ticket": round(mean, 2),
            "median_ticket": round(median, 2),
            "mode_ticket": round(mode, 2),
            "stdev": round(stdev, 2),
            "max_purchase": {
                "amount": max_p["amount"],
                "title": max_p["title"],
                "date": max_p["date"],
            },
            "min_purchase": {
                "amount": min_p["amount"],
                "title": min_p["title"],
                "date": min_p["date"],
            },
            "establishments": len([m for m, v in merchant_net.items() if v > 0]),
            "avg_per_day": round(total_net / n_days, 2),
            "avg_per_week": round(total_net / n_weeks, 2),
            "avg_per_category": round(
                total_net / len([c for c in cat_net if cat_net[c] > 0]), 2
            ),
            "avg_monthly": round(avg_monthly, 2),
            "late_fees_total": round(late_fees, 2),
            "food_total": round(food_total, 2),
            "transport_total": round(transport_total, 2),
            "bill_totals": bill_totals,
        },
        "categories": top_cats,
        "merchants": top_merchants,
        "weekday": [
            {"day": d, "total": round(weekday_spend[d], 2), "count": weekday_count[d]}
            for d in WEEKDAYS_PT
        ],
        "daily": cum,
        "subscriptions": subs,
        "installments": installments,
        "installments_latest": installments_latest,
        "stats": {
            "online_pct": round(100 * online_total / total_net, 2),
            "presencial_pct": round(100 * presencial_total / total_net, 2),
            "online_total": round(online_total, 2),
            "presencial_total": round(presencial_total, 2),
            "recurring_pct": round(100 * recurring_total / total_net, 2),
            "eventual_pct": round(100 * eventual_total / total_net, 2),
            "recurring_total": round(recurring_total, 2),
            "eventual_total": round(eventual_total, 2),
            "weekend_total": round(weekend, 2),
            "weekday_total": round(weekday_amt, 2),
            "weekend_pct": round(100 * weekend / total_purchases, 2),
        },
        "impulse_candidates": impulse[:50],
        "savings": {
            "conservative": {
                "monthly": round(cons_monthly, 2),
                "annual": round(cons_monthly * 12, 2),
                "actions": [
                    "Pagar fatura em dia (zerar multa/juros/IOF)",
                    "Reduzir 25% das corridas de Uber",
                    "Cancelar microassinatura Apple de R$ 5,90 se não essencial",
                ],
            },
            "moderate": {
                "monthly": round(mod_monthly, 2),
                "annual": round(mod_monthly * 12, 2),
                "actions": [
                    "Eliminar atrasos",
                    "Cortar 35% de restaurantes/delivery/cafés",
                    "Reduzir 40% Uber",
                    "Manter Cursor no plano mais baixo observado",
                    "Revisar pacote Apple (~R$ 20/mês)",
                ],
            },
            "aggressive": {
                "monthly": round(agg_monthly, 2),
                "annual": round(agg_monthly * 12, 2),
                "actions": [
                    "Zero atraso",
                    "Cortar 55% alimentação fora",
                    "Reduzir 60% Uber",
                    "Suspender/minimizar Cursor de alto valor",
                    "Enxugar Apple",
                    "Congelar compras online discricionárias",
                ],
            },
        },
        "scores": {
            "organizacao": {
                "score": 3.0,
                "reason": "Atrasos em todas as 3 faturas geraram multa, juros e IOF — desorganização no fluxo de pagamento.",
            },
            "diversificacao": {
                "score": 6.5,
                "reason": "Gastos em várias categorias, com concentração em assinaturas/tech, compras online e alimentação fora.",
            },
            "controle": {
                "score": 3.5,
                "reason": "Desvio-padrão alto e salto do Cursor; novos parcelamentos longos aumentam o comprometimento futuro.",
            },
            "consumo_consciente": {
                "score": 4.5,
                "reason": "Há gastos de valor (saúde, ferramentas), mas padrão forte de conveniência e encargos evitáveis.",
            },
            "saude_financeira": {
                "score": 3.0,
                "reason": "Encargos recorrentes por atraso + novas parcelas (até 12x) pressionam o orçamento dos próximos meses.",
            },
        },
        "opportunities": opportunities,
        "transactions": all_txs,
    }

    out_src = ROOT / "src" / "data" / "analysis.json"
    out_pub = ROOT / "public" / "data" / "analysis.json"
    out_src.parent.mkdir(parents=True, exist_ok=True)
    out_pub.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    out_src.write_text(payload, encoding="utf-8")
    out_pub.write_text(payload, encoding="utf-8")
    print(f"Wrote {out_src} and {out_pub}")
    print("Total net:", report["summary"]["total_net_spend"])


if __name__ == "__main__":
    main()
