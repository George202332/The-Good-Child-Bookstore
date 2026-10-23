-- OPTIONAL tidy-up for the Round 39 category rename. Not required: the site
-- already recognises the old "... Series" spelling and shows the new name, so
-- nothing breaks if you never run this.
--
-- It only rewrites the text in "Book"."category" (the Category a book was filed
-- under). It never touches subcategories, genres, ids or any other table, so
-- every book keeps its links.
--
-- Run it on STAGING first, then on PRODUCTION (before merging staging into main
-- is NOT needed for this, but run it on both). Safe to run twice.
-- Take a Neon backup/branch first if you like.

UPDATE "Book" SET "category" = 'Interactive Activity'                  WHERE "category" = 'Interactive Activity Series';
UPDATE "Book" SET "category" = 'Emotional Wellness and Mindfulness'    WHERE "category" = 'Emotional Wellness and Mindfulness Series';
UPDATE "Book" SET "category" = 'Fun and Humor'                         WHERE "category" = 'Fun and Humor Series';
UPDATE "Book" SET "category" = 'Values and Virtues'                    WHERE "category" = 'Values and Virtues Series';
UPDATE "Book" SET "category" = 'Community and Society'                 WHERE "category" = 'Community and Society Series';
UPDATE "Book" SET "category" = 'Religion and Culture'                  WHERE "category" = 'Religion and Culture Series';
