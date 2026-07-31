export interface HomeContent {
  eyebrow: string;
  heading: string;
  lede: string;
  /** Shared background image behind the hero carousel (all 4 slides) —
   * recommended 1600x600px (landscape, roughly 8:3). */
  heroImage?: string;
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
 * by every page besides Home. Each of these pages also has a large body
 * of detailed marketing copy below the intro (the Authorship/Affiliate
 * feature sections, for example) that ISN'T individually editable here —
 * making every paragraph of that deeper content admin-editable would need
 * a much larger, dedicated content-block editor, which is real future
 * work, not something this covers yet. This covers what visitors see
 * first on each page. */
export interface SimplePageContent {
  eyebrow: string;
  heading: string;
  introText: string;
}

export interface PagesContent {
  home: HomeContent;
  shop: SimplePageContent;
  authors: SimplePageContent;
  affiliate: SimplePageContent;
  blog: SimplePageContent;
  contact: SimplePageContent;
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
  authors: {
    eyebrow: "✦ Authorship",
    heading: "Publish your story. Keep the rights.",
    introText: "Join the children's authors already publishing eBooks, print, and audiobooks through The Good Child Bookstore, with real-time sales tracking, transparent royalties, and a modern dashboard built for writers, not spreadsheets.",
  },
  affiliate: {
    eyebrow: "✦ Affiliate program",
    heading: "Share books you love. Get paid for it.",
    introText: "Anyone passionate about children's books can earn commission promoting titles from our shelf, with a real-time dashboard, transparent payouts, and lifetime earnings from the authors you refer.",
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
};
