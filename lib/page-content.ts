export interface HomeContent {
  eyebrow: string;
  heading: string;
  lede: string;
  /** One background image per hero carousel slide — recommended
   * 1200x600px (2:1 landscape) each. */
  heroWelcomeImage?: string;
  heroBrowseImage?: string;
  heroAuthorImage?: string;
  heroAffiliateImage?: string;
  bookClubBannerTitle: string;
  bookClubBannerBody: string;
  /** Recommended 1200x600px. */
  bookClubBannerImage?: string;
  printBannerTitle: string;
  printBannerBody: string;
  /** Recommended 1200x600px. */
  printBannerImage?: string;
  affiliateBannerTitle: string;
  affiliateBannerBody: string;
  /** Recommended 1200x600px. */
  affiliateBannerImage?: string;
  journalBannerTitle: string;
  journalBannerBody: string;
  /** Recommended 1200x600px. */
  journalBannerImage?: string;
}

/** A simple, editable intro block used by the lighter pages — Shop,
 * Blog, Contact — plus one free-form content pane (bodyHtml) where all
 * of that page's actual content is written or pasted in, as a single
 * block, instead of separate structured picture/text fields. */
export interface SimplePageContent {
  eyebrow: string;
  heading: string;
  introText: string;
  /** The one editing pane for this page — written or pasted in as a
   * single block of HTML. This is the actual page content; eyebrow/
   * heading/introText above remain as the simple page title area. */
  bodyHtml: string;
}

/** One block of a long-form marketing page (Authorship, Affiliate) — a
 * title, one or more paragraphs, and an optional image. Kept for
 * backward compatibility with previously-stored data; no longer
 * rendered — superseded by bodyHtml below. */
export interface MarketingPageSection {
  id: string;
  title: string;
  paragraphs: string[];
  /** Recommended 1000x700px. Leave empty to show a placeholder. */
  imageUrl?: string;
}

export interface MarketingPageContent {
  eyebrow: string;
  heading: string;
  introText: string;
  /** Recommended 1200x600px — same size as the homepage hero banners.
   * The banner itself (this image + heading + introText above) stays
   * exactly as it currently renders at the top of the page — this is
   * the one thing that stays a separate, structured upload rather than
   * being folded into the free-text pane below. */
  heroImage?: string;
  /** Kept for backward compatibility with previously-stored data; no
   * longer rendered — superseded by bodyHtml below. */
  sections: MarketingPageSection[];
  /** The one editing pane for everything below the banner — written or
   * pasted in as a single block of HTML, replacing the previous
   * separate feature-section fields. */
  bodyHtml: string;
}

/** One section of a legal/info page — a heading (or FAQ question) and
 * its body (or answer). Kept for backward compatibility with
 * previously-stored data; no longer rendered — superseded by
 * bodyHtml below. */
export interface LegalPageSection {
  id: string;
  heading: string;
  body: string;
}

export interface LegalPageContent {
  title: string;
  intro: string;
  /** Kept for backward compatibility with previously-stored data; no
   * longer rendered — superseded by bodyHtml below. */
  sections: LegalPageSection[];
  /** The one editing pane for this page. */
  bodyHtml: string;
}

export interface PagesContent {
  home: HomeContent;
  shop: SimplePageContent;
  authorship: MarketingPageContent;
  affiliateMarketing: MarketingPageContent;
  blog: SimplePageContent;
  contact: SimplePageContent;
  privacy: LegalPageContent;
  terms: LegalPageContent;
  returns: LegalPageContent;
  faq: LegalPageContent;
}

