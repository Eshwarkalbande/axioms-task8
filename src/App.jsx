import React, { useEffect, useRef, useState } from "react";

const POSITIONS = [
  { id: "manager", label: "Manager", rate: 1500, hours: 8, color: "#8b5cf6" },
  { id: "jr", label: "Jr. Manager", rate: 1000, hours: 8, color: "#3b82f6" },
  { id: "clerk", label: "Clerk", rate: 800, color: "#14b8a6" },
  { id: "sales", label: "Sales Executive", rate: 500, color: "#f97316" },
];

const EMPTY = {
  name: "", empId: "", email: "", phone: "", address: "",
  position: "", doj: "", dop: "", leaves: "0",
};
const REQUIRED = ["name", "email", "phone", "address", "position", "doj", "dop"];
const STORE = "salary-records";
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 37) % 100,
  c: ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6"][i % 6],
  d: ((i % 7) * 0.07).toFixed(2),
  r: (i * 47) % 360,
  dx: ((i * 29) % 80) - 40,
}));
const colorOf = (label) => POSITIONS.find((p) => p.label === label)?.color || "#3b82f6";

const inr = (n) => "₹" + n.toLocaleString("en-IN");
const dayNum = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000; // UTC avoids daylight-saving off-by-one
};
const dmy = (s) => (s ? s.split("-").reverse().join("-") : "—");
const todayISO = () => new Date().toLocaleDateString("en-CA");

/* number -> words (Indian system) */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const three = (n) =>
  (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + two(n % 100);
function words(n) {
  if (n === 0) return "Zero";
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(words(cr) + " Crore");
  if (lk) parts.push(two(lk) + " Lakh");
  if (th) parts.push(two(th) + " Thousand");
  if (n) parts.push(three(n));
  return parts.join(" ");
}

function useCountUp(target) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      from.current = target;
      return;
    }
    const a = from.current;
    const start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / 600);
      const val = Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)));
      setV(val);
      from.current = val;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function Field({ label, error, wide, hint, children }) {
  return (
    <label className={`sc-field ${wide ? "wide" : ""} ${error ? "bad" : ""}`}>
      <span className="sc-label">
        {label}
        {hint}
      </span>
      {children}
      {error && <small className="sc-err">{error}</small>}
    </label>
  );
}

