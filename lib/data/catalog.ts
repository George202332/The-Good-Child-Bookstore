/**
 * Catalog seed/demo data, ported from the original frontend's
 * buildBooks() and related constants (the-good-child-bookstore_54_1.html,
 * lines 1898-2199).
 *
 * This is temporary demo data, exactly as in the original — deterministic,
 * not hand-typed per book. Once the Prisma `Book` table has real rows,
 * pages should read from the database instead; this generator is kept
 * standalone (no other module reaches into its internals) so swapping the
 * source later only means changing the import, per the original file's own
 * design note at that section.
 */

import { hashStr } from "@/lib/hash";

export type MotifKind =
  | "sun" | "moon" | "leaf" | "star" | "balloon" | "cat" | "fox" | "boat"
  | "rainbow" | "tree" | "owl" | "cloud" | "umbrella" | "train" | "heart" | "dragon";

export interface Category {
  id: string;
  name: string;
  blurb: string;
  tile: string;
  motif: MotifKind;
  icon: string;
}

export const CATS: Category[] = [
  { id: "picture", name: "Picture books", blurb: "Big art, small words", tile: "ct-pink", motif: "sun", icon: "🎨" },
  { id: "bedtime", name: "Bedtime stories", blurb: "For the last page of the day", tile: "ct-lav", motif: "moon", icon: "🌙" },
  { id: "early", name: "Early readers", blurb: "First chapters, first pride", tile: "ct-mint", motif: "leaf", icon: "📖" },
  { id: "middle", name: "Middle grade", blurb: "Longer worlds to get lost in", tile: "ct-gold", motif: "star", icon: "⭐" },
  { id: "activity", name: "Activity books", blurb: "Crayons at the ready", tile: "ct-coral", motif: "balloon", icon: "🖍️" },
];

export const PALETTES: [string, string][] = [
  ["#F0A6C0", "#EF87AC"], ["#8FD3B3", "#6DBE97"], ["#B7A0E8", "#9A7EDD"],
  ["#F4B942", "#E2A22B"], ["#FF8C6B", "#F06E49"], ["#7FC4E0", "#57ABCE"],
  ["#E8A0C7", "#D67FAF"], ["#A7D98C", "#8AC46B"], ["#F7C873", "#EDA93E"],
  ["#9FB6E8", "#7C98DB"], ["#F29CA3", "#E5747E"], ["#7ED6C1", "#4FBEA5"],
];

