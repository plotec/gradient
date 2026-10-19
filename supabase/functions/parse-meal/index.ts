// Supabase Edge Function: wandelt eine gesprochene Mahlzeit in Zutaten mit Mengen und Nährwerten um.
// Deploy:  supabase functions deploy parse-meal
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Nur angemeldete Accounts dürfen sie aufrufen (Supabase prüft das JWT standardmäßig).
import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic(); // liest ANTHROPIC_API_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Du bist ein präziser Ernährungs-Assistent für eine deutsche Kalorien-Tracking-App.
Der Nutzer beschreibt per Spracheingabe, was er gegessen hat. Die Transkription kann Hörfehler enthalten
(z. B. "Creme Fien" = Cremefine, "Krem Fresch" = Crème fraîche).

Zerlege die Beschreibung in einzelne Zutaten. Für jede Zutat:
- name: kurzer deutscher Lebensmittelname, eindeutig und mit Zustand (z. B. "Nudeln, roh", "Hackfleisch gemischt, roh", "Gouda gerieben").
- grams: die genannte Menge in Gramm (bei Flüssigkeiten ml ≈ g). Rechne Mengenangaben um:
  "halbe Packung" anhand der üblichen deutschen Packungsgröße (Cremefine 200 ml, Crème fraîche 200 g, Reibekäse 200 g,
  Hackfleisch 500 g), "Handvoll" ≈ 30 g Käse / 25 g Nüsse, "Esslöffel" ≈ 15 g, "Teelöffel" ≈ 5 g, "Scheibe Brot" ≈ 50 g, "Stück" nach typischem Gewicht.
  Nudeln und Reis ohne Hinweis auf "gekocht" gelten als Trockengewicht (roh).
- amount_note: kurz, wie die Menge zustande kam (z. B. "½ Packung à 200 ml"), leer wenn direkt in Gramm genannt.
- per100: Nährwerte je 100 g im genannten Zustand (kcal, protein, carbs, fat), realistische Durchschnittswerte für Deutschland.
  Nutze Werte aus der Liste "Eigene Lebensmittel", wenn ein Lebensmittel dort eindeutig vorkommt.
- search_term: 1–3 Wörter zum Suchen in einer deutschen Nährwertdatenbank (z. B. "Hackfleisch gemischt").
- spoken: der Teil der Eingabe, auf den sich die Zutat bezieht.

Erfinde keine Zutaten, die nicht genannt wurden (keine Öle, Gewürze o. ä. ergänzen). Ist eine Menge gar nicht genannt,
nimm eine übliche Portion an und vermerke das in amount_note.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          spoken: { type: "string" },
          name: { type: "string" },
          grams: { type: "number" },
          amount_note: { type: "string" },
          search_term: { type: "string" },
          per100: {
            type: "object",
            properties: {
              kcal: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
            required: ["kcal", "protein", "carbs", "fat"],
            additionalProperties: false,
          },
        },
        required: ["spoken", "name", "grams", "amount_note", "search_term", "per100"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  let text = "";
  let myFoods: unknown[] = [];
  try {
    const body = await req.json();
    text = String(body.text ?? "").slice(0, 2000);
    myFoods = Array.isArray(body.myFoods) ? body.myFoods.slice(0, 80) : [];
  } catch {
    return json({ error: "Ungültige Anfrage" }, 400);
  }
  if (!text.trim()) return json({ items: [] });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Eigene Lebensmittel (Nährwerte je 100 g):\n${JSON.stringify(myFoods)}\n\nEingabe:\n${text}`,
      }],
    });

    if (response.stop_reason === "refusal") return json({ error: "Anfrage abgelehnt" }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "Antwort unvollständig" }, 502);
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return json({ error: "Keine Antwort" }, 502);
    return json(JSON.parse(block.text));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Zu viele Anfragen, bitte kurz warten" }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: `KI-Fehler ${err.status ?? ""}` }, 502);
    if (err instanceof SyntaxError) return json({ error: "Antwort nicht lesbar" }, 502);
    throw err;
  }
});
