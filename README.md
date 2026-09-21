# Education Forum

Education-first Expo / React Native application for iOS, Android, and web. Forest green, warm ivory, and sage visual identity. The supplied specification is preserved in [docs/product-specification.md](docs/product-specification.md).

**Status: functional development preview with a backend migration, not a production-complete release.** The implementation does not process real money. See [release readiness](docs/RELEASE_READINESS.md) for explicit gaps.

## Run

Requires Node 22+ and npm.

```sh
npm ci
npm run web
# Or use a device / simulator
npm start
npm run ios
npm run android
```

With no environment variables, the app runs in clearly labelled preview mode. Sample books are original short educational excerpts, not licensed full textbooks. Bookmarks, submissions, moderation decisions and introductory language progress persist locally. Open Account → Explore admin preview to test moderation and configuration. Demo admin access never grants backend privileges.

```sh
npm run typecheck
npm test
npm run build:web
npm run test:database
# Serve dist on port 8080, then run with installed Chrome:
npm run test:browser
```

## Connect Supabase

1. Create a Supabase project and run `supabase/migrations/001_platform.sql` against a **fresh** database. The migration passed local PGlite integration tests with auth/storage stubs; validation against a deployed Supabase instance is still required.
2. Copy `.env.example` to `.env` and provide the project URL and public anon key. Never put a service role key in the mobile application.
3. Configure email confirmation, email delivery, authentication redirect URLs, and password recovery in Supabase.
4. Register a user in the app. Assign the first owner from a trusted database console: `update public.profiles set role = 'owner' where id = '<your-auth-user-uuid>';`. No client can assign roles to itself.
5. Restart Expo. Real mode has no sample content. Register, sign in, upload a PDF, review it as an owner, and read it as another user.

All user submissions start `pending`. Only an audited administrator RPC can publish or remove them. The private storage bucket uses short-lived signed URLs. Assistance and idea documents remain private even when their public descriptions are approved. Application descriptions should contain only information suitable for eventual publication.

## Structure

- `App.tsx`: responsive app shell, discovery, reader, submissions, authentication, introductory language lessons, moderation, and account screens.
- `src/Management.tsx`: plan administration, feature configuration, earnings rates, user suspension, reports, and audit display.
- `src/domain.ts`: types, publication validation, sample excerpts, and configurable earnings calculation helper.
- `src/backend.ts`: environment-gated Supabase client.
- `supabase/migrations/001_platform.sql`: tables, RLS, audited admin functions, and private storage policies.
- `docs/RELEASE_READINESS.md`: feature coverage and deployment work still required.

## Native builds

`app.json` and `eas.json` include development, preview, and production build profiles. Before building, choose your final bundle identifiers, configure an EAS project and signing credentials, create original app icons and splash assets, and add actual store metadata. A development build requires installing `expo-dev-client` first. Store submission is not configured or performed by this repository.

```sh
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform all
```

Reference documentation: [Expo builds](https://docs.expo.dev/build/setup/), [Supabase React Native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Apple in-app purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases).