export default function SalaryCalculator() {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [inclusive, setInclusive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const [records, setRecords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(records));
    } catch {}
  }, [records]);

  // no white gaps: paint the whole browser page black while this screen is open
  useEffect(() => {
    const b = document.body, h = document.documentElement;
    const prev = [b.style.background, b.style.margin, h.style.background];
    b.style.background = "#000";
    b.style.margin = "0";
    h.style.background = "#000";
    return () => {
      [b.style.background, b.style.margin, h.style.background] = prev;
    };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const pos = POSITIONS.find((p) => p.id === form.position);

  // total days = payment date - joining date
  const datesOk = form.doj && form.dop && dayNum(form.dop) >= dayNum(form.doj);
  const totalDays = datesOk ? dayNum(form.dop) - dayNum(form.doj) + (inclusive ? 1 : 0) : null;
  const leaves = Number(form.leaves);

  const errors = {};
  if (!form.name.trim()) errors.name = "Enter the employee name";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Enter a valid email";
  if (form.phone.replace(/\D/g, "").length !== 10) errors.phone = "Enter a 10-digit phone number";
  if (!form.address.trim()) errors.address = "Enter the address";
  if (!form.position) errors.position = "Select a position";
  if (!form.doj) errors.doj = "Select the joining date";
  if (!form.dop) errors.dop = "Select the payment date";
  else if (form.doj && !datesOk) errors.dop = "Payment date can't be before joining date";
  if (form.leaves === "" || !Number.isInteger(leaves) || leaves < 0) errors.leaves = "Enter 0 or more whole days";
  else if (totalDays !== null && leaves > totalDays) errors.leaves = "Leaves can't exceed total days";

  const ready = pos && totalDays !== null && !errors.leaves;
  const daysWorked = ready ? totalDays - leaves : 0;
  const salary = ready ? daysWorked * pos.rate : 0;
  const shown = useCountUp(salary);
  const workedPct = ready && totalDays > 0 ? (daysWorked / totalDays) * 100 : 0;

  const filled = REQUIRED.filter((k) => !errors[k]).length;
  const formPct = Math.round((filled / REQUIRED.length) * 100);

  const err = (k) => (touched[k] || submitted) && errors[k];
  const allValid = () => {
    setSubmitted(true);
    return Object.keys(errors).length === 0;
  };

  const stepLeaves = (d) => {
    const max = totalDays ?? Infinity;
    const n = Math.min(max, Math.max(0, (Number.isInteger(leaves) ? leaves : 0) + d));
    setForm((f) => ({ ...f, leaves: String(n) }));
  };

  const printSlip = () => allValid() && window.print();

  const saveRecord = () => {
    if (!allValid()) return;
    setRecords((r) => [
      {
        id: Date.now(), name: form.name.trim(), empId: form.empId, email: form.email, phone: form.phone,
        position: pos.label, rate: pos.rate, doj: form.doj, dop: form.dop,
        totalDays, leaves, daysWorked, salary,
      },
      ...r,
    ]);
    setBurst((b) => b + 1);
  };

  const copySummary = async () => {
    if (!ready) return;
    const text =
      `Salary slip: ${form.name.trim() || "Employee"} (${pos.label})\n` +
      `Joined: ${dmy(form.doj)} | Paid on: ${dmy(form.dop)}\n` +
      `Total days ${totalDays} - leaves ${leaves} = ${daysWorked} days worked\n` +
      `${daysWorked} x ${inr(pos.rate)} = ${inr(salary)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const downloadCsv = () => {
    const head = ["Name", "Employee ID", "Email", "Phone", "Position", "Joining", "Payment", "Total days", "Leaves", "Days worked", "Rate/day", "Salary"];
    const rows = records.map((r) => [r.name, r.empId, r.email, r.phone, r.position, dmy(r.doj), dmy(r.dop), r.totalDays, r.leaves, r.daysWorked, r.rate, r.salary]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "salary-records.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setForm(EMPTY);
    setTouched({});
    setSubmitted(false);
  };

  const initials =
    form.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const totalPayout = records.reduce((s, r) => s + r.salary, 0);
  const accent = pos ? pos.color : "#3b82f6";

  return (
    <>
      <style>{css}</style>
      <div className="sc" style={{ "--ac": accent }}>
        <div className="sc-bg" aria-hidden="true"><i /><i /><i /></div>
        <header className="sc-head sc-noprint">
          <div>
            <h1>Daily Wage Employee Salary Calculator</h1>
            <p>Salary = (days between joining and payment − leaves) × daily wage of the position</p>
          </div>
          <div className="sc-prog" aria-label={`Form ${formPct}% complete`}>
            <span>Form {formPct}% complete</span>
            <div className="sc-progbar"><i style={{ width: `${formPct}%` }} /></div>
          </div>
        </header>

        <div className="sc-grid">
          <div className="sc-form sc-noprint">
            <section className="sc-card">
              <h2><em>1</em> Employee details</h2>
              <div className="sc-fields">
                <Field label="Full name" error={err("name")}>
                  <input value={form.name} onChange={set("name")} onBlur={blur("name")} placeholder="e.g. Ravi Sharma" />
                </Field>
                <Field label="Employee ID (optional)">
                  <input value={form.empId} onChange={set("empId")} placeholder="e.g. EMP-014" />
                </Field>
                <Field label="Email" error={err("email")}>
                  <input type="email" value={form.email} onChange={set("email")} onBlur={blur("email")} placeholder="name@company.com" />
                </Field>
                <Field label="Phone" error={err("phone")}>
                  <input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} placeholder="10-digit mobile number" />
                </Field>
                <Field label="Address" error={err("address")} wide>
                  <textarea rows="2" value={form.address} onChange={set("address")} onBlur={blur("address")} placeholder="House no, street, city, state, PIN" />
                </Field>
              </div>
            </section>

            <section className="sc-card">
              <h2><em>2</em> Job &amp; payment details</h2>
              <div className="sc-fields">
                <Field label="Position" error={err("position")} wide>
                  <select value={form.position} onChange={set("position")} onBlur={blur("position")}>
                    <option value="">Select position</option>
                    {POSITIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {inr(p.rate)}/day{p.hours ? ` — ${p.hours} hrs` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {pos && (
                  <div className="sc-chips wide">
                    <span>{inr(pos.rate)} / day</span>
                    {pos.hours && <span>{pos.hours} hrs / day</span>}
                  </div>
                )}
                <Field label="Date of joining (DOJ)" error={err("doj")}>
                  <input type="date" value={form.doj} onChange={set("doj")} onBlur={blur("doj")} />
                </Field>
                <Field
                  label="Date of payment (DOP)"
                  error={err("dop")}
                  hint={
                    <button type="button" className="sc-link" onClick={() => setForm((f) => ({ ...f, dop: todayISO() }))}>
                      Today
                    </button>
                  }
                >
                  <input type="date" value={form.dop} min={form.doj || undefined} onChange={set("dop")} onBlur={blur("dop")} />
                </Field>
                <Field label="Total leaves taken (days)" error={err("leaves")}>
                  <div className="sc-step">
                    <button type="button" onClick={() => stepLeaves(-1)} aria-label="Decrease leaves">−</button>
                    <input type="number" min="0" step="1" value={form.leaves} onChange={set("leaves")} onBlur={blur("leaves")} />
                    <button type="button" onClick={() => stepLeaves(1)} aria-label="Increase leaves">+</button>
                  </div>
                </Field>
                <label className="sc-check">
                  <input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} />
                  <span>Count the joining day as well</span>
                </label>
              </div>
            </section>
          </div>

          {/* salary slip */}
          <aside className="sc-card sc-slip">
            <div className="sc-sliphead">
              <h2>Salary slip</h2>
              <small>Generated {dmy(todayISO())}</small>
            </div>
            {ready ? (
              <>
                <div className="sc-who">
                  <div className="sc-avatar">{initials}</div>
                  <div>
                    <b>{form.name.trim() || "Employee name"}</b>
                    <span>{pos.label}{form.empId ? ` · ${form.empId}` : ""}</span>
                  </div>
                </div>

                <div className="sc-split" aria-hidden="true">
                  <div className="sc-splitbar">
                    <i className="w" style={{ width: `${workedPct}%` }} />
                    <i className="l" style={{ width: `${100 - workedPct}%` }} />
                  </div>
                  <div className="sc-legend">
                    <span><b className="dot w" /> Worked {daysWorked}</span>
                    <span><b className="dot l" /> Leaves {leaves}</span>
                  </div>
                </div>

                <dl className="sc-rows">
                  <div><dt>Date of joining</dt><dd>{dmy(form.doj)}</dd></div>
                  <div><dt>Date of payment</dt><dd>{dmy(form.dop)}</dd></div>
                  <div><dt>Total days</dt><dd>{totalDays}</dd></div>
                  <div><dt>Leaves taken</dt><dd>− {leaves}</dd></div>
                  <div className="strong"><dt>Total days worked</dt><dd>{daysWorked}</dd></div>
                  <div><dt>Wage per day{pos.hours ? ` (${pos.hours} hrs)` : ""}</dt><dd>{inr(pos.rate)}</dd></div>
                </dl>

                <div className="sc-total">
                  <span>Total salary</span>
                  <strong>{inr(shown)}</strong>
                  <small>{daysWorked} × {inr(pos.rate)} ({pos.label})</small>
                  <em>{words(salary)} Rupees Only</em>
                </div>
              </>
            ) : (
              <p className="sc-empty">
                Select a position, joining date and payment date to see the salary here.
              </p>
            )}
            <div className="sc-actions sc-noprint">
              <button className="sc-btn primary" onClick={printSlip}>Print slip</button>
              <button className="sc-btn" onClick={saveRecord} disabled={!ready}>Save record</button>
            </div>
            <div className="sc-actions sc-noprint">
              <button className="sc-btn" onClick={copySummary} disabled={!ready}>{copied ? "Copied ✓" : "Copy summary"}</button>
              <button className="sc-btn" onClick={reset}>Reset</button>
            </div>
          </aside>
        </div>

        {/* saved records */}
        {records.length > 0 && (
          <section className="sc-card sc-records sc-noprint">
            <div className="sc-reche">
              <h2>Saved records ({records.length})</h2>
              <div className="sc-recact">
                <button className="sc-btn" onClick={downloadCsv}>Download CSV</button>
                <button className="sc-btn" onClick={() => setRecords([])}>Clear all</button>
              </div>
            </div>
            <div className="sc-tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Position</th><th>Period</th><th>Worked</th><th>Salary</th><th />
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.name}</b>{r.empId && <small>{r.empId}</small>}</td>
                      <td><span className="sc-pill" style={{ "--pc": colorOf(r.position) }}>{r.position}</span></td>
                      <td>{dmy(r.doj)} → {dmy(r.dop)}</td>
                      <td>{r.daysWorked} / {r.totalDays}</td>
                      <td><b>{inr(r.salary)}</b></td>
                      <td>
                        <button className="sc-x" aria-label={`Delete ${r.name}`} onClick={() => setRecords((all) => all.filter((x) => x.id !== r.id))}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan="4">Total payout</td><td colSpan="2"><b>{inr(totalPayout)}</b></td></tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {burst > 0 && (
          <div className="sc-confetti" key={burst} aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <i key={i} style={{ "--x": `${c.x}%`, "--c": c.c, "--d": `${c.d}s`, "--r": `${c.r}deg`, "--dx": `${c.dx}px` }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const css = `
.sc{
  --ac:#3b82f6; position:relative; overflow-x:clip;
  min-height:100vh; box-sizing:border-box; padding:32px 20px 48px; color:#fff;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:#000; color-scheme:dark;
}
.sc *{color:#fff; box-sizing:border-box}

/* ---------- colour effects on black ---------- */
.sc-bg{position:absolute; inset:0; pointer-events:none; z-index:0}
.sc-bg i{position:absolute; width:460px; height:460px; border-radius:50%; filter:blur(90px); opacity:.38; animation:scFloat 14s ease-in-out infinite alternate}
.sc-bg i:nth-child(1){left:-140px; top:-100px; background:#ec4899}
.sc-bg i:nth-child(2){right:-160px; top:28%; background:#3b82f6; animation-delay:-5s}
.sc-bg i:nth-child(3){left:30%; bottom:-180px; background:#f59e0b; animation-delay:-9s}
@keyframes scFloat{to{transform:translate(60px,40px) scale(1.15)}}
.sc-head,.sc-grid,.sc-records{position:relative; z-index:1}

.sc-head{max-width:1040px; margin:0 auto 22px; display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap}
.sc-head h1{margin:0 0 6px; font-size:1.9rem; font-weight:800; letter-spacing:-.01em}
.sc-head h1::after{
  content:""; display:block; width:120px; height:5px; border-radius:99px; margin-top:8px;
  background:linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6,#fbbf24,#60a5fa); background-size:200% 100%; animation:scShine 4s linear infinite;
  box-shadow:0 0 14px rgba(167,139,250,.7);
}
@keyframes scShine{to{background-position:200% 0}}
.sc-head p{margin:0; font-weight:500; opacity:.7}
.sc-prog{min-width:200px; display:flex; flex-direction:column; gap:6px; font-weight:700; font-size:.85rem}
.sc-progbar{height:8px; border-radius:99px; background:rgba(255,255,255,.15); overflow:hidden}
.sc-progbar i{display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6,#fbbf24); background-size:200% 100%; animation:scShine 4s linear infinite; transition:width .4s; box-shadow:0 0 10px rgba(167,139,250,.8)}

.sc-grid{max-width:1040px; margin:0 auto; display:grid; grid-template-columns:1.4fr 1fr; gap:20px; align-items:start}
.sc-form{display:flex; flex-direction:column; gap:20px}
.sc-card{
  position:relative; overflow:hidden; padding:22px; border-radius:24px;
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));
  backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,.14);
  box-shadow:0 20px 50px -20px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.1);
}
.sc-card::before{
  content:""; position:absolute; left:0; right:0; top:0; height:5px;
  background:linear-gradient(90deg,var(--ac),#f472b6,#fbbf24,var(--ac)); background-size:200% 100%; animation:scShine 5s linear infinite;
}
.sc-card h2{margin:0 0 16px; font-size:1.1rem; font-weight:800; display:flex; align-items:center; gap:10px}
.sc .sc-card h2 em{
  font-style:normal; display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%;
  background:var(--ac); color:#000; font-size:.85rem; font-weight:800; box-shadow:0 0 14px var(--ac); transition:background .4s;
}

/* fields */
.sc-fields{display:grid; grid-template-columns:1fr 1fr; gap:14px}
.sc-field{display:flex; flex-direction:column; gap:6px}
.wide,.sc-check{grid-column:1 / -1}
.sc-label{font-size:.82rem; font-weight:700; display:flex; justify-content:space-between; align-items:center; opacity:.9}
.sc-link{border:0; background:rgba(255,255,255,.14); border-radius:99px; padding:2px 10px; font:inherit; font-size:.75rem; font-weight:800; cursor:pointer}
.sc-link:hover{background:rgba(255,255,255,.26)}
.sc-field input,.sc-field select,.sc-field textarea{
  width:100%; padding:11px 13px; border-radius:12px; font:inherit; color:#fff;
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.22); transition:border-color .15s, box-shadow .15s;
}
.sc-field input::placeholder,.sc-field textarea::placeholder{color:rgba(255,255,255,.4)}
.sc-field select option{background:#111; color:#fff}
.sc-field textarea{resize:vertical}
.sc-field input:focus,.sc-field select:focus,.sc-field textarea:focus{
  outline:none; border-color:var(--ac); box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 35%,transparent), 0 0 18px color-mix(in srgb,var(--ac) 40%,transparent);
}
.sc-field.bad input,.sc-field.bad select,.sc-field.bad textarea{border-color:#f87171; background:rgba(248,113,113,.12)}
.sc .sc-err{font-weight:600; color:#fca5a5}
.sc-chips{display:flex; gap:8px; margin-top:-6px}
.sc-chips span{padding:4px 12px; border-radius:99px; font-weight:700; font-size:.82rem;
  background:color-mix(in srgb,var(--ac) 25%,transparent); border:1px solid color-mix(in srgb,var(--ac) 65%,transparent)}
.sc-step{display:flex; gap:8px}
.sc-step input{text-align:center; font-weight:700}
.sc-step button{
  flex:none; width:42px; border-radius:12px; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08);
  font-size:1.2rem; font-weight:800; cursor:pointer; box-shadow:0 3px 0 rgba(0,0,0,.7); transition:transform .08s, box-shadow .08s;
}
.sc-step button:active{transform:translateY(2px); box-shadow:0 1px 0 rgba(0,0,0,.7)}
.sc-check{display:flex; align-items:center; gap:10px; font-weight:600; cursor:pointer}
.sc-check input{width:18px; height:18px; accent-color:var(--ac)}

/* slip */
.sc-slip{position:sticky; top:20px; box-shadow:0 0 50px -12px color-mix(in srgb,var(--ac) 65%,transparent), 0 24px 50px -20px rgba(0,0,0,.95); transition:box-shadow .4s}
.sc-sliphead{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px}
.sc-sliphead h2{margin:0}
.sc-sliphead small{font-weight:600; opacity:.6}
.sc-who{display:flex; align-items:center; gap:12px; padding-bottom:14px; margin-bottom:12px; border-bottom:1px dashed rgba(255,255,255,.3)}
.sc-who b{display:block; font-size:1.1rem}
.sc-who span{font-weight:600; opacity:.7; font-size:.9rem}
.sc .sc-avatar{
  width:48px; height:48px; border-radius:50%; display:grid; place-items:center; font-weight:900; font-size:1.05rem; color:#000;
  background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 70%,#fff),#f9a8d4); box-shadow:0 0 18px color-mix(in srgb,var(--ac) 70%,transparent);
}
.sc-split{margin-bottom:8px}
.sc-splitbar{display:flex; height:12px; border-radius:99px; overflow:hidden; background:rgba(255,255,255,.12)}
.sc-splitbar i{display:block; height:100%; transition:width .5s}
.sc-splitbar .w,.dot.w{background:#4ade80}
.sc-splitbar .l,.dot.l{background:#fbbf24}
.sc-splitbar .w{box-shadow:0 0 12px #4ade80}
.sc-legend{display:flex; justify-content:space-between; margin-top:6px; font-size:.8rem; font-weight:700}
.dot{display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px}
.sc-rows{margin:0}
.sc-rows div{display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.1)}
.sc-rows dt{font-weight:600; opacity:.7}
.sc-rows dd{margin:0; font-weight:700; font-variant-numeric:tabular-nums}
.sc-rows .strong dt,.sc-rows .strong dd{opacity:1; font-weight:800}
.sc-total{
  position:relative; overflow:hidden; margin-top:16px; padding:18px; border-radius:18px; text-align:center;
  display:flex; flex-direction:column; gap:2px;
  background:linear-gradient(160deg,#a7f3c3,#4ade80); box-shadow:0 0 34px -4px rgba(74,222,128,.7);
}
.sc .sc-total *{color:#000}
.sc-total span{font-weight:700; font-size:.9rem}
.sc-total strong{font-size:2.4rem; font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:-.02em}
.sc-total small{font-weight:600; opacity:.75}
.sc-total em{font-style:normal; font-weight:700; font-size:.78rem; margin-top:6px; opacity:.8}
.sc-total::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.6) 50%,transparent 70%);
  transform:translateX(-100%); animation:scSweep 3.4s ease-in-out infinite;
}
@keyframes scSweep{60%,100%{transform:translateX(100%)}}
.sc-empty{margin:0 0 6px; font-weight:600; opacity:.65; line-height:1.5}

/* buttons */
.sc-actions{display:flex; gap:10px; margin-top:12px}
.sc-actions:first-of-type{margin-top:18px}
.sc-btn{
  flex:1; padding:11px 14px; border-radius:14px; font:inherit; font-weight:800; cursor:pointer;
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.25);
  box-shadow:0 4px 0 rgba(0,0,0,.7); transition:transform .08s, box-shadow .08s, background .15s;
}
.sc-btn:hover:not(:disabled){background:rgba(255,255,255,.16)}
.sc .sc-btn.primary{
  color:#000; border-color:transparent;
  background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 55%,#fff),var(--ac));
  box-shadow:0 4px 0 color-mix(in srgb,var(--ac) 60%,#000), 0 0 22px color-mix(in srgb,var(--ac) 55%,transparent);
}
.sc-btn:active:not(:disabled){transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.7)}
.sc-btn:disabled{opacity:.4; cursor:not-allowed}
.sc button:focus-visible{outline:2px solid #fff; outline-offset:2px}

/* records */
.sc-records{max-width:1040px; margin:20px auto 0}
.sc-reche{display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px}
.sc-reche h2{margin:0}
.sc-recact{display:flex; gap:10px}
.sc-recact .sc-btn{flex:none}
.sc-tablewrap{overflow-x:auto}
.sc table{width:100%; border-collapse:collapse; min-width:560px}
.sc th{text-align:left; font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; padding:8px 10px; opacity:.6}
.sc td{padding:11px 10px; border-top:1px solid rgba(255,255,255,.12); font-weight:600; font-variant-numeric:tabular-nums}
.sc td small{display:block; opacity:.6; font-weight:600}
.sc tfoot td{font-weight:800; border-top:2px solid rgba(255,255,255,.3)}
.sc-x{border:0; background:transparent; font-size:1.3rem; cursor:pointer; opacity:.5}
.sc-x:hover{opacity:1}
.sc-pill{
  display:inline-block; padding:3px 11px; border-radius:99px; font-size:.82rem; font-weight:800;
  background:color-mix(in srgb,var(--pc) 28%,transparent); border:1px solid color-mix(in srgb,var(--pc) 70%,transparent);
  box-shadow:0 0 12px color-mix(in srgb,var(--pc) 35%,transparent);
}

/* confetti */
.sc-confetti{position:fixed; inset:0; pointer-events:none; z-index:50; overflow:hidden}
.sc-confetti i{
  position:absolute; top:-14px; left:var(--x); width:9px; height:14px; border-radius:2px; background:var(--c);
  transform:rotate(var(--r)); opacity:0; animation:scFall 1.7s ease-in var(--d) forwards;
}
@keyframes scFall{
  0%{opacity:1; transform:translate(0,0) rotate(var(--r))}
  100%{opacity:0; transform:translate(var(--dx),105vh) rotate(calc(var(--r) + 540deg))}
}

@media (max-width:820px){
  .sc-grid{grid-template-columns:1fr}
  .sc-slip{position:static}
}
@media (max-width:480px){.sc-fields{grid-template-columns:1fr}.sc-recact{width:100%}.sc-recact .sc-btn{flex:1}}
@media (prefers-reduced-motion:reduce){.sc *,.sc *::before,.sc *::after{animation:none!important; transition:none!important}}
@media print{
  .sc{background:#fff; padding:0; color-scheme:light}
  .sc *{color:#000!important}
  .sc-noprint,.sc-bg,.sc-confetti,.sc-card::before,.sc-total::after{display:none!important}
  .sc-grid{display:block}
  .sc-card{box-shadow:none; border:1px solid #000; background:#fff; backdrop-filter:none}
  .sc-total{box-shadow:none; background:#e6ffee}
  .sc-rows div,.sc-who{border-color:#999}
}
`;
