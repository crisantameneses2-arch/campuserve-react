# CampuServe

Campus services portal for students, alumni and university offices: document requests, item reservations, claiming schedules, payments and notifications.

Roles: student, alumni, registrar, general office, cashier, admin. Each signs in and lands on its own dashboard.

## Stack

- React + TypeScript, built with Vite
- React Router (`BrowserRouter`)
- Firebase Authentication and Cloud Firestore
- Vercel hosting, with serverless functions in `api/`

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run lint
```

## Deployment

Deployed on Vercel. `vercel.json` rewrites every non-`/api` path to `index.html`, so refreshing a deep link such as `/student/requests` loads the app instead of returning a 404.