const TITLES: [string, string, MotifKind][] = [
  ["The Marmalade Fox", "Wendell Prue", "fox"],
  ["Moonlit Acorn", "Hana Osei", "moon"],
  ["Bramblewick Bay", "Iris Tallow", "boat"],
  ["A Thousand Tiny Suns", "Nadia Voss", "sun"],
  ["The Quiet Loud House", "Tomas Reyes", "cloud"],
  ["Pockets Full of Rain", "Elowen Marsh", "umbrella"],
  ["Bartholomew and the Blue Kite", "Sami Okoro", "balloon"],
  ["The Owl Who Counted Stars", "Priya Nandan", "owl"],
  ["Grandmother's Garden Train", "Lucia Ferro", "train"],
  ["Where the Wild Socks Grow", "Dev Kapoor", "leaf"],
  ["Nine Nights of Dragons", "Mateo Alder", "dragon"],
  ["The Cat Who Borrowed the Moon", "Yuki Sorel", "cat"],
  ["Sprout and the Sleepy Hill", "Anya Birch", "leaf"],
  ["Little Compass, Big World", "Femi Adeyemi", "boat"],
  ["The Rainboot Rainbow", "Clara Winship", "rainbow"],
  ["Whisker & the Winter Star", "Noor Kalim", "star"],
  ["The Buttonhole Kingdom", "Sasha Merrit", "heart"],
  ["Tumbleweed and the Toadstool", "Ronan Blythe", "tree"],
  ["A Very Small Adventure", "Mei Lindqvist", "balloon"],
  ["The Storyteller's Trunk", "Ines Caravaggio", "cloud"],
  ["Fern and the Foggy Forest", "Otis Wrenfield", "tree"],
  ["Paper Boats for Pip", "Aaliyah Chen", "boat"],
  ["The Lantern Under the Bed", "Kofi Danso", "moon"],
  ["Marigold Makes a Wish", "Delphine Aubert", "star"],
  ["The Firefly's Lullaby", "Rosalind Kim", "leaf"],
  ["Peppermint and the Paper Moon", "Julian Ashworth", "moon"],
  ["The Sleepy Lighthouse", "Marina Voskuijlen", "boat"],
  ["Buttercup's Big Question", "Theo Nakashima", "sun"],
  ["The Kite That Flew Too Far", "Amara Fentress", "balloon"],
  ["Hollowbrook's Last Leaf", "Simone Delacroix", "leaf"],
  ["The Whispering Willow", "Callum Bright", "tree"],
  ["Stardust for Breakfast", "Priyanka Sethi", "star"],
  ["The Tiny Dragon's Nap", "Emrys Caldwell", "dragon"],
  ["A Coat Full of Clouds", "Ingrid Halvorsen", "cloud"],
  ["The Button Collector", "Malachi Osei", "heart"],
  ["Rainy Day Ruckus", "Camille Fontaine", "umbrella"],
  ["The Fox Who Forgot How to Howl", "Desmond Okafor", "fox"],
  ["Six Silver Balloons", "Anouk Verhoeven", "balloon"],
  ["The Cat With Two Shadows", "Jonas Aurelio", "cat"],
  ["Milo and the Midnight Train", "Freya Lindstrom", "train"],
  ["The Garden That Ate Tuesday", "Baptiste Rousseau", "leaf"],
  ["A Very Polite Dragon", "Nkechi Obi", "dragon"],
  ["The Owl Who Forgot to Sleep", "Soren Kjeldsen", "owl"],
  ["Umbrella for a Rainbow", "Talia Marchetti", "rainbow"],
  ["The Quiet Kind of Brave", "Idris Falade", "tree"],
  ["Sailboats Made of Sunlight", "Wren Castellano", "boat"],
  ["The Last Star on the Shelf", "Odalys Pruitt", "star"],
  ["Pebbles for the Moon", "Hugo Sandoval", "moon"],
  ["The Blanket Fort Chronicles", "Zora Whitfield", "heart"],
  ["Acorn's First Winter", "Bennett Ishikawa", "leaf"],
];

export const AGE_RANGES = ["0-2", "3-5", "6-8", "9-12", "12-15"] as const;
export const GENRES = ["Adventure", "Fantasy", "Friendship", "Fable", "Family Life", "Nature", "Humor", "Gentle Mystery"];
export const PRICE_RANGES = [
  { id: "under10", label: "Under $10", min: 0, max: 9.99 },
  { id: "10to13", label: "$10 – $12.99", min: 10, max: 12.99 },
  { id: "13to15", label: "$13 – $14.99", min: 13, max: 14.99 },
  { id: "15up", label: "$15 & up", min: 15, max: Infinity },
];
export const PUB_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  /** Links to the public author profile page (/authors/profile/[id]) —
   * only set for real, submitted books; the static demo catalog has no
   * matching AuthorProfile row, so this stays undefined for those. */
  authorId?: string;
  motif: MotifKind;
  palette: [string, string];
  category: string;
  genre: string;
  age: string;
  price: number;
  formats: { ebook: number; print: number; paperback: number; audiobook: number };
  /** Which of the 4 formats this specific book actually has published —
   * gates which buy-box tiles show on the product page and which
   * formats can actually be purchased. Undefined (the static demo
   * catalog, unchanged) is treated as every format being available;
   * only real submitted books set this explicitly, reflecting the
   * formats their author actually enabled at submission. */
  formatAvailable?: { ebook: boolean; paperback: boolean; hardcover: boolean; audiobook: boolean };
  isbn: string;
  pubDate: string;
  sizeMB: string;
  rating: string;
  reviews: number;
  pages: number;
  format: string;
  blurb: string;
  featured: boolean;
  affiliateEnabled: boolean;
  coverImage?: string;
  /** External marketplace links (Amazon, Apple Books, etc.) collected
   * during a real print submission — undefined for the static demo
   * catalog and for ebook-only real submissions. */
  marketplaceLinks?: Record<string, string>;
}

