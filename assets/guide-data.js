/*
 * guide-data.js — curated Goa guide used by explore.html
 * Researched Sep 2026 from Google/Zomato/Tripadvisor/Restaurant Guru/Wanderlog listings and local blogs.
 * "score" is our curated 0–10 "worth your time" estimate. Ratings change — every card has a
 * ⚡ Live check button that pulls today's Google rating + newest reviews (when the backend has a Places key).
 *
 * Fields: n name · t type · a area · w where · vibe (ambience) · try · best (time) · price · tip · score · rating (optional, with source)
 * Types: cafe · restaurant · nightlife · beach · sight · activity · market
 * Areas: baga · north · candolim · panjim · south · highway
 * Add your own entries freely — the page picks them up automatically.
 */
window.GOA_AREAS = [
  { id: 'baga', label: 'Baga · Arpora · Calangute', stay: 'Stay 1', keys: ['baga', 'arpora', 'calangute', 'tito'] },
  { id: 'north', label: 'Anjuna · Vagator · Assagao · Siolim', stay: 'Stay 2', keys: ['anjuna', 'vagator', 'assagao', 'siolim', 'chapora', 'morjim', 'baaree', 'unvrs'] },
  { id: 'candolim', label: 'Candolim · Sinquerim · Aguada · Nerul', stay: '', keys: ['candolim', 'sinquerim', 'aguada', 'nerul', 'lpk'] },
  { id: 'panjim', label: 'Panjim · Old Goa', stay: '', keys: ['panjim', 'panaji', 'fontainhas', 'old goa'] },
  { id: 'south', label: 'Agonda · Palolem · Cola · Cabo de Rama', stay: 'Stay 3', keys: ['agonda', 'palolem', 'cola', 'cabo', 'canacona', 'patnem'] },
  { id: 'highway', label: 'Pune ⇄ Goa highway', stay: '', keys: ['pune', 'kolhapur'] }
];

window.GOA_TYPES = {
  cafe: '☕ Café', restaurant: '🍽️ Restaurant', nightlife: '🔥 Nightlife', beach: '🏖️ Beach',
  sight: '🏰 Sight', activity: '🛶 Activity', market: '🛍️ Market'
};

window.GOA_ADVISORY = 'Late September is the tail end of the monsoon. Some beach shacks, flea markets and water sports only reopen in October–November, and red flags on a beach mean no swimming. Before you drive out, use ⚡ Live check or call to confirm a place is open.';

