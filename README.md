This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Vercel auto-deploy troubleshooting (important)

If your latest commit is not auto-deploying on Vercel, check these in order:

1. **Project is linked to the correct Git repository**
   - Vercel Dashboard → your project → **Settings → Git**
   - Confirm repository + branch are correct.

2. **Auto-deploy is enabled for your branch**
   - In the same Git settings page, ensure deployments are enabled for pushes/PRs.

3. **Required environment variables are set in Vercel**
   - Add these in **Settings → Environment Variables** for the environments you use (Preview + Production):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - Any Gemini / Notion keys your APIs use
   - Missing Supabase values can cause build failures.

4. **Check deployment logs**
   - Vercel Dashboard → Deployments → open failed deploy → inspect logs.
   - Run locally before pushing:

```bash
npm run build
```

5. **Redeploy after fixing settings**
   - Once env vars/settings are fixed, trigger a new deploy from Vercel UI or push a new commit.
