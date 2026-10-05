# OCF / Net Income Rule Review and Phase 107 Adoption

Updated: 2026-07-24

## Conclusion

Phase 107 formally adopts `operating-cash-flow-much-lower-than-net-income` as the eleventh rule. The Phase 106 backend change makes `net_income` prefer net income attributable to owners of the parent and fall back to consolidated total net income only when that value is unavailable. The frontend uses the API-provided `net_income` directly for both matching and evidence.

The final rule is a single-year caution, not a persistence or causation claim. It requires a non-financial company, `net_income >= 10_000_000_000`, positive OCF, and a strict raw ratio below `0.4`. Exact `0.4`, zero OCF, negative OCF, null inputs, and financial companies do not match. Negative OCF remains the responsibility of `net-income-positive-operating-cash-flow-negative`.

The rule now appears in the existing warning card UI and participates in the existing Phase 97 `warning_flags` mapper and Phase 98 representative-rule selection without changing the order of the original ten rules. Backend Phase 107 is implemented but not deployed as of this update, so production Phase 97 and Phase 98 calls remain pending post-deployment QA.

The original production review below remains as the decision record. Its `0.5` results describe the earlier experiment and are not the formal Phase 107 contract.

## Final Phase 107 Contract

```text
is_financial === false
net_income != null
operating_cash_flow != null
net_income >= 10,000,000,000
operating_cash_flow > 0
operating_cash_flow / net_income < 0.4
```

The ratio used for the strict match and the evidence percentage comes from the same calculation. Percentage evidence has the fixed label `영업활동현금흐름/순이익 비율` and is truncated, not rounded, to two decimal places:

```ts
const ratio = operatingCashFlow / netIncome;
const evidencePercentage = Math.floor(ratio * 10000) / 100;
```

The earlier E3 proposal to cap evidence at `39.9` is discarded. Evidence contains exactly `당기순이익`, `영업활동현금흐름`, and `영업활동현금흐름/순이익 비율`; monetary values remain in API-provided KRW. The backend maps this rule to the single `check_items` value `영업활동현금흐름`, and the frontend displays that response without creating or supplementing items.

The caution copy deliberately treats this as a single-year observation. It does not assert structurally weak cash generation, low earnings quality, continuing deterioration, or a specific receivables or inventory cause.

## Scope and Source

The following scope describes the historical experiment completed before formal adoption:

- Source: production `GET /api/v1/finance/companies` and `GET /api/v1/finance/summary/detail` with `unit=원`
- Authentication: existing Bearer login; no `X-API-Key`
- Collection snapshot: 15 companies, fiscal year 2025, collected on 2026-07-15
- Rows: 75 total (15 companies × 5 years), including 70 non-financial and 5 financial rows
- Rule implementation: existing `analyzeExperimentalCashFlowInsight()` helper
- Helper cross-check: 0 mismatches against an independent threshold calculation

The historically evaluated rule ID and condition were:

```text
operating-cash-flow-much-lower-than-net-income
non-financial
net_income >= 10,000,000,000
operating_cash_flow > 0
operating_cash_flow / net_income < 0.5
```

Null and non-finite values are excluded. The ratio is calculated only when OCF is positive. Exact-zero OCF produces a `zero-operating-cash-flow` observation with a `null` ratio and never matches the ratio rule; negative OCF remains outside this experimental ratio rule.

## Reproduction

Use an existing Bearer token or provide login credentials through environment variables. The script never sends `X-API-Key`.

```powershell
$env:CHATDART_ACCESS_TOKEN='<access token>'
node --experimental-strip-types --experimental-loader ./scripts/typescript-path-loader.mjs scripts/analyzeExperimentalCashFlowRule.ts
```

Add `--markdown-rows` to print the non-financial yearly table. The script deliberately stops if the collected-company endpoint does not return exactly 15 companies, if a company is not `completed`, or if it does not contain five yearly rows.

The production collected-company endpoint returned exactly these 15 companies, so no companies were selected ad hoc:

| Stock code | Company | Financial sector |
|---|---|:---:|
| 000270 | Kia | No |
| 035720 | Kakao | No |
| 005930 | Samsung Electronics | No |
| 068270 | Celltrion | No |
| 012330 | Hyundai Mobis | No |
| 005380 | Hyundai Motor | No |
| 207940 | Samsung Biologics | No |
| 000990 | DB HiTek | No |
| 105560 | KB Financial Group | Yes |
| 066570 | LG Electronics | No |
| 373220 | LG Energy Solution | No |
| 035420 | NAVER | No |
| 005490 | POSCO Holdings | No |
| 006400 | Samsung SDI | No |
| 000660 | SK hynix | No |

