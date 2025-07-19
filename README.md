# NotionSocial Global

Global code resources for Notionsocial

## Content Architecture Refactor

This library has been refactored to separate content concerns into two distinct interfaces:

### NotionPageContent
Represents the raw content extracted from Notion pages:

```typescript
export interface NotionPageContent {
  text: string;
  paragraphs: Array<{
    media: Array<MediaType>;
    text: string;
  }>;
  title?: string;
  altText?: string;
  videoThumbnail?: Media;
  media?: Array<MediaType>;
}
```

### PlatformContent  
Represents platform-specific content structures:

```typescript
export interface PlatformContent {
  facebook: FacebookContent;
  instagram: InstagramContent;
  linkedin: LinkedInContent;
  youtube: YouTubeContent;
  tiktok: TikTokContent;
  pinterest: PinterestContent;
  threads: ThreadsContent;
  bluesky: BlueskyContent;
}
```

## Platform-Specific Captions Feature

This library supports platform-specific captions, allowing users to create different content for each social media platform from a single Notion page.

### How It Works

The system automatically detects Notion properties that contain:
- **Caption keywords**: "caption", "content", "message" 
- **Platform names**: "instagram", "twitter", "facebook", "linkedin", etc.

### Example Property Names

These Notion property names will be automatically detected:

- **Instagram Caption** → Content for Instagram
- **Twitter Content** → Content for Twitter/X  
- **Facebook Message** → Content for Facebook
- **LinkedIn Caption** → Content for LinkedIn
- **YouTube Content** → Content for YouTube
- **TikTok Caption** → Content for TikTok
- **Pinterest Message** → Content for Pinterest
- **Threads Content** → Content for Threads

### Platform Detection

The system recognizes these platform variations:

- **Twitter**: "twitter", "tweet", "tweets", "tw"
- **X**: "x"
- **Facebook**: "facebook", "fb", "meta"
- **Instagram**: "instagram", "ig", "insta"
- **LinkedIn**: "linkedin", "li"
- **YouTube**: "youtube", "yt"
- **TikTok**: "tiktok", "tik tok", "tik", "tt"
- **Pinterest**: "pinterest", "pin"
- **Threads**: "threads", "meta threads", "th"
- **Bluesky**: "bluesky", "bsky"

### Implementation Details

1. **Content Extraction**: `getNotionPageContent()` extracts raw content from Notion
2. **Platform Caption Detection**: `extractPlatformCaptions()` automatically detects and extracts platform-specific captions from Notion properties
3. **Platform Processing**: `processContentForSocialPlatforms()` handles platform-specific text
4. **Publishing**: Each platform receives appropriate content structure during publishing
5. **Fallback**: Uses general caption/content if no platform-specific content exists

### Platform Caption Extraction

The `extractPlatformCaptions()` function automatically scans Notion page properties to find platform-specific captions:

```typescript
import { extractPlatformCaptions } from '@pulbyte/notionsocial-global';

// Extract platform captions from Notion properties
const platformCaptions = extractPlatformCaptions(notionPageProperties, customCaptionPropName);

// Result example:
// {
//   instagram: "Instagram-specific caption",
//   facebook: "Facebook-specific message", 
//   linkedin: "LinkedIn professional content"
// }
```

**Supported Property Types:**
- `rich_text`: Standard Notion text properties
- `formula`: Notion formula properties that return strings

**Detection Logic:**
1. Scans all properties for caption-related keywords: "caption", "content", "message"
2. Detects platform names within property names using `detectSocialPlatforms()`
3. Extracts text content from supported property types
4. Returns a map of platform names to their specific captions

### Content Processing Flow

```typescript
// 1. Extract raw content from Notion
const [notionContent, blocks] = await getNotionPageContent(config);

// 2. Transform to platform-specific content using new functions
import {
  getFacebookContent,
  getInstagramContent,
  getXContent,
  getLinkedInContent,
  getYouTubeContent,
  getTikTokContent,
  getPinterestContent,
  getThreadsContent,
  getBlueskyContent,
  processLinkedInContent,
  validatePlatformContent
} from '@pulbyte/notionsocial-global';

// Transform for each platform
const facebookContent = getFacebookContent(notionContent);
const instagramContent = getInstagramContent(notionContent);
const twitterContent = getXContent(notionContent, allowLongPosts);
const linkedinContent = getLinkedInContent(notionContent);
const youtubeContent = getYouTubeContent(notionContent);
const tiktokContent = getTikTokContent(notionContent);
const pinterestContent = getPinterestContent(notionContent);
const threadsContent = getThreadsContent(notionContent);
const blueskyContent = getBlueskyContent(notionContent);

// Process LinkedIn content for quote/reply extraction
const { content, quotePostId, replyToPostId } = processLinkedInContent(linkedinContent);

// Validate content before publishing
const isValid = validatePlatformContent(facebookContent, 'facebook');
```

