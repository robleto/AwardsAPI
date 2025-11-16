const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Read the raw Oscar CSV data (tab-delimited)
const csvData = fs.readFileSync('data/oscars_raw.csv', 'utf-8');
const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
  delimiter: '\t',
  relax_column_count: true,
  escape: '\\',
  quote: false
});

console.log(`📊 Loaded ${records.length} Oscar nominations from CSV`);

// Categories we care about
const TARGET_CATEGORIES = [
  'ACTOR IN A LEADING ROLE',
  'ACTRESS IN A LEADING ROLE',
  'ACTOR IN A SUPPORTING ROLE',
  'ACTRESS IN A SUPPORTING ROLE',
  'BEST PICTURE',
  'DIRECTING',
  'WRITING (Original Screenplay)',
  'WRITING (Adapted Screenplay)',
  'ANIMATED FEATURE FILM',
  'HONORARY AWARD' // Lifetime achievement
];

// Map their category names to ours
const categoryMap = {
  'ACTOR IN A LEADING ROLE': 'Best Actor',
  'ACTRESS IN A LEADING ROLE': 'Best Actress',
  'ACTOR IN A SUPPORTING ROLE': 'Best Supporting Actor',
  'ACTRESS IN A SUPPORTING ROLE': 'Best Supporting Actress',
  'BEST PICTURE': 'Best Picture',
  'OUTSTANDING PICTURE': 'Best Picture',
  'OUTSTANDING PRODUCTION': 'Best Picture',
  'OUTSTANDING MOTION PICTURE': 'Best Picture',
  'DIRECTING': 'Best Director',
  'DIRECTING (Dramatic Picture)': 'Best Director',
  'DIRECTING (Comedy Picture)': 'Best Director',
  'WRITING (Original Screenplay)': 'Best Original Screenplay',
  'WRITING (Screenplay Based on Material from Another Medium)': 'Best Adapted Screenplay',
  'WRITING (Screenplay Based on Material Previously Produced or Published)': 'Best Adapted Screenplay',
  'WRITING (Adapted Screenplay)': 'Best Adapted Screenplay',
  'ANIMATED FEATURE FILM': 'Best Animated Feature',
  'HONORARY AWARD': 'Lifetime Achievement'
};

// Function to determine role from category
function getRoleFromCategory(canonicalCategory) {
  if (canonicalCategory.includes('ACTOR')) return 'Actor';
  if (canonicalCategory.includes('ACTRESS')) return 'Actress';
  if (canonicalCategory.includes('DIRECTING')) return 'Director';
  if (canonicalCategory.includes('WRITING')) return 'Writer';
  return 'Honoree';
}

// Group by ceremony year
const byCeremony = {};
records.forEach(record => {
  const ceremony = parseInt(record.Ceremony);
  const canonicalCategory = record.CanonicalCategory;
  
  // Skip categories we don't care about
  if (!Object.keys(categoryMap).some(cat => canonicalCategory.includes(cat))) {
    return;
  }
  
  // Get ceremony year from Year field (e.g., "1927/28" -> 1928, "2024" -> 2024)
  const yearMatch = record.Year.match(/(\d{4})$/);
  const ceremonyYear = yearMatch ? parseInt(yearMatch[1]) + 1 : ceremony + 1928;
  
  if (!byCeremony[ceremonyYear]) {
    byCeremony[ceremonyYear] = [];
  }
  
  // Map to our category name
  let categoryName = categoryMap[canonicalCategory] || categoryMap[record.Category];
  if (!categoryName) {
    // Try partial matching
    for (const [key, value] of Object.entries(categoryMap)) {
      if (canonicalCategory.includes(key) || record.Category.includes(key)) {
        categoryName = value;
        break;
      }
    }
  }
  
  if (!categoryName) return; // Skip if we can't map it
  
  // Parse film IDs (might be multiple separated by |)
  const filmIds = record.FilmId ? record.FilmId.split('|').filter(id => id && id !== '?') : [];
  const filmId = filmIds[0] || null;
  
  // Parse film titles
  const filmTitles = record.Film ? record.Film.split('|') : [];
  const filmTitle = filmTitles[0] || 'Lifetime Achievement';
  
  // Parse nominees
  const nomineeNames = record.Nominees ? record.Nominees.split('|') : [];
  const people = nomineeNames.map(name => ({
    name: name.trim(),
    role: getRoleFromCategory(canonicalCategory)
  }));
  
  byCeremony[ceremonyYear].push({
    ceremony_year: ceremonyYear,
    org_name: 'Academy Awards',
    ceremony_name: `${ceremony}${ceremony === 1 ? 'st' : ceremony === 2 ? 'nd' : ceremony === 3 ? 'rd' : 'th'} Academy Awards`,
    category_name: categoryName,
    imdb_id: filmId,
    film_title: filmTitle,
    is_win: record.Winner === 'True',
    people: people
  });
});

// Write separate JSON files for each year range
const years = Object.keys(byCeremony).map(Number).sort((a, b) => a - b);
console.log(`\n📅 Found data for years: ${years[0]} - ${years[years.length - 1]}`);
console.log(`📊 Total ceremonies: ${years.length}`);

// Group into files
const fileGroups = [
  { name: 'oscars_comprehensive_2020_2024', start: 2020, end: 2024 },
  { name: 'oscars_comprehensive_2015_2019', start: 2015, end: 2019 },
  { name: 'oscars_comprehensive_2010_2014', start: 2010, end: 2014 },
  { name: 'oscars_comprehensive_2005_2009', start: 2005, end: 2009 },
  { name: 'oscars_comprehensive_2000_2004', start: 2000, end: 2004 },
  { name: 'oscars_comprehensive_1990s', start: 1990, end: 1999 },
  { name: 'oscars_comprehensive_1980s', start: 1980, end: 1989 },
  { name: 'oscars_comprehensive_1970s', start: 1970, end: 1979 },
  { name: 'oscars_comprehensive_1960s', start: 1960, end: 1969 },
  { name: 'oscars_comprehensive_1950s', start: 1950, end: 1959 },
  { name: 'oscars_comprehensive_1940s', start: 1940, end: 1949 },
  { name: 'oscars_comprehensive_1930s', start: 1930, end: 1939 },
  { name: 'oscars_comprehensive_1920s', start: 1928, end: 1929 }
];

fileGroups.forEach(group => {
  const data = [];
  for (let year = group.start; year <= group.end; year++) {
    if (byCeremony[year]) {
      data.push(...byCeremony[year]);
    }
  }
  
  if (data.length > 0) {
    const filename = `data/${group.name}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Created ${filename} with ${data.length} nominations`);
  }
});

console.log('\n🎉 Transformation complete!');
