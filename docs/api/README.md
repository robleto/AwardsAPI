# API Documentation

## Overview

The Game Awards API provides RESTful access to comprehensive board game awards data. This directory contains detailed API documentation.

## Quick Links

- **[Endpoints Reference](endpoints.md)** - Complete API endpoint documentation
- **[Authentication](authentication.md)** - API key setup and usage
- **[Rate Limits](rate-limits.md)** - Usage quotas and limits
- **[Examples](examples.md)** - Code samples and use cases

## Base URL

```
Production: https://gameawards.netlify.app/api/
Local Dev: http://localhost:3000/api/
```

## Quick Start

1. [Get your API key](../../public/apikey.html)
2. Make your first request:
   ```bash
   curl "https://gameawards.netlify.app/api/?s=wingspan&apikey=your_key"
   ```

## Response Format

All responses are in JSON format with consistent structure:

```json
{
  "Response": "True",
  "awards": [...],
  "total": 1,
  "remaining_daily": 999,
  "remaining_monthly": 4999
}
```

## Support

- 📧 API Issues: support@awardsapi.com
