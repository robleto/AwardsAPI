# Golden Globes Integration Plan

## Data Source
- **Dataset**: Golden Globe Awards, 1944 - 2020
- **URL**: https://www.kaggle.com/datasets/unanimad/golden-globe-awards
- **License**: CC0 Public Domain
- **Size**: 838.36 kB
- **Format**: CSV
- **Coverage**: 1944-2020 (77 years)

## Dataset Structure
File: `golden_globe_awards.csv`
- 7 columns
- All nominations and winners
- Covers both Film and TV categories

## Integration Steps

### 1. Download Dataset
```bash
# Manual download from Kaggle (requires account)
# URL: https://www.kaggle.com/datasets/unanimad/golden-globe-awards
# Save to: data/golden_globe_awards.csv
```

### 2. Expected Columns
Based on similar award datasets:
- `year_film` or `year` - Film release year
- `year_award` or `ceremony` - Award ceremony year
- `category` - Award category
- `nominee` - Nominee name (person)
- `film` - Film title
- `win` - Boolean or Yes/No indicator

### 3. Film Categories to Include
Focus on major film categories (exclude TV):
- Best Motion Picture - Drama
- Best Motion Picture - Musical or Comedy
- Best Director - Motion Picture
- Best Actor - Drama
- Best Actor - Musical or Comedy
- Best Actress - Drama
- Best Actress - Musical or Comedy
- Best Supporting Actor - Motion Picture
- Best Supporting Actress - Motion Picture
- Best Screenplay - Motion Picture
- Best Original Score - Motion Picture
- Best Original Song - Motion Picture
- Best Foreign Language Film / Best Motion Picture - Non-English Language
- Best Animated Feature Film

### 4. Transformation Script
Create `scripts/transform-golden-globes.js`:
- Parse CSV
- Filter film-only categories
- Normalize to match our schema:
  - ceremony_name: "Golden Globe Awards"
  - year (ceremony year)
  - category
  - film title
  - nominees (people)
  - winner flag
- Handle special cases:
  - Split Drama/Musical-Comedy acting categories
  - Map old category names to current
  - Handle ties/joint winners

### 5. Import Script
Create `scripts/import-golden-globes.js`:
- Load transformed JSON
- Insert into `ceremonies` table
- Link to `award_categories`
- Create `nominations` records
- Link people via `nomination_people`

### 6. API Updates
Update endpoints to support:
- Filter by ceremony: `?ceremony=golden-globes` or `ceremony=oscars`
- Multi-ceremony queries for same film
- Cross-ceremony statistics

## Data Quality Checks
- Verify year ranges: 1944-2020
- Count nominations per category/year
- Validate winner flags
- Check for duplicate entries
- IMDb ID matching for films

## Next Steps After Download
1. Inspect actual column names and structure
2. Build transformation script
3. Test with sample data (one decade)
4. Import full dataset
5. Update API documentation
