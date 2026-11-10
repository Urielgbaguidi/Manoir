/**
 * Vérification bout-en-bout du sélecteur d'indicatif téléphonique (inscription).
 *
 * Prérequis : `npm run build` (le script sert le dossier `out/`).
 * Lancement : `npm run verify:countries`
 *   (avec un navigateur installé : PLAYWRIGHT_CHANNEL=msedge npm run verify:countries)
 *
 * Contrôle :
 * - le champ « Pays de résidence » et le texte d'aide ont disparu ;
 * - 245 indicatifs, codes uniques, tous nommés, indicatifs bien formés ;
 * - présence et indicatif de BJ, FR, TG, NG, HK, PR, PF, KY ;
 * - recherche de chaque pays par code, nom français et indicatif ;
 * - recherche par nom anglais pour les pays demandés ;
 * - +247, +290 et +383 : nom et drapeau affichés ;
 * - sélection (souris et clavier), largeur mobile, attributs ARIA ;
 * - payload POST /register : pays de l'indicatif et numéro international.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.VERIFY_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, baseUrl).pathname);
    let filePath = path.join(root, pathname);

    if (!filePath.startsWith(root)) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }

    let info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) {
      const cleanPath = pathname.replace(/\/$/, "");
      const htmlPath = path.join(root, cleanPath === "" ? "index.html" : `${cleanPath}.html`);
      const htmlInfo = await stat(htmlPath).catch(() => null);
      if (htmlInfo) {
        filePath = htmlPath;
        info = htmlInfo;
      }
    }

    if (!info) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    response.setHeader(
      "Content-Type",
      mimeTypes[path.extname(filePath)] || "application/octet-stream"
    );
    response.end(await readFile(filePath));
  } catch (error) {
    response.statusCode = 500;
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

// PLAYWRIGHT_CHANNEL=msedge (ou chrome) : utilise un navigateur déjà installé
// au lieu du Chromium téléchargé par `npx playwright install`.
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

// Le formulaire n'a plus de champ « Pays de résidence » : le seul sélecteur de
// pays est celui de l'indicatif téléphonique.
const trigger = page.locator('button[aria-label^="Indicatif téléphonique"]');
const search = page.locator('input[aria-label="Rechercher un indicatif"]');
const listbox = page.locator('[role="listbox"][aria-label="Indicatifs téléphoniques"]');
// Sans recherche, la liste affiche aussi des suggestions : on compte « Tous les pays ».
const allOptions = listbox.locator('[role="option"][id*="-all-"]');

const expectedCountries = [
  { code: "BJ", name: "Bénin", nameEn: "Benin", dial: "+229" },
  { code: "FR", name: "France", nameEn: "France", dial: "+33" },
  { code: "TG", name: "Togo", nameEn: "Togo", dial: "+228" },
  { code: "NG", name: "Nigéria", nameEn: "Nigeria", dial: "+234" },
  { code: "HK", name: "Hong Kong", nameEn: "Hong Kong", dial: "+852" },
  { code: "PR", name: "Porto Rico", nameEn: "Puerto Rico", dial: "+1" },
  { code: "PF", name: "Polynésie française", nameEn: "French Polynesia", dial: "+689" },
  { code: "KY", name: "Îles Caïmans", nameEn: "Cayman Islands", dial: "+1" }
];

const optionFor = (code) => listbox.locator(`[id$="-all-${code.toLowerCase()}"]`);

async function openMenu() {
  if (!(await listbox.isVisible().catch(() => false))) await trigger.click();
  await listbox.waitFor({ state: "visible" });
  await search.waitFor({ state: "visible" });
}

async function closeMenu() {
  if (await listbox.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await listbox.waitFor({ state: "hidden" });
  }
}

async function searchAndSelect(term, code, useKeyboard = false) {
  await openMenu();
  await search.fill(term);
  const option = optionFor(code);
  await option.waitFor({ state: "visible" });
  if (useKeyboard) {
    // La touche Entrée choisit le premier résultat : on s'y place d'abord.
    const index = Number(await option.getAttribute("data-index"));
    for (let step = 0; step < index; step++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  } else {
    await option.click();
  }
  await listbox.waitFor({ state: "hidden" });
}

try {
  await page.goto(`${baseUrl}/auth/register`, { waitUntil: "domcontentloaded" });
  await trigger.waitFor({ state: "visible" });
  // Laisse le temps à l'hydratation React de s'attacher aux événements.
  await page.waitForTimeout(800);

  // --- Le champ « Pays de résidence » a bien disparu ---
  assert.equal(await page.locator("#country").count(), 0, "Le champ « Pays de résidence » est toujours présent.");
  assert.equal(await page.getByText("Pays de résidence").count(), 0, "Le libellé « Pays de résidence » est toujours affiché.");
  assert.equal(
    await page.getByText("Numéro à 10 chiffres").count(),
    0,
    "Le texte d'aide sur les numéros à 10 chiffres est toujours affiché."
  );

  // --- Accessibilité de base et cible mobile ---
  assert.equal(await trigger.getAttribute("aria-haspopup"), "listbox");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  const triggerBox = await trigger.boundingBox();
  assert.ok(triggerBox, "Le sélecteur doit être visible.");
  assert.ok(triggerBox.height >= 44, "La cible tactile doit faire au moins 44 px de haut.");
  assert.ok(((await trigger.getAttribute("aria-label")) || "").includes("+229"), "Le Bénin doit être l'indicatif par défaut.");

  // --- Ouverture et inventaire complet ---
  await openMenu();
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  assert.equal(await search.getAttribute("role"), "combobox");
  assert.equal(await search.getAttribute("aria-controls"), await listbox.getAttribute("id"));

  await allOptions.first().waitFor({ state: "visible" });
  const optionCount = await allOptions.count();
  assert.equal(optionCount, 245, `245 indicatifs attendus, ${optionCount} trouvés.`);

  const countries = await allOptions.evaluateAll((elements) =>
    elements.map((element) => ({
      code: element.id.split("-all-").pop().toUpperCase(),
      name: element.querySelector("span.min-w-0")?.textContent?.trim() || "",
      dial: element.querySelector("span.tabular-nums")?.textContent?.trim() || ""
    }))
  );

  assert.equal(new Set(countries.map((country) => country.code)).size, 245, "Codes pays en doublon.");
  assert.ok(countries.every((country) => /^[A-Z]{2}$/.test(country.code)), "Code pays invalide.");
  const unnamed = countries.filter((country) => !country.name || country.name === country.code);
  assert.deepEqual(unnamed, [], `Pays sans nom : ${unnamed.map((country) => country.code).join(", ")}`);
  assert.ok(countries.every((country) => /^\+\d{1,4}$/.test(country.dial)), "Indicatif mal formé.");

  for (const expected of expectedCountries) {
    const found = countries.find((country) => country.code === expected.code);
    assert.ok(found, `${expected.code} absent du sélecteur.`);
    assert.equal(found.dial, expected.dial, `${expected.code} : indicatif ${found.dial} au lieu de ${expected.dial}.`);
  }

  const listboxBox = await listbox.boundingBox();
  assert.ok(listboxBox, "La listbox doit être visible.");
  assert.ok(listboxBox.x >= 0 && listboxBox.x + listboxBox.width <= 390, "La listbox déborde de l'écran mobile.");
  assert.ok(listboxBox.height <= 300, "La listbox doit rester compacte sur mobile.");
  const panelBox = await listbox.locator("..").boundingBox();
  assert.ok(panelBox, "Le panneau doit être visible.");
  assert.ok(panelBox.y >= 0 && panelBox.y + panelBox.height <= 844, "Le panneau doit rester dans le viewport mobile.");

  // --- Recherche de chaque pays par code, nom français et indicatif ---
  const searchFailures = await page.evaluate(async (entries) => {
    const input = document.querySelector('input[aria-label="Rechercher un indicatif"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const waitForRender = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const failures = [];

    for (const entry of entries) {
      for (const term of [entry.code, entry.name, entry.dial]) {
        setValue.call(input, term);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await waitForRender();
        if (!document.querySelector(`[id$="-all-${entry.code.toLowerCase()}"]`)) {
          failures.push(`${entry.code} introuvable avec « ${term} »`);
        }
      }
    }

    setValue.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitForRender();
    return failures;
  }, countries);
  assert.deepEqual(searchFailures, [], searchFailures.join("\n"));

  // --- Recherche par nom anglais pour les pays demandés ---
  for (const expected of expectedCountries) {
    await search.fill(expected.nameEn);
    await optionFor(expected.code).waitFor({ state: "visible" });
  }

  // --- Territoires absents de flagcdn : nom et drapeau local ---
  for (const [term, code, name] of [
    ["247", "ac", "Île de l'Ascension"],
    ["290", "ta", "Tristan da Cunha"],
    ["290", "sh", "Sainte-Hélène"],
    ["383", "xk", "Kosovo"]
  ]) {
    await search.fill(term);
    const option = optionFor(code);
    await option.waitFor({ state: "visible" });
    assert.ok(((await option.textContent()) || "").includes(name), `${code.toUpperCase()} : nom « ${name} » absent.`);
    await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await option.locator("img").elementHandle(), {
      timeout: 10000
    });
  }
  await closeMenu();

  // --- Sélection des 8 pays demandés, dont un au clavier ---
  for (const [index, expected] of expectedCountries.entries()) {
    await searchAndSelect(expected.code, expected.code, index === 2);
    const label = (await trigger.getAttribute("aria-label")) || "";
    assert.ok(label.includes(expected.name), `${expected.code} : nom non repris par le bouton.`);
    assert.ok(label.includes(expected.dial), `${expected.code} : indicatif non affiché.`);
  }

  // --- Transmission au formulaire et au backend ---
  await searchAndSelect("229", "BJ");

  await page.fill('input[name="firstName"]', "Awa");
  await page.fill('input[name="lastName"]', "Dossou");
  await page.fill('input[name="email"]', "awa@example.com");
  await page.fill("#phone", "97000000");
  await page.fill('input[name="password"]', "Password123!");
  await page.fill('input[name="password_confirmation"]', "Password123!");

  let registerPayload = null;
  await page.route("**/register", async (route) => {
    const request = route.request();
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    registerPayload = request.postDataJSON();
    await route.fulfill({
      status: 201,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        token: "test-token",
        user: {
          id: 1,
          name: "Awa Dossou",
          email: "awa@example.com",
          phone: "+229 01 97 00 00 00",
          country: "BJ",
          is_admin: false,
          is_super_admin: false,
          email_verified_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
    });
  });

  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(800);

  assert.ok(registerPayload, "La requête POST /register n'a pas été envoyée.");
  // Le pays transmis est celui de l'indicatif (l'API l'exige toujours).
  assert.equal(registerPayload.country, "BJ", "Le code pays n'est pas transmis au backend.");
  // Ancien numéro béninois à 8 chiffres : « 01 » est ajouté devant (règle
  // nationale en vigueur depuis fin 2024), puis le numéro est mis en forme.
  assert.equal(registerPayload.phone, "+229 01 97 00 00 00", "Le téléphone complet est incorrect.");
  assert.deepEqual(pageErrors, [], `Erreurs JavaScript : ${pageErrors.join(" | ")}`);

  console.log("✓ Champ « Pays de résidence » et texte d'aide retirés.");
  console.log(`✓ ${optionCount} indicatifs, codes uniques, tous nommés.`);
  console.log("✓ Recherche par code, nom français et indicatif sur toutes les entrées ; nom anglais sur 8 pays.");
  console.log("✓ +247, +290 et +383 : nom et drapeau affichés.");
  console.log("✓ Sélection BJ, FR, TG, NG, HK, PR, PF, KY (dont une au clavier).");
  console.log("✓ POST /register : country BJ, téléphone « +229 01 97 00 00 00 ».");

  // --- Panneau en feuille basse sur très petit écran ---
  const smallPage = await browser.newPage({ viewport: { width: 320, height: 480 } });
  await smallPage.goto(`${baseUrl}/auth/register`, { waitUntil: "domcontentloaded" });
  const smallTrigger = smallPage.locator('button[aria-label^="Indicatif téléphonique"]');
  await smallTrigger.waitFor();
  await smallPage.waitForTimeout(800);
  await smallTrigger.scrollIntoViewIfNeeded();
  await smallTrigger.click();

  const smallListbox = smallPage.locator('[role="listbox"][aria-label="Indicatifs téléphoniques"]');
  await smallListbox.waitFor({ state: "visible" });
  const smallPanelBox = await smallListbox.locator("..").boundingBox();
  assert.ok(smallPanelBox, "Le panneau mobile doit être visible.");
  assert.ok(
    smallPanelBox.x >= 0 && smallPanelBox.x + smallPanelBox.width <= 320,
    "Le panneau déborde horizontalement sur 320 px."
  );
  assert.ok(
    smallPanelBox.y >= 0 && smallPanelBox.y + smallPanelBox.height <= 480,
    "Le panneau déborde verticalement sur 320×480."
  );
  await smallPage.close();

  console.log("✓ Panneau en feuille basse vérifié sur 320×480.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
