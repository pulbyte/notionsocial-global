# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Build the library using tsup (creates CommonJS, ESM, and browser builds)
- `npm start` - Development mode with watch (uses tsup --watch)
- `npm run prepare` - Runs build (used by npm lifecycle)
- `npm run prepublishOnly` - Runs build before publishing

### Testing
- `npm test` - Run all Jest tests
- `npm run test:text` - Run text-specific tests only (`jest tests/text.test.ts`)
- `npm run test:media` - Run media-specific tests only (`jest tests/media.test.ts`)

### Package Management
- `npm run ig` - Install latest @pulbyte/social-stack-lib from GitHub packages
- `npm run il` - Install local development version of social-stack-lib

## Architecture Overview

This is a TypeScript library (`@pulbyte/notionsocial-global`) that provides global utilities for the NotionSocial application. The library is built with dual entry points:

### Dual Build System
- **Node.js Build** (`src/index.ts`): Full functionality for server-side use
- **Browser Build** (`src/browser.ts`): Browser-compatible subset with external dependencies excluded

### Core Architecture Components

#### Content Processing Pipeline
1. **Notion Content Extraction** (`src/content.ts`, `src/_content.ts`):
   - Extracts raw content from Notion pages via API
   - Processes Notion blocks into structured content
   - Handles rich text, media, and metadata extraction

2. **Platform Content Transformation** (`src/content.ts`):
   - Transforms `NotionPageContent` into platform-specific formats
   - Platform-specific functions: `getFacebookContent()`, `getInstagramContent()`, `getXContent()`, etc.
   - Handles platform constraints (character limits, media types, post types)

3. **Media Processing** (`src/media.ts`, `src/_media.ts`):
   - Downloads and processes media from Notion
   - Handles transformations, compressions, and optimizations
   - Supports multiple media sources (Buffer, URL, GCP bucket, Mux)

#### Key Data Structures
- **`NotionPageContent`**: Raw content extracted from Notion pages
- **`PlatformContent`**: Platform-specific content structures for all supported social platforms
- **`MediaType`**: Union type for different media representations (Media, MediaFile, TransformedMedia)

#### Publishing System (`src/publish.ts`, `src/_publish.ts`)
- Coordinates multi-platform publishing
- Handles scheduling, error handling, and retry logic
- Tracks publish status and metrics

#### Platform Support
Supports 9+ social platforms with dedicated content types:
- Facebook, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Threads, Bluesky, Google My Business

#### Utility Modules
- **`src/text.ts`**: Text processing, sanitization, and platform-specific formatting
- **`src/parser.ts`**: Content parsing and validation
- **`src/notion.ts`**: Notion API utilities and helpers
- **`src/crypto.ts`**: Encryption utilities for secure token storage
- **`src/logging.ts`**: Includes `safeStringify()` and `prettyLog()` utilities for debugging

## Key Features

### Platform-Specific Captions
The library automatically detects Notion properties containing:
- Caption keywords: "caption", "content", "message"
- Platform names: "instagram", "twitter", "facebook", "linkedin", etc.

Use `extractPlatformCaptions()` to automatically extract platform-specific content from Notion properties.

### Content Transformation
Each platform has dedicated transformation functions that handle:
- Media filtering based on platform support
- Text processing and character limits
- Thread creation for Twitter/Threads/Bluesky
- Post type detection (reel, story, carousel, etc.)

### Publishing Configuration
The system supports extensive configuration through `NotionDatabase` interface including:
- Property mappings for different content types
- Publishing rules and content filtering
- Media processing options
- Platform-specific settings

## Development Notes

- Uses TypeScript with strict type checking
- Jest for testing with ts-jest preset
- External dependency: `@pulbyte/social-stack-lib` (platform integrations)
- Publishes to GitHub Packages registry
- Browser build excludes Node.js-specific modules (net, http, https, dns)