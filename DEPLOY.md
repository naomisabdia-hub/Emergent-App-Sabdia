# Sabdia Equipment App — Go Live Guide

## What you need to create (3 free accounts)

---

## STEP 1 — MongoDB Atlas (database)

1. Go to https://mongodb.com/atlas → sign up free
2. Create a free cluster → choose **AWS / Sydney**
3. **Database Access** → Add user:
   - Username: `sabdia`
   - Password: autogenerate → copy it
4. **Network Access** → Add IP → **Allow Access from Anywhere**
5. **Clusters** → Connect → Drivers → copy the connection string:
   ```
   mongodb+srv://sabdia:<password>@cluster0.xxxxx.mongodb.net/
   ```
   Replace `<password>` with your actual password.

---

## STEP 2 — Railway (backend server)

1. Go to https://railway.app → sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `Emergent-App-Sabdia-main` repo
   (you'll need to push it to GitHub first — see note below)
4. Once deployed, go to **Variables** and add these:
   ```
   MONGO_URL      = mongodb+srv://sabdia:<password>@cluster0.xxxxx.mongodb.net/
   DB_NAME        = sabdia_equipment
   JWT_SECRET     = pick-a-long-random-string-here
   ADMIN_EMAIL    = naomi@sabdia.com.au
   ADMIN_PASSWORD = Admin123!
   ```
5. Railway will give you a URL like:
   ```
   https://emergent-app-sabdia-production.up.railway.app
   ```
   Copy this — you'll need it in Step 3.

### Push to GitHub (needed for Railway)
In Terminal, from your project folder:
```bash
git init
git add .
git commit -m "Initial commit"
```
Then create a new repo at https://github.com/new (name: `sabdia-equipment`)
and follow the "push existing repo" commands GitHub shows you.

---

## STEP 3 — Update frontend with live backend URL

Open `frontend/.env` and replace the URL:
```
EXPO_PUBLIC_BACKEND_URL=https://your-railway-url.up.railway.app
```

---

## STEP 4 — Publish to Expo (team access via Expo Go)

1. Create a free Expo account at https://expo.dev
2. In Terminal:
```bash
cd ~/Downloads/Emergent-App-Sabdia-main/frontend
npm install -g eas-cli
eas login
eas update --branch production --message "Initial release"
```
3. This gives you a URL and QR code.

---

## STEP 5 — Share with team

Send the team:
1. Download **Expo Go** from the App Store or Google Play
2. Open this link on their phone: `exp.host/@your-expo-username/sabdia-equipment`

Done — app works on any iPhone or Android, no app store needed.

---

## Login credentials
- Admin: naomi@sabdia.com.au / Admin123!
- Team member: johnny@sabdia.com / Team123!
- Add more users from the app under More → Users
