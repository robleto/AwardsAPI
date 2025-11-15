# Deployment Documentation

## Overview

This directory contains all deployment and infrastructure documentation for the Game Awards API.

## Documentation Files

### Core Deployment
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Main deployment guide for Netlify + Neon
- **[DEPLOYMENT-READY.md](DEPLOYMENT-READY.md)** - Production readiness checklist

### Platform-Specific Guides
- **[NETLIFY-DEPLOYMENT.md](NETLIFY-DEPLOYMENT.md)** - Netlify Functions setup
- **[NEON-DEPLOYMENT-SHORT.md](NEON-DEPLOYMENT-SHORT.md)** - Quick Neon setup
- **[NEON-CONNECTION-GUIDE.md](NEON-CONNECTION-GUIDE.md)** - Detailed Neon configuration

### Migration & Integration
- **[NEON-MIGRATION.md](NEON-MIGRATION.md)** - Migrating from Supabase to Neon
- **[STRIPE-SETUP.md](STRIPE-SETUP.md)** - Payment integration setup

## Quick Deployment Steps

1. **Database**: Set up Neon PostgreSQL
2. **Functions**: Deploy to Netlify Functions
3. **Environment**: Configure environment variables
4. **Payments**: Set up Stripe (optional)
5. **DNS**: Configure custom domain (optional)

## Architecture

```
Frontend (Static) → Netlify CDN
API Requests → Netlify Functions → Neon PostgreSQL
Payments → Stripe Webhooks → Database
```

## Environment Variables Required

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete list of required environment variables.

## Support

For deployment issues, see the troubleshooting sections in each guide or contact support@awardsapi.com.
