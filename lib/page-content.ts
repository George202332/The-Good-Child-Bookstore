export interface HomeContent {
  eyebrow: string;
  heading: string;
  lede: string;
  /** One background image per hero carousel slide — recommended
   * 1600x600px (landscape, roughly 8:3) each. */
  heroWelcomeImage?: string;
  heroBrowseImage?: string;
  heroAuthorImage?: string;
  heroAffiliateImage?: string;
  bookClubBannerTitle: string;
  bookClubBannerBody: string;
  /** Recommended 1200x500px. */
  bookClubBannerImage?: string;
  printBannerTitle: string;
  printBannerBody: string;
  /** Recommended 1200x500px. */
  printBannerImage?: string;
  affiliateBannerTitle: string;
  affiliateBannerBody: string;
  /** Recommended 1200x500px. */
  affiliateBannerImage?: string;
  journalBannerTitle: string;
  journalBannerBody: string;
  /** Recommended 1200x500px. */
  journalBannerImage?: string;
}

/** A simple, editable intro block (eyebrow/heading/intro paragraph) used
 * by the lighter pages — Shop, Blog, Contact — that don't need a full
 * long-form layout. */
export interface SimplePageContent {
  eyebrow: string;
  heading: string;
  introText: string;
}

/** One block of a long-form marketing page (Authorship, Affiliate) — a
 * title, one or more paragraphs, and an optional image. Fully
 * admin-editable, including adding/removing/reordering sections. */
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
  sections: MarketingPageSection[];
}

/** One section of a legal/info page — a heading (or FAQ question) and
 * its body (or answer). */
export interface LegalPageSection {
  id: string;
  heading: string;
  body: string;
}

export interface LegalPageContent {
  title: string;
  intro: string;
  sections: LegalPageSection[];
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
    ],
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
    ],
  },
  blog: {
    eyebrow: "",
    heading: "The Journal",
    introText: "Notes from our authors and the shelf team.",
  },
  contact: {
    eyebrow: "✦ We read every message",
    heading: "Let's start a conversation.",
    introText: "Questions about an order, a subscription, or just want a recommendation for a tricky reader? We're a small team and we answer everything ourselves: no ticket numbers, no bots.",
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
  },
};