**Platform Content Types:**
- **Array-based**: Twitter, Threads, Bluesky (support threading/multi-post content)
- **Object-based**: Facebook, Instagram, LinkedIn, YouTube, TikTok, Pinterest (structured content with metadata)

## Platform Content Transformation Functions

The library provides dedicated functions to transform `NotionPageContent` into platform-specific content formats:

### Available Functions

| Function | Platform | Return Type | Description |
|----------|----------|-------------|-------------|
| `getFacebookContent()` | Facebook | `FacebookContent` | Transforms content for Facebook posts with CTA support |
| `getInstagramContent()` | Instagram | `InstagramContent` | Handles Instagram posts, reels, carousels, and stories |
| `getXContent()` | X/Twitter | `XContent` | Supports single tweets, threads, and long-form posts |
| `getLinkedInContent()` | LinkedIn | `LinkedInContent` | Professional content with article support |
| `getYouTubeContent()` | YouTube | `YouTubeContent` | Video content with title, description, and thumbnails |
| `getTikTokContent()` | TikTok | `TikTokContent` | Short-form video content |
| `getPinterestContent()` | Pinterest | `PinterestContent` | Image-focused content with descriptions |
| `getThreadsContent()` | Threads | `ThreadsContent` | Thread-based content similar to Twitter |
| `getBlueskyContent()` | Bluesky | `BlueskyContent` | Decentralized social media content |

### Utility Functions

| Function | Purpose | Description |
|----------|---------|-------------|
| `processLinkedInContent()` | LinkedIn | Extracts quote/reply information from LinkedIn URLs |
| `validatePlatformContent()` | All platforms | Validates content meets platform requirements |
| `selectVideoThumbnail()` | All platforms | Intelligently selects video thumbnails based on configuration or falls back to first image |
| `determineFacebookPostType()` | Facebook | Determines the appropriate post type (story, reel, video, carousel, image, text) based on rules and media content |
| `determineInstagramPostType()` | Instagram | Determines the appropriate post type (reel, story, carousel, image) based on rules and media content |

### Content Processing Features

- **Smart Media Handling**: Automatically filters media types based on platform support
- **Intelligent Video Thumbnail Selection**: Selects appropriate thumbnails based on configuration or falls back to first image
- **Text Processing**: Applies platform-specific text transformations (line breaks, character limits)
- **Thread Creation**: Intelligently splits long content into threads for Twitter/Threads/Bluesky
- **Post Type Detection**: Intelligently determines post types (reel, story, carousel, video, image, text) for platforms like Instagram and Facebook based on rules, configuration, and media content
- **LinkedIn URL Processing**: Extracts quote and reply information from LinkedIn post URLs
- **Content Validation**: Ensures content meets platform requirements before publishing

### Example Usage

```typescript
import { getFacebookContent, getInstagramContent, validatePlatformContent } from '@pulbyte/notionsocial-global';

// Transform Notion content for Facebook
const facebookContent = getFacebookContent(notionPageContent);
// Result: { text: "processed text", media: [...], altText: "...", ... }

// Transform for Instagram with automatic type detection
const instagramContent = getInstagramContent(notionPageContent);
// Result: { caption: "...", media: [...], type: "carousel", ... }

// Validate content before publishing
const isValidForFacebook = validatePlatformContent(facebookContent, 'facebook');
const isValidForInstagram = validatePlatformContent(instagramContent, 'instagram');
```

### Backward Compatibility

- ✅ Existing single caption approach continues to work
- ✅ Platform-specific captions take precedence when available
- ✅ No breaking changes to existing functionality
- ✅ Gradual migration path from old `Content` to new `NotionPageContent`

## Build and Development

```bash
npm run build        # Build the library
npm start           # Development mode with watch
npm test            # Run tests
```

## Utility Functions

### safeStringify

A safe way to stringify objects that may contain circular references, Buffer objects, or TypedArrays.

```typescript
import { safeStringify } from '@pulbyte/notionsocial-global';

const obj = {
  name: "test",
  buffer: Buffer.from("hello"),
  nested: { arr: new Uint8Array([1, 2, 3]) }
};

console.log(safeStringify(obj));
// Output:
// {
//   "name": "test",
//   "buffer": "[Buffer: 5 bytes]",
//   "nested": {
//     "arr": "[TypedArray: 3 elements]"
//   }
// }
```

### prettyLog

A colored console logging utility that makes debugging objects easier by applying color coding to different types.

```typescript
import { prettyLog } from '@pulbyte/notionsocial-global';

// Basic usage
prettyLog(myObject);

// With a label
prettyLog(myObject, "My Object Label");

// With string truncation (for long strings)
prettyLog(myObject, "Truncated Strings", 50);
```

Color coding:
- **White**: Object keys (default color)
- **Green**: Strings
- **Cyan**: Numbers
- **Yellow**: Booleans
- **Gray**: null, undefined, empty objects/arrays, circular references
- **Blue**: Special values like [Buffer], [TypedArray], etc.

This function is particularly useful for debugging complex objects with nested structures, binary data, or circular references. 