export const DEFAULT_PAGES_CONTENT: PagesContent = {
  home: {
    eyebrow: "✦ Trusted by families, teachers, and libraries",
    heading: "Where young minds fall in love with reading.",
    lede: "A curated children's bookshop built for early literacy and lifelong curiosity: picture books, bedtime stories, and middle-grade adventures selected with parents, teachers, and librarians in mind.",
    bookClubBannerTitle: "Join the Good Child Book Club",
    bookClubBannerBody: "One hand-picked title delivered every month, chosen for the age and mood you tell us about.",
    printBannerTitle: "Now available in print",
    printBannerBody: "Love a book on screen? Most titles on our shelf also ship as real, hold-in-your-hands paperbacks and hardcovers.",
    affiliateBannerTitle: "Earn by sharing books you love",
    affiliateBannerBody: "Join our affiliate program and earn a commission every time someone buys through your link.",
    journalBannerTitle: "From the Journal",
    journalBannerBody: "Reading tips, behind-the-scenes picks, and the occasional bedtime-routine rescue.",
  },
  shop: {
    eyebrow: "✦ The full bookshelf",
    heading: "Every book on the shelf, in one place.",
    introText: "Filter by category, genre, age, price, and format to find the right book for the right reader.",
    bodyHtml: "<p>Filter by category, genre, age, price, and format to find the right book for the right reader.</p>",
  },
  authorship: {
    eyebrow: "✦ Authorship",
    heading: "Publish your story, keep the rights.",
    introText: "Join the children's authors already publishing eBooks, print, and audiobooks through The Good Child Bookstore, with real time sales tracking, transparent royalties, and a modern dashboard built for writers, not spreadsheets.",
    sections: [
      {
        id: "every-format",
        title: "Publish in every format",
        paragraphs: [
          "Every title you submit can be published as an eBook, a paperback, a hardcover, and an audiobook, all from the same manuscript and the same dashboard. You are not juggling four different tools, four different accounts, or four different review processes to reach readers who prefer different formats.",
          "Choose which formats to enable per title, set your own print trim size and cover finish, and adjust pricing independently for each format at any time, without resubmitting anything.",
          "This matters more than it might first seem. A reader who wants an audiobook for the car, a parent who wants an eBook for a tablet at bedtime, and a teacher who wants a classroom paperback are all looking at the same title page, and none of them has to settle for the \"wrong\" format simply because it happened to be the only one you got around to publishing first.",
        ],
        imageUrl: undefined,
      },
      {
        id: "realtime-sales",
        title: "Real time sales tracking",
        paragraphs: [
          "The moment a reader buys your book, it shows up in your dashboard. There is no overnight batch job and no waiting for a report to refresh: sales, downloads, and format breakdowns update as they happen.",
          "You can check in from your phone between errands and actually see whether today's promotion is working, instead of finding out three weeks from now when a statement finally arrives.",
        ],
        imageUrl: undefined,
      },
      {
        id: "revenue-transparency",
        title: "Complete revenue transparency and a live performance dashboard",
        paragraphs: [
          "Every royalty calculation is shown in full: the price paid, the platform's share, and your share, for every single sale. Nothing is bundled into a vague \"net revenue\" figure you have to take on faith, and if a sale came through an affiliate link, you can see exactly how that commission was split.",
          "Alongside the money, the same dashboard lays out revenue, unit sales, downloads, unique readers, and the countries your readers are in, with trend lines showing whether a title is picking up or slowing down.",
        ],
        imageUrl: undefined,
      },
      {
        id: "monthly-reports",
        title: "Monthly downloadable reports and secure payments",
        paragraphs: [
          "Alongside the live dashboard, a clean report is generated automatically at the end of every month, covering everything that sold, where it sold, and exactly what you earned from it, ready to download as a PDF for your own records or to hand to an accountant.",
          "Payouts themselves are processed through the same secure infrastructure that handles customer checkout at the front of the store; every payout is logged in your account history for as long as you need to refer back to it.",
        ],
        imageUrl: undefined,
      },
      {
        id: "keep-ownership",
        title: "You keep ownership of your work",
        paragraphs: [
          "Submitting a title to The Good Child Bookstore does not transfer ownership of it. You retain full rights to your manuscript and illustrations; publishing here grants us a license to sell and distribute the book on your behalf, and nothing more.",
          "You remain free to publish the same title elsewhere, and to remove it from our shelf whenever you choose.",
        ],
        imageUrl: undefined,
      },
      {
        id: "publishing-workflow",
        title: "An easy publishing workflow and a modern author dashboard",
        paragraphs: [
          "Upload a manuscript and a cover, answer a short set of questions about age range and category, and we handle formatting and print setup from there. A built in checklist walks you through print specifications, back cover copy, and ISBN details, so nothing gets missed before a title goes live.",
          "Once it is live, submissions, sales, messages from readers, and your blog posts all sit in the same dashboard, built to be checked in a few spare minutes rather than managed like a second job.",
        ],
        imageUrl: undefined,
      },
      {
        id: "affiliate-integration",
        title: "Affiliate integration, no extra account",
        paragraphs: [
          "Every author account can also earn as an affiliate, sharing books (including books by other authors on the shelf) and earning commission on the sales that follow, without ever creating a second login.",
          "Enable affiliate access from your existing dashboard whenever you are ready to start referring readers; your author tools stay exactly where they are.",
        ],
        imageUrl: undefined,
      },
      {
        id: "print-on-demand",
        title: "Print on demand, worldwide distribution, and your professional profile",
        paragraphs: [
          "Paperback and hardcover copies are produced through our print partner, Lulu, on a print on demand basis. There is no print run to pay for upfront and no boxes of unsold inventory taking up space in your home; a copy is only printed once a customer orders it, and shipped directly to them, wherever they are.",
          "Once a title is live, it is available to readers everywhere we operate, and it sits on a professional profile page, alongside your bio, your photo, and your full catalog, that readers, teachers, and librarians can actually browse and follow.",
        ],
        imageUrl: undefined,
      },
      {
        id: "editorial-review-team",
        title: "A real editorial review, not an algorithm",
        paragraphs: [
          "Every submission is opened and read by an actual editor before it goes live, checking the basics that matter most for a children's title: accurate metadata, age appropriateness, and copyright.",
          "If something needs a change, you get specific, written notes explaining exactly what to fix, then you resubmit; the goal is a stronger finished book on the shelf, not a rejection with no explanation attached to it.",
        ],
        imageUrl: undefined,
      },
      {
        id: "reader-community",
        title: "A shelf built around readers who actually look for children's books",
        paragraphs: [
          "There is no third party advertising anywhere on this site, and no outside advertiser can pay to appear next to your book; what a reader sees is what our editors and our own recommendation logic chose to show them.",
          "For a children's bookstore in particular, that matters to the parents, teachers, and librarians who make up most of our audience, and it means your book is judged on its own merits, not on someone else's ad budget.",
        ],
        imageUrl: undefined,
      },
    ],
    bodyHtml: `<h3>Publish in every format</h3>
<p>Every title you submit can be published as an eBook, a paperback, a hardcover, and an audiobook, all from the same manuscript and the same dashboard. You are not juggling four different tools, four different accounts, or four different review processes to reach readers who prefer different formats.</p>
<p>Choose which formats to enable per title, set your own print trim size and cover finish, and adjust pricing independently for each format at any time, without resubmitting anything.</p>
<p>This matters more than it might first seem. A reader who wants an audiobook for the car, a parent who wants an eBook for a tablet at bedtime, and a teacher who wants a classroom paperback are all looking at the same title page, and none of them has to settle for the "wrong" format simply because it happened to be the only one you got around to publishing first.</p>
<h3>Real time sales tracking</h3>
<p>The moment a reader buys your book, it shows up in your dashboard. There is no overnight batch job and no waiting for a report to refresh: sales, downloads, and format breakdowns update as they happen.</p>
<p>You can check in from your phone between errands and actually see whether today's promotion is working, instead of finding out three weeks from now when a statement finally arrives.</p>
<h3>Complete revenue transparency and a live performance dashboard</h3>
<p>Every royalty calculation is shown in full: the price paid, the platform's share, and your share, for every single sale. Nothing is bundled into a vague "net revenue" figure you have to take on faith, and if a sale came through an affiliate link, you can see exactly how that commission was split.</p>
<p>Alongside the money, the same dashboard lays out revenue, unit sales, downloads, unique readers, and the countries your readers are in, with trend lines showing whether a title is picking up or slowing down.</p>
<h3>Monthly downloadable reports and secure payments</h3>
<p>Alongside the live dashboard, a clean report is generated automatically at the end of every month, covering everything that sold, where it sold, and exactly what you earned from it, ready to download as a PDF for your own records or to hand to an accountant.</p>
<p>Payouts themselves are processed through the same secure infrastructure that handles customer checkout at the front of the store; every payout is logged in your account history for as long as you need to refer back to it.</p>
<h3>You keep ownership of your work</h3>
<p>Submitting a title to The Good Child Bookstore does not transfer ownership of it. You retain full rights to your manuscript and illustrations; publishing here grants us a license to sell and distribute the book on your behalf, and nothing more.</p>
<p>You remain free to publish the same title elsewhere, and to remove it from our shelf whenever you choose.</p>
<h3>An easy publishing workflow and a modern author dashboard</h3>
<p>Upload a manuscript and a cover, answer a short set of questions about age range and category, and we handle formatting and print setup from there. A built in checklist walks you through print specifications, back cover copy, and ISBN details, so nothing gets missed before a title goes live.</p>
<p>Once it is live, submissions, sales, messages from readers, and your blog posts all sit in the same dashboard, built to be checked in a few spare minutes rather than managed like a second job.</p>
<h3>Affiliate integration, no extra account</h3>
<p>Every author account can also earn as an affiliate, sharing books (including books by other authors on the shelf) and earning commission on the sales that follow, without ever creating a second login.</p>
<p>Enable affiliate access from your existing dashboard whenever you are ready to start referring readers; your author tools stay exactly where they are.</p>
<h3>Print on demand, worldwide distribution, and your professional profile</h3>
<p>Paperback and hardcover copies are produced through our print partner, Lulu, on a print on demand basis. There is no print run to pay for upfront and no boxes of unsold inventory taking up space in your home; a copy is only printed once a customer orders it, and shipped directly to them, wherever they are.</p>
<p>Once a title is live, it is available to readers everywhere we operate, and it sits on a professional profile page, alongside your bio, your photo, and your full catalog, that readers, teachers, and librarians can actually browse and follow.</p>
<h3>A real editorial review, not an algorithm</h3>
<p>Every submission is opened and read by an actual editor before it goes live, checking the basics that matter most for a children's title: accurate metadata, age appropriateness, and copyright.</p>
<p>If something needs a change, you get specific, written notes explaining exactly what to fix, then you resubmit; the goal is a stronger finished book on the shelf, not a rejection with no explanation attached to it.</p>
<h3>A shelf built around readers who actually look for children's books</h3>
<p>There is no third party advertising anywhere on this site, and no outside advertiser can pay to appear next to your book; what a reader sees is what our editors and our own recommendation logic chose to show them.</p>
<p>For a children's bookstore in particular, that matters to the parents, teachers, and librarians who make up most of our audience, and it means your book is judged on its own merits, not on someone else's ad budget.</p>`,
  },
  affiliateMarketing: {
    eyebrow: "✦ Affiliate program",
    heading: "Share books you love, get paid for it.",
    introText: "Anyone passionate about children's books can earn commission promoting titles from our shelf, with a real time dashboard, transparent payouts, and lifetime earnings from the authors you refer.",
    sections: [
      {
        id: "commission-on-sales",
        title: "Earn commission on every sale you refer",
        paragraphs: [
          "Every affiliate account comes with a unique link for any book on the shelf. When someone buys through your link, a share of that sale is credited to you automatically, no manual tracking or spreadsheets required on your end.",
          "You can see exactly which books, which links, and which days are earning the most, so you know where to put your effort next.",
          "It is worth saying plainly, because it surprises a lot of people who join: you do not need a following of any particular size to start earning through this program. A single well placed recommendation, shared in a classroom newsletter, a parents' group chat, or a small local book club, works exactly the same way, mechanically, as a link shared with a much larger audience online.",
        ],
        imageUrl: undefined,
      },
      {
        id: "lifetime-referral-commissions",
        title: "Lifetime commissions from the authors you refer",
        paragraphs: [
          "Referring authors works differently, and better, than referring a single sale. Refer a writer who joins the platform, and you continue earning a share of their sales for as long as they keep publishing with us, not just for the first purchase.",
          "That means a single good referral can keep paying out for years, quietly compounding in the background while you focus on other things.",
        ],
        imageUrl: undefined,
      },
      {
        id: "realtime-dashboard",
        title: "A real time earnings dashboard and live commission tracking",
        paragraphs: [
          "Clicks, conversions, and commission all appear in your dashboard as they happen, rather than in a delayed monthly export. You can watch a shared link start converting in real time and know, that same day, whether a post or a promotion actually worked.",
          "Every referral is logged the moment it happens, with the exact commission calculation attached to it, so there is never a gap between a sale occurring and you being able to see it.",
        ],
        imageUrl: undefined,
      },
      {
        id: "monthly-payouts",
        title: "Monthly payout reports and transparent accounting",
        paragraphs: [
          "Every commission calculation is visible before it is paid, broken down by referral, so nothing is bundled into a single unexplained number.",
          "At the end of each month, that detail is summarized into a clean, downloadable report you can keep for your own records or hand to an accountant.",
        ],
        imageUrl: undefined,
      },
      {
        id: "marketing-resources",
        title: "Marketing resources, ready to use",
        paragraphs: [
          "Ready made banners, cover images, and suggested copy are available for every book on the shelf, so you are never starting a promotion from a blank page.",
          "Everything is sized and formatted for the platforms affiliates actually use: social posts, newsletters, and classroom handouts alike.",
        ],
        imageUrl: undefined,
      },
      {
        id: "no-following-needed",
        title: "No large following required",
        paragraphs: [
          "You do not need a following of any particular size to start earning through this program. A single well placed recommendation, shared in a classroom newsletter, a parents' group chat, or a small local book club, works exactly the same way, mechanically, as a link shared with a much larger audience online.",
          "Commission is calculated the same way regardless of how the click arrived, so a small, genuinely engaged audience can perform just as well as a large one.",
        ],
        imageUrl: undefined,
      },
      {
        id: "affiliate-support",
        title: "Real support, not a self-serve dead end",
        paragraphs: [
          "Questions about a commission calculation, a payout, or a link that is not tracking correctly go to a real person, not a support ticket queue with no timeline attached to it.",
          "Every affiliate account also has direct access to the same messaging system authors use, so a question about a specific book or promotion reaches the right person quickly.",
        ],
        imageUrl: undefined,
      },
    ],
    bodyHtml: `<h3>Earn commission on every sale you refer</h3>
<p>Every affiliate account comes with a unique link for any book on the shelf. When someone buys through your link, a share of that sale is credited to you automatically, no manual tracking or spreadsheets required on your end.</p>
<p>You can see exactly which books, which links, and which days are earning the most, so you know where to put your effort next.</p>
<p>It is worth saying plainly, because it surprises a lot of people who join: you do not need a following of any particular size to start earning through this program. A single well placed recommendation, shared in a classroom newsletter, a parents' group chat, or a small local book club, works exactly the same way, mechanically, as a link shared with a much larger audience online.</p>
<h3>Lifetime commissions from the authors you refer</h3>
<p>Referring authors works differently, and better, than referring a single sale. Refer a writer who joins the platform, and you continue earning a share of their sales for as long as they keep publishing with us, not just for the first purchase.</p>
<p>That means a single good referral can keep paying out for years, quietly compounding in the background while you focus on other things.</p>
<h3>A real time earnings dashboard and live commission tracking</h3>
<p>Clicks, conversions, and commission all appear in your dashboard as they happen, rather than in a delayed monthly export. You can watch a shared link start converting in real time and know, that same day, whether a post or a promotion actually worked.</p>
<p>Every referral is logged the moment it happens, with the exact commission calculation attached to it, so there is never a gap between a sale occurring and you being able to see it.</p>
<h3>Monthly payout reports and transparent accounting</h3>
<p>Every commission calculation is visible before it is paid, broken down by referral, so nothing is bundled into a single unexplained number.</p>
<p>At the end of each month, that detail is summarized into a clean, downloadable report you can keep for your own records or hand to an accountant.</p>
<h3>Marketing resources, ready to use</h3>
<p>Ready made banners, cover images, and suggested copy are available for every book on the shelf, so you are never starting a promotion from a blank page.</p>
<p>Everything is sized and formatted for the platforms affiliates actually use: social posts, newsletters, and classroom handouts alike.</p>
<h3>No large following required</h3>
<p>You do not need a following of any particular size to start earning through this program. A single well placed recommendation, shared in a classroom newsletter, a parents' group chat, or a small local book club, works exactly the same way, mechanically, as a link shared with a much larger audience online.</p>
<p>Commission is calculated the same way regardless of how the click arrived, so a small, genuinely engaged audience can perform just as well as a large one.</p>
<h3>Real support, not a self-serve dead end</h3>
<p>Questions about a commission calculation, a payout, or a link that is not tracking correctly go to a real person, not a support ticket queue with no timeline attached to it.</p>
<p>Every affiliate account also has direct access to the same messaging system authors use, so a question about a specific book or promotion reaches the right person quickly.</p>`,
  },
  blog: {
    eyebrow: "",
    heading: "The Journal",
    introText: "Notes from our authors and the shelf team.",
    bodyHtml: "<p>Notes from our authors and the shelf team.</p>",
  },
  contact: {
    eyebrow: "✦ We read every message",
    heading: "Let's start a conversation.",
    introText: "Questions about an order, a subscription, or just want a recommendation for a tricky reader? We're a small team and we answer everything ourselves: no ticket numbers, no bots.",
    bodyHtml: "<p>Questions about an order, a subscription, or just want a recommendation for a tricky reader? We're a small team and we answer everything ourselves: no ticket numbers, no bots.</p>",
  },
  privacy: {
    title: "Privacy Policy",
    intro: "How The Good Child Bookstore collects, uses, and protects your information.",
    sections: [
      { id: "what-we-collect", heading: "What we collect", body: "Account details you provide (name, email, shipping and billing address), order history, and basic usage data to keep the store running smoothly." },
      { id: "how-we-use-it", heading: "How we use it", body: "To process orders, deliver digital downloads, run your subscription, pay author royalties and affiliate commissions, and improve recommendations." },
      { id: "what-we-never-do", heading: "What we never do", body: "We don't sell your data to third parties, and we don't run third party advertising on this site." },
      { id: "your-choices", heading: "Your choices", body: "You can review, export, or request deletion of your account data at any time from Security settings in your account." },
    ],
    bodyHtml: `<h3>What we collect</h3>
<p>Account details you provide (name, email, shipping and billing address), order history, and basic usage data to keep the store running smoothly.</p>
<h3>How we use it</h3>
<p>To process orders, deliver digital downloads, run your subscription, pay author royalties and affiliate commissions, and improve recommendations.</p>
<h3>What we never do</h3>
<p>We don't sell your data to third parties, and we don't run third party advertising on this site.</p>
<h3>Your choices</h3>
<p>You can review, export, or request deletion of your account data at any time from Security settings in your account.</p>`,
  },
  terms: {
    title: "Terms of Service",
    intro: "The basics of using The Good Child Bookstore, in plain language.",
    sections: [
      { id: "your-account", heading: "Your account", body: "You're responsible for keeping your login secure, and for the accuracy of the information you provide us." },
      { id: "purchases", heading: "Purchases", body: "Digital downloads are for your personal use only; redistributing purchased files is a violation of copyright and these terms." },
      { id: "author-content", heading: "Author content", body: "Authors retain the rights to their own work; publishing with us doesn't transfer ownership, only the license to sell through our shelf." },
      { id: "changes", heading: "Changes", body: "We may update these terms from time to time; continued use of the site after a change means you accept the update." },
    ],
    bodyHtml: `<h3>Your account</h3>
<p>You're responsible for keeping your login secure, and for the accuracy of the information you provide us.</p>
<h3>Purchases</h3>
<p>Digital downloads are for your personal use only; redistributing purchased files is a violation of copyright and these terms.</p>
<h3>Author content</h3>
<p>Authors retain the rights to their own work; publishing with us doesn't transfer ownership, only the license to sell through our shelf.</p>
<h3>Changes</h3>
<p>We may update these terms from time to time; continued use of the site after a change means you accept the update.</p>`,
  },
  returns: {
    title: "Return Policy",
    intro: "What to expect if something isn't right with an order.",
    sections: [
      { id: "digital-downloads", heading: "Digital downloads", body: "Because eBooks and audiobooks are delivered instantly, we generally don't offer refunds once a download has started, except where the file itself is defective." },
      { id: "print-copies", heading: "Print copies", body: "Damaged or misprinted physical copies are replaced free of charge; contact us with a photo of the issue and we'll sort it out." },
      { id: "subscriptions", heading: "Subscriptions", body: "You can cancel a subscription at any time; you'll keep access through the end of the period you already paid for." },
      { id: "how-to-request", heading: "How to request a return", body: "Reach out through Contact us with your order number, and a real person will respond, not an automated ticket." },
    ],
    bodyHtml: `<h3>Digital downloads</h3>
<p>Because eBooks and audiobooks are delivered instantly, we generally don't offer refunds once a download has started, except where the file itself is defective.</p>
<h3>Print copies</h3>
<p>Damaged or misprinted physical copies are replaced free of charge; contact us with a photo of the issue and we'll sort it out.</p>
<h3>Subscriptions</h3>
<p>You can cancel a subscription at any time; you'll keep access through the end of the period you already paid for.</p>
<h3>How to request a return</h3>
<p>Reach out through Contact us with your order number, and a real person will respond, not an automated ticket.</p>`,
  },
  faq: {
    title: "Frequently Asked Questions",
    intro: "Quick answers to what we get asked most.",
    sections: [
      { id: "how-download", heading: "How do I download a book I bought?", body: "Purchased books appear in My Library immediately after checkout, with a Download button on each title." },
      { id: "become-author", heading: "Can I become an author on this platform?", body: "Yes; sign up for an author account and submit your title through our editorial review process." },
      { id: "affiliate-program", heading: "How does the affiliate program work?", body: "Any account, reader or author, can enable affiliate access and start earning commission on referrals and promoted book links." },
      { id: "payment-methods", heading: "What payment methods do you accept?", body: "Cards via Paystack, including Visa, Mastercard, American Express, and Verve." },
      { id: "safe-for-children", heading: "Is this platform safe for children to browse?", body: "Yes; every listing is age tagged honestly, and there is no third party advertising anywhere on the site." },
    ],
    bodyHtml: `<h3>How do I download a book I bought?</h3>
<p>Purchased books appear in My Library immediately after checkout, with a Download button on each title.</p>
<h3>Can I become an author on this platform?</h3>
<p>Yes; sign up for an author account and submit your title through our editorial review process.</p>
<h3>How does the affiliate program work?</h3>
<p>Any account, reader or author, can enable affiliate access and start earning commission on referrals and promoted book links.</p>
<h3>What payment methods do you accept?</h3>
<p>Cards via Paystack, including Visa, Mastercard, American Express, and Verve.</p>
<h3>Is this platform safe for children to browse?</h3>
<p>Yes; every listing is age tagged honestly, and there is no third party advertising anywhere on the site.</p>`,
  },
};
