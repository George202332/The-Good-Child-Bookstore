export interface HomepageContent {
  eyebrow: string;
  heading: string;
  lede: string;
  bookClubBannerTitle: string;
  bookClubBannerBody: string;
  printBannerTitle: string;
  printBannerBody: string;
  affiliateBannerTitle: string;
  affiliateBannerBody: string;
  journalBannerTitle: string;
  journalBannerBody: string;
}

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
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
};
