// Curated real-card showcase for the public home page.
// Ported from the legacy app's server/config/carousel-cards.js. Images are the
// pre-optimized (~300px) scans hosted on Azure Blob. TODO: repoint `image` to
// Supabase Storage once the asset copy (P1) lands — keep this the single source.
//
// Rule: NO graded/slabbed cards here (they don't display well). The legacy
// Mickey Mantle entry (#90212) was a PSA slab and has been removed.
export type ShowcaseCard = {
  cardId: number;
  image: string;
  player: string;
  series: string;
  year: number;
  number: string;
  href: string;
};

export const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    "cardId": 56304,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/56304_front.jpg",
    "player": "Roberto Clemente",
    "series": "1959 Topps Baseball",
    "year": 1959,
    "number": "478",
    "href": "/cards/56304"
  },
  {
    "cardId": 56340,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/56340_front.jpg?v=1762995032961",
    "player": "Bob Gibson",
    "series": "1959 Topps Baseball",
    "year": 1959,
    "number": "514",
    "href": "/cards/56340"
  },
  {
    "cardId": 774420,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/774420_front.jpg",
    "player": "Early Wynn",
    "series": "1960 Topps Baseball",
    "year": 1960,
    "number": "1",
    "href": "/cards/774420"
  },
  {
    "cardId": 774428,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/774428_front.jpg?v=1762995061709",
    "player": "Ernie Banks",
    "series": "1960 Topps Baseball",
    "year": 1960,
    "number": "10",
    "href": "/cards/774428"
  },
  {
    "cardId": 774486,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/774486_front.jpg",
    "player": "Bob Gibson",
    "series": "1960 Topps Baseball",
    "year": 1960,
    "number": "73",
    "href": "/cards/774486"
  },
  {
    "cardId": 778554,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/778554_front.jpg?v=1763311852865",
    "player": "Nolan Ryan",
    "series": "1981 Donruss Baseball",
    "year": 1981,
    "number": "260",
    "href": "/cards/778554"
  },
  {
    "cardId": 774367,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/774367_front.jpg?v=1762995353031",
    "player": "Ryne Sandberg",
    "series": "1983 Topps Baseball",
    "year": 1983,
    "number": "83",
    "href": "/cards/774367"
  },
  {
    "cardId": 904939,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/904939_front.jpg",
    "player": "Ken Griffey Jr",
    "series": "1989 Upper Deck",
    "year": 1989,
    "number": "1",
    "href": "/cards/904939"
  },
  {
    "cardId": 904963,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/904963_front.jpg",
    "player": "Randy Johnson",
    "series": "1989 Upper Deck",
    "year": 1989,
    "number": "25",
    "href": "/cards/904963"
  },
  {
    "cardId": 982523,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/982523_front.jpg?v=1767735658246",
    "player": "Bob Gibson",
    "series": "2025 Topps Allen & Ginter Chrome",
    "year": 2025,
    "number": "61",
    "href": "/cards/982523"
  },
  {
    "cardId": 982525,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/982525_front.jpg?v=1767735886095",
    "player": "Stan Musial",
    "series": "2025 Topps Allen & Ginter Chrome",
    "year": 2025,
    "number": "64",
    "href": "/cards/982525"
  },
  {
    "cardId": 1006835,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1006835_front.jpg?v=1767018201473",
    "player": "Satchel Paige",
    "series": "2025 Topps Archives Pink Foilboard",
    "year": 2025,
    "number": "62",
    "href": "/cards/1006835"
  },
  {
    "cardId": 1011896,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1011896_front.jpg?v=1765903371619",
    "player": "Rollie Fingers",
    "series": "2025 Topps Archives '11 Topps Fan Favorites Autographs",
    "year": 2025,
    "number": "11FFA-RF",
    "href": "/cards/1011896"
  },
  {
    "cardId": 1008448,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1008448_front.jpg?v=1767534656255",
    "player": "Mike Trout",
    "series": "2025 Topps Archives Red Hot Foilboard",
    "year": 2025,
    "number": "175",
    "href": "/cards/1008448"
  },
  {
    "cardId": 913196,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/913196_front.jpg?v=1764622729700",
    "player": "Aaron Judge",
    "series": "2022 Topps Allen & Ginter Mini Framed Relics",
    "year": 2022,
    "number": "MFR-AJ",
    "href": "/cards/913196"
  },
  {
    "cardId": 913322,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/913322_front.jpg?v=1764622740285",
    "player": "Aaron Judge",
    "series": "2022 Topps Allen & Ginter Relics B",
    "year": 2022,
    "number": "AGRB-AJ",
    "href": "/cards/913322"
  },
  {
    "cardId": 1007872,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1007872_front.jpg?v=1765902130398",
    "player": "Aaron Judge",
    "series": "2025 Topps Archives Green Foilboard",
    "year": 2025,
    "number": "199",
    "href": "/cards/1007872"
  },
  {
    "cardId": 904131,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/904131_front.jpg?v=1767016727792",
    "player": "Aaron Judge",
    "series": "2025 Topps Holiday Short Prints",
    "year": 2025,
    "number": "H161",
    "href": "/cards/904131"
  },
  {
    "cardId": 980099,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/980099_front.jpg?v=1767532616248",
    "player": "Roki Sasaki",
    "series": "2025 Topps Allen & Ginter Mini A&G Back",
    "year": 2025,
    "number": "92",
    "href": "/cards/980099"
  },
  {
    "cardId": 1015178,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015178_front.jpg?v=1767832976758",
    "player": "Carlos Correa",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "629",
    "href": "/cards/1015178"
  },
  {
    "cardId": 1007949,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1007949_front.jpg?v=1767016669453",
    "player": "Austin Riley",
    "series": "2025 Topps Archives Green Foilboard",
    "year": 2025,
    "number": "276",
    "href": "/cards/1007949"
  },
  {
    "cardId": 1007915,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1007915_front.jpg?v=1767469020011",
    "player": "Francisco Alvarez",
    "series": "2025 Topps Archives Green Foilboard",
    "year": 2025,
    "number": "242",
    "href": "/cards/1007915"
  },
  {
    "cardId": 1015258,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015258_front.jpg?v=1767833634939",
    "player": "Kenley Jansen",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "709",
    "href": "/cards/1015258"
  },
  {
    "cardId": 1015252,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015252_front.jpg?v=1767833619502",
    "player": "Anthony Santander",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "703",
    "href": "/cards/1015252"
  },
  {
    "cardId": 940708,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/940708_front.jpg?v=1767470947372",
    "player": "Jackson Chourio",
    "series": "2025 Topps Update Sandglitter",
    "year": 2025,
    "number": "US233",
    "href": "/cards/940708"
  },
  {
    "cardId": 1007009,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1007009_front.jpg?v=1767018242717",
    "player": "Marcelo Mayer",
    "series": "2025 Topps Archives Pink Foilboard",
    "year": 2025,
    "number": "236",
    "href": "/cards/1007009"
  },
  {
    "cardId": 982561,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/982561_front.jpg?v=1767736548071",
    "player": "Marcelo Mayer",
    "series": "2025 Topps Allen & Ginter Chrome",
    "year": 2025,
    "number": "245",
    "href": "/cards/982561"
  },
  {
    "cardId": 1015237,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015237_front.jpg?v=1767833322006",
    "player": "Marcelo Mayer",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "688",
    "href": "/cards/1015237"
  },
  {
    "cardId": 1006957,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1006957_front.jpg?v=1767018282911",
    "player": "Triston Casas",
    "series": "2025 Topps Archives Pink Foilboard",
    "year": 2025,
    "number": "184",
    "href": "/cards/1006957"
  },
  {
    "cardId": 982541,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/982541_front.jpg?v=1767736367963",
    "player": "Luisangel Acuna",
    "series": "2025 Topps Allen & Ginter Chrome",
    "year": 2025,
    "number": "107",
    "href": "/cards/982541"
  },
  {
    "cardId": 1015081,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015081_front.jpg?v=1767832240977",
    "player": "Brett Baty",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "532",
    "href": "/cards/1015081"
  },
  {
    "cardId": 1015175,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015175_front.jpg?v=1767832963165",
    "player": "Cade Horton",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "626",
    "href": "/cards/1015175"
  },
  {
    "cardId": 1015124,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015124_front.jpg?v=1767832595431",
    "player": "Trevor Story",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "575",
    "href": "/cards/1015124"
  },
  {
    "cardId": 1015052,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1015052_front.jpg?v=1767829180717",
    "player": "Harrison Bader",
    "series": "2025 Topps Heritage Chrome Blue Sparkle Refractors",
    "year": 2025,
    "number": "503",
    "href": "/cards/1015052"
  },
  {
    "cardId": 1014191,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/1014191_front.jpg?v=1767838930493",
    "player": "Javier Baez",
    "series": "2025 Topps Heritage Blue Border",
    "year": 2025,
    "number": "542",
    "href": "/cards/1014191"
  },
  {
    "cardId": 877582,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/877582_front.jpg?v=1762994996910",
    "player": "Otto Graham",
    "series": "1950 Bowman Football",
    "year": 1950,
    "number": "45",
    "href": "/cards/877582"
  },
  {
    "cardId": 877410,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/877410_front.jpg?v=1762995006329",
    "player": "Milt Plum",
    "series": "1958 Topps Football",
    "year": 1958,
    "number": "5",
    "href": "/cards/877410"
  },
  {
    "cardId": 982597,
    "image": "https://cardcheckliststorage.blob.core.windows.net/card-optimized/982597_front.jpg?v=1767737714592",
    "player": "Bryan Cranston",
    "series": "2025 Topps Allen & Ginter Chrome",
    "year": 2025,
    "number": "290",
    "href": "/cards/982597"
  }
];
