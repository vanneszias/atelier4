export const locales = ["nl", "en"] as const;
export type Locale = (typeof locales)[number];
export function localeFromPath(path: string): Locale {
  return /^\/en(?:\/|$)/.test(path) ? "en" : "nl";
}
export function localizedPath(locale: Locale, path = "/") {
  return `${locale === "en" ? "/en" : ""}${path === "/" ? "/" : path}`;
}
export function safeUrl(value: unknown, fallback = "#") {
  if (
    typeof value !== "string" ||
    value.includes("\\") ||
    /[\x00-\x20]/.test(value)
  )
    return fallback;
  if (/^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(value)) return value;
  return fallback;
}
export const messages = {
  nl: {
    skip: "Ga naar inhoud",
    navigation: "Hoofdnavigatie",
    events: "Events",
    about: "Over ons",
    community: "Community",
    search: "Zoeken",
    searchHint: "Zoek events, verhalen en makers",
    join: "Doe mee",
    privacy: "Privacy",
    preparing: "In voorbereiding",
    dateSoon: "Datum en locatie volgen",
    read: "Ontdek meer",
    empty: "Binnenkort meer. Blijf op de hoogte via de community.",
    name: "Naam",
    email: "E-mailadres",
    discipline: "Jouw kunstvorm",
    disciplineHint: "Muziek, beeldende kunst, dans, woord…",
    help: "Ik wil graag actief meewerken",
    updates: "Houd me op de hoogte van Atelier 4",
    consent:
      "Ik ga akkoord met de verwerking van mijn gegevens voor deze aanvraag.",
    message: "Bericht",
    submit: "Verstuur",
    sending: "Versturen…",
    success: "Bedankt! We hebben je aanvraag ontvangen.",
    error: "Dat lukte niet. Controleer je gegevens en probeer opnieuw.",
    next: "Volgende",
    previous: "Vorige",
    contact: "Contact",
    newsletter: "Blijf op de hoogte",
    artist: "Stel jezelf voor",
    registration: "Inschrijven",
    event: "Event",
    selectEvent: "Kies een event",
    unavailable: "Inschrijvingen zijn nog niet geopend.",
    news: "Verhalen",
    artists: "Makers",
    gallery: "Galerij",
    footer: "Een plek voor jonge mensen, Jezus en kunst.",
    cookies: "Anonieme bezoekersstatistieken",
    analyticsText:
      "Mogen we OpenPanel gebruiken om te begrijpen hoe deze website wordt bezocht? Formuliergegevens worden nooit meegestuurd.",
    accept: "Toestaan",
    decline: "Nee, bedankt",
    analyticsSettings: "Privacyvoorkeuren",
    notFound: "Deze pagina bestaat niet",
    home: "Terug naar het begin",
    published: "Gepubliceerd",
    noResults: "Geen resultaten gevonden.",
    query: "Zoekterm",
    required: "Verplicht",
    back: "Terug",
    artistConsent:
      "Mijn aanvraag is privé. Mijn profiel wordt alleen gepubliceerd na overleg.",
    preview: "Staging · testomgeving",
  },
  en: {
    skip: "Skip to content",
    navigation: "Main navigation",
    events: "Events",
    about: "About",
    community: "Community",
    search: "Search",
    searchHint: "Search events, stories and artists",
    join: "Join in",
    privacy: "Privacy",
    preparing: "In preparation",
    dateSoon: "Date and location to follow",
    read: "Discover more",
    empty: "More is on its way. Join the community to stay in the loop.",
    name: "Name",
    email: "Email address",
    discipline: "Your art form",
    disciplineHint: "Music, visual art, dance, spoken word…",
    help: "I would like to actively help",
    updates: "Keep me updated about Atelier 4",
    consent: "I agree to the processing of my details for this request.",
    message: "Message",
    submit: "Send",
    sending: "Sending…",
    success: "Thank you! We have received your request.",
    error: "That did not work. Check your details and try again.",
    next: "Next",
    previous: "Previous",
    contact: "Contact",
    newsletter: "Stay in the loop",
    artist: "Introduce yourself",
    registration: "Register",
    event: "Event",
    selectEvent: "Choose an event",
    unavailable: "Registration is not open yet.",
    news: "Stories",
    artists: "Artists",
    gallery: "Gallery",
    footer: "A place for young people, Jesus and art.",
    cookies: "Anonymous visitor statistics",
    analyticsText:
      "May we use OpenPanel to understand how this website is visited? Form details are never sent.",
    accept: "Allow",
    decline: "No, thanks",
    analyticsSettings: "Privacy preferences",
    notFound: "This page does not exist",
    home: "Back to the beginning",
    published: "Published",
    noResults: "No results found.",
    query: "Search term",
    required: "Required",
    back: "Back",
    artistConsent:
      "Your application is private. We only publish a profile after discussing it with you.",
    preview: "Staging · test environment",
  },
} satisfies Record<Locale, Record<string, string>>;
