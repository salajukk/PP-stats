# PP Stats

Selainpohjainen koripallotilastosovellus, joka hakee datan Google Apps Script -rajapinnasta ja näyttää nykykauden sekä kaikkien kausien pelaaja- ja joukkuetilastoja Chart.js:llä.

## Rakenne

```text
PP-stats/
├── index.html
├── css/
│   ├── styles.css       # yleinen ulkoasu ja responsiivisuus
│   └── history.css      # pelaaja- ja joukkuehistorian tyylit
├── js/
│   ├── utils.js         # yhteiset apufunktiot (escaping, nullable numerot)
│   ├── data.js          # datan lataus, kenttäkartta ja nykykauden aggregointi
│   ├── charts.js        # radar-, pistekehitys-, joukkue- ja heittokaaviot
│   ├── tables.js        # tilastotaulukot, suodatus, lajittelu ja CSV-export
│   ├── history.js       # kaikkien kausien pelaaja- ja joukkuehistoria
│   └── app.js           # sovelluksen käynnistys ja näkymien koordinointi
├── tests/
│   └── logic.test.cjs   # datalogiikan regressiotestit
└── .github/workflows/
    ├── quality.yml          # syntax- ja logiikkatestit
    ├── deploy-pages.yml     # tuotanto + preview GitHub Pagesiin
    └── preview-update.yml   # preview-päivityksen deploy-signaali
```

Sovellus on tarkoituksella ilman frameworkia tai build-vaihetta. Vanilla JavaScript + GitHub Pages on nykyiseen kokoon riittävä ja pitää ylläpidon yksinkertaisena.

## Data

Data haetaan `js/data.js`-tiedostossa määritellystä Google Apps Script -endpointista. Sovellus käsittelee vain rivejä, joiden `Sarja/Harjoitus` on `Sarja`.

Nykykauden PPG lasketaan kaikista pelaajan peleistä. Lisätilastot (esim. RPG, APG, FG%, EFF) lasketaan vain niistä peleistä, joissa lisätilastokentät on oikeasti kirjattu. Historiallisissa joukkuelaskelmissa puuttuvaa lopputulosta ei tulkita nollaksi.

## Kehitys ja testaus

Paikallinen staattinen palvelin:

```bash
python -m http.server 8000
```

JavaScriptin syntax-tarkistus:

```bash
for f in js/*.js; do node --check "$f"; done
```

Logiikkatestit:

```bash
node --test tests/logic.test.cjs
```

GitHub Actions ajaa samat tarkistukset pull requesteille ja ennen Pages-julkaisua.

## Branchit ja julkaisu

- `main` = tuotanto: `https://salajukk.github.io/PP-stats/`
- `preview` = testiversio: `https://salajukk.github.io/PP-stats/preview/`
- suuret muutokset tehdään lyhytikäisissä `feature/...` tai `chore/...` brancheissa

Tyypillinen prosessi:

```text
feature/chore branch → testit → preview → käyttäjätesti → PR → main
```

Feature- ja chore-branchit poistetaan mergeämisen jälkeen. `main` ja `preview` ovat ainoat pitkäikäiset branchit.

## Huomioita

- CSV-export säilyttää aidot nolla-arvot (esim. 0 pistettä) tyhjän solun sijaan.
- Apps Scriptin ISO-muotoon serialisoima peliaika muunnetaan takaisin minuuteiksi.
- Advanced stats -tunnistus perustuu kenttien olemassaoloon, joten täysin nollatilastoitu peli voidaan erottaa puuttuvasta tilastodatasta silloin, kun rajapinta säilyttää tyhjät arvot tyhjinä.
- Dynaamiset taulukkotekstit lisätään DOMiin `textContent`-pohjaisesti, jotta Sheetistä tulevaa tekstiä ei tulkita HTML:ksi.
