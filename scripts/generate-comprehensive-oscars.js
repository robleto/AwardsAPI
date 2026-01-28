// Script to generate comprehensive Oscar data for all years 1929-2024
// This uses a simplified approach: for each ceremony, generates the 10 core categories
// with representative nominees based on historical winners and notable films

const fs = require('fs');
const path = require('path');

// Historical Oscar data structure - winners + notable nominees per year
const oscarData = {
  2018: {
    ceremony_name: "90th Academy Awards",
    picture: [
      { title: "The Shape of Water", imdb: "tt5580390", win: true },
      { title: "Three Billboards Outside Ebbing, Missouri", imdb: "tt5027774", win: false },
      { title: "Get Out", imdb: "tt5052448", win: false },
      { title: "Dunkirk", imdb: "tt5013056", win: false },
      { title: "Call Me by Your Name", imdb: "tt5726616", win: false }
    ],
    director: [
      { title: "The Shape of Water", imdb: "tt5580390", name: "Guillermo del Toro", win: true },
      { title: "Dunkirk", imdb: "tt5013056", name: "Christopher Nolan", win: false },
      { title: "Get Out", imdb: "tt5052448", name: "Jordan Peele", win: false },
      { title: "Lady Bird", imdb: "tt4925292", name: "Greta Gerwig", win: false },
      { title: "Phantom Thread", imdb: "tt5776858", name: "Paul Thomas Anderson", win: false }
    ],
    actor: [
      { title: "Darkest Hour", imdb: "tt4555426", name: "Gary Oldman", win: true },
      { title: "Call Me by Your Name", imdb: "tt5726616", name: "Timothée Chalamet", win: false },
      { title: "Phantom Thread", imdb: "tt5776858", name: "Daniel Day-Lewis", win: false },
      { title: "Roman J. Israel, Esq.", imdb: "tt6000478", name: "Denzel Washington", win: false },
      { title: "Get Out", imdb: "tt5052448", name: "Daniel Kaluuya", win: false }
    ],
    actress: [
      { title: "Three Billboards Outside Ebbing, Missouri", imdb: "tt5027774", name: "Frances McDormand", win: true },
      { title: "Lady Bird", imdb: "tt4925292", name: "Saoirse Ronan", win: false },
      { title: "I, Tonya", imdb: "tt5580036", name: "Margot Robbie", win: false },
      { title: "The Post", imdb: "tt6294822", name: "Meryl Streep", win: false },
      { title: "Mudbound", imdb: "tt2396589", name: "Sally Hawkins", win: false }
    ],
    supporting_actor: [
      { title: "Three Billboards Outside Ebbing, Missouri", imdb: "tt5027774", name: "Sam Rockwell", win: true },
      { title: "The Shape of Water", imdb: "tt5580390", name: "Richard Jenkins", win: false },
      { title: "Call Me by Your Name", imdb: "tt5726616", name: "Armie Hammer", win: false },
      { title: "The Florida Project", imdb: "tt5649144", name: "Willem Dafoe", win: false },
      { title: "Three Billboards Outside Ebbing, Missouri", imdb: "tt5027774", name: "Woody Harrelson", win: false }
    ],
    supporting_actress: [
      { title: "I, Tonya", imdb: "tt5580036", name: "Allison Janney", win: true },
      { title: "The Shape of Water", imdb: "tt5580390", name: "Octavia Spencer", win: false },
      { title: "Lady Bird", imdb: "tt4925292", name: "Laurie Metcalf", win: false },
      { title: "Mudbound", imdb: "tt2396589", name: "Mary J. Blige", win: false },
      { title: "The Post", imdb: "tt6294822", name: "Lesley Manville", win: false }
    ],
    original_screenplay: [
      { title: "Get Out", imdb: "tt5052448", names: ["Jordan Peele"], win: true },
      { title: "Lady Bird", imdb: "tt4925292", names: ["Greta Gerwig"], win: false },
      { title: "Three Billboards Outside Ebbing, Missouri", imdb: "tt5027774", names: ["Martin McDonagh"], win: false },
      { title: "The Big Sick", imdb: "tt5462602", names: ["Emily V. Gordon", "Kumail Nanjiani"], win: false },
      { title: "The Shape of Water", imdb: "tt5580390", names: ["Guillermo del Toro", "Vanessa Taylor"], win: false }
    ],
    adapted_screenplay: [
      { title: "Call Me by Your Name", imdb: "tt5726616", names: ["James Ivory"], win: true },
      { title: "The Disaster Artist", imdb: "tt3521126", names: ["Scott Neustadter", "Michael H. Weber"], win: false },
      { title: "Logan", imdb: "tt3315342", names: ["Scott Frank", "James Mangold", "Michael Green"], win: false },
      { title: "Molly's Game", imdb: "tt4209788", names: ["Aaron Sorkin"], win: false },
      { title: "Mudbound", imdb: "tt2396589", names: ["Virgil Williams", "Dee Rees"], win: false }
    ],
    animated: [
      { title: "Coco", imdb: "tt2380307", win: true },
      { title: "The Boss Baby", imdb: "tt3874544", win: false },
      { title: "The Breadwinner", imdb: "tt3901826", win: false },
      { title: "Ferdinand", imdb: "tt3411444", win: false },
      { title: "Loving Vincent", imdb: "tt3262410", win: false }
    ],
    lifetime: [
      { name: "Donald Sutherland" },
      { name: "Agnes Varda" },
      { name: "Charles Burnett" }
    ]
  },
  // Add more years as needed - this is a template
};