## Frequency

### Current condition (`ratio < 0.5`)

- 3 of 15 companies overall (20.0%)
- 3 of 14 non-financial companies (21.4%)
- 3 of 75 total rows (4.0%)
- 3 of 70 non-financial rows (4.3%)

| Stock code | Company | Year | Net income (KRW) | OCF (KRW) | Ratio | Observation |
|---|---|---:|---:|---:|---:|---|
| 035720 | Kakao | 2022 | 1,358,019,478,520 | 678,376,491,408 | 0.4995 | Borderline; excluded at 0.4 |
| 068270 | Celltrion | 2022 | 542,566,233,270 | 863,531,984 | 0.0016 | Severe single-year gap; source-report review needed |
| 035420 | NAVER | 2021 | 16,489,849,771,129 | 1,379,905,728,836 | 0.0837 | Severe single-year gap; large net-income base |

Each matched company triggered in exactly one year. All three recovered above `0.5` in later data, so the sample shows isolated observations rather than a persistent multi-year pattern.

### Threshold sensitivity

| Ratio threshold | Companies | Company-years | Change |
|---:|---:|---:|---|
| `< 0.3` | 2 | 2 | Celltrion 2022, NAVER 2021 |
| `< 0.4` | 2 | 2 | Same as 0.3 |
| `< 0.5` | 3 | 3 | Adds Kakao 2022 (`0.4995`) |
| `< 0.6` | 3 | 3 | No additional rows |

The observed result is stable from `0.3` to `0.4` and from `0.5` to `0.6`. The only sensitivity point is Kakao 2022 immediately below `0.5`, which makes `0.5` look somewhat permissive for this small sample. This does not prove that `0.4` generalizes beyond the 15 demo companies.

## Minimum Net Income Filter

All 66 profitable non-financial rows already exceeded KRW 10 billion. Therefore, the KRW 10 billion materiality floor filtered out **zero profitable low-ratio rows** in this sample and did not change the 3-match result.

There were 4 loss years. A naive ratio-only implementation would classify their negative ratios as `< 0.5`; the current `net_income >= 10_000_000_000` condition correctly prevents those denominator-sign false positives. The condition is useful as a positive-net-income guard here, but its materiality value cannot be judged from this large-cap-only sample.

## Financial Sector, Zero, and Negative OCF

- KB Financial Group was the only financial company. Its `revenue`, `operating_profit`, and `operating_cash_flow` values were `null`, and all five rows were marked financial and excluded by the helper.
- The same production contract leaves all ten formal rules without their required revenue, operating-profit, or OCF input. `net_income` alone does not create a formal rule, so financial-sector rule cards and the Phase 97 and Phase 98 requests remain absent.
- No non-financial row had OCF exactly `0`, so production data does not answer whether exact zero should be promoted directly to a warning.
- Six non-financial rows had negative OCF and were excluded by the current `operating_cash_flow > 0` condition.

An exact reported OCF of zero remains only a separate `zero-operating-cash-flow` observation and is not assigned a ratio. The formal `net-income-positive-operating-cash-flow-negative` warning continues to require negative OCF. Phase 107 promotes only positive OCF below the strict `0.4` ratio threshold.

## Historical Recommendation

The 2026-07-20 review decision was **hold**. Phase 106 reaggregation and the Phase 107 decision supersede that status with the final contract above.

Before formal adoption:

1. Test `ratio < 0.4` on a broader, sector-balanced production or staging sample.
2. Review the source reports for Celltrion 2022 and NAVER 2021, and the boundary case Kakao 2022.
3. Decide whether the rule should require persistence, such as two consecutive years, or only flag severe one-year gaps.
4. Review exact-zero OCF observations for provenance and continue evaluating negative OCF separately from this ratio rule.
5. Reassess the KRW 10 billion floor on mid- and small-cap companies because it had no materiality effect in this sample.

## Non-financial Yearly Data

The ratios below use the unrounded KRW values; displayed ratios are rounded to four decimal places. `Current match` applies the existing `ratio < 0.5` condition.

