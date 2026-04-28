# Sidharth Parihar // Portfolio

This is the repository for my professional portfolio and personal website. It is designed with a modern, high-end "Renaissance Edition" aesthetic, blending classical aesthetics with advanced web technologies. 

The site is built with **Node.js** and **Express** for local development and configuration, but is compiled into a completely static website for seamless, free hosting on **GitHub Pages**.

---

## 🏗️ Architecture & Structure

- **`config.json`**: The central source of truth. All text, experiences, skills, projects, and manually added data live here.
- **`index.html`**: The HTML template. It uses placeholders (like `{{HERO_LINE1}}`) that get replaced dynamically.
- **`server.js`**: The local development server. It serves the site live, provides an `/admin` interface to edit configuration, and automatically fetches your latest Goodreads data.
- **`build.js`**: The static compiler. It reads the data from `config.json`, injects it into `index.html`, and outputs a ready-to-deploy static site into the `dist/` folder.
- **`script.js` & `style.css`**: Contain all custom logic, GSAP animations, Lenis smooth scrolling, and styles.

---

## 💻 Running the Site Locally

If you want to preview your site, edit data, or trigger a Goodreads sync, you should run the site locally.

1. Open your terminal in the project directory.
2. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Start the local server:
   ```bash
   npm start
   ```
4. Open your browser and go to: **[http://localhost:8000](http://localhost:8000)**

---

## ✏️ Updating Your Data

You have two ways to update the text, projects, and experiences on your site:

### Method 1: The Admin UI (Easiest)
1. Run the site locally (`npm start`).
2. Go to **[http://localhost:8000/admin](http://localhost:8000/admin)**.
3. Use the visual dashboard to edit text, upload images, and save your changes.

### Method 2: Manual JSON Editing
1. Open `config.json` in your code editor.
2. Make your text or URL changes directly in the JSON file.
3. Save the file and refresh your browser.

> **Note on Books:** Your Goodreads books automatically sync. Every time you start the local server, `server.js` fetches your latest data from Goodreads and updates `config.json` for you.

---

## 🚀 Deploying to GitHub Pages

Once you are happy with how the site looks locally, you need to compile it and push it to the live internet.

1. Make sure you are in the project directory in your terminal.
2. Run the deployment command:
   ```bash
   npm run deploy
   ```
   
**What this command does automatically:**
1. Runs `npm run build` (which executes `build.js` to compile your latest `config.json` into the `dist/` folder).
2. Pushes the contents of the `dist/` folder directly to the `gh-pages` branch on GitHub.
3. GitHub Pages instantly serves the `gh-pages` branch at your live URL: `https://sidharthparihar.github.io/mysite/`

### Committing to the Main Branch
Don't forget to also save your actual source code changes to the `main` branch so you don't lose them!
```bash
git add .
git commit -m "Updated site data"
git push origin main
```

---

## ⚠️ Important Developer Notes

- **`server.js` vs `build.js`**: If you ever decide to add new features or change how HTML components are rendered (for example, redesigning a book card or adding a new section), you **must** update both `server.js` (so you can see it locally) AND `build.js` (so the live deployed site gets the changes).
- **Deployment Errors**: If `npm run deploy` ever fails with a git error like `error: cannot spawn sh.exe`, this is an issue with your Windows Git configuration. As a workaround, you can manually run `npm run build`, and then upload the contents of the `dist/` folder manually to the `gh-pages` branch on GitHub.com.
