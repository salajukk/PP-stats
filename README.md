# PP Stats

Selainpohjainen koripallotilastosovellus, joka hakee datan Google Apps Script -rajapinnasta ja näyttää pelaaja- ja joukkuetilastoja Chart.js:llä.

## Rakenne

```text
PP-stats/
├── index.html          # käyttöliittymän rakenne
├── css/
│   └── styles.css      # ulkoasu ja responsiivisuus
└── js/
    ├── data.js         # datan lataus, kenttäkartta ja perusaggregointi
    ├── charts.js       # radar-, pistekehitys-, joukkue- ja heittokaaviot
    ├── tables.js       # tilastotaulukot, suodatus, lajittelu ja CSV-export
    └── app.js          # sovelluksen käynnistys ja näkymien koordinointi
```

## Data

Data haetaan `js/data.js`-tiedostossa määritellystä Google Apps Script -endpointista. Sovellus käsittelee vain rivejä, joiden `Sarja/Harjoitus` on `Sarja`.

## Refaktoroinnissa korjattua

- CSS ja JavaScript erotettu monoliittisesta `index.html`-tiedostosta.
- CSV-export säilyttää aidot nolla-arvot (esim. 0 pistettä) tyhjän solun sijaan.
- Apps Scriptin ISO-muotoon serialisoima peliaika muunnetaan takaisin minuuteiksi ja 24 tunnin ylitys kierretään oikein.
- Advanced stats -tunnistus perustuu kenttien olemassaoloon, joten täysin nollatilastoitu peli voidaan erottaa puuttuvasta tilastodatasta.
- Refaktoroinnin katselmuksessa varmistettiin, että pistekehityksen joukkuekeskiarvo, TOTAL-rivit, lajittelu, korostukset ja täysi CSV-sarakemääritys säilyvät.

## Kehitys

Sovellus on staattinen, joten sen voi ajaa millä tahansa staattisia tiedostoja tarjoavalla HTTP-palvelimella. GitHub Pages sopii julkaisuun.

Pidä `main` vakaana ja tee suuremmat muutokset omissa brancheissa ennen yhdistämistä.
