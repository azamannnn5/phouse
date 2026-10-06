THE P HOUSE: SETUP

Static HTML, CSS and JavaScript plus four small Netlify Functions in netlify/functions.
Deploy the whole folder to Netlify (netlify.toml is included). There is no build step and no npm install.

1. Database
   Supabase > SQL Editor > paste setup.sql > Run. (Safe to run again.)

2. Environment variables (Netlify > Site configuration > Environment variables)
   ADMIN_PASSWORD        the password you type at /admin.html
   SUPABASE_URL          your project URL
   SUPABASE_ANON_KEY     public key, used for reading content
   SUPABASE_SECRET_KEY   secret key, used only by the functions to save content and pictures
   These stay on the server. They are never in the website files.
   After adding or changing variables, redeploy.

3. Sign in at yoursite.com/admin.html with ADMIN_PASSWORD.
   The first save publishes your content to the database. Until then the site shows the starter content.
   Sessions last 12 hours. To change the password, edit ADMIN_PASSWORD and redeploy.

Notes
   - There is no link to admin.html on the site.
   - Pictures you upload are resized in the browser and stored in the "media" bucket.
   - Settings > Backup lets you export, import or reset all content.
   - Opened without the functions (for example from a plain file server), admin runs in test mode:
     changes stay in your browser only and the password is admin123.