| Stock code | Company | Year | Net income (KRW) | OCF (KRW) | OCF / net income | Current match | Note |
|---|---|---:|---:|---:|---:|:---:|---|
| 000270 | Kia | 2025 | 7560983000000 | 9054140000000 | 1.1975 | No | Above threshold |
| 000270 | Kia | 2024 | 9775005000000 | 12564368000000 | 1.2854 | No | Above threshold |
| 000270 | Kia | 2023 | 8777817000000 | 11296526000000 | 1.2869 | No | Above threshold |
| 000270 | Kia | 2022 | 5409429000000 | 9333186000000 | 1.7254 | No | Above threshold |
| 000270 | Kia | 2021 | 4760450000000 | 7359670000000 | 1.5460 | No | Above threshold |
| 000660 | SK hynix | 2025 | 42947902000000 | 53373126000000 | 1.2427 | No | Above threshold |
| 000660 | SK hynix | 2024 | 19796902000000 | 29795885000000 | 1.5051 | No | Above threshold |
| 000660 | SK hynix | 2023 | -9137547000000 | 4278191000000 | -0.4682 | No | Net loss |
| 000660 | SK hynix | 2022 | 2241669000000 | 14780517000000 | 6.5935 | No | Above threshold |
| 000660 | SK hynix | 2021 | 9616188000000 | 19797648000000 | 2.0588 | No | Above threshold |
| 000990 | DB HiTek | 2025 | 256071900592 | 356967025481 | 1.3940 | No | Above threshold |
| 000990 | DB HiTek | 2024 | 229473615387 | 382634373825 | 1.6674 | No | Above threshold |
| 000990 | DB HiTek | 2023 | 264149250979 | 224258155766 | 0.8490 | No | Above threshold |
| 000990 | DB HiTek | 2022 | 556227095934 | 730905287732 | 1.3140 | No | Above threshold |
| 000990 | DB HiTek | 2021 | 313979185521 | 393129114790 | 1.2521 | No | Above threshold |
| 005380 | Hyundai Motor | 2025 | 10364775000000 | -5991270000000 | -0.5780 | No | Negative OCF |
| 005380 | Hyundai Motor | 2024 | 13229908000000 | -5661641000000 | -0.4279 | No | Negative OCF |
| 005380 | Hyundai Motor | 2023 | 12272301000000 | -2518760000000 | -0.2052 | No | Negative OCF |
| 005380 | Hyundai Motor | 2022 | 7983614000000 | 10627311000000 | 1.3311 | No | Above threshold |
| 005380 | Hyundai Motor | 2021 | 5693077000000 | -1176416000000 | -0.2066 | No | Negative OCF |
| 005490 | POSCO Holdings | 2025 | 657654060164 | 4571910292218 | 6.9518 | No | Above threshold |
| 005490 | POSCO Holdings | 2024 | 1094917125078 | 6663654759669 | 6.0860 | No | Above threshold |
| 005490 | POSCO Holdings | 2023 | 1845849532200 | 6167694886590 | 3.3414 | No | Above threshold |
| 005490 | POSCO Holdings | 2022 | 3560483538695 | 6186764805543 | 1.7376 | No | Above threshold |
| 005490 | POSCO Holdings | 2021 | 7195889963608 | 6259365289022 | 0.8699 | No | Above threshold |
| 005930 | Samsung Electronics | 2025 | 45206805000000 | 85315148000000 | 1.8872 | No | Above threshold |
| 005930 | Samsung Electronics | 2024 | 34451351000000 | 72982621000000 | 2.1184 | No | Above threshold |
| 005930 | Samsung Electronics | 2023 | 15487100000000 | 44137427000000 | 2.8499 | No | Above threshold |
| 005930 | Samsung Electronics | 2022 | 55654077000000 | 62181346000000 | 1.1173 | No | Above threshold |
| 005930 | Samsung Electronics | 2021 | 39907450000000 | 65105448000000 | 1.6314 | No | Above threshold |
| 006400 | Samsung SDI | 2025 | -649468657555 | 792385760879 | -1.2201 | No | Net loss |
| 006400 | Samsung SDI | 2024 | 599289842809 | -137613377776 | -0.2296 | No | Negative OCF |
| 006400 | Samsung SDI | 2023 | 2066046562201 | 2103521513959 | 1.0181 | No | Above threshold |
| 006400 | Samsung SDI | 2022 | 2039361447986 | 2641096163726 | 1.2951 | No | Above threshold |
| 006400 | Samsung SDI | 2021 | 1250401560241 | 2176027358565 | 1.7403 | No | Above threshold |
| 012330 | Hyundai Mobis | 2025 | 3664736000000 | 4472515000000 | 1.2204 | No | Above threshold |
| 012330 | Hyundai Mobis | 2024 | 4060161000000 | 4252694000000 | 1.0474 | No | Above threshold |
| 012330 | Hyundai Mobis | 2023 | 3423309000000 | 5342631000000 | 1.5607 | No | Above threshold |
| 012330 | Hyundai Mobis | 2022 | 2487244000000 | 2154062000000 | 0.8660 | No | Above threshold |
| 012330 | Hyundai Mobis | 2021 | 2362474000000 | 2608809000000 | 1.1043 | No | Above threshold |
| 035420 | NAVER | 2025 | 1953214734956 | 3095806604677 | 1.5850 | No | Above threshold |
| 035420 | NAVER | 2024 | 1931976372953 | 2589874337746 | 1.3405 | No | Above threshold |
| 035420 | NAVER | 2023 | 1012321527624 | 2002233273518 | 1.9779 | No | Above threshold |
| 035420 | NAVER | 2022 | 760260876247 | 1453390444990 | 1.9117 | No | Above threshold |
| 035420 | NAVER | 2021 | 16489849771129 | 1379905728836 | 0.0837 | Yes | Current condition met |
| 035720 | Kakao | 2025 | 517959587282 | 1404762595727 | 2.7121 | No | Above threshold |
| 035720 | Kakao | 2024 | -217147983708 | 1250459006332 | -5.7586 | No | Net loss |
| 035720 | Kakao | 2023 | -1816669011014 | 1341098333644 | -0.7382 | No | Net loss |
| 035720 | Kakao | 2022 | 1358019478520 | 678376491408 | 0.4995 | Yes | Current condition met |
| 035720 | Kakao | 2021 | 1640484195406 | 1306571526446 | 0.7965 | No | Above threshold |
| 066570 | LG Electronics | 2025 | 1220412000000 | 4280500000000 | 3.5074 | No | Above threshold |
| 066570 | LG Electronics | 2024 | 591365000000 | 3842661000000 | 6.4980 | No | Above threshold |
| 066570 | LG Electronics | 2023 | 1150611000000 | 5913596000000 | 5.1395 | No | Above threshold |
| 066570 | LG Electronics | 2022 | 1863123000000 | 3107839000000 | 1.6681 | No | Above threshold |
| 066570 | LG Electronics | 2021 | 1414972000000 | 2677382000000 | 1.8922 | No | Above threshold |
| 068270 | Celltrion | 2025 | 1031483789240 | 646050776661 | 0.6263 | No | Above threshold |
| 068270 | Celltrion | 2024 | 422691724154 | 901870301325 | 2.1336 | No | Above threshold |
| 068270 | Celltrion | 2023 | 539706505110 | 537158606192 | 0.9953 | No | Above threshold |
| 068270 | Celltrion | 2022 | 542566233270 | 863531984 | 0.0016 | Yes | Current condition met |
| 068270 | Celltrion | 2021 | 595779438812 | 911159432327 | 1.5294 | No | Above threshold |
| 207940 | Samsung Biologics | 2025 | 1784352060593 | 2247807426551 | 1.2597 | No | Above threshold |
| 207940 | Samsung Biologics | 2024 | 1083315885986 | 1659255402663 | 1.5316 | No | Above threshold |
| 207940 | Samsung Biologics | 2023 | 857691298384 | 1666228521442 | 1.9427 | No | Above threshold |
| 207940 | Samsung Biologics | 2022 | 798056210082 | 953047810086 | 1.1942 | No | Above threshold |
| 207940 | Samsung Biologics | 2021 | 393589467655 | 454596217269 | 1.1550 | No | Above threshold |
| 373220 | LG Energy Solution | 2025 | 1153613000000 | 4432277000000 | 3.8421 | No | Above threshold |
| 373220 | LG Energy Solution | 2024 | 1357343000000 | 5111700000000 | 3.7660 | No | Above threshold |
| 373220 | LG Energy Solution | 2023 | 1637985000000 | 4444179000000 | 2.7132 | No | Above threshold |
| 373220 | LG Energy Solution | 2022 | 779826000000 | -579807000000 | -0.7435 | No | Negative OCF |
| 373220 | LG Energy Solution | 2021 | 929868000000 | 978585000000 | 1.0524 | No | Above threshold |

## Financial-sector Rows

| Stock code | Company | Year | Net income (KRW) | OCF | Result |
|---|---|---:|---:|---:|---|
| 105560 | KB Financial Group | 2025 | 5840715000000 | null | Excluded as financial |
| 105560 | KB Financial Group | 2024 | 5078221000000 | null | Excluded as financial |
| 105560 | KB Financial Group | 2023 | 4631932000000 | null | Excluded as financial |
| 105560 | KB Financial Group | 2022 | 4152992000000 | null | Excluded as financial |
| 105560 | KB Financial Group | 2021 | 4409543000000 | null | Excluded as financial |
