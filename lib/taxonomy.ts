/**
 * Book classification taxonomy. Three INDEPENDENT dimensions:
 *   - Category    one of the ten CATEGORIES (the "series" a book belongs to)
 *   - Genre       one of the five GENRES (the "Shop by Shelf" shelves)
 *   - Subcategory a theme listed under the chosen Category
 * A subcategory name exists under exactly one category so a
 * name -> category lookup is unambiguous.
 */

export const CATEGORIES = [
  "Adventure Series",
  "Education Series",
  "Interactive Activity Series",
  "Emotional Wellness and Mindfulness Series",
  "Fun and Humor Series",
  "Values and Virtues Series",
  "Community and Society Series",
  "Religion and Culture Series",
  "Holiday and Festivities",
  "Diversity, Equity, and Inclusion",
] as const;

export type BookCategory = (typeof CATEGORIES)[number];

export const GENRES = [
  "Picture Books",
  "Bedtime Stories",
  "Early Readers",
  "Middle Grade",
  "Activity Books",
] as const;

export type BookGenre = (typeof GENRES)[number];

/** Shelf ids used by lib/data/catalog.ts CATS and the `?cat=` URLs. */
export const GENRE_SHELF_ID: Record<BookGenre, string> = {
  "Picture Books": "picture",
  "Bedtime Stories": "bedtime",
  "Early Readers": "early",
  "Middle Grade": "middle",
  "Activity Books": "activity",
};

export const SUBCATEGORIES: Record<BookCategory, readonly string[]> = {
  "Adventure Series": [
    "Adventure",
    "Fantasy",
    "Fairy Tale",
    "Gentle Mystery",
    "Treasure Hunts",
    "Quests and Journeys",
    "Pirates and Sailors",
    "Explorers and Expeditions",
    "Magical Worlds",
    "Dragons and Mythical Creatures",
    "Space Adventures",
    "Ocean Adventures",
    "Jungle and Safari",
    "Mountain and Wilderness",
    "Time Travel",
    "Superheroes",
    "Detectives and Puzzles",
    "Robots and Inventions",
    "Dinosaur Adventures",
    "Camping and Outdoors",
    "Road Trips and Travel",
    "Lost and Found Quests",
  ],
  "Education Series": [
    "Educational",
    "Educational Stories",
    "Alphabet and Letters",
    "Numbers and Counting",
    "Shapes and Colors",
    "Science and Discovery",
    "Nature",
    "Animal Facts",
    "Space and Planets",
    "Weather and Seasons",
    "History for Kids",
    "Geography and Maps",
    "Biographies",
    "Languages and Words",
    "Reading Skills",
    "Phonics and Spelling",
    "Math Fun",
    "Money and Saving",
    "Technology and Coding",
    "Art and Music",
    "Health and Body",
    "Environment and Recycling",
    "School Readiness",
  ],
  "Interactive Activity Series": [
    "Coloring",
    "Drawing and Doodling",
    "Mazes and Puzzles",
    "Word Searches",
    "Dot to Dot",
    "Crafts and DIY",
    "Stickers and Cutouts",
    "Lift the Flap",
    "Touch and Feel",
    "Sing Along and Rhymes",
    "Poetry",
    "Riddles and Brain Teasers",
    "Games and Quizzes",
    "Science Experiments",
    "Cooking with Kids",
    "Gardening Projects",
    "Write Your Own Story",
    "Journals and Diaries",
    "Matching and Memory",
    "Seek and Find",
    "Role Play and Pretend",
  ],
  "Emotional Wellness and Mindfulness Series": [
    "Feelings and Emotions",
    "Mindfulness",
    "Calm and Breathing",
    "Gratitude",
    "Self-Esteem",
    "Confidence",
    "Anxiety and Worry",
    "Anger Management",
    "Sadness and Grief",
    "Loneliness",
    "Resilience",
    "Growth Mindset",
    "Positive Thinking",
    "Sleep and Relaxation",
    "Yoga for Kids",
    "Meditation Stories",
    "Body Positivity",
    "Overcoming Fears",
    "Change and Transitions",
    "Self-Care",
    "Imagination and Dreams",
  ],
  "Fun and Humor Series": [
    "Humor",
    "Silly Stories",
    "Funny Animals",
    "Jokes and Knock-Knocks",
    "Tongue Twisters",
    "Fable",
    "Animal Story",
    "Pets and Companions",
    "Farm Friends",
    "Talking Toys",
    "Monsters and Giggles",
    "Pranks and Mischief",
    "Funny Families",
    "Food Fun",
    "Wacky Inventions",
    "Comic Style",
    "Nonsense Rhymes",
    "Playtime and Games",
    "Birthday and Party Fun",
    "Silly School Days",
    "Bedtime Giggles",
  ],
  "Values and Virtues Series": [
    "Friendship",
    "Family Life",
    "Kindness",
    "Honesty",
    "Courage",
    "Respect",
    "Sharing and Generosity",
    "Patience",
    "Perseverance",
    "Responsibility",
    "Forgiveness",
    "Empathy",
    "Humility",
    "Teamwork",
    "Fairness and Justice",
    "Gratitude and Manners",
    "Hard Work",
    "Integrity",
    "Love and Belonging",
    "Siblings",
    "Grandparents and Elders",
    "Good Choices",
  ],
  "Community and Society Series": [
    "Diversity and Inclusion",
    "Neighborhood and Community",
    "Helpers and Heroes",
    "Jobs and Careers",
    "Cultural Heritage",
    "Immigration and New Beginnings",
    "Disability and Accessibility",
    "Social Justice",
    "Bullying and Belonging",
    "Citizenship",
    "Environment and Community Care",
    "Village and City Life",
    "Schools and Teachers",
    "Global Citizens",
    "Equality",
    "Peace and Conflict",
    "Volunteering",
    "Adoption and Foster Care",
    "Blended Families",
    "Famous Leaders",
    "Traditions and Festivals",
    "Kids Making a Difference",
  ],
  "Religion and Culture Series": [
    "Bible Stories",
    "Faith and Prayer",
    "Islamic Stories",
    "Hindu Stories",
    "Buddhist Stories",
    "Jewish Stories",
    "Sikh Stories",
    "Interfaith Understanding",
    "Holidays and Festivals",
    "Easter",
    "Ramadan and Eid",
    "Diwali",
    "Hanukkah",
    "African Folktales",
    "Asian Folktales",
    "Indigenous Stories",
    "Myths and Legends",
    "World Cultures",
    "Cultural Foods and Customs",
    "Heritage Languages",
    "Spiritual Values",
  ],
  "Holiday and Festivities": [
    "New Year's Day",
    "Valentine's Day",
    "Easter Egg Fun",
    "Mother's Day",
    "Father's Day",
    "Independence Day",
    "Thanksgiving",
    "Canada Day",
    "Remembrance Day",
    "Australia Day",
    "Anzac Day",
    "Boxing Day",
    "Earth Day",
    "Halloween",
    "Christmas",
    "Lunar New Year",
  ],
  "Diversity, Equity, and Inclusion": [
    "Cultural Diversity",
    "Celebrating Differences",
    "Inclusion and Belonging",
    "Disability Awareness",
    "Neurodiversity",
    "Autism Awareness",
    "Deaf and Hard of Hearing",
    "Blind and Low Vision",
    "Accessibility and Mobility",
    "Racial Equity",
    "Anti-Racism",
    "Immigrant Stories",
    "Refugee Stories",
    "Gender Equality",
    "Different Family Structures",
    "LGBTQ+ Families",
    "Language and Identity",
    "Indigenous Voices",
    "Mixed Heritage",
    "Cultural Pride",
    "Equity for All",
    "Allyship",
    "Kids Advocating for Change",
  ],
};

