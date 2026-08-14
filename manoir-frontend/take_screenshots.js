const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  
  // Set viewport to a typical desktop size
  await page.setViewportSize({ width: 1280, height: 800 });

  const outputDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  try {
    // 1. Page d'Accueil
    console.log("Prendre la capture de l'Accueil...");
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    
    // Force light theme
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    
    // Wait a bit for animations/images
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, '1_accueil.png'), fullPage: true });
    
    // 2. Catalogue des Appartements
    console.log("Prendre la capture du Catalogue...");
    await page.goto('http://localhost:3000/rooms');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, '2_catalogue.png'), fullPage: true });

    // 3. Page de Connexion
    console.log("Prendre la capture de Connexion...");
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, '3_connexion.png'), fullPage: true });

    // 4. Espace Client
    console.log("Connexion au compte client...");
    await page.fill('input[type="email"]', 'client@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/espace-client**');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log("Prendre la capture de l'Espace Client...");
    await page.screenshot({ path: path.join(outputDir, '4_espace_client.png'), fullPage: true });

    // Logout
    console.log("Deconnexion...");
    // Assuming there is a logout button, or we can just clear cookies.
    await page.context().clearCookies();

    // 5. Back-office
    console.log("Connexion au compte admin...");
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'admin@manoir.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Sometimes it redirects to /admin or we have to go there manually
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log("Prendre la capture du Back-office...");
    await page.screenshot({ path: path.join(outputDir, '5_backoffice.png'), fullPage: true });

  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    await browser.close();
    console.log("Terminé. Captures sauvegardées dans:", outputDir);
  }
})();
