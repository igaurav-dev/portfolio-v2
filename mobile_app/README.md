# Portfolio Admin — mobile client

A Flutter app for managing the portfolio from a phone: content CRUD, the day
planner, résumé ingestion and account settings. It talks to the same
`/api/admin` surface the web panel uses.

```bash
cd mobile_app
flutter pub get
flutter run --dart-define=BASE_URL=http://10.0.2.2:8008
```

`BASE_URL` only sets the default shown on the login screen — you can type a
different server there and it is remembered.

| where you're running | address to use |
|---|---|
| Android emulator → server on your Mac | `http://10.0.2.2:8008` |
| iOS simulator → server on your Mac | `http://localhost:8008` |
| Real phone on the same Wi-Fi | `http://<your-LAN-ip>:8008` |
| Production | `https://igaurav.dev` |

For a real device against a local server, start Next on all interfaces —
`next start --port 8008 --hostname 0.0.0.0` — since the PM2 config binds to
`127.0.0.1` for production safety.

## The bit worth knowing

**The forms are not written in Dart.** On launch the app fetches
`/api/admin/schema`, which is the same `lib/admin-schema.ts` definition that
drives the web editors, and builds every form from it — text, textarea, tags,
line lists, dropdowns and repeatable object rows like project metrics or the
rejected alternatives on a decision.

Add a field on the server and it appears on the phone with no app release.

## Screens

- **Home** — server health, storage backend, what the routine says you should
  be doing right now, and record counts per collection.
- **Collections** — Profile, Projects, Decisions, Experience, Skills, Craft and
  Résumé history. Tap to edit, arrows to reorder, long-press to delete.
- **Record editor** — schema-driven, with required-field validation and a
  discard prompt if you back out mid-edit. Renaming a record's id moves it
  properly rather than leaving a duplicate.
- **Day planner** — routine blocks with time pickers and per-weekday toggles,
  a live count of derived free time, and daily check-ins that feed the streaks
  on `/day`. Overlapping blocks are rejected by the server with a readable
  message.
- **Résumé ingest** — pick a PDF, it uploads and is extracted by Claude, then
  you get the same diff the web shows (newly learned, added, changed) and pick
  which sections to write.
- **Account** — change email, name and password. Sign out.

## Auth

Login posts `{ email, password, client: "mobile" }` and gets a 30-day bearer
token back instead of a cookie. It's kept in the platform keystore via
`flutter_secure_storage` and sent as `Authorization: Bearer …`.

On launch the app calls `/api/admin/me`; an expired or revoked token drops
straight back to the login screen rather than failing later with a confusing
permission error. Any 401 mid-session does the same.

## Building

```bash
flutter build apk --release --dart-define=BASE_URL=https://igaurav.dev
flutter build ipa --release --dart-define=BASE_URL=https://igaurav.dev
```

The project ships `lib/` and `pubspec.yaml` only. Generate the platform
folders once with:

```bash
flutter create --platforms=android,ios .
```

That writes `android/` and `ios/` around the existing source without touching
it. On Android, if you point at a plain-HTTP server you will also need
`android:usesCleartextTraffic="true"` on `<application>` in
`android/app/src/main/AndroidManifest.xml` — required for local development,
not for an HTTPS production host.