// Function to generate data for a single year
function generateYearData(year, data) {
  const entries = [];
  const ceremonyName = data.ceremony_name;

  // Best Picture (5 nominees)
  data.picture.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Picture",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: []
    });
  });

  // Best Director (5 nominees)
  data.director.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Director",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: [{ name: film.name, role: "Director" }]
    });
  });

  // Best Actor
  data.actor.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Actor",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: [{ name: film.name, role: "Actor" }]
    });
  });

  // Best Actress
  data.actress.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Actress",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: [{ name: film.name, role: "Actress" }]
    });
  });

  // Best Supporting Actor
  data.supporting_actor.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Supporting Actor",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: [{ name: film.name, role: "Actor" }]
    });
  });

  // Best Supporting Actress
  data.supporting_actress.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Supporting Actress",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: [{ name: film.name, role: "Actress" }]
    });
  });

  // Original Screenplay
  data.original_screenplay.forEach(film => {
    const people = film.names.map(name => ({ name, role: "Writer" }));
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Original Screenplay",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people
    });
  });

  // Adapted Screenplay
  data.adapted_screenplay.forEach(film => {
    const people = film.names.map(name => ({ name, role: "Writer" }));
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Adapted Screenplay",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people
    });
  });

  // Animated Feature
  data.animated.forEach(film => {
    entries.push({
      ceremony_year: year,
      org_name: "Academy Awards",
      ceremony_name: ceremonyName,
      category_name: "Best Animated Feature",
      imdb_id: film.imdb,
      film_title: film.title,
      is_win: film.win,
      people: []
    });
  });

  // Lifetime Achievement
  if (data.lifetime) {
    data.lifetime.forEach(person => {
      entries.push({
        ceremony_year: year,
        org_name: "Academy Awards",
        ceremony_name: ceremonyName,
        category_name: "Lifetime Achievement",
        imdb_id: null,
        film_title: "Lifetime Achievement",
        is_win: true,
        people: [{ name: person.name, role: "Honoree" }]
      });
    });
  }

  return entries;
}

// Generate files for each year range
console.log('This is a template generator.');
console.log('To complete the dataset, you need to:');
console.log('1. Add historical data for all years 1929-2024 to the oscarData object');
console.log('2. Or use an external API/dataset to fetch this information');
console.log('3. Run this script to generate JSON files for each year range');
console.log('');
console.log('Example usage:');
console.log('const yearData = generateYearData(2018, oscarData[2018]);');
console.log('fs.writeFileSync("data/oscars_2018.json", JSON.stringify(yearData, null, 2));');
