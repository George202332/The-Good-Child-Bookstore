import { PlanButton } from "./PlanButton";

/** Converted from subscriptionHTML() (the-good-child-bookstore_54_1.html:5145-5182).
 * This was never converted in the initial build — 404 in production until now. */

const PLANS = [
  { name: "The First Chapters", age: "Ages 0–4", price: 14, per: "book box / month", feats: ["1 hand-picked board or picture book", "Free shipping, always", "Cancel or pause anytime", "Parent read-aloud notes included"], featured: false },
  { name: "The Good Shelf", age: "Ages 3–8", price: 22, per: "book box / month", feats: ["2 picture books or early readers", "Free shipping, always", "A bookmark + activity sheet", "Swap any title before it ships"], featured: true },
  { name: "The Long Reader", age: "Ages 9–12", price: 26, per: "book box / month", feats: ["1 middle-grade novel + surprise extra", "Free shipping, always", "Discussion questions for car rides", "Skip a month whenever you like"], featured: false },
];

export default function SubscriptionPage() {
  return (
    <div className="wrap" style={{ padding: "48px 0 48px" }}>
      <div className="plan-grid">
        {PLANS.map((p) => (
          <div className={`plan-card ${p.featured ? "featured" : ""}`} key={p.name}>
            {p.featured && <span className="plan-badge">Most loved</span>}
            <h3>{p.name}</h3>
            <div className="plan-age">{p.age}</div>
            <div className="plan-price">${p.price}<span> / {p.per}</span></div>
            <ul>{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
            <PlanButton featured={p.featured} />
          </div>
        ))}
      </div>

      <div className="section-head" style={{ justifyContent: "center", textAlign: "center", marginBottom: 40 }}>
        <div style={{ margin: "0 auto" }}>
          <h2>How the box works</h2>
          <p>Three steps, zero guesswork.</p>
        </div>
      </div>
      <div className="steps-row">
        <div className="step-card"><div className="step-num">1</div><h4>Tell us their age and taste</h4><p>A short quiz on reading level, favorite animals, and how brave a story they like.</p></div>
        <div className="step-card"><div className="step-num">2</div><h4>We pick, wrap, and ship</h4><p>Our shelf team curates each box by hand: never an algorithm, never a duplicate.</p></div>
        <div className="step-card"><div className="step-num">3</div><h4>Adjust anytime</h4><p>Swap a title before it ships, skip a month, or cancel; no phone calls required.</p></div>
      </div>

      <div className="section-head" style={{ justifyContent: "center", textAlign: "center", marginBottom: 26 }}>
        <div style={{ margin: "0 auto" }}><h2>Subscription FAQ</h2></div>
      </div>
      <div className="faq-list">
        <details className="faq-item"><summary>Can I change the age range later?</summary><p>Yes; update it anytime from your account and your next box will reflect the change.</p></details>
        <details className="faq-item"><summary>What if we already own a pick?</summary><p>Swap it for anything on the bookshelf before your box ships, at no extra cost.</p></details>
        <details className="faq-item"><summary>Is shipping really free?</summary><p>Always, on every plan, every month, no minimum.</p></details>
        <details className="faq-item"><summary>Can I gift a subscription?</summary><p>Yes; choose a gift length at checkout and we&apos;ll send a printable card for under the tree or the birthday table.</p></details>
      </div>
    </div>
  );
}