function buildBooks(): Book[] {
  const books: Book[] = TITLES.map((t, i) => {
    const cat = CATS[i % CATS.length].id;
    const age =
      cat === "picture" ? (i % 2 ? "0-2" : "3-5")
      : cat === "bedtime" ? "0-2"
      : cat === "early" ? "3-5"
      : cat === "middle" ? (i % 3 === 0 ? "12-15" : "9-12")
      : AGE_RANGES[i % AGE_RANGES.length];
    const price = [9.99, 10.5, 11.99, 12.5, 13.99, 14.5, 8.99, 15.99][i % 8];

    return {
      id: "b" + (i + 1),
      title: t[0],
      author: t[1],
      motif: t[2],
      palette: PALETTES[i % PALETTES.length],
      category: cat,
      genre: GENRES[i % GENRES.length],
      age,
      price,
      formats: {
        ebook: +(price * 0.62).toFixed(2),
        print: price,
        paperback: +(price * 0.8).toFixed(2),
        audiobook: +(price * 1.45).toFixed(2),
      },
      isbn: `978-1-${String(50000 + i * 137).padStart(5, "0")}-${String((i * 7 + 3) % 100).padStart(2, "0")}-${(i % 9) + 1}`,
      pubDate: `${PUB_MONTHS[(i * 3) % 12]} ${2020 + (i % 6)}`,
      sizeMB: (8 + (i % 12) * 3.2).toFixed(1),
      rating: (3.5 + (i % 4) * 0.5).toFixed(1),
      reviews: 42 + ((i * 37) % 260),
      pages: 24 + (i % 5) * 8,
      format: ["eBook", "Audiobook", "Paperback", "Hardcover"][i % 4],
      blurb:
        "A gentle, richly illustrated story built for read-aloud evenings and quiet afternoons, with a warmth that lingers long after the last page.",
      featured: i < 8,
      affiliateEnabled: i % 10 < 7,
    };
  });

  // A few authors get a second (or third) title, so "More by this author" has real content.
  const authorOverrides: Record<number, number> = { 2: 0, 8: 3, 13: 5, 18: 9, 21: 14 };
  Object.entries(authorOverrides).forEach(([idx, sourceIdx]) => {
    books[Number(idx)].author = books[Number(sourceIdx)].author;
  });

  return books;
}

export const BOOKS: Book[] = buildBooks();

export function fiveStarBooks(): Book[] {
  return BOOKS.filter((b) => parseFloat(b.rating) === 5);
}

export interface CatalogAuthor {
  isCatalogAuthor: true;
  verifiedName: string;
  bookCount: number;
  avgRating: number;
  totalReviews: number;
  totalSales: 0;
  seed: number;
  sampleBook: Book;
}

/**
 * Ported from getCatalogFallbackAuthors() (the-good-child-bookstore_54_1.html:3417-3430).
 * A fallback pool drawn from the catalog itself — used to fill "Featured
 * authors" seats that real, qualifying author accounts haven't earned yet.
 * Once the Author/User tables have real qualifying rows (5+ published
 * books, 4.0+ average rating, a real profile photo — see
 * evaluateAuthorFeaturedEligibility() in the original), those should be
 * ranked first and this pool should only fill remaining seats, exactly as
 * the original homepage does. That merge is still pending (no real author
 * accounts exist in this build yet); for now this pool is the only source.
 */
export function getCatalogFallbackAuthors(): CatalogAuthor[] {
  const stats: Record<string, { name: string; count: number; ratingSum: number; reviewSum: number; seed: number; sampleBook: Book }> = {};
  BOOKS.forEach((b) => {
    if (!stats[b.author]) {
      stats[b.author] = { name: b.author, count: 0, ratingSum: 0, reviewSum: 0, seed: hashStr(b.author), sampleBook: b };
    }
    stats[b.author].count++;
    stats[b.author].ratingSum += parseFloat(b.rating);
    stats[b.author].reviewSum += b.reviews;
  });
  return Object.values(stats)
    .map((a) => ({
      isCatalogAuthor: true as const,
      verifiedName: a.name,
      bookCount: a.count,
      avgRating: +(a.ratingSum / a.count).toFixed(2),
      totalReviews: a.reviewSum,
      totalSales: 0 as const,
      seed: a.seed,
      sampleBook: a.sampleBook,
    }))
    .sort((x, y) => y.avgRating - x.avgRating || y.bookCount - x.bookCount || y.totalReviews - x.totalReviews);
}