export function isCategory(v: unknown): v is BookCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export function isGenre(v: unknown): v is BookGenre {
  return typeof v === "string" && (GENRES as readonly string[]).includes(v);
}

export function subcategoriesFor(cat: string | null | undefined): readonly string[] {
  return isCategory(cat) ? SUBCATEGORIES[cat] : [];
}

export function isSubcategoryOf(cat: string | null | undefined, sub: string | null | undefined): boolean {
  return !!sub && subcategoriesFor(cat).includes(sub);
}

const SUB_TO_CATEGORY = new Map<string, BookCategory>();
for (const cat of CATEGORIES) {
  for (const sub of SUBCATEGORIES[cat]) SUB_TO_CATEGORY.set(sub, cat);
}

export function categoryOfSubcategory(sub: string | null | undefined): BookCategory | undefined {
  return sub ? SUB_TO_CATEGORY.get(sub) : undefined;
}

export function categorySlug(cat: BookCategory): string {
  return cat
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryFromSlug(slug: string | null | undefined): BookCategory | undefined {
  if (!slug) return undefined;
  const s = slug.trim().toLowerCase();
  return CATEGORIES.find((c) => categorySlug(c) === s);
}

/** Fuzzy match of a legacy shelf/category label to one of the five genres.
 * Case-insensitive; "Educational" and unknown labels return undefined. */
export function normalizeGenre(label: string | null | undefined): BookGenre | undefined {
  const key = label?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return undefined;
  return GENRES.find((g) => g.toLowerCase() === key);
}