window.GOA_GUIDE = [
  /* ── Baga · Arpora · Calangute (Stay 1) ── */
  { n: "Britto's", t: 'restaurant', a: 'baga', w: 'Baga beach', vibe: 'Classic, busy beachfront restaurant — loud, happy, family crowd.', try: 'Prawn curry rice, crab xec xec, bebinca', best: 'Lunch', price: '₹₹', tip: 'Very busy at weekends — go before 1 PM.', score: 7.2 },
  { n: 'Souza Lobo', t: 'restaurant', a: 'baga', w: 'Calangute beach', vibe: 'Heritage seafood spot on the sand, old-school Goan service.', try: 'Lobster, fish curry rice, prawn rava fry', best: 'Late lunch / sunset', price: '₹₹', tip: 'Ask for the catch of the day and its price before ordering.', score: 7.4 },
  { n: 'Go With The Flow', t: 'restaurant', a: 'baga', w: 'Baga creek', vibe: 'Garden & terrace by the creek — calm, romantic, away from Baga noise.', try: 'Global menu, cocktails', best: '❤️ Dinner for two', price: '₹₹₹', tip: 'Book a garden table for the evening.', score: 8.0 },
  { n: 'Toro Toro', t: 'restaurant', a: 'baga', w: 'Arpora', vibe: 'Lively pan-Asian on several levels with a river view.', try: 'Sushi, dim sum, Asian cocktails', best: 'Dinner', price: '₹₹₹', tip: 'Upper level has the better view.', score: 7.3 },
  { n: 'A Reverie', t: 'restaurant', a: 'baga', w: 'Calangute', vibe: 'Plush modern-European fine dining — a proper date night.', try: 'Smoked duck breast, calamari tempura', best: '❤️ Date night', price: '₹₹₹₹', tip: 'Dress up a little; reserve.', score: 7.8 },
  { n: 'Pousada by the Beach', t: 'restaurant', a: 'baga', w: 'Calangute', vibe: 'Beachfront Goan-Portuguese seafood.', try: 'Goan fish curry, surmai tava fry, lobster', best: 'Lunch', price: '₹₹', tip: 'Good for a long lazy lunch on the sand.', score: 7.2 },
  { n: 'Infantaria', t: 'cafe', a: 'baga', w: 'Calangute–Baga road', vibe: 'Bakery-café around since 1989; easy, bustling breakfast spot.', try: 'Croissants, quiche, Death by Chocolate', best: '☕ Breakfast', price: '₹₹', tip: 'Grab bakes to go for the beach.', score: 7.3 },
  { n: "Tito's Lane", t: 'nightlife', a: 'baga', w: 'Baga', vibe: 'Baga’s party street — clubs and bars wall-to-wall, crowded and loud.', try: "Bar-hop; Tito's / Mambo's", best: '10 PM onwards', price: '₹₹₹', tip: 'Check cover charges at the door; keep valuables close; take a cab back.', score: 6.5 },

  /* ── Anjuna · Vagator · Assagao · Siolim (Stay 2) ── */
  { n: 'Vinayak Family Restaurant', t: 'restaurant', a: 'north', w: 'Assagao', vibe: 'Simple, packed local joint — all about the seafood.', try: 'Fish thali, prawn rava fry, kingfish', best: 'Lunch (go early)', price: '₹₹', tip: 'Closes in the afternoon and reopens around 7 PM; expect a queue.', score: 8.8, rating: '4.9 · 10k+ votes (Restaurant Guru)' },
  { n: 'Antares', t: 'restaurant', a: 'north', w: 'Vagator cliff', vibe: 'Clifftop beach club with a huge sea view — stylish and buzzy at sunset.', try: 'Pork belly, seafood platter', best: '🌅 Sunset dinner', price: '₹₹₹₹', tip: 'Book a sunset table; it gets windy on the edge.', score: 8.2 },
  { n: 'Thalassa', t: 'restaurant', a: 'north', w: 'Vagator', vibe: 'Greek tavern vibes and sunset views — great for a group.', try: 'Souvlaki, moussaka, mezze', best: '🌅 Sunset + group dinner', price: '₹₹₹', tip: 'Reserve a sunset table for 5 on 29 or 30 Sep.', score: 8.3 },
  { n: 'Artjuna', t: 'cafe', a: 'north', w: 'Anjuna / Assagao', vibe: 'Leafy garden café with a boutique and yoga — a whole mood.', try: 'Shakshuka, smoothie bowls, Mediterranean platters', best: '☕ Breakfast / brunch', price: '₹₹', tip: 'Browse the store while you wait.', score: 8.0 },
  { n: 'Como Agua', t: 'restaurant', a: 'north', w: 'Vagator', vibe: 'Pizzeria with Roman-style architecture inspired by a weaver bird’s nest; rooftop and garden seating.', try: 'Wood-fired pizza, lemon spaghetti, Como honey toast', best: 'Lunch / dinner (opens 12:30 PM)', price: '₹₹ · ~₹1,500 for two', tip: 'Ask for rooftop seating at sunset.', score: 7.3, rating: '4.3 · 81 ratings (District)' },
  { n: 'Baaree by the Sea', t: 'nightlife', a: 'north', w: 'Vagator / Anjuna beachfront', vibe: 'Beachfront restaurant & lounge bar known for sundowners that roll into the night.', try: 'Cocktails, sundowner platters', best: '🌅 Sunset → late', price: '₹₹₹', tip: 'Reserve on Zomato/District for your 26 Sep night.', score: 7.5 },
  { n: 'UNVRS Goa', t: 'nightlife', a: 'north', w: 'Anjuna (Casuia)', vibe: 'Big, glossy club — Bollywood nights, EDM, VIP tables, live DJs.', try: 'Bollywood night; VIP table for a group', best: '10 PM – 5 AM', price: '₹₹₹₹', tip: 'Check the night’s event and entry/cover on their Instagram; carry ID; cab both ways.', score: 7.3 },
  { n: "Goa's Ark", t: 'restaurant', a: 'north', w: 'Anjuna', vibe: 'Mediterranean mezze in a relaxed setting; organic, locally sourced.', try: 'Mezze platter, grills', best: 'Dinner', price: '₹₹₹', tip: 'Good veg options.', score: 7.5 },
  { n: 'Mango Tree', t: 'restaurant', a: 'north', w: 'Vagator main road', vibe: 'Easy, affordable, always open-ish — everyone finds something.', try: 'Thali, Goan curries, cold beer', best: 'Any time', price: '₹', tip: 'Safe fallback when you’re tired.', score: 6.8 },
  { n: 'Baba Au Rhum', t: 'cafe', a: 'north', w: 'Anjuna', vibe: 'European café in the green lanes — slow and pretty.', try: 'Bakes, coffee, pasta', best: '☕ Lazy breakfast', price: '₹₹', tip: 'Scooter-friendly lanes; parking is limited.', score: 7.5 },
  { n: 'Kefi', t: 'cafe', a: 'north', w: 'Assagao', vibe: 'Lebanese café-bistro-bar, always buzzing, always reliable.', try: 'Pita & hummus, grilled meats', best: 'Lunch / dinner', price: '₹₹', tip: 'Works for coffee or a full meal.', score: 7.6 },
  { n: 'The ASSA House', t: 'restaurant', a: 'north', w: 'Assagao', vibe: 'Styled but relaxed villa restaurant — feels like an occasion.', try: 'Wood-fired pizza, cocktails', best: 'Dinner', price: '₹₹₹', tip: '', score: 7.4 },
  { n: 'G-Shot Coffee Roastery', t: 'cafe', a: 'north', w: 'Assagao', vibe: 'Calm, green, great coffee — good for slow mornings.', try: 'Pour-over, cold brew', best: '☕ Morning', price: '₹₹', tip: '', score: 7.3 },
  { n: 'Bloom & Brew (NOFC)', t: 'cafe', a: 'north', w: 'Assagao', vibe: 'Easy, aesthetic café to sit in for a while.', try: 'Specialty coffee, smoothie bowls', best: '☕ Morning', price: '₹₹', tip: '', score: 7.2 },
  { n: 'Hello Sunshine', t: 'cafe', a: 'north', w: 'Assagao', vibe: 'Bright, laid-back breakfast spot.', try: 'Pancakes, smoothie bowls', best: '☕ Breakfast', price: '₹₹', tip: '', score: 7.0 },
  { n: "Noronha's Corner", t: 'restaurant', a: 'north', w: 'Assagao', vibe: 'No-frills, iconic late-night snack corner.', try: 'Chorizo pav, poi', best: 'Late-night bite', price: '₹', tip: 'Perfect after the club.', score: 7.5 },
  { n: 'Hawratt Khanavaal', t: 'restaurant', a: 'north', w: 'Siolim riverside', vibe: 'Modest riverside eatery — the food is the whole point.', try: 'Fish thali', best: 'Lunch', price: '₹', tip: 'Cheap and very local.', score: 7.4 },
  { n: 'Sazietá Boulangerie', t: 'cafe', a: 'north', w: 'Siolim', vibe: 'Soft mornings, fresh bakes.', try: 'Croissants, pastries', best: '☕ Breakfast', price: '₹₹', tip: 'Pick up breakfast for the villa.', score: 7.2 },
  { n: 'Hoops Coffee', t: 'cafe', a: 'north', w: 'Siolim', vibe: 'Quieter, less crowded coffee stop.', try: 'Cappuccino, iced coffee', best: '☕ Morning', price: '₹', tip: '', score: 6.9 },

  /* ── Candolim · Sinquerim · Aguada · Nerul ── */
  { n: "Mikey's Place", t: 'restaurant', a: 'candolim', w: 'Fort Aguada Rd, Sinquerim', vibe: 'Popular, friendly seafood place right on the way to the fort.', try: 'Goan prawn curry, butter-garlic squid', best: 'Lunch after Aguada', price: '₹₹', tip: 'Perfect for 27 or 30 Sep.', score: 8.0, rating: '4.7 · 21k+ ratings (Justdial)' },
  { n: 'Yazu – Pan Asian Beach Club', t: 'restaurant', a: 'candolim', w: 'Marquis Beach Resort, Candolim', vibe: 'Beachfront pan-Asian with killer sunsets.', try: 'Sushi, dim sum, ramen, Thai curries', best: '🌅 Sunset', price: '₹₹₹₹', tip: 'One of the priciest in Candolim — worth it for sunset drinks.', score: 7.6 },
  { n: 'Calamari Bathe & Binge', t: 'restaurant', a: 'candolim', w: 'Candolim beach road', vibe: 'Busy beach shack-style seafood.', try: 'Calamari, fish fry', best: 'Beach lunch', price: '₹₹', tip: '', score: 7.2, rating: '4.4 · 12k+ ratings (Justdial)' },
  { n: 'Seven Rivers', t: 'restaurant', a: 'candolim', w: 'Sinquerim', vibe: 'Brewpub with good value snacks.', try: 'Beer flight', best: 'Before UNVRS / LPK', price: '₹₹', tip: '', score: 7.4 },
  { n: 'LPK Waterfront', t: 'nightlife', a: 'candolim', w: 'Nerul riverside', vibe: 'Iconic open-air club by the river with sculpted cave-like architecture.', try: 'Big-night DJ events', best: '10 PM onwards', price: '₹₹₹', tip: 'Entry and cover change by night; check first. Cab both ways.', score: 7.5 },

  /* ── Panjim · Old Goa ── */
  { n: 'Viva Panjim', t: 'restaurant', a: 'panjim', w: 'Fontainhas', vibe: 'Family-run heritage house — tiles, chandeliers, proper Goan food.', try: 'Pork vindaloo, xacuti, prawn curry', best: '👨‍👩‍👧 Friends lunch (29 Sep)', price: '₹₹', tip: 'Small place — arrive early, then walk the Latin Quarter.', score: 8.3 },
  { n: 'Ritz Classic', t: 'restaurant', a: 'panjim', w: 'Panjim', vibe: 'Local legend for fish thali — no-nonsense and fast.', try: 'Fish thali, prawn rava fry', best: 'Lunch', price: '₹₹', tip: 'Expect a queue at lunch.', score: 8.0 },
  { n: 'Kokni Kanteen', t: 'restaurant', a: 'panjim', w: 'Panjim', vibe: 'Cosy Konkani kitchen.', try: 'Fish thali', best: 'Lunch', price: '₹₹', tip: '', score: 7.8 },
  { n: 'The Black Sheep Bistro', t: 'restaurant', a: 'panjim', w: 'Villa Braganca, Panjim', vibe: 'Stylish modern bistro in an old villa.', try: 'Small plates, cocktails', best: 'Lunch / dinner', price: '₹₹₹', tip: '', score: 8.0 },
  { n: "Fisherman's Wharf", t: 'restaurant', a: 'panjim', w: 'Panjim riverside', vibe: 'Big, lively Goan seafood restaurant by the river.', try: 'Butter-garlic prawns, fish curry rice, Goan pickle', best: 'Group dinner', price: '₹₹₹', tip: '', score: 7.8 },
  { n: 'Cafe Bhonsle', t: 'cafe', a: 'panjim', w: 'Panjim', vibe: 'Always-busy local institution for snacks.', try: 'Alsande & batata bhaji with undo, mirchi bhaji', best: 'Breakfast / snack', price: '₹', tip: '', score: 7.6 },
  { n: 'Fontainhas (Latin Quarter)', t: 'sight', a: 'panjim', w: 'Panjim', vibe: 'Colourful Portuguese-era houses and narrow lanes — the most photogenic walk in Goa.', try: 'Walk + Our Lady of the Immaculate Conception Church', best: 'Morning or late afternoon', price: 'Free', tip: 'Park near the church and walk.', score: 8.5 },
  { n: 'Basilica of Bom Jesus', t: 'sight', a: 'panjim', w: 'Old Goa', vibe: 'UNESCO-listed baroque basilica with St Francis Xavier’s relics.', try: 'Basilica + Se Cathedral across the road', best: 'Morning', price: 'Free', tip: 'Dress modestly (shoulders/knees covered). ~20 min from Panjim.', score: 8.4 },
  { n: 'Mandovi river cruise', t: 'activity', a: 'panjim', w: 'Panjim jetty', vibe: 'Cheesy but fun 1-hour evening cruise with music and dance.', try: 'Sunset cruise', best: 'Evening', price: '₹', tip: 'Tickets at the jetty; sit on the upper deck.', score: 6.8 },

  /* ── South: Agonda · Palolem · Cola · Cabo de Rama (Stay 3) ── */
  { n: 'Zest', t: 'restaurant', a: 'south', w: 'Agonda (also Palolem)', vibe: 'Healthy, mostly vegan global food — consistently the top pick in the area.', try: 'Buddha bowls, curries, smoothies', best: 'Lunch / dinner', price: '₹₹', tip: '', score: 8.0 },
  { n: 'The Bay Agonda', t: 'restaurant', a: 'south', w: 'South end of Agonda beach', vibe: 'Relaxed beachfront at the quiet end of the bay.', try: 'Tandoori prawns, grilled fish, calamari', best: '🌅 Sunset dinner', price: '₹₹', tip: '', score: 7.5 },
  { n: 'Simrose', t: 'restaurant', a: 'south', w: 'Agonda', vibe: 'Beachfront resort restaurant, polished.', try: 'Seafood, continental', best: 'Dinner', price: '₹₹₹', tip: '', score: 7.3 },
  { n: "Zac's", t: 'cafe', a: 'south', w: 'Agonda', vibe: 'Friendly café for a light meal.', try: 'Light lunch', best: 'After Cola', price: '₹', tip: '', score: 7.0 },
  { n: "Baba's Little Italy", t: 'restaurant', a: 'south', w: 'Palolem (~10 km)', vibe: 'Buzzy Italian with a pizza oven and good music.', try: 'Pizza, mud crab in garlic cream', best: 'Pizza night', price: '₹₹', tip: '', score: 7.3 },
  { n: 'Cafe Inn', t: 'cafe', a: 'south', w: 'Palolem', vibe: 'Coffee and Mediterranean café behind the rickshaw stand.', try: 'Coffee, English breakfast, bowls', best: '☕ Breakfast', price: '₹₹', tip: '', score: 7.2 },
  { n: 'Agonda Beach', t: 'beach', a: 'south', w: 'Agonda', vibe: 'Long, quiet, clean bay — the calmest big beach in Goa.', try: 'Sunset walk', best: 'Sunset', price: 'Free', tip: 'Olive Ridley turtles nest here in winter; keep lights low on the sand.', score: 8.6 },
  { n: 'Cola Beach & lagoon', t: 'beach', a: 'south', w: 'Cola, Canacona', vibe: 'Secluded beach where a freshwater lagoon meets the sea — postcard-pretty.', try: 'Kayaking on the lagoon', best: 'Morning', price: 'Kayaks ~₹300–600/hr', tip: 'Last stretch of road is narrow and bumpy; kayaks are run by the resorts and may not be operating until the season starts — call ahead.', score: 8.5 },
  { n: 'Cabo de Rama Fort', t: 'sight', a: 'south', w: 'Canacona', vibe: 'Cliff-top fort ruins with a small church and wide sea views.', try: 'Walk the ramparts', best: 'Late morning / sunset', price: 'Free', tip: 'Wear shoes and carry water; little shade.', score: 8.0 },
  { n: 'Palolem Beach', t: 'beach', a: 'south', w: 'Palolem', vibe: 'Pretty crescent bay, livelier than Agonda.', try: 'Kayak, sunset, shacks', best: 'Evening', price: 'Free', tip: '', score: 8.0 },

  /* ── North beaches & sights ── */
  { n: 'Chapora Fort', t: 'sight', a: 'north', w: 'Vagator', vibe: 'Ruined hill fort with sweeping views over Vagator and the Chapora river.', try: 'Sunset from the walls', best: '~5 PM', price: 'Free', tip: 'Short steep climb — wear proper shoes.', score: 8.2 },
  { n: 'Vagator Beach', t: 'beach', a: 'north', w: 'Vagator', vibe: 'Red cliffs and a dramatic bay — the best sunsets in the north.', try: 'Sunset from the cliffs', best: 'Sunset', price: 'Free', tip: '', score: 8.0 },
  { n: 'Anjuna Beach', t: 'beach', a: 'north', w: 'Anjuna', vibe: 'Rocky, boho beach lined with cafés.', try: 'Café-hopping, sunset', best: 'Evening', price: 'Free', tip: 'Rocky — swimming is not great.', score: 7.2 },
  { n: 'Anjuna flea market / Arpora night market', t: 'market', a: 'north', w: 'Anjuna (Wed) / Arpora (Sat)', vibe: 'Famous seasonal markets.', try: 'Shopping, food stalls', best: 'Season only', price: '₹', tip: 'These usually run from about November; unlikely to be on during your dates. Mapusa’s Friday market is the year-round alternative.', score: 4.0 },
  { n: 'Baga Beach', t: 'beach', a: 'baga', w: 'Baga', vibe: 'Lively, crowded party beach with shacks and water sports (in season).', try: 'Shacks, people-watching', best: 'Evening', price: 'Free', tip: 'Busy; watch the flags before swimming.', score: 6.8 },
  { n: 'Calangute Beach', t: 'beach', a: 'baga', w: 'Calangute', vibe: 'The busiest beach in Goa.', try: 'Quick walk', best: 'Early morning', price: 'Free', tip: 'Crowded — Candolim next door is calmer.', score: 6.3 },
  { n: 'Candolim & Sinquerim beaches', t: 'beach', a: 'candolim', w: 'Candolim', vibe: 'Wide, calmer stretch with good shacks.', try: 'Long walk, sunset', best: 'Sunset', price: 'Free', tip: '', score: 7.4 },
  { n: 'Fort Aguada', t: 'sight', a: 'candolim', w: 'Sinquerim', vibe: '17th-century Portuguese fort and lighthouse above the sea.', try: 'Lighthouse and ramparts', best: 'Before 5 PM', price: '₹ (small entry)', tip: 'Go in the late afternoon then drop to Sinquerim for sunset.', score: 8.0 },

  /* ── Highway ── */
  { n: 'Hotel Opal, Kolhapur', t: 'restaurant', a: 'highway', w: 'Kolhapur', vibe: 'Kolhapur favourite for fiery mutton thalis.', try: 'Tambda & pandhra rassa mutton thali', best: '🍽️ Lunch on the drive', price: '₹₹', tip: 'Confirm timings and route before leaving Pune.', score: 7.8 }
];
